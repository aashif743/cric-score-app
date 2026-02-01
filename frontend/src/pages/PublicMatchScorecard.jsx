import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import publicService from "../services/publicService";
import "./FullScorecard.css";

const PublicMatchScorecard = () => {
  const { shareId, matchId } = useParams();
  const navigate = useNavigate();

  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyModal, setHistoryModal] = useState({ isOpen: false, inningsData: null });

  const normalizeMatchData = useCallback((data) => {
    if (!data) return null;
    return {
      ...data,
      teamA: data.teamA || { name: "Team A" },
      teamB: data.teamB || { name: "Team B" },
      innings1: data.innings1
        ? {
            ...data.innings1,
            batting: Array.isArray(data.innings1.batting)
              ? data.innings1.batting.map((b) => ({
                  ...b,
                  runs: b.runs || 0,
                  balls: b.balls || 0,
                  fours: b.fours || 0,
                  sixes: b.sixes || 0,
                  strikeRate:
                    b.strikeRate ||
                    (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00"),
                  status: b.status || (b.isOut ? "Out" : b.balls > 0 ? "Not Out" : "Did Not Bat"),
                }))
              : [],
            bowling: Array.isArray(data.innings1.bowling)
              ? data.innings1.bowling.map((bowler) => ({
                  ...bowler,
                  overs: bowler.overs || "0.0",
                  runs: bowler.runs || 0,
                  wickets: bowler.wickets || 0,
                  maidens: bowler.maidens || 0,
                  economyRate: bowler.economyRate || "0.00",
                }))
              : [],
          }
        : null,
      innings2: data.innings2
        ? {
            ...data.innings2,
            batting: Array.isArray(data.innings2.batting)
              ? data.innings2.batting.map((b) => ({
                  ...b,
                  runs: b.runs || 0,
                  balls: b.balls || 0,
                  fours: b.fours || 0,
                  sixes: b.sixes || 0,
                  strikeRate:
                    b.strikeRate ||
                    (b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00"),
                  status: b.status || (b.isOut ? "Out" : b.balls > 0 ? "Not Out" : "Did Not Bat"),
                }))
              : [],
            bowling: Array.isArray(data.innings2.bowling)
              ? data.innings2.bowling.map((bowler) => ({
                  ...bowler,
                  overs: bowler.overs || "0.0",
                  runs: bowler.runs || 0,
                  wickets: bowler.wickets || 0,
                  maidens: bowler.maidens || 0,
                  economyRate: bowler.economyRate || "0.00",
                }))
              : [],
          }
        : null,
      toss: data.toss || {},
      result: data.result || null,
      status: data.status || "completed",
    };
  }, []);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        setLoading(true);
        const res = await publicService.getPublicMatch(matchId);
        if (res.success) {
          setMatchData(normalizeMatchData(res.data));
        } else {
          setError("Match not found.");
        }
      } catch (err) {
        setError(err?.error || "Failed to load match.");
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [matchId, normalizeMatchData]);

  const calculateEconomy = (overs, runs) => {
    if (!overs || runs === undefined) return "0.00";
    const [whole, part] = overs.toString().split(".").map(Number);
    const totalBalls = (whole || 0) * 6 + (part || 0);
    return totalBalls > 0 ? ((runs / totalBalls) * 6).toFixed(2) : "0.00";
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const renderExtras = (inningsExtras) => {
    const extras = inningsExtras || {};
    const calculatedTotal =
      (extras.wides || 0) +
      (extras.noBalls || 0) +
      (extras.byes || 0) +
      (extras.legByes || 0) +
      (extras.penalty || 0);
    const displayTotal = extras.total !== undefined ? extras.total : calculatedTotal;

    if (displayTotal === 0) return null;

    return (
      <div className="extras-section">
        <h4>Extras</h4>
        <div className="extras-details">
          <span><strong>Total:</strong> {displayTotal}</span>
          {(extras.wides || 0) > 0 && <span><strong>Wides:</strong> {extras.wides}</span>}
          {(extras.noBalls || 0) > 0 && <span><strong>No Balls:</strong> {extras.noBalls}</span>}
          {(extras.byes || 0) > 0 && <span><strong>Byes:</strong> {extras.byes}</span>}
          {(extras.legByes || 0) > 0 && <span><strong>Leg Byes:</strong> {extras.legByes}</span>}
        </div>
      </div>
    );
  };

  const renderFallOfWickets = (fowData = [], inningsLabel = "") => {
    if (!Array.isArray(fowData) || fowData.length === 0) return null;

    return (
      <div className="fow-section">
        <h4>Fall of Wickets</h4>
        <div className="fow-details">
          {fowData.map((wicket, idx) => (
            <div key={`${inningsLabel}-fow-${idx}`} className="fow-item">
              <span className="fow-score">
                {wicket.score ?? "N/A"}-{wicket.wicket ?? "N/A"}
              </span>
              {wicket.batsman_name && <span className="fow-batsman"> ({wicket.batsman_name})</span>}
              {wicket.over && <span className="fow-over"> - {wicket.over} ov</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOverHistoryModal = () => {
    if (!historyModal.isOpen || !historyModal.inningsData) return null;
    const { teamName, overHistory = [] } = historyModal.inningsData;

    return (
      <div
        className="modal-overlay"
        onClick={() => setHistoryModal({ isOpen: false, inningsData: null })}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              <p className="no-overs">No completed overs recorded.</p>
            ) : (
              <div className="overs-list">
                {[...overHistory].reverse().map((over) => (
                  <div key={over.overNumber} className="over-item">
                    <div className="over-header">
                      <strong>Over {over.overNumber}</strong>
                      <span>(Bowler: {over.bowlerName})</span>
                    </div>
                    <div className="balls-container">
                      {over.balls.map((ball, index) => (
                        <span key={index} className={`ball ${ball === "W" ? "wicket" : ""}`}>
                          {ball}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInningsSection = (inningsData, defaultTeamName, inningsLabel) => {
    if (!inningsData) {
      return (
        <div className="innings-section">
          <h3 className="innings-title">{defaultTeamName} - Yet to bat</h3>
        </div>
      );
    }

    const playedBatsmen =
      inningsData.batting?.filter(
        (b) => (b.runs || 0) > 0 || (b.balls || 0) > 0 || b.isOut === true
      ) || [];

    const bowledBowlers =
      inningsData.bowling?.filter((bowler) => {
        if (!bowler.overs || bowler.overs === "0.0") return false;
        const [whole, part] = bowler.overs.toString().split(".").map(Number);
        return (whole || 0) > 0 || (part || 0) > 0;
      }) || [];

    return (
      <div className="innings-section">
        <h3 className="innings-title">
          {inningsData.teamName || defaultTeamName}
          <span className="innings-score">
            {inningsData.runs ?? 0}/{inningsData.wickets ?? 0}
          </span>
          <span className="innings-overs">({inningsData.overs || "0.0"} Overs)</span>
          {inningsData.target > 0 && (
            <span className="innings-target"> (Target: {inningsData.target})</span>
          )}
        </h3>

        <div className="innings-details">
          <div className="batting-section">
            <h4>Batting</h4>
            {playedBatsmen.length > 0 ? (
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
                  {playedBatsmen.map((batsman, index) => (
                    <tr key={`bat-${index}`}>
                      <td className="player-name">{batsman.name}</td>
                      <td className="batsman-status">{batsman.status || "Did Not Bat"}</td>
                      <td>{batsman.runs || 0}</td>
                      <td>{batsman.balls || 0}</td>
                      <td>{batsman.fours || 0}</td>
                      <td>{batsman.sixes || 0}</td>
                      <td>{batsman.strikeRate || "0.00"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">No batting data available</div>
            )}
          </div>

          <div className="bowling-section">
            <h4>Bowling</h4>
            {bowledBowlers.length > 0 ? (
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
                  {bowledBowlers.map((bowler, index) => (
                    <tr key={`bowl-${index}`}>
                      <td className="player-name">{bowler.name}</td>
                      <td>{bowler.overs || "0.0"}</td>
                      <td>{bowler.maidens || 0}</td>
                      <td>{bowler.runs || 0}</td>
                      <td>{bowler.wickets || 0}</td>
                      <td>
                        {bowler.economyRate ||
                          (bowler.overs ? calculateEconomy(bowler.overs, bowler.runs) : "0.00")}
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

          {inningsData.overHistory?.length > 0 && (
            <button
              className="view-history-btn"
              onClick={() => setHistoryModal({ isOpen: true, inningsData })}
            >
              View Over-by-Over History
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading scorecard...</p>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="error-container">
        <h2>Error Loading Scorecard</h2>
        <p>{error || "No match data available."}</p>
        <button className="back-button" onClick={() => navigate(`/tournament/${shareId}`)}>
          Back to Tournament
        </button>
      </div>
    );
  }

  const { teamA, teamB, date, result, innings1, innings2, totalOvers } = matchData;

  return (
    <div className="full-scorecard-page">
      <div className="full-scorecard-container">
        <div className="scorecard-card">
          <header className="header-section">
            <div className="header-top">
              <h1 className="header-title">
                {teamA?.name || "Team A"} vs {teamB?.name || "Team B"}
              </h1>
              <div className="header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/tournament/${shareId}`)}
                >
                  Back to Tournament
                </button>
              </div>
            </div>
            <div className="match-meta">
              {totalOvers && (
                <span>
                  <strong>Overs:</strong> {totalOvers}
                </span>
              )}
              {date && (
                <span>
                  <strong>Date:</strong> {formatDate(date)}
                </span>
              )}
            </div>
            {result && (
              <div className="match-result-container">
                <div className="match-result-highlight">
                  <strong className="result-label">MATCH RESULT:</strong>
                  <div className="result-text">{result}</div>
                </div>
              </div>
            )}
          </header>

          <main className="score-sections">
            {innings1 &&
              renderInningsSection(innings1, teamA?.name || "Team A", "1st Innings")}

            {innings2 && innings2.teamName !== "N/A" && (
              <>
                <hr className="innings-separator" />
                {renderInningsSection(innings2, teamB?.name || "Team B", "2nd Innings")}
              </>
            )}
          </main>

          <div
            style={{
              textAlign: "center",
              padding: "16px",
              borderTop: "1px solid var(--border-color)",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
            }}
          >
            Powered by CricZone
          </div>
        </div>

        {renderOverHistoryModal()}
      </div>
    </div>
  );
};

export default PublicMatchScorecard;
