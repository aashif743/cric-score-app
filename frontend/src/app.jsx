import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from "react-router-dom";
import styled from 'styled-components';

// Page and Component Imports
import MatchSetup from "./pages/MatchSetup";
import ScorecardPage from "./pages/ScoreCard";
import FullScorecardPage from "./pages/FullScorecard";
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Header from './components/Header';
import BottomNav from './components/BottomNav'; // New Component
import PastMatches from './pages/PastMatches';
import ProfilePage from './pages/ProfilePage'; 
import PointsSystem from './pages/PointsSystem';
import { AuthProvider, AuthContext } from './context/AuthContext.jsx';

// --- Placeholder Components for Future Features ---
const PlaceholderContainer = styled.div`
  padding: 3rem 1.5rem;
  text-align: center;
  color: #4a5568;
  h2 {
    font-size: 2rem;
    font-weight: 700;
    color: #2d3748;
    margin-bottom: 1rem;
  }
  p {
    font-size: 1.1rem;
  }
`;


// This is the main content component that handles all the routing and state logic.
function AppContent() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [matchSettings, setMatchSettings] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // This ref is used to correctly handle guest sessions vs. user logouts.
  const prevUser = useRef(user);

  // Effect to handle window resizing for responsive components
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  useEffect(() => {
    // If a user is logged in, check if they have a match to resume.
    if (user) {
      const savedMatch = localStorage.getItem("currentMatch");
      if (savedMatch) {
        try {
          const parsedMatch = JSON.parse(savedMatch);
          if (parsedMatch.settings && parsedMatch.settings.matchId) {
            setMatchSettings(parsedMatch.settings);
            navigate('/scorecard', { replace: true });
          } else {
            localStorage.removeItem("currentMatch");
          }
        } catch (e) {
          console.error("Failed to parse saved match from localStorage", e);
          localStorage.removeItem("currentMatch");
        }
      }
    }
    // If a user has just logged out, clear any active match state.
    else if (prevUser.current && !user) {
      setMatchSettings(null);
      localStorage.removeItem("currentMatch");
    }
    // Update the ref for the next render.
    prevUser.current = user;
  }, [user, navigate]);




// This function is called from MatchSetup to begin a match.
  const handleStartMatch = (settingsFromSetup) => {
    // settingsFromSetup is the full match object returned from your server
    const matchId = settingsFromSetup._id;

    // 1. Pass the FULL match object to the ScorecardPage component directly.
    // This allows the match to start instantly with all the correct data.
    setMatchSettings(settingsFromSetup);
    
    // 2. Save ONLY a minimal object with the ID to localStorage.
    // This is just for resuming the session if the user reloads the browser.
    // This small object will NEVER exceed the storage quota.
    const sessionData = {
      settings: {
        _id: matchId,
        matchId: matchId // Include both for compatibility
      }
    };
    localStorage.setItem("currentMatch", JSON.stringify(sessionData));
    
    // 3. Navigate to the scorecard.
    navigate('/scorecard');
};




const handleMatchEnd = useCallback((finalMatchData) => {
  console.log("handleMatchEnd triggered.");

  if (!finalMatchData || !finalMatchData._id) {
    console.error("Match end error: Received invalid data.", finalMatchData);
    alert("An error occurred while finishing the match.");
    navigate('/dashboard');
    return;
  }
  
  const matchId = finalMatchData._id;
  console.log(`Navigating to Full Scorecard for match ID: ${matchId}`);
  
  // ✅ FIX: Navigate to the new page FIRST.
  navigate(`/full-scorecard/${matchId}`, {
    state: { 
      matchData: finalMatchData,
      fromMatchEnd: true
    }
    // Note: 'replace: true' was removed as it might not be desired here.
    // You typically want the full scorecard to be a new page in history.
  });

  // THEN, clean up the state. This will no longer interfere.
  setMatchSettings(null);
  localStorage.removeItem("currentMatch");

}, [navigate]);



  // This function handles when a user exits a match without finishing.
  const handleExitMatch = () => {
    // Remove the flag that tells the app a match is active on reload.
    // This prevents the app from automatically navigating you back to the scorecard.
    localStorage.removeItem("currentMatch");
    
    // Clear the active match settings from the app's state.
    // This will cause the router to unmount the ScorecardPage component.
    setMatchSettings(null);

    // Explicitly navigate the user to the dashboard.
    navigate(user ? '/dashboard' : '/');
  };

// In app.jsx

const handleResumeMatch = (matchToResume) => {
    if (!matchToResume?._id) {
        console.error("Cannot resume match: Invalid match data provided.");
        return;
    }
    
    // 1. Create a minimal "lean" settings object with just the ID.
    const leanMatchSettings = {
        _id: matchToResume._id,
        matchId: matchToResume._id, // Include for compatibility
    };

    // 2. Set the lean settings in the app state. This tells ScorecardPage it needs to fetch full data.
    setMatchSettings(leanMatchSettings);
    
    // 3. Save the minimal session data to localStorage to handle page reloads.
    localStorage.setItem("currentMatch", JSON.stringify({ settings: leanMatchSettings }));
    
    // 4. Navigate to the scorecard page.
    navigate('/scorecard');
};


  // --- Conditional Rendering Logic for Navigation ---
  const pathsWithoutNav = ['/scorecard', '/full-scorecard', '/'];
  const isNavHidden = pathsWithoutNav.some(path => location.pathname.startsWith(path) && path !== '/');
  
  // Corrected code
const showBottomNav = !isNavHidden && location.pathname !== '/auth';
const showHeader = !showBottomNav && location.pathname !== '/'; // Now this will work


  return (
    <>
      {showHeader && <Header />}
      <main style={{ paddingBottom: showBottomNav ? '80px' : '0' }}>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={!user ? <AuthPage /> : <Navigate to="/dashboard" />} />
          <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" />} />
          <Route path="/match-setup" element={<MatchSetup onStartMatch={handleStartMatch} />} />
          <Route path="/full-scorecard/:matchIdParam" element={<FullScorecardPage />} />

          {/* --- Protected Routes (Require Login) --- */}
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
          <Route path="/past-matches" element={user ? <PastMatches onResumeMatch={handleResumeMatch} /> : <Navigate to="/auth" />} />
          
          {/* --- New Routes for Future Features --- */}
          <Route path="/points-system" element={user ? <PointsSystem /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/auth" />} />


          {/* --- Dynamic Route (Works for Guests & Users) --- */}
          <Route
            path="/scorecard"
            element={
              matchSettings ? (
                <ScorecardPage
                  matchSettings={matchSettings}
                  onMatchEnd={handleMatchEnd}
                  onExitMatch={handleExitMatch}
                  key={matchSettings.matchId}
                />
              ) : (
                null
              )
            }
          />

          {/* Fallback route for any other path */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showBottomNav && <BottomNav />}
    </>
  );
}

// The main App component wraps everything in the necessary providers.
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
