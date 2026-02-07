import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import io from "socket.io-client";
import "./Overlay.css";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const Overlay = () => {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const style = searchParams.get("style") || "bar"; // 'bar' or 'box'
  const theme = searchParams.get("theme") || "dark"; // 'dark' or 'light'

  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch initial data
  const fetchOverlayData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || "Match not found");
      }
    } catch (err) {
      setError("Failed to connect to server");
    }
  }, [matchId]);

  // Setup WebSocket connection
  useEffect(() => {
    fetchOverlayData();

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-match", matchId);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("score-updated", (payload) => {
      // Update overlay data from WebSocket payload
      if (payload) {
        setData((prev) => {
          if (!prev) return prev;

          const currentInningsKey = payload.innings === 1 ? "innings1" : "innings2";
          const inningsData = payload[currentInningsKey];

          return {
            ...prev,
            status: payload.status || prev.status,
            result: payload.result || prev.result,
            currentInnings: payload.innings || prev.currentInnings,
            target: payload.target || prev.target,
            [currentInningsKey]: inningsData ? {
              battingTeam: inningsData.battingTeam || inningsData.teamName,
              runs: inningsData.runs || 0,
              wickets: inningsData.wickets || 0,
              overs: inningsData.overs || "0.0",
              runRate: inningsData.runRate || 0,
            } : prev[currentInningsKey],
            currentBatsmen: payload.currentBatsmen || prev.currentBatsmen,
            currentBowler: payload.currentBowler || prev.currentBowler,
            lastBall: payload.lastBallResult || prev.lastBall,
            partnership: payload.partnership || prev.partnership,
          };
        });
      }
    });

    // Periodic refresh as backup
    const refreshInterval = setInterval(fetchOverlayData, 10000);

    return () => {
      socket.disconnect();
      clearInterval(refreshInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [matchId, fetchOverlayData]);

  if (error) {
    return (
      <div className={`overlay-error ${theme}`}>
        <span>{error}</span>
      </div>
    );
  }

  if (!data) {
    return null; // Transparent while loading
  }

  const currentInnings = data.currentInnings === 1 ? data.innings1 : data.innings2;
  const battingTeamName = currentInnings?.battingTeam ||
    (data.currentInnings === 1 ? data.teamA.name : data.teamB.name);
  const battingTeamShort = battingTeamName.substring(0, 3).toUpperCase();

  // Calculate runs needed for second innings
  let runsNeeded = null;
  let ballsRemaining = null;
  if (data.currentInnings === 2 && data.target && currentInnings) {
    runsNeeded = data.target - currentInnings.runs;
    const oversUsed = parseFloat(currentInnings.overs) || 0;
    const totalBalls = data.totalOvers * 6;
    const ballsUsed = Math.floor(oversUsed) * 6 + Math.round((oversUsed % 1) * 10);
    ballsRemaining = totalBalls - ballsUsed;
  }

  // IPL-style minimal bar overlay
  if (style === "bar") {
    return (
      <div className={`overlay-bar ${theme}`}>
        <div className="bar-team">
          <span className="bar-team-name">{battingTeamShort}</span>
          <span className="bar-score">
            {currentInnings?.runs || 0}-{currentInnings?.wickets || 0}
          </span>
          <span className="bar-overs">({currentInnings?.overs || "0.0"})</span>
        </div>

        {data.currentBatsmen?.length > 0 && (
          <div className="bar-batsmen">
            {data.currentBatsmen.map((b, i) => (
              <span key={i} className={`bar-batsman ${b.onStrike ? "on-strike" : ""}`}>
                {b.name.split(" ").pop()} {b.runs}({b.balls})
              </span>
            ))}
          </div>
        )}

        {runsNeeded !== null && runsNeeded > 0 && (
          <div className="bar-target">
            Need {runsNeeded} from {ballsRemaining}
          </div>
        )}

        {data.status === "completed" && data.result && (
          <div className="bar-result">{data.result}</div>
        )}

        <div className={`bar-live-indicator ${connected ? "connected" : "disconnected"}`}>
          {data.status === "in_progress" ? "LIVE" : data.status?.toUpperCase()}
        </div>
      </div>
    );
  }

  // Test match style box overlay
  return (
    <div className={`overlay-box ${theme}`}>
      <div className="box-header">
        <div className={`box-live-indicator ${connected ? "connected" : "disconnected"}`}>
          {data.status === "in_progress" ? "LIVE" : data.status?.toUpperCase()}
        </div>
      </div>

      <div className="box-scores">
        {/* First Innings */}
        {data.innings1 && (
          <div className={`box-innings ${data.currentInnings === 1 ? "current" : ""}`}>
            <span className="box-team">{data.innings1.battingTeam?.substring(0, 3).toUpperCase() || "TM1"}</span>
            <span className="box-score">{data.innings1.runs}/{data.innings1.wickets}</span>
            <span className="box-overs">({data.innings1.overs})</span>
          </div>
        )}

        {/* Second Innings */}
        {data.innings2 && (
          <div className={`box-innings ${data.currentInnings === 2 ? "current" : ""}`}>
            <span className="box-team">{data.innings2.battingTeam?.substring(0, 3).toUpperCase() || "TM2"}</span>
            <span className="box-score">{data.innings2.runs}/{data.innings2.wickets}</span>
            <span className="box-overs">({data.innings2.overs})</span>
          </div>
        )}
      </div>

      {/* Current Batsmen */}
      {data.currentBatsmen?.length > 0 && (
        <div className="box-batsmen">
          {data.currentBatsmen.map((b, i) => (
            <div key={i} className={`box-batsman ${b.onStrike ? "on-strike" : ""}`}>
              <span className="batsman-name">{b.name}</span>
              <span className="batsman-score">{b.runs} ({b.balls})</span>
            </div>
          ))}
        </div>
      )}

      {/* Current Bowler */}
      {data.currentBowler && (
        <div className="box-bowler">
          <span className="bowler-label">Bowling:</span>
          <span className="bowler-name">{data.currentBowler.name}</span>
          <span className="bowler-figures">
            {data.currentBowler.wickets}/{data.currentBowler.runs} ({data.currentBowler.overs})
          </span>
        </div>
      )}

      {/* Run Rate Info */}
      <div className="box-rates">
        {currentInnings?.runRate > 0 && (
          <span className="box-crr">CRR: {parseFloat(currentInnings.runRate).toFixed(2)}</span>
        )}
        {data.requiredRunRate && (
          <span className="box-rrr">RRR: {data.requiredRunRate}</span>
        )}
      </div>

      {/* Target/Result */}
      {data.target && data.currentInnings === 2 && runsNeeded > 0 && (
        <div className="box-target">
          {battingTeamShort} need {runsNeeded} runs from {ballsRemaining} balls
        </div>
      )}

      {data.status === "completed" && data.result && (
        <div className="box-result">{data.result}</div>
      )}

      {/* Partnership */}
      {data.partnership?.runs > 0 && (
        <div className="box-partnership">
          Partnership: {data.partnership.runs} ({data.partnership.balls})
        </div>
      )}
    </div>
  );
};

export default Overlay;
