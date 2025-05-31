
import { useLocation, useNavigate, useParams } from "react-router-dom";
import React, { useEffect, useState } from "react"; // Added useEffect, useState for potential future live updates
import "./FullScorecard.css"; // Ensure this CSS file exists and is styled

const FullScorecardPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { matchIdParam } = useParams(); // For fetching live data if no state is passed

  // Local state to hold match data, allowing for updates if live viewing is implemented
  const [displayMatchData, setDisplayMatchData] = useState(state?.matchData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (state?.matchData) {
      setDisplayMatchData(state.matchData);
    } else if (matchIdParam) {
      // If matchData is not in location.state but a matchIdParam is present in URL,
      // this is where you would fetch the match data from your backend.
      // This part is for enabling direct navigation to /full-scorecard/:matchIdParam
      // and for live updates.
      const fetchMatch = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // Replace with your actual API endpoint
          // const response = await axios.get(`/api/matches/${matchIdParam}`);
          // setDisplayMatchData(response.data.data);
          console.log(`TODO: Fetch match data for ID: ${matchIdParam}`);
          // For now, simulate an error if not fetched
          setError("Live fetching not implemented. Data must be passed via navigation state.");
        } catch (err) {
          console.error("Error fetching match data:", err);
          setError(err.response?.data?.error || "Failed to load match data.");
          setDisplayMatchData(null);
        } finally {
          setIsLoading(false);
        }
      };
      // fetchMatch(); // Uncomment when API endpoint is ready

      // For now, if no state.matchData and fetchMatch is commented out:
      if (!state?.matchData) {
           setError("Scorecard data not available directly. Please navigate from the match.");
      }

    } else {
         setError("No match data provided.");
    }
  }, [state, matchIdParam]);

  // Placeholder for Socket.IO connection for live updates
  useEffect(() => {
    if (matchIdParam && displayMatchData && !displayMatchData.status?.includes("completed")) {
      // const socket = io("http://localhost:5000"); // Your socket server
      // socket.emit("join-match", matchIdParam);
      // socket.on("score-updated", (updatedMatchData) => {
      //   console.log("Live score update received on FullScorecardPage:", updatedMatchData);
      //   setDisplayMatchData(prevData => ({ ...prevData, ...updatedMatchData })); // Or merge more intelligently
      // });
      // return () => socket.disconnect();
      console.log("TODO: Implement Socket.IO for live updates on FullScorecardPage for match:", matchIdParam);
    }
  }, [matchIdParam, displayMatchData]);


  if (isLoading) {
    return (
      <div className="loading-error-container">
        <h2>Loading Scorecard...</h2>
      </div>
    );
  }

  if (error || !displayMatchData) {
    return (
      <div className="loading-error-container">
        <h2>Scorecard Not Available</h2>
        <p>{error || "Unable to load match data. Please return to the live scorecard or match setup."}</p>
        <button className="back-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  // Destructure from displayMatchData which is now the source of truth for rendering
  const {
    teamA = { name: "Team A" },
    teamB = { name: "Team B" },
    date = new Date().toISOString(),
    venue = "Unknown Venue",
    matchType = "Match",
    result = "Result not available",
    matchSummary = {},
    innings1 = {},
    innings2 = {},
    toss = {},
    // Assuming these are added to your MatchSchema and passed in matchData
    totalOvers = "N/A",
    playersPerTeam = "N/A"
  } = displayMatchData;

  const goToLiveScorecard = () => {
    // If navigating back to an ongoing match, ensure matchId is available
    // The ScoreCardPage might need matchSettings prop, which might not be available here.
    // This navigation might need to be smarter or ScoreCardPage needs to handle loading from ID.
    if (matchIdParam) {
      navigate(`/scorecard`); // Assuming ScoreCardPage can handle loading with just ID or context
    } else if (displayMatchData?._id) { // If the completed match has an ID
      navigate(`/scorecard`);
    }
     else {
      navigate("/scorecard"); // General fallback
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date not set";
    try {
      return new Date(dateString).toLocaleDateString("en-GB", { // en-GB for DD/MM/YYYY
        year: "numeric",
        month: "long",
        day: "numeric",
        // weekday: "long", // Optional
      });
    } catch {
      return "Invalid Date";
    }
  };

  const renderBattingTable = (batsmen = [], inningsLabel = "") => {
    if (!Array.isArray(batsmen) || batsmen.length === 0) {
      // console.warn(`No batsman data found for ${inningsLabel}.`);
      return <p className="no-data">Batting data not yet available for {inningsLabel}.</p>;
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
          {batsmen.map((b, idx) => (
            <tr key={`${inningsLabel}-batsman-${b.name}-${idx}`}> {/* More unique key */}
              <td className="player-name">{b.name || `Player ${idx + 1}`}</td>
              <td className="batsman-status">{b.isOut ? b.outType || "Out" : "Not Out"}</td>
              <td>{b.runs ?? 0}</td>
              <td>{b.balls ?? 0}</td>
              <td>{b.fours ?? 0}</td>
              <td>{b.sixes ?? 0}</td>
              <td>{b.strikeRate || (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderBowlingTable = (bowlers = [], inningsLabel = "") => {
    if (!Array.isArray(bowlers) || bowlers.length === 0) {
      // console.warn(`No bowler data found for ${inningsLabel}.`);
      return <p className="no-data">Bowling data not yet available for {inningsLabel}.</p>;
    }

    return (
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th> {/* Maiden Overs */}
            <th>R</th>
            <th>W</th>
            <th>ER</th>
          </tr>
        </thead>
        <tbody>
          {bowlers.map((b, idx) => {
            // Directly use the aggregated stats from the bowler object
            // These should be prepared by ScoreCard.jsx's endMatch or fetched from backend
            return (
              <tr key={`${inningsLabel}-bowler-${b.name}-${idx}`}> {/* More unique key */}
                <td className="player-name">{b.name || `Bowler ${idx + 1}`}</td>
                <td>{b.overs || "0.0"}</td>
                <td>{b.maidens ?? 0}</td> {/* Display Maidens */}
                <td>{b.runs ?? 0}</td>   {/* Runs conceded */}
                <td>{b.wickets ?? 0}</td>
                <td>{b.economyRate || "0.00"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderExtras = (inningsData = {}) => {
    const extras = inningsData.extras || {};
    const totalExtras =
      typeof extras.total === "number"
        ? extras.total
        : (extras.wides || 0) +
          (extras.noBalls || 0) +
          (extras.byes || 0) +
          (extras.legByes || 0);

    if (totalExtras === 0 && !inningsData.runs) return null; // Don't show if no extras and no runs yet

    return (
      <div className="extras-container">
        <p className="extras-line">
          <strong>Extras:</strong> {totalExtras}
          {totalExtras > 0 && (
            <span className="extras-breakdown">
              (wd {extras.wides || 0}, nb {extras.noBalls || 0}, b {extras.byes || 0}, lb {extras.legByes || 0})
            </span>
          )}
        </p>
      </div>
    );
  };

  const renderFallOfWickets = (fowData = [], inningsLabel = "") => {
    if (!Array.isArray(fowData) || fowData.length === 0) {
        if (!innings1.runs && inningsLabel.includes("1st")) return null; // Don't show if no runs in 1st inn
        if (!innings2.runs && inningsLabel.includes("2nd")) return null; // Don't show if no runs in 2nd inn
      return <p className="no-data">No wickets have fallen yet for {inningsLabel}.</p>;
    }

    return (
      <div className="fow-container">
        <p className="fow-line">
          <strong>Fall of Wickets:</strong>{" "}
          {fowData.map((w, idx) => (
            <span key={`${inningsLabel}-fow-${idx}`} className="fow-item">
              {w.wicket || idx + 1}-{w.score || 0} ({w.batsman || "Unknown"}, {w.over || "N/A"})
              {idx < fowData.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      </div>
    );
  };

  const renderInningsSection = (inningsData, teamDefaultName, inningsLabel) => {
    if (!inningsData || Object.keys(inningsData).length === 0) {
      // If innings data is minimal (e.g., only teamName), it might mean innings hasn't started
      if (inningsData && inningsData.teamName && !inningsData.runs && !inningsData.overs) {
         return (
            <div className="innings-section">
                <h3 className="innings-title">
                    {inningsData.teamName || teamDefaultName} - Yet to bat
                </h3>
            </div>
         );
      }
      return (
        <div className="innings-section">
          <h3 className="innings-title">{inningsLabel} - Data Not Available</h3>
        </div>
      );
    }

    return (
      <div className="innings-section">
        <h3 className="innings-title">
          {inningsData.teamName || teamDefaultName}
          <span className="innings-score">
            {inningsData.runs ?? 0}/{inningsData.wickets ?? 0}
          </span>
          <span className="innings-overs">
            ({inningsData.overs || "0.0"} Overs)
          </span>
          {inningsData.target && <span className="innings-target"> (Target: {inningsData.target})</span>}
        </h3>

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
      </div>
    );
  };


  return (
    <div className="full-scorecard-container bg-gray-50 p-2 md:p-6 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-lg">
        <div className="header-section p-4 md:p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              {teamA.name || "Team A"} vs {teamB.name || "Team B"}
            </h1>
            <button
              className="live-btn back-button" // Combined classes for styling
              onClick={goToLiveScorecard}
            >
              ← Scorecard
            </button>
          </div>
          <div className="match-meta text-sm text-gray-600 space-y-1 md:flex md:space-y-0 md:space-x-4">
            <span><strong>Type:</strong> {matchType} ({totalOvers} Overs)</span>
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

        <div className="result-section p-4 md:p-6 bg-blue-50 rounded-b-lg md:rounded-none">
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
          {renderInningsSection(innings1, teamA.name, "1st Innings")}
          {/* Render 2nd Innings only if it has data or if 1st innings is complete */}
          {(innings2 && Object.keys(innings2).length > (innings2.teamName ? 1:0) ) || (innings1 && innings1.overs && parseFloat(innings1.overs) >= parseFloat(totalOvers)) || (innings1 && innings1.wickets >= (playersPerTeam -1)) ? (
             renderInningsSection(innings2, teamB.name, "2nd Innings")
          ) : (
            <div className="innings-section">
                 <h3 className="innings-title">
                    {teamB.name || "Team B"} - Yet to bat (or 2nd innings data not available)
                </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullScorecardPage;
