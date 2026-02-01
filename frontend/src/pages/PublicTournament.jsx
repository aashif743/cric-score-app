import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import publicService from "../services/publicService";
import "./FullScorecard.css";

const PublicTournament = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        setLoading(true);
        const res = await publicService.getPublicTournament(shareId);
        if (res.success) {
          const { matches: m, ...t } = res.data;
          setTournament(t);
          setMatches(m || []);
        } else {
          setError("Tournament not found.");
        }
      } catch (err) {
        setError(err?.error || "Failed to load tournament.");
      } finally {
        setLoading(false);
      }
    };
    fetchTournament();
  }, [shareId]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await publicService.getPublicTournamentStats(shareId);
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.warn("Failed to load stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [shareId]);

  const handleToggleStats = () => {
    const next = !showStats;
    setShowStats(next);
    if (next && !stats) fetchStats();
  };

  const statusConfig = {
    upcoming: { label: "Upcoming", color: "#d97706", bg: "#fef3c7" },
    in_progress: { label: "In Progress", color: "#2563eb", bg: "#dbeafe" },
    completed: { label: "Completed", color: "#059669", bg: "#d1fae5" },
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading tournament...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="error-container">
        <h2>Tournament Not Found</h2>
        <p>{error || "This tournament link may be invalid or expired."}</p>
      </div>
    );
  }

  const status = statusConfig[tournament.status] || statusConfig.upcoming;

  const getScore = (innings) => {
    if (!innings) return null;
    return {
      runs: innings.runs || 0,
      wickets: innings.wickets || 0,
      overs: innings.overs || "0.0",
    };
  };

  return (
    <div className="full-scorecard-page">
      <div className="full-scorecard-container">
        <div className="scorecard-card">
          {/* Header */}
          <header className="header-section">
            <div className="header-top">
              <h1 className="header-title">{tournament.name}</h1>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  backgroundColor: status.bg,
                  color: status.color,
                }}
              >
                {status.label}
              </span>
            </div>

            <div className="match-meta">
              <span>
                <strong>Teams:</strong> {tournament.numberOfTeams}
              </span>
              <span>
                <strong>Overs:</strong> {tournament.totalOvers}
              </span>
              <span>
                <strong>Players/Team:</strong> {tournament.playersPerTeam}
              </span>
              {tournament.venue && (
                <span>
                  <strong>Venue:</strong> {tournament.venue}
                </span>
              )}
            </div>

            {tournament.teamNames?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                {tournament.teamNames.filter(Boolean).map((name, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor: "#fef3c7",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "#92400e",
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Stats Toggle */}
          {matches.length > 0 && (
            <div style={{ padding: "0 2rem" }}>
              <button
                onClick={handleToggleStats}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 0",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--border-color)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                Tournament Statistics
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {showStats ? "Hide" : "Show"}
                </span>
              </button>

              {showStats && statsLoading && !stats && (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <div className="loading-spinner" style={{ margin: "0 auto" }}></div>
                </div>
              )}

              {showStats && stats && (
                <div style={{ padding: "16px 0" }}>
                  {/* Overview */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      flexWrap: "wrap",
                      marginBottom: "20px",
                      padding: "16px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ flex: 1, textAlign: "center", minWidth: "80px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalMatches}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Total
                      </div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", minWidth: "80px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.completedMatches}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Completed
                      </div>
                    </div>
                    {stats.mostRunsInMatch && (
                      <div style={{ flex: 1, textAlign: "center", minWidth: "80px" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.mostRunsInMatch.runs}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                          Best Score
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                          {stats.mostRunsInMatch.name}
                        </div>
                      </div>
                    )}
                    {stats.bestBowling && (
                      <div style={{ flex: 1, textAlign: "center", minWidth: "80px" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                          {stats.bestBowling.wickets}/{stats.bestBowling.runs}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                          Best Bowling
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                          {stats.bestBowling.name}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top Run Scorers */}
                  {stats.topRunScorers?.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <h4 style={{ marginBottom: "8px", fontSize: "1rem" }}>Top Run Scorers</h4>
                      <table className="scorecard-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Team</th>
                            <th>Runs</th>
                            <th>Inn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.topRunScorers.map((p, i) => (
                            <tr key={i}>
                              <td className="player-name">{p.name}</td>
                              <td>{p.team || "-"}</td>
                              <td>{p.totalRuns}</td>
                              <td>{p.innings}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Top Wicket Takers */}
                  {stats.topWicketTakers?.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: "8px", fontSize: "1rem" }}>Top Wicket Takers</h4>
                      <table className="scorecard-table">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Team</th>
                            <th>Wkts</th>
                            <th>Runs</th>
                            <th>Inn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.topWicketTakers.map((p, i) => (
                            <tr key={i}>
                              <td className="player-name">{p.name}</td>
                              <td>{p.team || "-"}</td>
                              <td>{p.totalWickets}</td>
                              <td>{p.totalRuns}</td>
                              <td>{p.innings}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Matches */}
          <main className="score-sections">
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                marginBottom: "16px",
                paddingBottom: "8px",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              Matches ({matches.length})
            </h3>

            {matches.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "32px 0" }}>
                No matches yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {matches.map((match) => {
                  const teamA = match.teamA?.name || "Team A";
                  const teamB = match.teamB?.name || "Team B";
                  const scoreA = getScore(match.innings1);
                  const scoreB = getScore(match.innings2);
                  const isCompleted = match.status === "completed";

                  return (
                    <div
                      key={match._id}
                      onClick={() => navigate(`/tournament/${shareId}/match/${match._id}`)}
                      style={{
                        display: "flex",
                        border: "1px solid var(--border-color)",
                        borderRadius: "12px",
                        overflow: "hidden",
                        cursor: "pointer",
                        transition: "box-shadow 0.2s",
                        backgroundColor: "#fff",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-md)")}
                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                      <div
                        style={{
                          width: "4px",
                          backgroundColor: isCompleted ? "#059669" : "#2563eb",
                        }}
                      />
                      <div style={{ flex: 1, padding: "12px 16px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              color: isCompleted ? "#059669" : "#2563eb",
                              backgroundColor: isCompleted ? "#ecfdf5" : "#eff6ff",
                              padding: "2px 8px",
                              borderRadius: "20px",
                            }}
                          >
                            {isCompleted ? "Completed" : match.status === "abandoned" ? "Abandoned" : "Live"}
                          </span>
                          {match.totalOvers && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                              {match.totalOvers} ov
                            </span>
                          )}
                        </div>

                        {/* Team rows */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{teamA}</span>
                            {scoreA && (
                              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                                {scoreA.runs}/{scoreA.wickets}{" "}
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                                  ({scoreA.overs})
                                </span>
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{teamB}</span>
                            {scoreB && (
                              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                                {scoreB.runs}/{scoreB.wickets}{" "}
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 400 }}>
                                  ({scoreB.overs})
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {match.result && (
                          <div
                            style={{
                              marginTop: "8px",
                              paddingTop: "6px",
                              borderTop: "1px solid #f1f5f9",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: "#d97706",
                            }}
                          >
                            {match.result}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

          {/* Footer */}
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
      </div>
    </div>
  );
};

export default PublicTournament;
