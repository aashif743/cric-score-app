import React, { useState } from "react";
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

function App() {
  const [matchSettings, setMatchSettings] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [matchStarted, setMatchStarted] = useState(false);

  const handleStartMatch = (settings) => {
    if (!settings.teamA || !settings.teamB) {
      console.error("Invalid match settings: teams not defined");
      return;
    }

    const newSettings = {
      ...settings,
      matchId: Date.now().toString(),
      createdAt: new Date().toISOString(),
      overs: settings.overs || 20,
      playersPerTeam: settings.playersPerTeam || 11,
      ballsPerOver: settings.ballsPerOver || 6
    };

    setMatchSettings(newSettings);
    setMatchData(null); // Clear previous match data
    setMatchStarted(true);
  };

  const handleMatchEnd = (finalMatchData) => {
    if (!finalMatchData) {
      console.error("No match data provided on match end");
      return;
    }

    const completeMatchData = {
      ...finalMatchData,
      settings: matchSettings
    };

    setMatchData(completeMatchData);
    setMatchStarted(false);

    // Optional: Persist match data in localStorage for refresh safety
    localStorage.setItem("lastMatchData", JSON.stringify(completeMatchData));
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            !matchStarted ? (
              <MatchSetup
                onStartMatch={handleStartMatch}
                defaultSettings={matchSettings}
              />
            ) : (
              <Navigate to="/scorecard" replace />
            )
          }
        />

        <Route
          path="/scorecard"
          element={
            matchSettings ? (
              <ScorecardPage
                matchSettings={matchSettings}
                onMatchEnd={handleMatchEnd}
                key={matchSettings.matchId} // Force rerender on new match
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/full-scorecard"
          element={
            matchData ? (
              <FullScorecardPage />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
