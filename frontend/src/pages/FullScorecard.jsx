import React, { useEffect, useState, useRef, useCallback, useContext } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from '../context/AuthContext.jsx';
import axios from "axios";
import domtoimage from 'dom-to-image';
import io from "socket.io-client";
import "./FullScorecard.css";

const socket = io(import.meta.env.VITE_BACKEND_URL || "https://cric-score-app.onrender.com");

const FullScorecardPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { matchIdParam } = useParams();
  const scorecardRef = useRef(null);
  const { user } = useContext(AuthContext);

  const [displayMatchData, setDisplayMatchData] = useState(null);
  const [isLoading, setIsLoading] = useState(!state?.matchData);
  const [error, setError] = useState(null);
  const [historyModal, setHistoryModal] = useState({ isOpen: false, inningsData: null });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

const normalizeMatchData = useCallback((data) => {
  if (!data) return null;
  
  const normalized = {
    ...data,
    teamA: data.teamA || { name: "Team A" },
    teamB: data.teamB || { name: "Team B" },
    innings1: data.innings1 ? {
      ...data.innings1,
      batting: Array.isArray(data.innings1.batting) ? data.innings1.batting.map(b => ({
        ...b,
        runs: b.runs || 0,
        balls: b.balls || 0,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        strikeRate: b.strikeRate || (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00"),
        status: b.status || (b.isOut ? 'Out' : (b.balls > 0 ? 'Not Out' : 'Did Not Bat'))
      })) : [],
      bowling: Array.isArray(data.innings1.bowling) ? data.innings1.bowling.map(bowler => ({
        ...bowler,
        overs: bowler.overs || "0.0",
        runs: bowler.runs || 0,
        wickets: bowler.wickets || 0,
        maidens: bowler.maidens || 0,
        economyRate: bowler.economyRate || "0.00"
      })) : []
    } : null,
    innings2: data.innings2 ? {
      ...data.innings2,
      batting: Array.isArray(data.innings2.batting) ? data.innings2.batting.map(b => ({
        ...b,
        runs: b.runs || 0,
        balls: b.balls || 0,
        fours: b.fours || 0,
        sixes: b.sixes || 0,
        strikeRate: b.strikeRate || (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00"),
        status: b.status || (b.isOut ? 'Out' : (b.balls > 0 ? 'Not Out' : 'Did Not Bat'))
      })) : [],
      bowling: Array.isArray(data.innings2.bowling) ? data.innings2.bowling.map(bowler => ({
        ...bowler,
        overs: bowler.overs || "0.0",
        runs: bowler.runs || 0,
        wickets: bowler.wickets || 0,
        maidens: bowler.maidens || 0,
        economyRate: bowler.economyRate || "0.00"
      })) : []
    } : null,
    toss: data.toss || {},
    date: data.date || null,
    venue: data.venue || null,
    matchType: data.matchType || null,
    result: data.result || null,
    status: data.status || "completed"
  };

  return normalized;
}, []);

  useEffect(() => {
    const loadMatchData = async () => {
      const resolvedMatchId = matchIdParam;
      setIsLoading(true);
      setError(null);

      if (state?.matchData) {
        console.log("Using state match data");
        setDisplayMatchData(normalizeMatchData(state.matchData));
        setIsLoading(false);
        return;
      }

      const cachedMatchData = localStorage.getItem(`finalMatchData_${resolvedMatchId}`);
    if (cachedMatchData) {
      try {
        const parsedData = JSON.parse(cachedMatchData);
        console.log("✅ Restoring match from localStorage:", parsedData);
        setDisplayMatchData(normalizeMatchData(parsedData));
        setIsLoading(false);
        return;
      } catch (err) {
        console.error("Failed to parse cached match data", err);
      }
    }
      
      if (resolvedMatchId && !resolvedMatchId.startsWith('guest_')) {
        if (!user || !user.token) {
          setError("You must be logged in to view past match scorecards.");
          setIsLoading(false);
          return;
        }
        try {
          const config = { headers: { 'Authorization': `Bearer ${user.token}` } };
          const response = await axios.get(`/api/matches/${resolvedMatchId}`, config);
          setDisplayMatchData(normalizeMatchData(response.data.data));
        } catch (err) {
          setError(`Failed to fetch match data. ${err.response?.data?.message || err.message}`);
        }
      } else {
        setError("No match data found. The session may have expired or been cleared.");
      }
      
      setIsLoading(false);
    };

    loadMatchData();
  }, [matchIdParam, state, user, normalizeMatchData]);
  

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
  console.log("Rendering batting table:", batsmen);
  const batsmenList = Array.isArray(batsmen) ? batsmen : [];
  
  // Filter to show only batsmen who either:
  // - Faced at least one ball (balls > 0)
  // - Scored runs (runs > 0)
  // - Were out (isOut === true)
  const playedBatsmen = batsmenList.filter(b => 
    (b.balls || 0) > 0 || 
    (b.runs || 0) > 0 || 
    b.isOut === true
  );

  if (playedBatsmen.length === 0) {
    return <div className="no-data">No batsmen faced a ball in {inningsLabel}.</div>;
  }

  return (
    <motion.div className="table-container" variants={itemVariants}>
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
            <motion.tr 
              key={`${inningsLabel}-batsman-${b.id || idx}`}
              whileHover={{ backgroundColor: '#f8f9fa' }}
            >
              <td className="player-name">{b.name}</td>
              <td className="batsman-status">
                {b.status || 
                 (b.isOut ? 'Out' : 
                  ((b.balls || 0) > 0 ? 'Not Out' : 'Did Not Bat'))}
              </td>
              <td>{b.runs ?? 0}</td>
              <td>{b.balls ?? 0}</td>
              <td>{b.fours ?? 0}</td>
              <td>{b.sixes ?? 0}</td>
              <td>
                {b.strikeRate || 
                 ((b.balls || 0) > 0 ? 
                  ((b.runs / b.balls) * 100).toFixed(2) : 
                  "0.00")}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

const renderBowlingTable = (bowlers = [], inningsLabel = "") => {
  console.log("Rendering bowling table:", bowlers);
  const bowlersList = Array.isArray(bowlers) ? bowlers : [];
  
  // Filter to show only bowlers who bowled at least one ball
  const bowledBowlers = bowlersList.filter(b => {
    if (!b.overs) return false;
    const [whole, part] = b.overs.toString().split('.').map(Number);
    return (whole || 0) > 0 || (part || 0) > 0;
  });

  if (bowledBowlers.length === 0) {
    return <div className="no-data">No bowlers delivered a ball in {inningsLabel}.</div>;
  }

  return (
    <motion.div className="table-container" variants={itemVariants}>
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
            <motion.tr 
              key={`${inningsLabel}-bowler-${b.id || idx}`}
              whileHover={{ backgroundColor: '#f8f9fa' }}
            >
              <td className="player-name">{b.name}</td>
              <td>{b.overs || "0.0"}</td>
              <td>{b.maidens ?? 0}</td>
              <td>{b.runs ?? 0}</td>
              <td>{b.wickets ?? 0}</td>
              <td>
                {b.economyRate || 
                 (b.overs ? calculateEconomy(b.overs, b.runs) : "0.00")}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};

  const calculateEconomy = (overs, runs) => {
  if (!overs || runs === undefined) return "0.00";
  const [whole, part] = overs.toString().split('.').map(Number);
  const totalBalls = (whole || 0) * 6 + (part || 0);
  return totalBalls > 0 ? ((runs / totalBalls) * 6).toFixed(2) : "0.00";
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
      <motion.div className="extras-section" variants={itemVariants}>
        <h4>Extras</h4>
        <div className="extras-details">
          <span><strong>Total:</strong> {displayTotal}</span>
          {(extras.wides || 0) > 0 && <span><strong>Wides (wd):</strong> {extras.wides}</span>}
          {(extras.noBalls || 0) > 0 && <span><strong>No Balls (nb):</strong> {extras.noBalls}</span>}
          {(extras.byes || 0) > 0 && <span><strong>Byes (b):</strong> {extras.byes}</span>}
          {(extras.legByes || 0) > 0 && <span><strong>Leg Byes (lb):</strong> {extras.legByes}</span>}
          {(extras.penalty || 0) > 0 && <span><strong>Penalty (p):</strong> {extras.penalty}</span>}
        </div>
      </motion.div>
    );
  };

  const renderFallOfWickets = (fowData = [], inningsLabel = "") => {
    const fowList = Array.isArray(fowData) ? fowData : [];
    if (fowList.length === 0) return null;

    return (
      <motion.div className="fow-section" variants={itemVariants}>
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
      </motion.div>
    );
  };

  const renderOverHistoryModal = () => {
    if (!historyModal.isOpen || !historyModal.inningsData) return null;

    const { teamName, overHistory = [] } = historyModal.inningsData;

    return (
      <AnimatePresence>
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setHistoryModal({ isOpen: false, inningsData: null })}
        >
          <motion.div 
            className="modal-content"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Over History for {teamName}</h3>
              <button 
                className="close-modal"
                onClick={() => setHistoryModal({ isOpen: false, inningsData: null })}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {overHistory.length === 0 ? (
                <p className="no-overs">No completed overs recorded for this innings.</p>
              ) : (
                <div className="overs-list">
                  {[...overHistory].reverse().map((over) => (
                    <motion.div 
                      key={over.overNumber} 
                      className="over-item"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="over-header">
                        <strong>Over {over.overNumber}</strong>
                        <span>(Bowler: {over.bowlerName})</span>
                      </div>
                      <div className="balls-container">
                        {over.balls.map((ball, index) => (
                          <span 
                            key={index} 
                            className={`ball ${ball === 'W' ? 'wicket' : ''}`}
                          >
                            {ball}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

const renderInningsSection = (inningsData, defaultTeamName, inningsLabel) => {
  if (!inningsData) {
    return (
      <motion.div className="innings-section" variants={itemVariants}>
        <h3 className="innings-title">
          {defaultTeamName} - Yet to bat
        </h3>
      </motion.div>
    );
  }

  // --- FIX: Filter the lists before rendering ---
  const playedBatsmen = inningsData.batting?.filter(
    (batsman) => batsman.status !== 'Did Not Bat'
  ) || [];

  const bowledBowlers = inningsData.bowling?.filter(
    (bowler) => bowler.overs && bowler.overs !== "0.0"
  ) || [];

  return (
    <motion.div className="innings-section" variants={itemVariants}>
      <h3 className="innings-title">
        {inningsData.teamName || defaultTeamName}
        <span className="innings-score">
          {inningsData.runs ?? 0}/{inningsData.wickets ?? 0}
        </span>
        <span className="innings-overs">
          ({inningsData.overs || "0.0"} Overs)
        </span>
        {inningsData.target > 0 && (
          <span className="innings-target"> (Target: {inningsData.target})</span>
        )}
      </h3>

      <div className="innings-details">
        {/* Batting Section */}
        <div className="batting-section">
          <h4>Batting</h4>
          {playedBatsmen.length > 0 ? ( // Use the filtered list here
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
                {/* Map over the filtered list */}
                {playedBatsmen.map((batsman, index) => (
                  <tr key={`bat-${index}`}>
                    <td>{batsman.name || `Batsman ${index + 1}`}</td>
                    <td>{batsman.status || 'Did Not Bat'}</td>
                    <td>{batsman.runs || 0}</td>
                    <td>{batsman.balls || 0}</td>
                    <td>{batsman.fours || 0}</td>
                    <td>{batsman.sixes || 0}</td>
                    <td>
                      {batsman.strikeRate || 
                       (batsman.balls > 0 ? 
                        ((batsman.runs / batsman.balls) * 100).toFixed(2) : 
                        '0.00')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-data">No batting data available</div>
          )}
        </div>

        {/* Bowling Section */}
        <div className="bowling-section">
          <h4>Bowling</h4>
          {bowledBowlers.length > 0 ? ( // Use the filtered list here
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
                {/* Map over the filtered list */}
                {bowledBowlers.map((bowler, index) => (
                  <tr key={`bowl-${index}`}>
                    <td>{bowler.name || `Bowler ${index + 1}`}</td>
                    <td>{bowler.overs || '0.0'}</td>
                    <td>{bowler.maidens || 0}</td>
                    <td>{bowler.runs || 0}</td>
                    <td>{bowler.wickets || 0}</td>
                    <td>
                      {bowler.economyRate || 
                       (bowler.overs ? calculateEconomy(bowler.overs, bowler.runs) : '0.00')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-data">No bowling data available</div>
          )}
        </div>

        {renderExtras(inningsData.extras)}
        {renderFallOfWickets(inningsData.fallOfWickets, inningsLabel)}

        <button 
          className="view-history-btn"
          onClick={() => setHistoryModal({ isOpen: true, inningsData })}
        >
          View Over-by-Over History
        </button>
      </div>
    </motion.div>
  );
};

  if (isLoading) {
    return (
      <motion.div 
        className="loading-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="loading-spinner"></div>
        <p>Loading match data...</p>
      </motion.div>
    );
  }

  if (error || !displayMatchData) {
    return (
      <motion.div 
        className="error-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h2>Error Loading Scorecard</h2>
        <p>{error || "No match data is available to display."}</p>
        <motion.button 
          onClick={() => navigate("/")} 
          className="back-button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Go Home
        </motion.button>
      </motion.div>
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

  return (
    <motion.div 
      className="full-scorecard-container"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      ref={scorecardRef}
    >
      <motion.div 
        className="scorecard-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <header className="header-section">
          <div className="header-top">
            <h1 className="header-title">
              {teamA?.name || "Team A"} vs {teamB?.name || "Team B"}
            </h1>
            <div className="header-actions">
              <motion.button 
                className="btn btn-secondary"
                onClick={() => navigate("/scorecard")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Live View
              </motion.button>
              <motion.button 
                className="btn btn-primary"
                onClick={() => navigate("/match-setup")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Match
              </motion.button>
              <motion.button 
                className="btn btn-download"
                onClick={handleDownloadImage}
                title="Download Scorecard"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </motion.button>
            </div>
          </div>
          <div className="match-meta">
            {matchType && <span><strong>Type:</strong> {matchType} {totalOvers && totalOvers !== "N/A" ? `(${totalOvers} overs)` : ''}</span>}
            {date && <span><strong>Date:</strong> {formatDate(date)}</span>}
            {venue && <span><strong>Venue:</strong> {venue}</span>}
            {toss?.winner && <span><strong>Toss:</strong> {`${toss.winner} won and chose to ${toss.decision}`}</span>}
          </div>
          {result && (
            <motion.div 
              className="match-result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <strong>Result:</strong> {result}
            </motion.div>
          )}
        
          {matchSummary?.netRunRates && (
            <motion.div 
              className="net-run-rate-summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3>Net Run Rate</h3>
              <div className="nrr-details">
                <p><strong>{teamA.name}</strong>: {matchSummary.netRunRates[teamA.name] || 'N/A'}</p>
                <p><strong>{teamB.name}</strong>: {matchSummary.netRunRates[teamB.name] || 'N/A'}</p>
              </div>
            </motion.div>
          )}
        </header>

        <main className="score-sections">
          {innings1 && renderInningsSection(innings1, teamA?.name || "Team A", "1st Innings")}

          {innings2 && innings2.teamName !== "N/A" && (
            <>
              <motion.hr 
                className="innings-separator"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4 }}
              />
              {renderInningsSection(innings2, teamB?.name || "Team B", "2nd Innings")}
            </>
          )}
        </main>
      </motion.div>
      
      {renderOverHistoryModal()}
    </motion.div>
  );
};

export default FullScorecardPage;