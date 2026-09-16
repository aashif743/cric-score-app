import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled, { keyframes, css, createGlobalStyle } from "styled-components";
import fullLogo from "../assets/criczone_full_logo.png";
import SummaryBoard from "./tv/SummaryBoard";
import { getBallType, formatBall } from "./tv/LiveBoard";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const POLL_MS = 2500;

// Professional broadcast overlay for OBS. Single match (/overlay/:matchId) or a
// whole tournament (/overlay/tournament/:tournamentId): auto-switches to each
// new match and shows a full summary card between games.
const Overlay = () => {
  const params = useParams();
  const isTournament = !!params.tournamentId;
  const id = params.tournamentId || params.matchId;

  const [payload, setPayload] = useState(null);
  const [connected, setConnected] = useState(false);
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
  }, [id, isTournament, fetchData]);

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

// ---- Live overlay ----------------------------------------------------------
const LiveOverlay = ({ data, connected }) => {
  const isSecond = data.currentInnings === 2;
  const done = data.status === "completed";
  const battingTeam = data.battingTeam || data.teamA?.name || "Team";
  const need = isSecond && data.requiredRuns != null ? Math.max(0, data.requiredRuns) : null;
  const scoreKey = `${data.runs}-${data.wickets}`;
  const battingLogo = (data.logos && data.logos[battingTeam]) || "";

  return (
    <>
      {/* Corners */}
      <CornerLogo src={fullLogo} alt="CricZone" />
      <CornerRight>
        {done
          ? <ResultTag>RESULT</ResultTag>
          : <LivePill $on={connected}><LiveDot />LIVE</LivePill>}
      </CornerRight>

      {/* Lower-third scorebar */}
      <BarWrap>
        <Bar>
          <ScoreCell>
            <TeamNameRow>
              {battingLogo ? <TeamLogo src={battingLogo} alt="" /> : null}
              <TeamName>{battingTeam}</TeamName>
            </TeamNameRow>
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
                <StrikerArrow /><Nm>{data.striker.name}</Nm>
                <Rn>{data.striker.runs}<em> ({data.striker.balls})</em></Rn>
              </PLine>
            )}
            {data.nonStriker && (
              <PLine>
                <Nm>{data.nonStriker.name}</Nm>
                <Rn>{data.nonStriker.runs}<em> ({data.nonStriker.balls})</em></Rn>
              </PLine>
            )}
          </BattersCell>

          {data.bowler && (
            <BowlerCell>
              <Nm>{data.bowler.name}</Nm>
              <BowlFig>{data.bowler.wickets}-{data.bowler.runs} <em>({data.bowler.overs})</em></BowlFig>
            </BowlerCell>
          )}

          <OverCell>
            <Balls>
              {data.thisOver && data.thisOver.length > 0
                ? data.thisOver.slice(-10).map((b, i) => <Ball key={i} $type={getBallType(b)}>{formatBall(b)}</Ball>)
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

const ObsGlobal = createGlobalStyle`
  html, body, #root { margin:0; height:100%; background:transparent !important; overflow:hidden; }
  * { box-sizing:border-box; }
`;

const FONT = css`font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;

const CornerLogo = styled.img`
  position: fixed; top: 2.6vh; left: 2.4vw; height: clamp(64px, 13vh, 190px); width: auto; object-fit: contain;
  filter: drop-shadow(0 6px 16px rgba(0,0,0,.5)); animation: ${dropIn} .6s ease both;
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
  display: flex; align-items: stretch; height: clamp(58px, 10vh, 116px); width: 96vw;
  border-radius: 14px; overflow: hidden; color: #fff;
  background: linear-gradient(180deg, rgba(15,23,42,.95), rgba(11,17,32,.97));
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 16px 44px rgba(0,0,0,.55); backdrop-filter: blur(6px);
`;
const Cell = styled.div`display: flex; flex-direction: column; justify-content: center; gap: .3vh; padding: 0 clamp(12px,1.4vw,30px); border-right: 1px solid rgba(255,255,255,.1);`;
const CellLabel = styled.div`font-size: clamp(9px,1.3vh,17px); font-weight: 900; letter-spacing: 2px; color: #64748b;`;

const ScoreCell = styled(Cell)`
  flex: 1.25; align-items: center; justify-content: center; text-align: center; gap: .4vh; min-width: 0;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
`;
const TeamNameRow = styled.div`display: flex; align-items: center; justify-content: center; gap: .6vw; max-width: 100%;`;
const TeamLogo = styled.img`height: clamp(16px,3vh,40px); width: clamp(16px,3vh,40px); border-radius: 50%; object-fit: cover; background: #fff; flex-shrink: 0;`;
const TeamName = styled.div`font-size: clamp(12px,2.2vh,30px); font-weight: 900; letter-spacing: .5px; color: #fff; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;`;
const ScoreRow = styled.div`display: flex; align-items: baseline; justify-content: center; gap: 1.8vw;`;
const ScoreBig = styled.div`font-size: clamp(26px,5.2vh,72px); font-weight: 900; line-height: 1; letter-spacing: -1px; animation: ${pop} .5s ease; i{ font-style:normal; color: rgba(255,255,255,.6); margin: 0 2px; }`;
const OversSide = styled.div`font-size: clamp(15px,2.8vh,38px); font-weight: 900; color: rgba(255,255,255,.92); small{ font-size:.5em; font-weight:800; color: rgba(255,255,255,.8); letter-spacing:1px; }`;
const CrrCell = styled(Cell)`flex: .6; min-width: 0; align-items: center; justify-content: center; text-align: center;`;
const CrrNum = styled.div`font-size: clamp(18px,3.4vh,46px); font-weight: 900; color: #22c55e; line-height: 1.05;`;

const BattersCell = styled(Cell)`flex: 1.35; min-width: 0; justify-content: center; gap: .5vh;`;
const PLine = styled.div`
  display: flex; align-items: center; gap: .5vw; font-size: clamp(13px,2.3vh,32px); color: ${p => p.$on ? "#fff" : "#cbd5e1"};
`;
/* Small green arrow marks the striker (no big highlight). */
const StrikerArrow = styled.span`
  width: 0; height: 0; flex-shrink: 0;
  border-top: clamp(5px,1vh,9px) solid transparent;
  border-bottom: clamp(5px,1vh,9px) solid transparent;
  border-left: clamp(8px,1.4vh,13px) solid #22c55e;
`;
const Nm = styled.span`font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 12vw;`;
const Rn = styled.span`margin-left: auto; font-weight: 900; padding-left: 1vw; em{ font-style:normal; color:#94a3b8; font-size:.62em; font-weight:700; }`;

const BowlerCell = styled(Cell)`flex: .7; min-width: 0;`;
const BowlFig = styled.div`font-size: clamp(14px,2.3vh,32px); font-weight: 900; color: #f8fafc; em{ font-style:normal; color:#94a3b8; font-size:.66em; font-weight:700; }`;

const OverCell = styled(Cell)`flex: 1.5; min-width: 0; justify-content: center;`;
const Balls = styled.div`display: flex; gap: .35vw; align-items: center; flex-wrap: nowrap; overflow: hidden;`;
const Ball = styled.div`
  width: clamp(22px,3.8vh,42px); height: clamp(22px,3.8vh,42px); border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: clamp(10px,1.7vh,20px);
  ${p => { switch (p.$type) {
    case "wicket": return css`background:#ef4444;`;
    case "wide": case "noball": return css`background:#f59e0b;`;
    case "four": return css`background:#22c55e;`;
    case "six": return css`background:#8b5cf6;`;
    case "dot": return css`background:#334155;color:#94a3b8;`;
    default: return css`background:#2563eb;`;
  } }}
`;
const NewOver = styled.div`color:#64748b; font-size: clamp(13px,2.2vh,28px); font-weight:700;`;

const RateCell = styled(Cell)`border-right: 0; flex: 1.55; min-width: 0; align-items: flex-start; justify-content: center;`;
const NeedLine = styled.div`font-size: clamp(14px,2.4vh,32px); font-weight: 900; color: #fca5a5; white-space: nowrap; letter-spacing: .2px;`;
const RateSub = styled.div`font-size: clamp(11px,1.9vh,24px); font-weight: 800; color: #94a3b8; margin-top: 2px;`;
const ResultInline = styled.div`font-size: clamp(15px,2.6vh,34px); font-weight: 900; color: #fff; max-width: 20vw;`;

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
