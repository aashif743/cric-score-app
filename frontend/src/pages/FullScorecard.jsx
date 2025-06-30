import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import html2canvas from 'html2canvas';
import "./FullScorecard.css";
import io from "socket.io-client";
import axios from "axios";
import domtoimage from 'dom-to-image';

const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000");

const FullScorecardPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { matchIdParam } = useParams();
  const location = useLocation();
  const scorecardRef = useRef(null);

  const [displayMatchData, setDisplayMatchData] = useState(null);
  const [isLoading, setIsLoading] = useState(!state?.matchData);
  const [error, setError] = useState(null);
  const [socketError, setSocketError] = useState(null);

  // Helper function to validate and normalize match data
  const normalizeMatchData = useCallback((data) => {
    if (!data) return null;
    
    const normalized = {
      ...data,
      teamA: data.teamA || { name: "Team A" },
      teamB: data.teamB || { name: "Team B" },
      innings1: data.innings1 || null,
      innings2: data.innings2 || null,
      toss: data.toss || {},
      date: data.date || null,
      venue: data.venue || null,
      matchType: data.matchType || null,
      result: data.result || null,
      status: data.status || "completed"
    };

    ['innings1', 'innings2'].forEach(key => {
      if (normalized[key]) {
        normalized[key] = {
          teamName: normalized[key].teamName || (key === 'innings1' ? normalized.teamA.name : normalized.teamB.name),
          batting: Array.isArray(normalized[key].batting) ? normalized[key].batting : [],
          bowling: Array.isArray(normalized[key].bowling) ? normalized[key].bowling : [],
          runs: normalized[key].runs || 0,
          wickets: normalized[key].wickets || 0,
          overs: normalized[key].overs || "0.0",
          extras: normalized[key].extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
          fallOfWickets: Array.isArray(normalized[key].fallOfWickets) ? normalized[key].fallOfWickets : [],
          target: normalized[key].target || 0
        };
      }
    });

    return normalized;
  }, []);

  useEffect(() => {
    const resolvedMatchId = matchIdParam || state?.matchData?._id;

    if (!resolvedMatchId) {
      setError("No match ID found to display scorecard.");
      setIsLoading(false);
      return;
    }

    const handleScoreUpdate = (livePayload) => {
      console.log("✅ Live score update received:", livePayload);
      setDisplayMatchData(prevData => {
          if (!prevData) {
              console.warn("Received live update but previous data is null.");
              return prevData;
          }

          const newMatchData = JSON.parse(JSON.stringify(prevData));
          const inningsKey = `innings${livePayload.currentInningsNumber}`;

          // ✅ FIX: Merge the entire update, which now includes the teamName
          newMatchData[inningsKey] = {
              ...(newMatchData[inningsKey] || {}), // Preserve existing data
              ...livePayload.inningsUpdate      // Merge new data
          };

          if (livePayload.status) {
              newMatchData.status = livePayload.status;
          }

          // Log the state right after it's updated for debugging
          console.log("📦 State after live update:", newMatchData);
          return newMatchData;
        });
      };

    const loadMatchData = async () => {
      try {
        if (state?.matchData) {
          console.log("🚀 Using match data passed via navigation state.");
          setDisplayMatchData(normalizeMatchData(state.matchData));
        } else {
          console.log(`📡 Fetching initial match data for ID: ${resolvedMatchId}`);
          const response = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/api/matches/${resolvedMatchId}`
          );
          setDisplayMatchData(normalizeMatchData(response.data));
        }
      } catch (err) {
        setError(`Failed to load match data. ${err.response?.data?.message || err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadMatchData();

    try {
      socket.connect();
      socket.on("connect", () => {
        console.log("Connected to socket server");
        socket.emit("join-match", resolvedMatchId);
      });
      socket.on("score-updated", handleScoreUpdate);
      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setSocketError("Live updates unavailable - connection error");
      });
    } catch (socketErr) {
      console.error("Socket initialization error:", socketErr);
      setSocketError("Failed to initialize live updates");
    }

    return () => {
      socket.emit("leave-match", resolvedMatchId);
      socket.off("score-updated", handleScoreUpdate);
      socket.disconnect();
    };
  }, [matchIdParam, state, normalizeMatchData]);

  const handleDownloadImage = useCallback(() => {
    const node = scorecardRef.current;
    if (node) {
      domtoimage.toPng(node)
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = `scorecard-${displayMatchData?.teamA?.name}-vs-${displayMatchData?.teamB?.name}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error("Download failed:", err);
          setError("Sorry, the scorecard could not be downloaded.");
        });
    }
  }, [displayMatchData]);

  const goToLiveScorecard = () => {
    navigate("/scorecard");
  };

  const goToMatchSetup = () => {
    navigate("/match-setup");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date N/A";
    try {
      const options = { year: "numeric", month: "long", day: "numeric" };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      console.warn("Error formatting date:", dateString, e);
      return dateString;
    }
  };

  const renderBattingTable = (batsmen = [], inningsLabel = "") => {
    const batsmenList = Array.isArray(batsmen) ? batsmen : [];
    const playedBatsmen = batsmenList.filter(
      (b) => (b.balls || 0) > 0 || (b.runs || 0) > 0 || b.isOut === true || b.status?.toLowerCase() === "not out"
    );

    if (batsmenList.length === 0) {
      return <p className="no-data">Batting data not available for {inningsLabel}.</p>;
    }
    if (playedBatsmen.length === 0 && inningsLabel) {
      return <p className="no-data">No batsmen faced a ball or scored in {inningsLabel}.</p>;
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
          {playedBatsmen.map((b, idx) => (
            <tr key={`${inningsLabel}-batsman-${b.id || idx}`}>
              <td className="player-name">{b.name}</td>
              <td className="batsman-status">{b.status}</td>
              <td>{b.runs ?? 0}</td>
              <td>{b.balls ?? 0}</td>
              <td>{b.fours ?? 0}</td>
              <td>{b.sixes ?? 0}</td>
              <td>{b.strikeRate || "0.00"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderBowlingTable = (bowlers = [], inningsLabel = "") => {
    const bowlersList = Array.isArray(bowlers) ? bowlers : [];
    const bowledBowlers = bowlersList.filter((b) => {
      if (!b.overs) return false;
      const [overs, balls] = b.overs.toString().split('.').map(Number);
      return (overs || 0) > 0 || (balls || 0) > 0;
    });

    if (bowlersList.length === 0) {
      return <p className="no-data">Bowling data not available for {inningsLabel}.</p>;
    }
    if (bowledBowlers.length === 0 && inningsLabel) {
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
          {bowledBowlers.map((b, idx) => (
            <tr key={`${inningsLabel}-bowler-${b.id || idx}`}>
              <td className="player-name">{b.name}</td>
              <td>{b.overs || "0.0"}</td>
              <td>{b.maidens ?? 0}</td>
              <td>{b.runs ?? 0}</td>
              <td>{b.wickets ?? 0}</td>
              <td>{b.economyRate || "0.00"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderExtras = (inningsExtras) => {
    const extras = inningsExtras || {};
    const calculatedTotal = (extras.wides || 0) + (extras.noBalls || 0) + 
                          (extras.byes || 0) + (extras.legByes || 0) + 
                          (extras.penalty || 0);
    const displayTotal = extras.total !== undefined ? extras.total : calculatedTotal;

    if (displayTotal === 0 && Object.keys(extras).filter(k => k !== 'total').every(k => !(extras[k] > 0))) {
      return null;
    }

    return (
      <div className="extras-section">
        <h4>Extras</h4>
        <div className="extras-details">
          <span><strong>Total:</strong> {displayTotal}</span>
          {(extras.wides || 0) > 0 && <span><strong>Wides (wd):</strong> {extras.wides}</span>}
          {(extras.noBalls || 0) > 0 && <span><strong>No Balls (nb):</strong> {extras.noBalls}</span>}
          {(extras.byes || 0) > 0 && <span><strong>Byes (b):</strong> {extras.byes}</span>}
          {(extras.legByes || 0) > 0 && <span><strong>Leg Byes (lb):</strong> {extras.legByes}</span>}
          {(extras.penalty || 0) > 0 && <span><strong>Penalty (p):</strong> {extras.penalty}</span>}
        </div>
      </div>
    );
  };

  const renderFallOfWickets = (fowData = [], inningsLabel = "") => {
    const fowList = Array.isArray(fowData) ? fowData : [];
    if (fowList.length === 0) return null;

    return (
      <div className="fow-section">
        <h4>Fall of Wickets</h4>
        <div className="fow-details">
          {fowList.map((wicket, idx) => (
            <div key={`${inningsLabel}-fow-${idx}`} className="fow-item">
              <span className="fow-score">{wicket.score ?? 'N/A'}-{wicket.wicket ?? 'N/A'}</span>
              {wicket.batsman_name && (
                <span className="fow-batsman"> ({wicket.batsman_name})</span>
              )}
              {wicket.over && (
                <span className="fow-over"> - {wicket.over} ov</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInningsSection = (inningsData, defaultTeamName, inningsLabel) => {
    if (!inningsData || typeof inningsData !== 'object') {
      return (
        <div className="innings-section">
          <h3 className="innings-title">
            {defaultTeamName} - Yet to bat
          </h3>
        </div>
      );
    }

    const hasData = inningsData.runs !== undefined || 
                   inningsData.wickets !== undefined ||
                   (inningsData.batting && inningsData.batting.length > 0) ||
                   (inningsData.bowling && inningsData.bowling.length > 0);

    if (!hasData) {
      return (
        <div className="innings-section">
          <h3 className="innings-title">
            {inningsData.teamName || defaultTeamName} - Yet to bat
          </h3>
        </div>
      );
    }

    const hasBattingData = Array.isArray(inningsData.batting) && inningsData.batting.length > 0;
    const hasBowlingData = Array.isArray(inningsData.bowling) && inningsData.bowling.length > 0;

    return (
      <div className="innings-section">
        <h3 className="innings-title">
          {inningsData.teamName || defaultTeamName}
          <span className="innings-score">
            {inningsData.runs ?? 0}/{inningsData.wickets ?? 0}
          </span>
          <span className="innings-overs">
            ({inningsData.overs || "0.0"} Overs)
          </span>
          {inningsData.target > 0 && <span className="innings-target"> (Target: {inningsData.target})</span>}
        </h3>

        <div className="innings-details">
          {hasBattingData ? (
            <div className="batting-section">
              <h4>Batting</h4>
              {renderBattingTable(inningsData.batting, inningsLabel)}
            </div>
          ) : (
            <p className="no-data">No batting data recorded for {inningsData.teamName || defaultTeamName} in {inningsLabel}.</p>
          )}

          {renderExtras(inningsData.extras)}
          {renderFallOfWickets(inningsData.fallOfWickets, inningsLabel)}

          {hasBowlingData ? (
            <div className="bowling-section">
              <h4>Bowling</h4>
              {renderBowlingTable(inningsData.bowling, inningsLabel)}
            </div>
          ) : (
            <p className="no-data">No bowling data recorded against {inningsData.teamName || defaultTeamName} in {inningsLabel}.</p>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading match data...</p>
      </div>
    );
  }

  if (error || !displayMatchData) {
    return (
      <div className="error-container">
        <h2>Error Loading Scorecard</h2>
        <p>{error || "No match data is available to display."}</p>
        <button onClick={() => navigate("/")} className="back-button">Go Home</button>
      </div>
    );
  }

  const {
    teamA = { name: "Team A" },
    teamB = { name: "Team B" },
    date,
    venue,
    matchType,
    result,
    innings1,
    innings2,
    toss = {},
    totalOvers,
    matchSummary
  } = displayMatchData;

  console.log("Current match data:", {
    displayMatchData,
    isLoading,
    error,
    socketConnected: socket.connected,
    locationState: state
  });

  return (
    <div className="full-scorecard-container" ref={scorecardRef}>
      <div className="scorecard-card">
        <header className="header-section">
          <div className="header-top">
            <h1 className="header-title">
              {teamA?.name || "Team A"} vs {teamB?.name || "Team B"}
            </h1>
            <div className="header-actions">
              <button className="btn btn-secondary" onClick={goToLiveScorecard}>
                ← Live View
              </button>
              <button className="btn btn-primary" onClick={goToMatchSetup}>
                New Match
              </button>
              <button className="btn" onClick={handleDownloadImage} title="Download Scorecard">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
              </button>
            </div>
          </div>
          <div className="match-meta">
            {matchType && <span><strong>Type:</strong> {matchType} {totalOvers && totalOvers !== "N/A" ? `(${totalOvers} overs)` : ''}</span>}
            {date && <span><strong>Date:</strong> {formatDate(date)}</span>}
            {venue && <span><strong>Venue:</strong> {venue}</span>}
            {toss?.winner && <span><strong>Toss:</strong> {`${toss.winner} won and chose to ${toss.decision}`}</span>}
          </div>
          {result && <div className="match-result"><strong>Result:</strong> {result}</div>}
        
          {matchSummary?.netRunRates && (
            <div className="net-run-rate-summary">
              <h3>NRR</h3>
              <div className="nrr-details">
                <p><strong>{teamA.name}</strong>: {matchSummary.netRunRates[teamA.name] || 'N/A'}</p>
                <p><strong>{teamB.name}</strong>: {matchSummary.netRunRates[teamB.name] || 'N/A'}</p>
              </div>
            </div>
          )}
        </header>

        <main className="score-sections">
          {innings1 && renderInningsSection(innings1, teamA?.name || "Team A", "1st Innings")}

          {innings2 && innings2.teamName !== "N/A" && (
            <>
              <hr className="innings-separator" />
              {renderInningsSection(innings2, teamB?.name || "Team B", "2nd Innings")}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default FullScorecardPage;