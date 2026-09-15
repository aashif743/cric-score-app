import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import LiveBoard, {
  NoScroll, CenterScreen, Spinner, LoadingText, ErrorIcon, ErrorText, RetryButton,
} from "./tv/LiveBoard";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const POLL_MS = 2500;

const TVScoreboard = () => {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const dataRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) { setData(json.data); setError(null); }
      else if (!dataRef.current) setError(json.error || "Match not found");
    } catch (err) {
      if (!dataRef.current) setError("Failed to connect to server");
    }
  }, [matchId]);

  useEffect(() => {
    fetchData();
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 3000, timeout: 8000,
    });
    socket.on("connect", () => { setConnected(true); socket.emit("join-match", matchId); fetchData(); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("score-updated", fetchData);
    const poll = setInterval(fetchData, POLL_MS);
    const refresh = () => fetchData();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      socket.disconnect();
      clearInterval(poll);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [matchId, fetchData]);

  if (error && !data) {
    return (<><NoScroll /><CenterScreen><ErrorIcon>!</ErrorIcon><ErrorText>{error}</ErrorText><RetryButton onClick={fetchData}>Retry</RetryButton></CenterScreen></>);
  }
  if (!data) {
    return (<><NoScroll /><CenterScreen><Spinner /><LoadingText>Loading scoreboard…</LoadingText></CenterScreen></>);
  }

  const title = `${data.teamA?.name || "Team A"} vs ${data.teamB?.name || "Team B"}`;
  return <LiveBoard data={data} connected={connected} title={title} />;
};

export default TVScoreboard;
