import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled, { keyframes, css, createGlobalStyle } from "styled-components";
import brand from "../assets/criczone_icon.png";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const POLL_MS = 2500;

// Professional broadcast lower-third for OBS. Works for a single match
// (/overlay/:matchId) or a whole tournament (/overlay/tournament/:tournamentId),
// auto-switching to each new match and showing a result bar between games.
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
        // Normalise both endpoints to { mode, live, summary, tournamentName }.
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

  const Transparent = <ObsGlobal />;

  if (!payload) return Transparent;

  if (payload.mode === "summary" && payload.summary) {
    return <>{Transparent}<SummaryBar summary={payload.summary} tournamentName={payload.tournamentName} /></>;
  }
  if (payload.mode === "idle") {
    return <>{Transparent}<IdleBadge><Logo src={brand} alt="" /><span>{payload.tournamentName || "CricZone"}</span><Up>Next match starting soon</Up></IdleBadge></>;
  }
  if (payload.live) {
    return <>{Transparent}<LiveBar data={payload.live} connected={connected} /></>;
  }
  return Transparent;
};

// ---- Live lower-third ------------------------------------------------------
const LiveBar = ({ data, connected }) => {
  const isSecond = data.currentInnings === 2;
  const done = data.status === "completed";
  const battingTeam = data.battingTeam || data.teamA?.name || "Team";
  const battingShort = (battingTeam || "TM").substring(0, 3).toUpperCase();
  const need = isSecond && data.requiredRuns != null ? Math.max(0, data.requiredRuns) : null;
  const scoreKey = `${data.runs}-${data.wickets}`; // re-key to pop on change

  return (
    <BarWrap>
      <Bar>
        <LogoCell><Logo src={brand} alt="CricZone" /></LogoCell>

        <ScoreCell>
          <TeamTag>{battingShort}</TeamTag>
          <ScoreBig key={scoreKey}>{data.runs ?? 0}<i>/</i>{data.wickets ?? 0}</ScoreBig>
          <OversTag>{data.overs || "0.0"} ov</OversTag>
        </ScoreCell>

        <BattersCell>
          {data.striker && (
            <PLine $on><Dotm /><Nm>{lastName(data.striker.name)}</Nm><Rn>{data.striker.runs}<em> ({data.striker.balls})</em></Rn></PLine>
          )}
          {data.nonStriker && (
            <PLine><Nm>{lastName(data.nonStriker.name)}</Nm><Rn>{data.nonStriker.runs}<em> ({data.nonStriker.balls})</em></Rn></PLine>
          )}
        </BattersCell>

        {data.bowler && (
          <BowlerCell>
            <CellLabel>BOWLING</CellLabel>
            <Nm>{lastName(data.bowler.name)}</Nm>
            <BowlFig>{data.bowler.wickets}-{data.bowler.runs} <em>({data.bowler.overs})</em></BowlFig>
          </BowlerCell>
        )}

        <RateCell>
          {!done && isSecond && need != null ? (
            <>
              <CellLabel>NEED</CellLabel>
              <NeedBig>{need}<small> off {data.ballsRemaining ?? 0}</small></NeedBig>
              <RateSub>RRR {data.requiredRunRate || "-"}</RateSub>
            </>
          ) : (
            <>
              <CellLabel>CRR</CellLabel>
              <RateBig>{data.runRate || "0.00"}</RateBig>
              {isSecond && data.target != null && <RateSub>Trgt {data.target}</RateSub>}
            </>
          )}
        </RateCell>

        <StatusCell>
          {done ? <ResultTag>RESULT</ResultTag> : <LivePill $on={connected}><LiveDot />LIVE</LivePill>}
        </StatusCell>
      </Bar>

      {done && data.result && <SubStrip>{data.result}</SubStrip>}
    </BarWrap>
  );
};

