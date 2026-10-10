import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled, { keyframes, css, createGlobalStyle } from "styled-components";
import fullLogo from "../assets/criczone_full_logo.png";
import { shortenName } from "../utils/nameDisplay";
import SummaryBoard from "./tv/SummaryBoard";
import { getBallType, formatBall } from "./tv/LiveBoard";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const POLL_MS = 2500;

// Sample frame for previewing the overlay layout without a live match: open
// /overlay/demo?demo=1 (any id works with ?demo). Exercises long names, the
// chase line and both team crests (falls back to initials when no crest).
const DEMO_PAYLOAD = {
  mode: "live",
  tournamentName: "Balangoda Indoor Premier League",
  summary: null,
  live: {
    currentInnings: 2,
    status: "in_progress",
    battingTeam: "Smashers",
    bowlingTeam: "Thunders",
    runs: 72, wickets: 3, overs: "6.0", runRate: "12.00",
    logos: {},
    striker: { name: "Hiranya Deshapriya", runs: 34, balls: 19 },
    nonStriker: { name: "Isuru Lakshan", runs: 21, balls: 14 },
    bowler: { name: "Zamseer Ahamed", wickets: 1, runs: 28, overs: "2.0" },
    thisOver: [1, 4, 0, 6, "W"],
    requiredRuns: 60, ballsRemaining: 24, requiredRunRate: "15.00",
  },
};

