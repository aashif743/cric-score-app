import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled from "styled-components";
import LiveBoard, {
  NoScroll, CenterScreen, Spinner, LoadingText, ErrorIcon, ErrorText, RetryButton,
} from "./tv/LiveBoard";
import SummaryBoard from "./tv/SummaryBoard";
import TransitionCurtain from "./tv/TransitionCurtain";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const POLL_MS = 2500;

// One link for the whole tournament. Auto-switches to the current live match,
// and shows the last match's summary between games — no need to re-copy a link
// for every match.
const TournamentTVScoreboard = () => {
  const params = useParams();
  const tournamentId = params.tournamentId || params.shareId;
  const [payload, setPayload] = useState(null); // { tournamentName, mode, overlay|summary }
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [curtain, setCurtain] = useState(false);
  const payloadRef = useRef(null);
  const prevKeyRef = useRef(null);
  const curtainTimer = useRef(null);
  useEffect(() => { payloadRef.current = payload; }, [payload]);

  // Play a branded transition whenever the shown content changes: a match ends
  // (live → summary) or the next match starts (summary → live / new matchId).
  useEffect(() => {
    if (!payload) return;
    const key = `${payload.mode}:${payload.matchId || ""}`;
    if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
      setCurtain(true);
      if (curtainTimer.current) clearTimeout(curtainTimer.current);
      curtainTimer.current = setTimeout(() => setCurtain(false), 1400);
    }
    prevKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload && payload.mode, payload && payload.matchId]);
  useEffect(() => () => { if (curtainTimer.current) clearTimeout(curtainTimer.current); }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/tournament-tv/${tournamentId}?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) { setPayload(json.data); setError(null); }
      else if (!payloadRef.current) setError(json.error || "Tournament not found");
    } catch (err) {
      if (!payloadRef.current) setError("Failed to connect to server");
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 3000, timeout: 8000,
    });
    socket.on("connect", () => {
      setConnected(true);
      // Any public match update pings this room → refetch to catch match switches
      // (a new match started) and live score changes instantly.
      socket.emit("join-public-live");
      fetchData();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("public-live-update", fetchData);
    socket.on("score-updated", fetchData);
    const poll = setInterval(fetchData, POLL_MS);
    const refresh = () => fetchData();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      try { socket.emit("leave-public-live"); } catch (_) {}
      socket.disconnect();
      clearInterval(poll);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tournamentId, fetchData]);

  if (error && !payload) {
    return (<><NoScroll /><CenterScreen><ErrorIcon>!</ErrorIcon><ErrorText>{error}</ErrorText><RetryButton onClick={fetchData}>Retry</RetryButton></CenterScreen></>);
  }
  if (!payload) {
    return (<><NoScroll /><CenterScreen><Spinner /><LoadingText>Loading tournament…</LoadingText></CenterScreen></>);
  }

  const title = payload.tournamentName || "Tournament";

  let board;
  if (payload.mode === "live" && payload.overlay) {
    board = <LiveBoard data={payload.overlay} connected={connected} title={title} />;
  } else if (payload.mode === "summary" && payload.summary) {
    board = <SummaryBoard summary={payload.summary} title={title} />;
  } else {
    // Idle — no match live and none completed yet.
    board = (
      <><NoScroll /><CenterScreen>
        <IdleTitle>{title}</IdleTitle>
        <IdleText>Waiting for the next match…</IdleText>
      </CenterScreen></>
    );
  }

  return <>{board}{curtain && <TransitionCurtain />}</>;
};

const IdleTitle = styled.h1`
  margin: 0; font-size: clamp(28px, 7vh, 110px); font-weight: 900; letter-spacing: -1px;
  background: linear-gradient(90deg,#60a5fa,#a78bfa);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  text-align: center; padding: 0 4vw;
`;
const IdleText = styled.div`font-size: clamp(18px, 3.4vh, 44px); color: #64748b; font-weight: 700;`;

export default TournamentTVScoreboard;