// ---- Summary lower-third (between matches) ---------------------------------
const SummaryBar = ({ summary, tournamentName }) => {
  const a = summary.innings1, b = summary.innings2;
  return (
    <BarWrap>
      <Bar $summary>
        <LogoCell><Logo src={brand} alt="CricZone" /></LogoCell>
        <SumResult>
          <CellLabel>{tournamentName || "MATCH RESULT"}</CellLabel>
          <SumResultText>{summary.result || "Match complete"}</SumResultText>
        </SumResult>
        <SumScores>
          {a && <SumScore><b>{a.battingTeam}</b> {a.runs}/{a.wickets} <i>({a.overs})</i></SumScore>}
          {b && <SumScore><b>{b.battingTeam}</b> {b.runs}/{b.wickets} <i>({b.overs})</i></SumScore>}
        </SumScores>
        {summary.playerOfMatch && (
          <SumPotm>
            <CellLabel>PLAYER OF THE MATCH</CellLabel>
            <PotmName>{summary.playerOfMatch}{summary.playerOfMatchLine ? <em> · {summary.playerOfMatchLine}</em> : null}</PotmName>
          </SumPotm>
        )}
      </Bar>
    </BarWrap>
  );
};

const lastName = (n) => {
  if (!n) return "";
  const parts = String(n).trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

// ---- styles ----------------------------------------------------------------
const slideUp = keyframes`from{transform:translateY(120%);opacity:0}to{transform:translateY(0);opacity:1}`;
const pop = keyframes`0%{transform:scale(1)}35%{transform:scale(1.18)}100%{transform:scale(1)}`;
const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.35}`;

const ObsGlobal = createGlobalStyle`
  html, body, #root { margin:0; height:100%; background:transparent !important; overflow:hidden; }
  * { box-sizing:border-box; }
`;

const BarWrap = styled.div`
  position: fixed; left: 0; right: 0; bottom: 3.2vh;
  display: flex; flex-direction: column; align-items: center; gap: 0.9vh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: ${slideUp} .6s cubic-bezier(.18,.9,.32,1.1) both;
`;
const Bar = styled.div`
  display: flex; align-items: stretch; height: clamp(64px, 11vh, 128px);
  width: min(1560px, 95vw); border-radius: 16px; overflow: hidden;
  color: #fff;
  background: linear-gradient(180deg, rgba(15,23,42,.94), rgba(11,17,32,.96));
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 18px 50px rgba(0,0,0,.5);
  backdrop-filter: blur(6px);
  ${p => p.$summary && css`background: linear-gradient(180deg, rgba(13,20,38,.96), rgba(9,14,28,.97));`}
`;

const Cell = styled.div`
  display: flex; flex-direction: column; justify-content: center; gap: .3vh;
  padding: 0 clamp(12px, 1.4vw, 30px);
  border-right: 1px solid rgba(255,255,255,.09);
`;
const LogoCell = styled(Cell)`align-items:center; padding:0 clamp(10px,1vw,22px); background:rgba(255,255,255,.04);`;
const Logo = styled.img`height: clamp(34px, 6vh, 74px); width:auto; object-fit:contain;`;

const ScoreCell = styled(Cell)`
  align-items: center; justify-content: center; gap: 0;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  min-width: clamp(150px, 15vw, 280px);
`;
const TeamTag = styled.div`font-size: clamp(11px, 1.7vh, 22px); font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,.85);`;
const ScoreBig = styled.div`
  font-size: clamp(30px, 6vh, 78px); font-weight: 900; line-height: 1; letter-spacing: -1px;
  animation: ${pop} .5s ease; i{ font-style:normal; color: rgba(255,255,255,.6); margin:0 2px; }
`;
const OversTag = styled.div`font-size: clamp(11px, 1.7vh, 22px); font-weight: 800; color: rgba(255,255,255,.85); margin-top:2px;`;

const BattersCell = styled(Cell)`min-width: clamp(150px, 15vw, 300px); justify-content:center; gap:.5vh;`;
const PLine = styled.div`
  display: flex; align-items: baseline; gap: .5vw;
  font-size: clamp(14px, 2.4vh, 32px); font-weight: 700; color: ${p => p.$on ? "#fff" : "#cbd5e1"};
`;
const Dotm = styled.span`width:.8vh;height:.8vh;min-width:7px;min-height:7px;border-radius:50%;background:#22c55e;align-self:center;`;
const Nm = styled.span`font-weight: 800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width: 12vw;`;
const Rn = styled.span`margin-left:auto; font-weight:900; em{ font-style:normal; color:#94a3b8; font-size:.62em; font-weight:700; }`;