// Professional broadcast overlay for OBS. Single match (/overlay/:matchId) or a
// whole tournament (/overlay/tournament/:tournamentId): auto-switches to each
// new match and shows a full summary card between games.
const Overlay = () => {
  const params = useParams();
  const isTournament = !!params.tournamentId;
  const id = params.tournamentId || params.matchId;
  const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");

  const [payload, setPayload] = useState(isDemo ? DEMO_PAYLOAD : null);
  const [connected, setConnected] = useState(isDemo);
  const payloadRef = useRef(null);
  useEffect(() => { payloadRef.current = payload; }, [payload]);

  const fetchData = useCallback(async () => {
    try {
      const url = isTournament
        ? `${API_URL}/api/public/tournament-tv/${id}?t=${Date.now()}`
        : `${API_URL}/api/public/overlay/${id}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setPayload(isTournament
          ? { mode: json.data.mode, live: json.data.overlay, summary: json.data.summary, tournamentName: json.data.tournamentName }
          : { mode: "live", live: json.data, summary: null, tournamentName: null });
      }
    } catch (err) { /* keep last frame; poll/reconnect recovers */ }
  }, [id, isTournament]);

  useEffect(() => {
    if (isDemo) return; // preview mode: render sample data, no network
    fetchData();
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 3000, timeout: 8000,
    });
    socket.on("connect", () => {
      setConnected(true);
      if (isTournament) socket.emit("join-public-live"); else socket.emit("join-match", id);
      fetchData();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("score-updated", fetchData);
    socket.on("public-live-update", fetchData);
    const poll = setInterval(fetchData, POLL_MS);
    const refresh = () => fetchData();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      try { if (isTournament) socket.emit("leave-public-live"); } catch (_) {}
      socket.disconnect();
      clearInterval(poll);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id, isTournament, fetchData, isDemo]);

  if (!payload) return <ObsGlobal />;

  if (payload.mode === "summary" && payload.summary) {
    return <><ObsGlobal /><SummaryBoard summary={payload.summary} title={payload.tournamentName} variant="overlay" /></>;
  }
  if (payload.mode === "idle") {
    return <><ObsGlobal /><IdleBadge><img src={fullLogo} alt="" /><span>{payload.tournamentName || "CricZone"}</span><Up>Next match starting soon</Up></IdleBadge></>;
  }
  if (payload.live) {
    return <><ObsGlobal /><LiveOverlay data={payload.live} connected={connected} /></>;
  }
  return <ObsGlobal />;
};

// Up-to-3-letter initials for a team with no uploaded crest.
const initials = (name = "") =>
  (name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase()) || "–";

// ---- Live overlay ----------------------------------------------------------
const LiveOverlay = ({ data, connected }) => {
  const isSecond = data.currentInnings === 2;
  const done = data.status === "completed";
  const battingTeam = data.battingTeam || data.teamA?.name || "Team";
  const bowlingTeam = data.bowlingTeam || data.teamB?.name || "Team";
  const need = isSecond && data.requiredRuns != null ? Math.max(0, data.requiredRuns) : null;
  const scoreKey = `${data.runs}-${data.wickets}`;
  const logos = data.logos || {};
  const battingLogo = logos[battingTeam] || "";
  const bowlingLogo = logos[bowlingTeam] || "";

  return (
    <>
      {/* Screen corners: brand + live status */}
      <CornerLogo><img src={fullLogo} alt="CricZone" /></CornerLogo>
      <CornerRight>
        {done
          ? <ResultTag>RESULT</ResultTag>
          : <LivePill $on={connected}><LiveDot />LIVE</LivePill>}
      </CornerRight>

      {/* Lower-third scorebar */}
      <BarWrap>
        <Bar>
          {/* Batting team crest — left corner */}
          <SideLogoCell $batting title={battingTeam}>
            {battingLogo
              ? <SideLogo src={battingLogo} alt="" />
              : <SideLogoFallback $batting>{initials(battingTeam)}</SideLogoFallback>}
          </SideLogoCell>

          <ScoreCell>
            <TeamName>{battingTeam}</TeamName>
            <ScoreRow>
              <ScoreBig key={scoreKey}>{data.runs ?? 0}<i>/</i>{data.wickets ?? 0}</ScoreBig>
              <OversSide>{data.overs || "0.0"}<small> OV</small></OversSide>
            </ScoreRow>
          </ScoreCell>

          <CrrCell>
            <CellLabel>CRR</CellLabel>
            <CrrNum>{data.runRate || "0.00"}</CrrNum>
          </CrrCell>

          <BattersCell>
            {data.striker && (
              <PLine $on>
                <StrikerArrow /><Nm>{shortenName(data.striker.name)}</Nm>
                <Rn>{data.striker.runs}<em> ({data.striker.balls})</em></Rn>
              </PLine>
            )}
            {data.nonStriker && (
              <PLine>
                <Nm>{shortenName(data.nonStriker.name)}</Nm>
                <Rn>{data.nonStriker.runs}<em> ({data.nonStriker.balls})</em></Rn>
              </PLine>
            )}
          </BattersCell>

          {data.bowler && (
            <BowlerCell>
              <NmB>{shortenName(data.bowler.name)}</NmB>
              <BowlFig>{data.bowler.wickets}-{data.bowler.runs} <em>({data.bowler.overs})</em></BowlFig>
            </BowlerCell>
          )}

          <OverCell>
            <Balls>
              {data.thisOver && data.thisOver.length > 0
                ? data.thisOver.slice(-9).map((b, i) => <Ball key={i} $type={getBallType(b)}>{formatBall(b)}</Ball>)
                : <NewOver>New over</NewOver>}
            </Balls>
          </OverCell>

          {done && data.result ? (
            <RateCell><ResultInline>{data.result}</ResultInline></RateCell>
          ) : (!done && isSecond && need != null) ? (
            <RateCell>
              <NeedLine>NEED {need} OFF {data.ballsRemaining ?? 0} BALLS</NeedLine>
              <RateSub>RRR {data.requiredRunRate || "-"}</RateSub>
            </RateCell>
          ) : null}

          {/* Bowling team crest — right corner */}
          <SideLogoCell $bowling title={bowlingTeam}>
            {bowlingLogo
              ? <SideLogo src={bowlingLogo} alt="" />
              : <SideLogoFallback>{initials(bowlingTeam)}</SideLogoFallback>}
          </SideLogoCell>
        </Bar>
      </BarWrap>
    </>
  );
};

// ---- styles ----------------------------------------------------------------
const slideUp = keyframes`from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}`;
const dropIn = keyframes`from{transform:translateY(-120%);opacity:0}to{transform:translateY(0);opacity:1}`;
const pop = keyframes`0%{transform:scale(1)}35%{transform:scale(1.16)}100%{transform:scale(1)}`;
const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.35}`;
/* Premium logo entrance + a slow gloss sweep that rests between passes. */
const logoIn = keyframes`0%{transform:translateY(-130%) scale(.9);opacity:0}60%{transform:translateY(6%) scale(1.02);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}`;
const sheen = keyframes`0%{left:-70%}18%{left:140%}100%{left:140%}`;
const floaty = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}`;

const ObsGlobal = createGlobalStyle`
  html, body, #root { margin:0; height:100%; background:transparent !important; overflow:hidden; }
  * { box-sizing:border-box; }
`;

const FONT = css`font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;

/* Logo sits on a clean white card so it stays crisp over any video, with a
   premium drop-in and a periodic gloss sweep + gentle float. */
const CornerLogo = styled.div`
  position: fixed; top: 2.4vh; left: 2vw; z-index: 3;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  padding: clamp(7px,1.2vh,15px) clamp(11px,1.5vw,22px); border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #eef2f7 100%);
  border: 1px solid rgba(255,255,255,.8);
  box-shadow: 0 12px 30px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.95);
  animation: ${logoIn} .8s cubic-bezier(.2,.85,.3,1.15) both, ${floaty} 4.5s ease-in-out 1s infinite;
  img { height: clamp(44px, 8.4vh, 108px); width: auto; object-fit: contain; display: block; }
  &::after {
    content: ""; position: absolute; top: 0; bottom: 0; width: 45%;
    background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,.85) 50%, transparent 100%);
    transform: skewX(-18deg); filter: blur(1px);
    animation: ${sheen} 6s ease-in-out 1.2s infinite;
  }
`;
const CornerRight = styled.div`position: fixed; top: 3vh; right: 2.6vw; animation: ${dropIn} .6s ease both; ${FONT}`;
const LivePill = styled.div`
  display:flex; align-items:center; gap:.5vw; padding:.6vh 1vw; border-radius:999px; color:#fff;
  background:#dc2626; font-weight:900; letter-spacing:1.5px; font-size:clamp(11px,1.8vh,24px);
  box-shadow:0 8px 24px rgba(220,38,38,.45); ${p => p.$on && css`animation:${pulse} 1.6s ease-in-out infinite;`}
`;
const LiveDot = styled.span`width:1vh;height:1vh;min-width:7px;min-height:7px;border-radius:50%;background:#fff;`;
const ResultTag = styled.div`padding:.6vh 1vw;border-radius:999px;background:#6366f1;color:#fff;font-weight:900;letter-spacing:1.5px;font-size:clamp(11px,1.8vh,24px);`;

const BarWrap = styled.div`position: fixed; left: 0; right: 0; bottom: 2.6vh; display: flex; justify-content: center; ${FONT} animation: ${slideUp} .6s cubic-bezier(.18,.9,.32,1.1) both;`;
const Bar = styled.div`
  display: flex; align-items: stretch; height: clamp(54px, 9.2vh, 104px); width: 96vw;
  border-radius: 14px; overflow: hidden; color: #fff;
  background: linear-gradient(180deg, rgba(15,23,42,.95), rgba(11,17,32,.97));
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 16px 44px rgba(0,0,0,.55); backdrop-filter: blur(6px);
`;
const Cell = styled.div`display: flex; flex-direction: column; justify-content: center; gap: .25vh; padding: 0 clamp(9px,1.1vw,22px); border-right: 1px solid rgba(255,255,255,.1); min-width: 0;`;
const CellLabel = styled.div`font-size: clamp(8px,1.1vh,14px); font-weight: 900; letter-spacing: 1.6px; color: #64748b;`;

/* Team crest cells frame the bar: batting on the left, bowling on the right. */
const SideLogoCell = styled.div`
  display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
  padding: 0 clamp(7px,0.8vw,16px);
  ${p => p.$batting && css`background: linear-gradient(135deg,#4f46e5,#7c3aed);`}
  ${p => p.$bowling && css`background: rgba(255,255,255,.04); border-left: 1px solid rgba(255,255,255,.1);`}
`;
const SideLogo = styled.img`
  height: clamp(28px,4.9vh,56px); width: clamp(28px,4.9vh,56px); border-radius: 50%;
  object-fit: cover; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.4);
`;
const SideLogoFallback = styled.div`
  height: clamp(28px,4.9vh,56px); width: clamp(28px,4.9vh,56px); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-weight: 900;
  font-size: clamp(10px,1.7vh,20px); color: #fff; letter-spacing: .5px;
  border: 2px solid rgba(255,255,255,.4);
  background: ${p => p.$batting ? "rgba(255,255,255,.16)" : "linear-gradient(135deg,#1e293b,#334155)"};
`;

const ScoreCell = styled(Cell)`
  flex: 1.1; align-items: center; justify-content: center; text-align: center; gap: .3vh; min-width: 0;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
`;
const TeamName = styled.div`font-size: clamp(10px,1.7vh,22px); font-weight: 900; letter-spacing: .4px; color: #fff; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;`;
const ScoreRow = styled.div`display: flex; align-items: baseline; justify-content: center; gap: 1.4vw;`;
const ScoreBig = styled.div`font-size: clamp(22px,4.4vh,56px); font-weight: 900; line-height: 1; letter-spacing: -1px; animation: ${pop} .5s ease; i{ font-style:normal; color: rgba(255,255,255,.6); margin: 0 2px; }`;
const OversSide = styled.div`font-size: clamp(13px,2.4vh,30px); font-weight: 900; color: rgba(255,255,255,.92); small{ font-size:.5em; font-weight:800; color: rgba(255,255,255,.8); letter-spacing:1px; }`;
const CrrCell = styled(Cell)`flex: .5; min-width: 0; align-items: center; justify-content: center; text-align: center;`;
const CrrNum = styled.div`font-size: clamp(15px,2.9vh,36px); font-weight: 900; color: #22c55e; line-height: 1.05;`;

const BattersCell = styled(Cell)`flex: 1.4; min-width: 0; justify-content: center; gap: .4vh;`;
const PLine = styled.div`
  display: flex; align-items: center; gap: .5vw; font-size: clamp(11px,1.95vh,25px); color: ${p => p.$on ? "#fff" : "#cbd5e1"};
`;
/* Small green arrow marks the striker (no big highlight). */
const StrikerArrow = styled.span`
  width: 0; height: 0; flex-shrink: 0;
  border-top: clamp(4px,.8vh,8px) solid transparent;
  border-bottom: clamp(4px,.8vh,8px) solid transparent;
  border-left: clamp(7px,1.2vh,12px) solid #22c55e;
`;
const Nm = styled.span`font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 13vw;`;
const Rn = styled.span`margin-left: auto; font-weight: 900; padding-left: .8vw; em{ font-style:normal; color:#94a3b8; font-size:.62em; font-weight:700; }`;

const BowlerCell = styled(Cell)`flex: .95; min-width: 0; justify-content: center;`;
const NmB = styled.span`font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: block; font-size: clamp(11px,1.95vh,25px);`;
const BowlFig = styled.div`font-size: clamp(12px,1.95vh,25px); font-weight: 900; color: #f8fafc; em{ font-style:normal; color:#94a3b8; font-size:.66em; font-weight:700; }`;

const OverCell = styled(Cell)`flex: 1.35; min-width: 0; justify-content: center;`;
const Balls = styled.div`display: flex; gap: .3vw; align-items: center; flex-wrap: nowrap; overflow: hidden;`;
const Ball = styled.div`
  width: clamp(20px,3.4vh,37px); height: clamp(20px,3.4vh,37px); border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: clamp(9px,1.5vh,17px);
  ${p => { switch (p.$type) {
    case "wicket": return css`background:#ef4444;`;
    case "wide": case "noball": return css`background:#f59e0b;`;
    case "four": return css`background:#22c55e;`;
    case "six": return css`background:#8b5cf6;`;
    case "dot": return css`background:#334155;color:#94a3b8;`;
    default: return css`background:#2563eb;`;
  } }}
