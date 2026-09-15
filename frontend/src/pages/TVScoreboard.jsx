import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled, { keyframes, css, createGlobalStyle } from "styled-components";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const POLL_MS = 2500; // reliable fallback cadence (socket gives instant updates)

const TVScoreboard = () => {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const dataRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Fetch latest overlay data. Never blanks the screen on a transient failure:
  // it only surfaces an error before the FIRST successful load; after that it
  // keeps the last board on screen and simply retries (poll / reconnect).
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}?t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else if (!dataRef.current) {
        setError(json.error || "Match not found");
      }
    } catch (err) {
      if (!dataRef.current) setError("Failed to connect to server");
    }
  }, [matchId]);

  useEffect(() => {
    fetchData();

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-match", matchId);
      fetchData(); // catch up immediately after (re)connect — key after a drop
    });
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
    return (
      <><NoScroll /><CenterScreen>
        <ErrorIcon>!</ErrorIcon>
        <ErrorText>{error}</ErrorText>
        <RetryButton onClick={fetchData}>Retry</RetryButton>
      </CenterScreen></>
    );
  }
  if (!data) {
    return (
      <><NoScroll /><CenterScreen>
        <Spinner />
        <LoadingText>Loading scoreboard…</LoadingText>
      </CenterScreen></>
    );
  }

  const isSecond = data.currentInnings === 2;
  const battingTeam = data.battingTeam || data.teamA?.name || "Team A";
  const bowlingTeam = data.bowlingTeam || data.teamB?.name || "Team B";
  const live = data.status === "in_progress";
  const done = data.status === "completed";
  const statusLabel = live ? "LIVE"
    : data.status === "innings_break" ? "INNINGS BREAK"
    : done ? "RESULT"
    : (data.status || "").toUpperCase().replace(/_/g, " ");
  const need = isSecond && data.requiredRuns != null ? Math.max(0, data.requiredRuns) : null;

  return (
    <><NoScroll />
    <Screen>
      {/* Header */}
      <Header>
        <HTeams>{data.teamA?.name} <VS>vs</VS> {data.teamB?.name}</HTeams>
        <HRight>
          <OversPill>{data.totalOvers} OVERS</OversPill>
          <Status $live={live} $status={data.status}>{statusLabel}</Status>
        </HRight>
      </Header>

      {/* HERO — the score, centered and dominant */}
      <Hero>
        <BatTeam>{battingTeam}</BatTeam>
        <ScoreLine>
          <Runs>{data.runs ?? 0}</Runs>
          <Slash>/</Slash>
          <Wkts>{data.wickets ?? 0}</Wkts>
        </ScoreLine>
        <SubLine>
          <Overs>{data.overs || "0.0"}<small> OVERS</small></Overs>
          <SubDot>•</SubDot>
          <Crr>CRR <b>{data.runRate || "0.00"}</b></Crr>
        </SubLine>

        {/* Chase — the most important info in the 2nd innings, highlighted */}
        {isSecond && data.target != null && !done && (
          <ChaseStrip>
            <ChaseNeed>
              <span>NEED</span>
              <strong>{need}</strong>
              <span>off {data.ballsRemaining ?? 0}</span>
            </ChaseNeed>
            <ChaseSide>
              <ChasePill><span>TARGET</span><b>{data.target}</b></ChasePill>
              <ChasePill $hi><span>REQ RR</span><b>{data.requiredRunRate || "-"}</b></ChasePill>
            </ChaseSide>
          </ChaseStrip>
        )}

        {isSecond && data.firstInnings && (
          <FirstInn>
            {data.firstInnings.battingTeam} {data.firstInnings.runs}/{data.firstInnings.wickets} ({data.firstInnings.overs})
          </FirstInn>
        )}

        {done && data.result && <Result>{data.result}</Result>}
      </Hero>

      {/* Info band */}
      <Band>
        <Card $flex={1.3}>
          <CardTitle>Batting</CardTitle>
          {data.striker && (
            <PRow $striker>
              <PName>{data.striker.name}<Star>●</Star></PName>
              <PScore>{data.striker.runs}<em> ({data.striker.balls})</em></PScore>
              <PMeta>SR {data.striker.strikeRate} · 4s {data.striker.fours} · 6s {data.striker.sixes}</PMeta>
            </PRow>
          )}
          {data.nonStriker && (
            <PRow>
              <PName>{data.nonStriker.name}</PName>
              <PScore>{data.nonStriker.runs}<em> ({data.nonStriker.balls})</em></PScore>
              <PMeta>SR {data.nonStriker.strikeRate} · 4s {data.nonStriker.fours} · 6s {data.nonStriker.sixes}</PMeta>
            </PRow>
          )}
          {!data.striker && !data.nonStriker && <Muted>Waiting for batsmen…</Muted>}
        </Card>

        <Card $flex={1}>
          <CardTitle>Bowling · {bowlingTeam}</CardTitle>
          {data.bowler ? (
            <PRow>
              <PName>{data.bowler.name}</PName>
              <PScore>{data.bowler.wickets}-{data.bowler.runs}<em> ({data.bowler.overs})</em></PScore>
              <PMeta>Econ {data.bowler.economy} · Maidens {data.bowler.maidens}</PMeta>
            </PRow>
          ) : <Muted>Waiting for bowler…</Muted>}
          <ExtrasLine>
            EXTRAS <b>{data.extras?.total || 0}</b>
            <span> · wd {data.extras?.wides || 0} · nb {data.extras?.noBalls || 0} · b {data.extras?.byes || 0} · lb {data.extras?.legByes || 0}</span>
          </ExtrasLine>
        </Card>

        <Card $flex={1}>
          <CardTitle>This Over</CardTitle>
          <Balls>
            {data.thisOver && data.thisOver.length > 0
              ? data.thisOver.map((b, i) => <Ball key={i} $type={getBallType(b)}>{formatBall(b)}</Ball>)
              : <Muted>New over</Muted>}
          </Balls>
          {data.partnership && (data.partnership.runs > 0 || data.partnership.balls > 0) && (
            <PartLine>P'SHIP <b>{data.partnership.runs}</b> ({data.partnership.balls})</PartLine>
          )}
        </Card>
      </Band>

      {/* Corner live indicator */}
      <ConnBadge $on={connected}>
        <ConnDot $on={connected} />
        {connected ? "Live" : "Reconnecting…"}
        <Brand>CricZone</Brand>
      </ConnBadge>
    </Screen></>
  );
};