const BowlerCell = styled(Cell)`min-width: clamp(130px, 12vw, 240px);`;
const CellLabel = styled.div`font-size: clamp(9px, 1.4vh, 17px); font-weight: 900; letter-spacing: 1.5px; color: #64748b;`;
const BowlFig = styled.div`font-size: clamp(14px, 2.3vh, 30px); font-weight: 900; color:#f8fafc; em{ font-style:normal; color:#94a3b8; font-size:.66em; font-weight:700; }`;

const RateCell = styled(Cell)`min-width: clamp(110px, 10vw, 200px); align-items:flex-start;`;
const RateBig = styled.div`font-size: clamp(20px, 3.6vh, 46px); font-weight:900; color:#22c55e;`;
const NeedBig = styled.div`font-size: clamp(20px, 3.6vh, 48px); font-weight:900; color:#fca5a5; small{ font-size:.42em; color:#94a3b8; font-weight:800; margin-left:4px; }`;
const RateSub = styled.div`font-size: clamp(10px, 1.6vh, 20px); font-weight:800; color:#94a3b8;`;

const StatusCell = styled(Cell)`border-right:0; align-items:center; justify-content:center; min-width: clamp(80px, 7vw, 140px);`;
const LivePill = styled.div`
  display:flex; align-items:center; gap:.5vw; padding:.6vh 1vw; border-radius:999px;
  background:#dc2626; font-weight:900; letter-spacing:1.5px; font-size:clamp(12px,2vh,26px);
  ${p => p.$on && css`animation:${pulse} 1.6s ease-in-out infinite;`}
`;
const LiveDot = styled.span`width:1vh;height:1vh;min-width:8px;min-height:8px;border-radius:50%;background:#fff;`;
const ResultTag = styled.div`padding:.6vh 1vw;border-radius:999px;background:#6366f1;font-weight:900;letter-spacing:1.5px;font-size:clamp(12px,2vh,26px);`;

const SubStrip = styled.div`
  width: min(1560px, 95vw); text-align:center; padding:.9vh 2vw; border-radius:12px; color:#fff;
  background: linear-gradient(135deg,#16a34a,#15803d); font-weight:900; letter-spacing:.5px;
  font-size: clamp(14px, 2.6vh, 34px); text-transform:uppercase;
`;

/* Summary bar cells */
const SumResult = styled(Cell)`min-width: clamp(180px, 20vw, 380px); justify-content:center;`;
const SumResultText = styled.div`font-size: clamp(16px, 3vh, 42px); font-weight:900; color:#fff;`;
const SumScores = styled(Cell)`min-width: clamp(180px, 20vw, 380px); gap:.6vh;`;
const SumScore = styled.div`font-size: clamp(14px, 2.4vh, 32px); font-weight:800; color:#e2e8f0; b{ color:#60a5fa; } i{ font-style:normal; color:#94a3b8; font-size:.7em; }`;
const SumPotm = styled(Cell)`border-right:0; min-width: clamp(160px, 16vw, 320px); justify-content:center;`;
const PotmName = styled.div`font-size: clamp(15px, 2.6vh, 34px); font-weight:900; color:#93c5fd; em{ font-style:normal; color:#cbd5e1; font-weight:700; font-size:.72em; }`;

const IdleBadge = styled.div`
  position: fixed; left: 3vw; bottom: 3.2vh; display:flex; align-items:center; gap:1vw;
  padding: 1.2vh 1.6vw; border-radius: 14px; color:#fff;
  background: linear-gradient(180deg, rgba(15,23,42,.92), rgba(11,17,32,.95));
  border: 1px solid rgba(255,255,255,.12); box-shadow: 0 14px 40px rgba(0,0,0,.5);
  font-family: 'Inter', sans-serif; animation: ${slideUp} .6s ease both;
  span{ font-size: clamp(16px,2.8vh,36px); font-weight:900; }
`;
const Up = styled.div`font-size: clamp(11px,1.7vh,22px); color:#64748b; font-weight:800; letter-spacing:1px; margin-left:.6vw;`;

export default Overlay;
