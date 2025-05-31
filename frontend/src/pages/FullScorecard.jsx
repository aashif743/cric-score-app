import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./FullScorecard.css";

const FullScorecardPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { matchIdParam } = useParams();

  const [displayMatchData, setDisplayMatchData] = useState(state?.matchData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("FullScorecardPage location.state.matchData:", state?.matchData);
    if (state?.matchData) {
      setDisplayMatchData(state.matchData);
    } else if (matchIdParam) {
      // ... (fetching logic placeholder - same as before) ...
      console.log(`TODO: Fetch match data for ID: ${matchIdParam}`);
      if (!state?.matchData) {
           setError("Scorecard data not available. Please navigate from an active or completed match.");
      }
    } else {
         setError("No match data provided to display scorecard.");
    }
  }, [state, matchIdParam]);

  // ... (useEffect for Socket.IO placeholder - same as before) ...

  if (isLoading) { /* ... */ }
  if (error || !displayMatchData) { /* ... */ }

  const {
    teamA = { name: "Team A" },
    teamB = { name: "Team B" },
    date, venue, matchType, result, matchSummary = {},
    innings1 = {}, innings2 = {}, toss = {},
    totalOvers, playersPerTeam
  } = displayMatchData;

  const goToLiveScorecard = () => navigate("/scorecard");
  const formatDate = (dateString) => { /* ... same as before ... */ };

  const renderBattingTable = (batsmen = [], inningsLabel = "") => {
    const playedBatsmen = batsmen.filter(
      b => (b.balls && b.balls > 0) || (b.runs && b.runs > 0) || (b.isOut === false && (b.outType === '' || b.outType === null || b.outType === undefined) && batsmen.some(s => s.id === b.id)) // Show not out batsmen if they were at crease
    );

    if (playedBatsmen.length === 0) {
      return <p className="no-data">No batsmen faced a ball in {inningsLabel}.</p>;
    }

    return (
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>Batsman</th>
            <th>Status</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {playedBatsmen.map((b, idx) => {
            if (!b || typeof b !== 'object') return null;
            return (
              <tr key={`${inningsLabel}-batsman-${b.name || idx}-${idx}`}>
                <td className="player-name">{b.name || `Player ${idx + 1}`}</td>
                <td className="batsman-status">{b.isOut ? b.outType || "Out" : "Not Out"}</td>
                <td>{b.runs ?? 0}</td>
                <td>{b.balls ?? 0}</td>
                <td>{b.fours ?? 0}</td>
                <td>{b.sixes ?? 0}</td>
                <td>{b.strikeRate || (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderBowlingTable = (bowlers = [], inningsLabel = "") => {
    const bowledBowlers = bowlers.filter(b => b.overs && parseFloat(b.overs.replace('.','')) > 0); // Check if overs string indicates any balls bowled

    if (bowledBowlers.length === 0) {
      return <p className="no-data">No bowlers delivered a ball in {inningsLabel}.</p>;
    }
    return (
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>ER</th>
          </tr>
        </thead>
        <tbody>
          {bowledBowlers.map((b, idx) => {
            if (!b || typeof b !== 'object') return null;
            return (
              <tr key={`${inningsLabel}-bowler-${b.name || idx}-${idx}`}>
                <td className="player-name">{b.name || `Bowler ${idx + 1}`}</td>
                <td>{b.overs || "0.0"}</td>
                <td>{b.maidens ?? 0}</td>
                <td>{b.runs ?? 0}</td>
                <td>{b.wickets ?? 0}</td>
                <td>{b.economyRate || "0.00"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderExtras = (inningsData = {}) => { /* ... same as before ... */ };
  const renderFallOfWickets = (fowData = [], inningsLabel = "") => { /* ... same as before ... */};

  const renderInningsSection = (inningsData, teamDefaultName, inningsLabel) => {
    // Check if inningsData is valid and has a teamName before proceeding
    if (!inningsData || typeof inningsData !== 'object' || !inningsData.teamName) {
        // If it's 1st innings or 2nd innings and 1st has data, show "Yet to bat" or "Data not available"
        if (inningsLabel === "1st Innings" || (inningsLabel === "2nd Innings" && innings1 && innings1.teamName)) {
             return (
                <div className="innings-section">
                    <h3 className="innings-title">
                        {teamDefaultName} - {inningsLabel === "1st Innings" && (!inningsData || !inningsData.teamName) ? "Data not available" : "Yet to bat"}
                    </h3>
                </div>
             );
        }
      return null; // Don't render section if no meaningful data for the innings
    }
    
    const hasBatted = (inningsData.batting && inningsData.batting.length > 0) || (inningsData.runs !== undefined && inningsData.runs !== null) || (inningsData.overs && inningsData.overs !== "0.0");

    return (
      <div className="innings-section">
        <h3 className="innings-title">
          {inningsData.teamName} {/* Use teamName directly from inningsData */}
          {hasBatted && (
            <>
              <span className="innings-score">
                {inningsData.runs ?? 0}/{inningsData.wickets ?? 0}
              </span>
              <span className="innings-overs">
                ({inningsData.overs || "0.0"} Overs)
              </span>
            </>
          )}
          {!hasBatted && inningsData.teamName && " - Yet to bat"}
          {inningsData.target > 0 && <span className="innings-target"> (Target: {inningsData.target})</span>}
        </h3>

        {/* Render details only if the team has batted or if batting/bowling arrays are present */}
        {(hasBatted || (inningsData.batting && inningsData.batting.length > 0) || (inningsData.bowling && inningsData.bowling.length > 0)) && (
          <div className="innings-details">
            <div className="batting-section">
              <h4>Batting</h4>
              {renderBattingTable(inningsData.batting, inningsLabel)}
            </div>

            {renderExtras(inningsData)}
            {renderFallOfWickets(inningsData.fallOfWickets, inningsLabel)}

            <div className="bowling-section">
              <h4>Bowling</h4>
              {renderBowlingTable(inningsData.bowling, inningsLabel)}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main return
  return (
    <div className="full-scorecard-container bg-gray-50 p-2 md:p-6 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg">
        <div className="header-section p-4 md:p-6 border-b border-gray-200">
          {/* ... header content same as before ... */}
           <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              {displayMatchData.teamA?.name || "Team A"} vs {displayMatchData.teamB?.name || "Team B"}
            </h1>
            <button
              className="live-btn back-button"
              onClick={goToLiveScorecard}
            >
              ← Scorecard
            </button>
          </div>
          <div className="match-meta text-sm text-gray-600 space-y-1 md:flex md:space-y-0 md:space-x-4">
            <span><strong>Type:</strong> {matchType} ({totalOvers !== "N/A" ? `${totalOvers} Overs` : ''})</span>
            <span><strong>Venue:</strong> {venue}</span>
            <span><strong>Date:</strong> {formatDate(date)}</span>
            <span><strong>Players/Team:</strong> {playersPerTeam}</span>
          </div>
           {toss.winner && (
            <p className="toss-info mt-2 text-sm text-gray-600">
              <strong>Toss:</strong> {toss.winner} won the toss and chose to {toss.decision || "N/A"}.
            </p>
          )}
        </div>

        <div className="result-section p-4 md:p-6 bg-blue-50">
         {/* ... result content same as before ... */}
          <h2 className="result-text text-xl md:text-2xl font-semibold text-blue-700 mb-2">
            {result}
          </h2>
          {matchSummary.winner && matchSummary.winner !== "TBD" && (
            <p className="summary-item">
              <strong>Winner:</strong> {matchSummary.winner}
              {matchSummary.margin && ` (${matchSummary.margin})`}
            </p>
          )}
          {matchSummary.playerOfMatch && matchSummary.playerOfMatch !== "TBD" && (
            <p className="summary-item">
              <strong>Player of the Match:</strong> {matchSummary.playerOfMatch}
            </p>
          )}
        </div>

        <div className="innings-container p-4 md:p-6 space-y-6">
          {/* Use teamA.name and teamB.name from the root of displayMatchData for default names */}
          {renderInningsSection(innings1, displayMatchData.teamA?.name, "1st Innings")}
          {renderInningsSection(innings2, displayMatchData.teamB?.name, "2nd Innings")}
        </div>
      </div>
    </div>
  );
};

export default FullScorecardPage;