// ---- helpers ---------------------------------------------------------------
const getBallType = (ball) => {
  const s = typeof ball === "string" ? ball.toUpperCase() : "";
  if (s.includes("W") && !s.includes("WD")) return "wicket";
  if (s.includes("WD")) return "wide";
  if (s.includes("NB")) return "noball";
  if (s === "4") return "four";
  if (s === "6") return "six";
  if (s === "0" || s === ".") return "dot";
  if (typeof ball === "object" && ball) {
    if (ball.wicket) return "wicket";
    if (ball.wide) return "wide";
    if (ball.noBall) return "noball";
    if (ball.runs === 4) return "four";
    if (ball.runs === 6) return "six";
    if (ball.runs === 0) return "dot";
  }
  return "normal";
};
const formatBall = (ball) => {
  if (typeof ball === "string") return ball;
  if (typeof ball === "object" && ball) {
    if (ball.wicket) return "W";
    if (ball.wide) return `${ball.runs || 1}wd`;
    if (ball.noBall) return `${ball.runs || 1}nb`;
    return (ball.runs ?? 0).toString();
  }
  return (ball ?? 0).toString();
};

// ---- styles ----------------------------------------------------------------
const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.45}`;
const spin = keyframes`to{transform:rotate(360deg)}`;

const NoScroll = createGlobalStyle`
  html, body, #root { margin:0; height:100%; overflow:hidden; background:#0b1120; }
  * { box-sizing: border-box; }
