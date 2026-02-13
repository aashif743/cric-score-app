import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled, { keyframes, css } from "styled-components";
import publicService from "../services/publicService";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const TournamentTVScoreboard = () => {
  const { shareId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");
  const socketRef = useRef(null);
  const matchesRef = useRef([]);
  const selectedMatchIdRef = useRef(null);

  // Keep ref in sync
  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  // Fetch match overlay data
  const fetchMatchData = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMatchData(json.data);
        setDebugInfo(`Updated: ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error("Failed to fetch match data:", err);
      setDebugInfo(`Error: ${err.message}`);
    }
  }, []);

  // Fetch tournament data
  const fetchTournament = useCallback(async () => {
    try {
      const res = await publicService.getPublicTournament(shareId);
      if (res.success) {
        const { matches: m, ...t } = res.data;
        setTournament(t);
        setMatches(m || []);
        matchesRef.current = m || [];

        // Auto-select live match if no match selected
        const liveMatch = m?.find(match =>
          match.status === 'in_progress' || match.status === 'innings_break'
        );
        if (liveMatch) {
          setSelectedMatchId(prev => prev || liveMatch._id);
        } else if (m?.length > 0 && !selectedMatchIdRef.current) {
          setSelectedMatchId(m[0]._id);
        }
      } else {
        setError("Tournament not found");
      }
    } catch (err) {
      setError(err?.error || "Failed to load tournament");
    }
  }, [shareId]);

  // Initial load
  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  // Fetch match data when selected match changes
  useEffect(() => {
    if (selectedMatchId) {
      fetchMatchData(selectedMatchId);
    }
  }, [selectedMatchId, fetchMatchData]);

  // Setup WebSocket connection (once)
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      setConnected(true);
      // Join rooms for all current matches
      matchesRef.current.forEach(match => {
        socket.emit("join-match", match._id);
      });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    socket.on("score-updated", (payload) => {
      console.log("Score updated event:", payload);
      // Refetch current match data
      if (selectedMatchIdRef.current) {
        fetchMatchData(selectedMatchIdRef.current);
      }
      fetchTournament();
    });

    // Very aggressive polling for real-time feel (every 1.5 seconds)
    const refreshInterval = setInterval(() => {
      if (selectedMatchIdRef.current) {
        fetchMatchData(selectedMatchIdRef.current);
      }
      fetchTournament();
    }, 1500);

    return () => {
      socket.disconnect();
      clearInterval(refreshInterval);
    };
  }, [fetchMatchData, fetchTournament]);

  // Join new match rooms when matches list updates
  useEffect(() => {
    if (socketRef.current?.connected && matches.length > 0) {
      matches.forEach(match => {
        socketRef.current.emit("join-match", match._id);
      });
    }
  }, [matches]);

  if (error) {
    return (
      <ErrorContainer>
        <ErrorText>{error}</ErrorText>
        <RetryButton onClick={fetchTournament}>Retry</RetryButton>
      </ErrorContainer>
    );
  }

  if (!tournament) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
        <LoadingText>Loading...</LoadingText>
      </LoadingContainer>
    );
  }

  const liveMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'innings_break');
  const completedMatches = matches.filter(m => m.status === 'completed');
  const otherMatches = matches.filter(m => m.status !== 'in_progress' && m.status !== 'innings_break' && m.status !== 'completed');

  return (
    <TVContainer>
      {/* Left Panel - Match List */}
      <LeftPanel>
        <TournamentHeader>
          <TournamentName>{tournament.name}</TournamentName>
          <TournamentMeta>{matches.length} matches</TournamentMeta>
        </TournamentHeader>

        <MatchList>
          {liveMatches.length > 0 && (
            <MatchSection>
              <MatchGroupLabel $live>LIVE</MatchGroupLabel>
              {liveMatches.map(match => (
                <MatchCard
                  key={match._id}
                  $selected={selectedMatchId === match._id}
                  $live
                  onClick={() => setSelectedMatchId(match._id)}
                >
                  <MatchTeams>
                    <TeamRow>
                      <TeamBadge>{(match.teamA?.name || "A")[0]}</TeamBadge>
                      <TeamName>{match.teamA?.name || "Team A"}</TeamName>
                      <TeamScore>{match.innings1?.runs ?? 0}/{match.innings1?.wickets ?? 0}</TeamScore>
                    </TeamRow>
                    <TeamRow>
                      <TeamBadge $alt>{(match.teamB?.name || "B")[0]}</TeamBadge>
                      <TeamName>{match.teamB?.name || "Team B"}</TeamName>
                      <TeamScore>{match.innings2?.runs ?? 0}/{match.innings2?.wickets ?? 0}</TeamScore>
                    </TeamRow>
                  </MatchTeams>
                  <LivePulse />
                </MatchCard>
              ))}
            </MatchSection>
          )}

          {completedMatches.length > 0 && (
            <MatchSection>
              <MatchGroupLabel>COMPLETED</MatchGroupLabel>
              {completedMatches.slice(0, 5).map(match => (
                <MatchCard
                  key={match._id}
                  $selected={selectedMatchId === match._id}
                  onClick={() => setSelectedMatchId(match._id)}
                >
                  <MatchTeams>
                    <TeamRow>
                      <TeamBadge>{(match.teamA?.name || "A")[0]}</TeamBadge>
                      <TeamName>{match.teamA?.name || "Team A"}</TeamName>
                      <TeamScore>{match.innings1?.runs ?? "-"}/{match.innings1?.wickets ?? "-"}</TeamScore>
                    </TeamRow>
                    <TeamRow>
                      <TeamBadge $alt>{(match.teamB?.name || "B")[0]}</TeamBadge>
                      <TeamName>{match.teamB?.name || "Team B"}</TeamName>
                      <TeamScore>{match.innings2?.runs ?? "-"}/{match.innings2?.wickets ?? "-"}</TeamScore>
                    </TeamRow>
                  </MatchTeams>
                </MatchCard>
              ))}
            </MatchSection>
          )}

          {otherMatches.length > 0 && (
            <MatchSection>
              <MatchGroupLabel>UPCOMING</MatchGroupLabel>
              {otherMatches.slice(0, 3).map(match => (
                <MatchCard
                  key={match._id}
                  $selected={selectedMatchId === match._id}
                  $upcoming
                  onClick={() => setSelectedMatchId(match._id)}
                >
                  <MatchTeams>
                    <TeamRow>
                      <TeamBadge>{(match.teamA?.name || "A")[0]}</TeamBadge>
                      <TeamName>{match.teamA?.name || "Team A"}</TeamName>
                    </TeamRow>
                    <TeamRow>
                      <TeamBadge $alt>{(match.teamB?.name || "B")[0]}</TeamBadge>
                      <TeamName>{match.teamB?.name || "Team B"}</TeamName>
                    </TeamRow>
                  </MatchTeams>
                </MatchCard>
              ))}
            </MatchSection>
          )}
        </MatchList>

        <StatusBar>
          <StatusIndicator $connected={connected} />
          <StatusText>{connected ? "LIVE" : "CONNECTING"}</StatusText>
          <DebugText>{debugInfo}</DebugText>
        </StatusBar>
      </LeftPanel>

      {/* Main Scoreboard */}
      <MainPanel>
        {matchData ? (
          <ScoreboardContent data={matchData} />
        ) : selectedMatchId ? (
          <LoadingState>
            <LoadingSpinner />
            <span>Loading match...</span>
          </LoadingState>
        ) : (
          <EmptyState>
            <EmptyIcon>🏏</EmptyIcon>
            <EmptyText>Select a match to view</EmptyText>
          </EmptyState>
        )}
      </MainPanel>
    </TVContainer>
  );
};

// Scoreboard Content Component - Optimized for TV
const ScoreboardContent = ({ data }) => {
  const isSecondInnings = data.currentInnings === 2;
  const battingTeam = data.battingTeam || data.teamA?.name || "Batting";
  const bowlingTeam = data.bowlingTeam || data.teamB?.name || "Bowling";

  return (
    <Scoreboard>
      {/* Header with Status */}
      <ScoreboardHeader>
        <MatchStatus $status={data.status}>
          {data.status === "in_progress" ? "LIVE" : data.status?.toUpperCase().replace("_", " ")}
        </MatchStatus>
        <MatchInfo>
          {data.teamA?.name} vs {data.teamB?.name}
        </MatchInfo>
      </ScoreboardHeader>

      {/* Main Score Display */}
      <MainScore>
        <BattingTeam>{battingTeam}</BattingTeam>
        <ScoreRow>
          <RunsDisplay>{data.runs ?? 0}</RunsDisplay>
          <Divider>/</Divider>
          <WicketsDisplay>{data.wickets ?? 0}</WicketsDisplay>
          <OversDisplay>({data.overs || "0.0"} ov)</OversDisplay>
        </ScoreRow>
        <RunRateDisplay>Run Rate: {data.runRate || "0.00"}</RunRateDisplay>
      </MainScore>

      {/* Target Info for 2nd Innings */}
      {isSecondInnings && data.target && (
        <TargetBar>
          <TargetItem>
            <TargetLabel>TARGET</TargetLabel>
            <TargetValue>{data.target}</TargetValue>
          </TargetItem>
          <TargetItem $highlight>
            <TargetLabel>NEED</TargetLabel>
            <TargetValue>{Math.max(0, data.requiredRuns || 0)}</TargetValue>
          </TargetItem>
          <TargetItem>
            <TargetLabel>BALLS</TargetLabel>
            <TargetValue>{data.ballsRemaining || 0}</TargetValue>
          </TargetItem>
          <TargetItem $highlight>
            <TargetLabel>REQ RR</TargetLabel>
            <TargetValue>{data.requiredRunRate || "-"}</TargetValue>
          </TargetItem>
        </TargetBar>
      )}

      {/* Players Row */}
      <PlayersRow>
        {/* Batsmen */}
        <PlayerCard>
          <CardTitle>BATTING</CardTitle>
          <BatsmenList>
            {data.striker && (
              <BatsmanItem $striker>
                <BatsmanName>{data.striker.name} *</BatsmanName>
                <BatsmanScore>
                  <Big>{data.striker.runs}</Big>
                  <Small>({data.striker.balls})</Small>
                </BatsmanScore>
                <BatsmanMeta>
                  4s: {data.striker.fours} | 6s: {data.striker.sixes} | SR: {data.striker.strikeRate}
                </BatsmanMeta>
              </BatsmanItem>
            )}
            {data.nonStriker && (
              <BatsmanItem>
                <BatsmanName>{data.nonStriker.name}</BatsmanName>
                <BatsmanScore>
                  <Big>{data.nonStriker.runs}</Big>
                  <Small>({data.nonStriker.balls})</Small>
                </BatsmanScore>
                <BatsmanMeta>
                  4s: {data.nonStriker.fours} | 6s: {data.nonStriker.sixes} | SR: {data.nonStriker.strikeRate}
                </BatsmanMeta>
              </BatsmanItem>
            )}
          </BatsmenList>
          {data.partnership && (data.partnership.runs > 0 || data.partnership.balls > 0) && (
            <Partnership>
              Partnership: {data.partnership.runs} ({data.partnership.balls})
            </Partnership>
          )}
        </PlayerCard>

        {/* Bowler */}
        <PlayerCard>
          <CardTitle>BOWLING</CardTitle>
          {data.bowler ? (
            <BowlerInfo>
              <BowlerName>{data.bowler.name}</BowlerName>
              <BowlerStats>
                <BowlerStat>
                  <Big>{data.bowler.overs}</Big>
                  <Label>Ov</Label>
                </BowlerStat>
                <BowlerStat>
                  <Big>{data.bowler.maidens}</Big>
                  <Label>M</Label>
                </BowlerStat>
                <BowlerStat>
                  <Big>{data.bowler.runs}</Big>
                  <Label>R</Label>
                </BowlerStat>
                <BowlerStat $highlight>
                  <Big>{data.bowler.wickets}</Big>
                  <Label>W</Label>
                </BowlerStat>
                <BowlerStat>
                  <Big>{data.bowler.economy}</Big>
                  <Label>Ec</Label>
                </BowlerStat>
              </BowlerStats>
            </BowlerInfo>
          ) : (
            <NoBowler>No bowler data</NoBowler>
          )}
        </PlayerCard>

        {/* This Over */}
        <PlayerCard>
          <CardTitle>THIS OVER</CardTitle>
          <BallsContainer>
            {data.thisOver && data.thisOver.length > 0 ? (
              data.thisOver.map((ball, idx) => (
                <Ball key={idx} $type={getBallType(ball)}>
                  {formatBall(ball)}
                </Ball>
              ))
            ) : (
              <NewOver>New Over</NewOver>
            )}
          </BallsContainer>
          <Extras>
            Extras: {data.extras?.total || 0}
            (Wd: {data.extras?.wides || 0}, Nb: {data.extras?.noBalls || 0}, B: {data.extras?.byes || 0}, Lb: {data.extras?.legByes || 0})
          </Extras>
        </PlayerCard>
      </PlayersRow>

      {/* Footer */}
      <ScoreboardFooter>
        {isSecondInnings && data.firstInnings && (
          <FirstInnings>
            {data.firstInnings.battingTeam}: {data.firstInnings.runs}/{data.firstInnings.wickets} ({data.firstInnings.overs} ov)
          </FirstInnings>
        )}
        {data.result && <ResultText>{data.result}</ResultText>}
        <Brand>CricZone</Brand>
      </ScoreboardFooter>
    </Scoreboard>
  );
};

// Helper functions
const getBallType = (ball) => {
  if (typeof ball === 'string') {
    if (ball.includes('W') || ball === 'W') return 'wicket';
    if (ball.includes('Wd') || ball.includes('wd')) return 'wide';
    if (ball.includes('Nb') || ball.includes('nb')) return 'noball';
    if (ball === '4') return 'four';
    if (ball === '6') return 'six';
    if (ball === '0' || ball === '.') return 'dot';
  }
  if (typeof ball === 'object') {
    if (ball.wicket) return 'wicket';
    if (ball.wide) return 'wide';
    if (ball.noBall) return 'noball';
    if (ball.runs === 4) return 'four';
    if (ball.runs === 6) return 'six';
    if (ball.runs === 0) return 'dot';
  }
  return 'normal';
};

const formatBall = (ball) => {
  if (typeof ball === 'string') return ball;
  if (typeof ball === 'object') {
    if (ball.wicket) return 'W';
    if (ball.wide) return `${ball.runs || 1}Wd`;
    if (ball.noBall) return `${ball.runs || 1}Nb`;
    return ball.runs?.toString() || '0';
  }
  return ball?.toString() || '0';
};

// Animations
const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Styled Components
const TVContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #0c1222 0%, #1a2744 50%, #0c1222 100%);
  color: #fff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
`;

const LeftPanel = styled.aside`
  width: 300px;
  min-width: 300px;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  border-right: 2px solid rgba(255, 255, 255, 0.1);
`;

const TournamentHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TournamentName = styled.h1`
  font-size: 20px;
  font-weight: 800;
  color: #60a5fa;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TournamentMeta = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const MatchList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
`;

const MatchSection = styled.div`
  margin-bottom: 16px;
`;

const MatchGroupLabel = styled.div`
  font-size: 11px;
  font-weight: 800;
  color: ${props => props.$live ? '#22c55e' : '#64748b'};
  margin-bottom: 8px;
  letter-spacing: 1.5px;
`;

const MatchCard = styled.div`
  background: ${props => props.$selected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
  border: 2px solid ${props => props.$selected ? '#3b82f6' : 'transparent'};
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;

  ${props => props.$live && css`
    border-color: ${props.$selected ? '#22c55e' : 'rgba(34, 197, 94, 0.5)'};
    background: ${props.$selected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'};
  `}

  ${props => props.$upcoming && css`opacity: 0.6;`}

  &:hover { background: rgba(255, 255, 255, 0.1); }
`;

const MatchTeams = styled.div``;

const TeamRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  &:last-child { margin-bottom: 0; }
`;

const TeamBadge = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: ${props => props.$alt ? '#8b5cf6' : '#3b82f6'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
`;

const TeamName = styled.span`
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamScore = styled.span`
  font-size: 14px;
  font-weight: 800;
  color: #60a5fa;
`;

const LivePulse = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const StatusBar = styled.div`
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusIndicator = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$connected ? '#22c55e' : '#f59e0b'};
  ${props => props.$connected && css`animation: ${pulse} 2s ease-in-out infinite;`}
`;

const StatusText = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${props => props.$connected ? '#22c55e' : '#f59e0b'};
`;

const DebugText = styled.span`
  font-size: 10px;
  color: #64748b;
  margin-left: auto;
`;

const MainPanel = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
`;

const LoadingState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #94a3b8;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const EmptyIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
`;

const EmptyText = styled.div`
  font-size: 24px;
  color: #64748b;
`;

const Scoreboard = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ScoreboardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const MatchStatus = styled.div`
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 2px;
  ${props => props.$status === 'in_progress' && css`
    background: #22c55e;
    animation: ${pulse} 2s ease-in-out infinite;
  `}
  ${props => props.$status === 'completed' && css`background: #6366f1;`}
  ${props => props.$status === 'innings_break' && css`background: #f59e0b;`}
  ${props => !['in_progress', 'completed', 'innings_break'].includes(props.$status) && css`background: #64748b;`}
`;

const MatchInfo = styled.div`
  font-size: 18px;
  color: #94a3b8;
`;

const MainScore = styled.div`
  background: rgba(0, 0, 0, 0.4);
  border-radius: 20px;
  padding: 30px 40px;
  text-align: center;
`;

const BattingTeam = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #60a5fa;
  margin-bottom: 10px;
`;

const ScoreRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
`;

const RunsDisplay = styled.span`
  font-size: 100px;
  font-weight: 900;
  line-height: 1;
  color: #fff;
`;

const Divider = styled.span`
  font-size: 60px;
  color: #475569;
`;

const WicketsDisplay = styled.span`
  font-size: 60px;
  font-weight: 800;
  color: #ef4444;
`;

const OversDisplay = styled.span`
  font-size: 28px;
  color: #94a3b8;
  margin-left: 16px;
`;

const RunRateDisplay = styled.div`
  font-size: 18px;
  color: #22c55e;
  margin-top: 12px;
`;

const TargetBar = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
`;

const TargetItem = styled.div`
  text-align: center;
  padding: 16px 28px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)'};
  border-radius: 14px;
  border: 2px solid ${props => props.$highlight ? 'rgba(239, 68, 68, 0.5)' : 'transparent'};
`;

const TargetLabel = styled.div`
  font-size: 11px;
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 6px;
`;

const TargetValue = styled.div`
  font-size: 32px;
  font-weight: 900;
  color: #fff;
`;

const PlayersRow = styled.div`
  flex: 1;
  display: flex;
  gap: 20px;
`;

const PlayerCard = styled.div`
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
`;

const CardTitle = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: #94a3b8;
  letter-spacing: 1.5px;
  margin-bottom: 16px;
`;

const BatsmenList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const BatsmanItem = styled.div`
  padding: 14px;
  background: ${props => props.$striker ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 12px;
  border-left: 4px solid ${props => props.$striker ? '#22c55e' : 'transparent'};
`;

const BatsmanName = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
`;

const BatsmanScore = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
`;

const Big = styled.span`
  font-size: 32px;
  font-weight: 900;
  color: #fff;
`;

const Small = styled.span`
  font-size: 14px;
  color: #94a3b8;
`;

const BatsmanMeta = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const Partnership = styled.div`
  margin-top: 12px;
  padding: 10px;
  background: rgba(96, 165, 250, 0.15);
  border-radius: 8px;
  font-size: 14px;
  color: #60a5fa;
  text-align: center;
`;

const BowlerInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const BowlerName = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 20px;
`;

const BowlerStats = styled.div`
  display: flex;
  gap: 16px;
`;

const BowlerStat = styled.div`
  text-align: center;
  padding: 12px 16px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)'};
  border-radius: 10px;
`;

const Label = styled.div`
  font-size: 10px;
  color: #94a3b8;
  margin-top: 4px;
  letter-spacing: 1px;
`;

const NoBowler = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
`;

const BallsContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const Ball = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  ${props => {
    switch (props.$type) {
      case 'wicket': return css`background: #ef4444; color: white;`;
      case 'wide':
      case 'noball': return css`background: #f59e0b; color: white;`;
      case 'four': return css`background: #22c55e; color: white;`;
      case 'six': return css`background: #8b5cf6; color: white;`;
      case 'dot': return css`background: #374151; color: #9ca3af;`;
      default: return css`background: #1e40af; color: white;`;
    }
  }}
`;

const NewOver = styled.span`
  color: #64748b;
  font-size: 16px;
`;

const Extras = styled.div`
  margin-top: 16px;
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
`;

const ScoreboardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 12px;
`;

const FirstInnings = styled.div`
  font-size: 16px;
  color: #94a3b8;
`;

const ResultText = styled.div`
  flex: 1;
  text-align: center;
  font-size: 20px;
  font-weight: 800;
  color: #a78bfa;
`;

const Brand = styled.div`
  font-size: 18px;
  font-weight: 800;
  color: #60a5fa;
`;

const ErrorContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0c1222;
  color: #f87171;
`;

const ErrorText = styled.div`
  font-size: 24px;
  margin-bottom: 20px;
`;

const RetryButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #2563eb; }
`;

const LoadingContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0c1222;
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid #334155;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const LoadingText = styled.div`
  margin-top: 16px;
  font-size: 18px;
  color: #94a3b8;
`;

export default TournamentTVScoreboard;
