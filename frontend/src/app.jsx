import React, { useState, useEffect, useContext, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from "react-router-dom";

// Page and Component Imports
import MatchSetup from "./pages/MatchSetup";
import ScorecardPage from "./pages/ScoreCard"; 
import FullScorecardPage from "./pages/FullScorecard"; 
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Header from './components/Header';
import PastMatches from './pages/PastMatches';
import { AuthProvider, AuthContext } from './context/AuthContext.jsx';

// This is the main content component that handles all the routing and state logic.
function AppContent() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [matchSettings, setMatchSettings] = useState(null);
  
  // This ref is used to correctly handle guest sessions vs. user logouts.
  const prevUser = useRef(user);

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
    const newMatchSettings = {
      ...settingsFromSetup,
      matchId: settingsFromSetup._id,
      createdAt: new Date().toISOString(),
    };
    setMatchSettings(newMatchSettings);
    localStorage.setItem("currentMatch", JSON.stringify({ settings: newMatchSettings }));
    navigate('/scorecard');
  };

  // In app.jsx

const handleMatchEnd = (finalMatchData) => {
  const matchId = finalMatchData?._id;

  if (!matchId) {
    console.error("Match ended without a valid ID.");
    navigate(user ? '/dashboard' : '/');
    return;
  }
  
  // 1. Navigate to the full scorecard page with the final data.
  navigate(`/full-scorecard/${matchId}`, {
    state: { matchData: finalMatchData }
  });

  // 2. Perform cleanup that DOES NOT trigger a re-render redirect.
  //    The 'currentMatch' is what would resume the match, so removing it is key.
  localStorage.removeItem("currentMatch");
  localStorage.removeItem(`matchState_${matchId}`);
  
  // 3. DO NOT setMatchSettings(null) here. This is the fix.
  //    The state will be naturally cleared when the user starts a new match
  //    or exits via the dashboard.
};
  
  // This function handles when a user exits a match without finishing.
  const handleExitMatch = () => {
    const matchId = matchSettings?._id;
    
    localStorage.removeItem("currentMatch");
    setMatchSettings(null);
    navigate(user ? '/dashboard' : '/');
  };

  const handleResumeMatch = (matchToResume) => {
    if (!matchToResume?._id) {
      console.error("Cannot resume match: Invalid match data provided.");
      return;
    }
    
    // Retrieve the detailed, live state of the match from localStorage
    const savedMatchStateRaw = localStorage.getItem(`matchState_${matchToResume._id}`);
    
    if (savedMatchStateRaw) {
      try {
        const parsedState = JSON.parse(savedMatchStateRaw);
        
        // Set this as the active match state
        setMatchSettings(parsedState.settings);
        
        // Also update the 'currentMatch' so it persists on refresh
        localStorage.setItem("currentMatch", JSON.stringify({ settings: parsedState.settings }));
        
        // Navigate to the live scorecard to continue the match
        navigate('/scorecard');
        
      } catch (e) {
        console.error("Failed to parse saved match state for resumption.", e);
        // Fallback: If parsing fails, remove the broken item
        localStorage.removeItem(`matchState_${matchToResume._id}`);
      }
    } else {
      console.error("Could not find saved state for this match to resume it.");
      alert("Error: Could not find the saved data to resume this match.");
    }
  };

  // Conditionally show the header on all pages except the landing and auth pages.
  const showHeader = location.pathname !== '/';

  return (
    <>
      {showHeader && <Header />}
      <main style={showHeader ? { padding: '1rem' } : {}}>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={!user ? <AuthPage /> : <Navigate to="/dashboard" />} />
          <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" />} />
          <Route path="/match-setup" element={<MatchSetup onStartMatch={handleStartMatch} />} />
          {/* The FullScorecardPage route is now public to allow guests to view their finished match */}
          <Route path="/full-scorecard/:matchIdParam" element={<FullScorecardPage />} />

          {/* --- Protected Routes (Require Login) --- */}
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
          
          <Route 
          path="/past-matches" 
          element={user ? <PastMatches onResumeMatch={handleResumeMatch} /> : <Navigate to="/auth" />} 
        />

          {/* --- Dynamic Route (Works for Guests & Users) --- */}
          <Route
            path="/scorecard"
            element={
              matchSettings ? (
                <ScorecardPage
                  matchSettings={matchSettings}
                  onMatchEnd={handleMatchEnd} // Use the new handler
                  onExitMatch={handleExitMatch} // Use the exit handler
                  key={matchSettings.matchId} 
                />
              ) : (
                <Navigate to={user ? "/dashboard" : "/"} replace />
              )
            }
          />

          {/* Fallback route for any other path */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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
