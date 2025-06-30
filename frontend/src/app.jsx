import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";

import MatchSetup from "./pages/MatchSetup";
import ScorecardPage from "./pages/ScoreCard"; 
import FullScorecardPage from "./pages/FullScorecard"; 


function AppContent() { // Renamed to AppContent if Router is outside
  const [matchSettings, setMatchSettings] = useState(null);
  const [matchData, setMatchData] = useState(null); // For completed match data
  const [matchStarted, setMatchStarted] = useState(false);
  const navigate = useNavigate(); // useNavigate hook

  useEffect(() => {
    const savedMatch = localStorage.getItem("currentMatch");
    const savedMatchId = localStorage.getItem("currentMatchId"); // Legacy check
    if (savedMatch) {
      try {
        const parsedMatch = JSON.parse(savedMatch);
        if(parsedMatch.settings && parsedMatch.settings.matchId){ // Check if it's a valid settings object
            setMatchSettings(parsedMatch.settings);
            setMatchStarted(true);
            console.log("Resuming match with settings:", parsedMatch.settings);
        } else {
            localStorage.removeItem("currentMatch");
            localStorage.removeItem("currentMatchId");
        }
      } catch (e) {
        console.error("Failed to parse saved match from localStorage", e);
        localStorage.removeItem("currentMatch");
        localStorage.removeItem("currentMatchId");
      }
    } else if (savedMatchId) {
        localStorage.removeItem("currentMatchId");
    }
  }, []);

  const handleStartMatch = (settingsFromSetup) => {
    if (!settingsFromSetup._id) {
        console.error("Match ID (_id) is missing from MatchSetup settings.");
        alert("Failed to start match: Match ID missing.");
        return;
    }
    const newMatchSettings = {
      ...settingsFromSetup, // Contains teamA, teamB names, overs, playersPerTeam, _id etc.
      matchId: settingsFromSetup._id, // Use backend _id as matchId for consistency
      createdAt: new Date().toISOString(),
    };
    setMatchSettings(newMatchSettings);
    setMatchData(null); // Clear any previous completed match data
    setMatchStarted(true);
    
    // Store settings for potential resumption, data will be in its own matchState_{id} key
    localStorage.setItem("currentMatch", JSON.stringify({ settings: newMatchSettings }));
    navigate('/scorecard'); // Navigate after setting state
  };

  const handleMatchEnd = (finalMatchData) => {
    console.log("App: Match ended, final data received:", finalMatchData);
    setMatchData(finalMatchData); 
    const matchHistory = JSON.parse(localStorage.getItem("matchHistory") || "[]");
    matchHistory.push(finalMatchData);
    localStorage.setItem("matchHistory", JSON.stringify(matchHistory.slice(-10)));
  };

  const handleExitMatch = () => {
    console.log("App: Exiting match.");
    const currentMatchId = matchSettings?._id || matchSettings?.matchId;
    if (currentMatchId) {
        localStorage.removeItem(`matchState_${currentMatchId}`); // Clear specific live match state
    }
    localStorage.removeItem("currentMatch"); // Clear general current match indicator
    
    setMatchStarted(false);
    setMatchSettings(null);
    setMatchData(null);
  };

  return (
      <Routes>
        <Route
          path="/"
          element={
            !matchStarted ? (
              <MatchSetup onStartMatch={handleStartMatch} />
            ) : (
              <Navigate to="/scorecard" replace />
            )
          }
        />
        <Route
          path="/scorecard"
          element={
            matchStarted && matchSettings ? (
              <ScorecardPage
                matchSettings={matchSettings}
                onMatchEnd={handleMatchEnd}
                onExitMatch={handleExitMatch} // Pass the new handler
                key={matchSettings.matchId} 
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/full-scorecard/:matchIdParam"  // matchIdFromUrl is the parameter name
          element={<FullScorecardPage />} // Render directly, page handles data fetching
        />
         <Route path="/match-setup" element={<MatchSetup onStartMatch={handleStartMatch} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;