`;
const NewOver = styled.div`color:#64748b; font-size: clamp(11px,1.9vh,23px); font-weight:700;`;

const RateCell = styled(Cell)`flex: 1.45; min-width: 0; align-items: flex-start; justify-content: center;`;
const NeedLine = styled.div`font-size: clamp(11px,1.9vh,23px); font-weight: 900; color: #fca5a5; white-space: nowrap; letter-spacing: .2px;`;
const RateSub = styled.div`font-size: clamp(9px,1.55vh,19px); font-weight: 800; color: #94a3b8; margin-top: 2px;`;
const ResultInline = styled.div`font-size: clamp(13px,2.2vh,28px); font-weight: 900; color: #fff; max-width: 22vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;

const IdleBadge = styled.div`
  position: fixed; left: 3vw; bottom: 3.4vh; display:flex; align-items:center; gap:1.2vw;
  padding: 1.4vh 1.8vw; border-radius: 16px; color:#fff;
  background: linear-gradient(180deg, rgba(15,23,42,.92), rgba(11,17,32,.95));
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 14px 40px rgba(0,0,0,.5); ${FONT}
  animation: ${slideUp} .6s ease both;
  img { height: clamp(40px,7vh,90px); width:auto; object-fit:contain; }
  span { font-size: clamp(16px,2.8vh,36px); font-weight:900; }
`;
const Up = styled.div`font-size: clamp(11px,1.7vh,22px); color:#64748b; font-weight:800; letter-spacing:1px; margin-left:.6vw;`;

export default Overlay;