`;

const Screen = styled.div`
  position: relative;
  height: 100vh; width: 100vw; overflow: hidden;
  display: flex; flex-direction: column; gap: 1.4vh;
  padding: 2.2vh 2.6vw 2vh;
  background: radial-gradient(1400px 700px at 50% -20%, #1e293b 0%, #0b1120 62%), linear-gradient(160deg,#0b1120,#0f172a);
  color: #fff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const CenterScreen = styled.div`
  height:100vh;width:100vw;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:#0b1120;color:#fff;
`;
const ErrorIcon = styled.div`width:84px;height:84px;border-radius:50%;background:#7f1d1d;display:flex;align-items:center;justify-content:center;font-size:46px;font-weight:800;`;
const ErrorText = styled.div`font-size:24px;color:#fca5a5;`;
const RetryButton = styled.button`background:#3b82f6;color:#fff;border:0;padding:12px 34px;border-radius:10px;font-size:18px;font-weight:700;cursor:pointer;`;
const Spinner = styled.div`width:64px;height:64px;border:5px solid #1e293b;border-top-color:#3b82f6;border-radius:50%;animation:${spin} 1s linear infinite;`;
const LoadingText = styled.div`font-size:20px;color:#94a3b8;`;

/* Header */
const Header = styled.header`
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 2vw;
`;
const HTeams = styled.h1`
  margin:0; font-weight:800; letter-spacing:-.5px; color:#e2e8f0;
  font-size: clamp(18px, 3vh, 46px);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
`;
const VS = styled.span`color:#64748b; margin:0 .5vw;`;
const HRight = styled.div`display:flex; align-items:center; gap:1vw; flex-shrink:0;`;
const OversPill = styled.div`
  padding:.8vh 1.4vw; border-radius:999px; background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14); color:#cbd5e1; font-weight:800;
  font-size:clamp(12px,1.9vh,24px); letter-spacing:1px; white-space:nowrap;
`;
const Status = styled.div`
  padding:.8vh 1.6vw; border-radius:999px; font-weight:900; letter-spacing:1.5px; color:#fff;
  font-size:clamp(12px,2vh,26px); white-space:nowrap;
  background:${p => p.$status === "completed" ? "#6366f1" : p.$status === "innings_break" ? "#f59e0b" : "#22c55e"};
  ${p => p.$live && css`animation:${pulse} 1.6s ease-in-out infinite;`}
`;

/* Hero — centered, dominant */
const Hero = styled.section`
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 0.4vh;
`;
const BatTeam = styled.div`
  font-size: clamp(26px, 5.4vh, 96px); font-weight: 900; letter-spacing:-1px; color:#60a5fa;
  max-width: 92vw; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.05;
`;
const ScoreLine = styled.div`display:flex; align-items:baseline; justify-content:center; line-height:.82;`;
const Runs = styled.span`
  font-size: clamp(120px, 33vh, 480px); font-weight: 900; letter-spacing:-6px;
  background: linear-gradient(180deg,#ffffff,#cbd5e1);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
`;
const Slash = styled.span`font-size: clamp(64px, 16vh, 220px); color:#475569; font-weight:300; margin:0 .5vw;`;
const Wkts = styled.span`font-size: clamp(70px, 18vh, 260px); font-weight:800; color:#f87171;`;
const SubLine = styled.div`
  margin-top:.6vh; display:flex; align-items:center; gap:1.6vw;
  font-size: clamp(22px, 4.4vh, 66px); font-weight:800; color:#cbd5e1;
  small{ font-size:.5em; color:#94a3b8; margin-left:6px; letter-spacing:1px; }
`;
const Overs = styled.span``;
const SubDot = styled.span`color:#475569;`;
const Crr = styled.span`color:#94a3b8; b{ color:#22c55e; }`;

const ChaseStrip = styled.div`
  margin-top: 1.4vh; display:flex; align-items:center; gap:1.4vw; flex-wrap:wrap; justify-content:center;
  padding:1.2vh 2vw; border-radius:2vh;
  background: rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.4);
`;
const ChaseNeed = styled.div`
  display:flex; align-items:baseline; gap:.8vw; color:#fecaca; font-weight:800;
  font-size: clamp(18px, 3.2vh, 44px);
  strong{ color:#fff; font-size: clamp(34px, 6.4vh, 92px); font-weight:900; line-height:1; }
`;
const ChaseSide = styled.div`display:flex; gap:1vw;`;
const ChasePill = styled.div`
  text-align:center; padding:.6vh 1.2vw; border-radius:1.2vh;
  background:${p => p.$hi ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.06)"};
  border:1px solid ${p => p.$hi ? "rgba(239,68,68,.45)" : "rgba(255,255,255,.12)"};
  span{ display:block; font-size:clamp(10px,1.4vh,18px); letter-spacing:1px; color:#94a3b8; font-weight:800; }
  b{ display:block; font-size:clamp(20px,3.4vh,44px); font-weight:900; color:${p => p.$hi ? "#fca5a5" : "#fff"}; }
`;
const FirstInn = styled.div`margin-top:1.2vh; font-size:clamp(14px,2.4vh,32px); color:#64748b; font-weight:600;`;
const Result = styled.div`
  margin-top:1.4vh; padding:1.2vh 2.4vw; border-radius:1.6vh;
  background: linear-gradient(135deg, rgba(99,102,241,.28), rgba(168,85,247,.28));
  border:1px solid rgba(129,140,248,.55);
  font-size: clamp(20px, 4vh, 60px); font-weight:900; color:#fff;
`;

/* Info band */
const Band = styled.section`
  flex-shrink: 0; display: flex; gap: 1.4vw; height: 27vh;
  @media (orientation: portrait) { height: auto; flex-wrap: wrap; }
`;
const Card = styled.div`
  flex: ${p => p.$flex || 1}; min-width: 0; overflow: hidden;
  background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
  border-radius: 1.6vh; padding: 1.3vh 1.3vw;
  display:flex; flex-direction:column; gap:.7vh; justify-content:flex-start;
`;
const CardTitle = styled.div`
  font-size: clamp(11px, 1.7vh, 22px); font-weight:900; letter-spacing:2px; color:#64748b; text-transform:uppercase;
  padding-bottom:.6vh; border-bottom:1px solid rgba(255,255,255,.08);
`;
const PRow = styled.div`
  display:grid; grid-template-columns:1fr auto; align-items:baseline; column-gap:1vw;
  padding:.5vh .8vw; border-radius:1vh;
  ${p => p.$striker && css`background:rgba(34,197,94,.14); border:1px solid rgba(34,197,94,.4);`}
`;
const PName = styled.div`
  font-size:clamp(18px,2.9vh,42px); font-weight:800; color:#fff;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:.5vw;
`;
const Star = styled.span`color:#22c55e; font-size:.55em;`;
const PScore = styled.div`
  font-size:clamp(20px,3.3vh,48px); font-weight:900; color:#fff; white-space:nowrap;
  em{ font-style:normal; color:#94a3b8; font-size:.58em; font-weight:700; }
`;
const PMeta = styled.div`grid-column:1/-1; font-size:clamp(12px,1.9vh,26px); color:#94a3b8; font-weight:600; margin-top:.2vh;`;
const Muted = styled.div`color:#64748b; font-size:clamp(14px,2.2vh,30px); font-weight:600;`;
const ExtrasLine = styled.div`
  margin-top:auto; font-size:clamp(12px,1.9vh,24px); color:#94a3b8; font-weight:700;
  b{ color:#e2e8f0; } span{ color:#64748b; font-weight:600; }
`;
const PartLine = styled.div`margin-top:auto; font-size:clamp(13px,2.1vh,28px); color:#60a5fa; font-weight:800; b{color:#93c5fd;}`;

const Balls = styled.div`display:flex; gap:.8vw; flex-wrap:wrap; align-items:center;`;
const Ball = styled.div`
  width:clamp(36px,5.6vh,72px); height:clamp(36px,5.6vh,72px); border-radius:50%;
  display:flex; align-items:center; justify-content:center; font-weight:900; color:#fff;
  font-size:clamp(15px,2.5vh,32px);
  ${p => {
    switch (p.$type) {
      case "wicket": return css`background:#ef4444;`;
      case "wide":
      case "noball": return css`background:#f59e0b;`;
      case "four": return css`background:#22c55e;`;
      case "six": return css`background:#8b5cf6;`;
      case "dot": return css`background:#334155;color:#94a3b8;`;
      default: return css`background:#2563eb;`;
    }
  }}
`;

const ConnBadge = styled.div`
  position:absolute; top:1.6vh; right:2.6vw; display:flex; align-items:center; gap:.6vw;
  font-size:clamp(11px,1.6vh,20px); color:#94a3b8; font-weight:700;
`;
const ConnDot = styled.span`
  width:1.2vh;height:1.2vh;min-width:9px;min-height:9px;border-radius:50%;
  background:${p => p.$on ? "#22c55e" : "#ef4444"};
  ${p => p.$on && css`animation:${pulse} 1.6s ease-in-out infinite;`}
`;
const Brand = styled.span`margin-left:.6vw;color:#60a5fa;font-weight:900;`;

export default TVScoreboard;
