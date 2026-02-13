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
  const socketRef = useRef(null);
  const matchesRef = useRef([]);

  // Fetch match overlay data
  const fetchMatchData = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}`);
      const json = await res.json();
      if (json.success) {
        setMatchData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch match data:", err);
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
        } else if (m?.length > 0 && !selectedMatchId) {
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
      setConnected(true);
      // Join rooms for all current matches
      matchesRef.current.forEach(match => {
        socket.emit("join-match", match._id);
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("score-updated", () => {
      // Refetch current match data
      if (selectedMatchId) {
        fetchMatchData(selectedMatchId);
      }
      fetchTournament();
    });

    // Aggressive polling for real-time feel (every 2 seconds)
    const refreshInterval = setInterval(() => {
      if (selectedMatchId) {
        fetchMatchData(selectedMatchId);
      }
      fetchTournament();
    }, 2000);

    return () => {
      socket.disconnect();
      clearInterval(refreshInterval);
    };
  }, []);

  // Join new match rooms when matches list updates
  useEffect(() => {
    if (socketRef.current?.connected && matches.length > 0) {
      matches.forEach(match => {
        socketRef.current.emit("join-match", match._id);
      });
    }
  }, [matches]);

  // Refetch match data when selectedMatchId changes
  useEffect(() => {
    if (selectedMatchId) {
      fetchMatchData(selectedMatchId);
    }
  }, [selectedMatchId]);

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
  const otherMatches = matches.filter(m => m.status !== 'in_progress' && m.status !== 'innings_break');

  return (
    <TVContainer>
      {/* Left Panel - Match List */}
      <LeftPanel>
        <TournamentName>{tournament.name}</TournamentName>

        <MatchList>
          {liveMatches.length > 0 && (
            <>
              <MatchGroupLabel $live>LIVE</MatchGroupLabel>
              {liveMatches.map(match => (
                <MatchCard
                  key={match._id}
                  $selected={selectedMatchId === match._id}
                  $live
                  onClick={() => setSelectedMatchId(match._id)}
                >
                  <MatchTeamRow>
                    <TeamInitial>{(match.teamA?.name || "A")[0]}</TeamInitial>
                    <TeamNameSmall>{match.teamA?.name || "Team A"}</TeamNameSmall>
                    <MatchScoreSmall>
                      {match.innings1?.runs || 0}/{match.innings1?.wickets || 0}
                    </MatchScoreSmall>
                  </MatchTeamRow>
                  <MatchTeamRow>
                    <TeamInitial $alt>{(match.teamB?.name || "B")[0]}</TeamInitial>
                    <TeamNameSmall>{match.teamB?.name || "Team B"}</TeamNameSmall>
                    <MatchScoreSmall>
                      {match.innings2?.runs || 0}/{match.innings2?.wickets || 0}
                    </MatchScoreSmall>
                  </MatchTeamRow>
                  <LiveDot />
                </MatchCard>
              ))}
            </>
          )}

          {otherMatches.length > 0 && (
            <>
              <MatchGroupLabel>MATCHES</MatchGroupLabel>
              {otherMatches.slice(0, 4).map(match => (
                <MatchCard
                  key={match._id}
                  $selected={selectedMatchId === match._id}
                  onClick={() => setSelectedMatchId(match._id)}
                >
                  <MatchTeamRow>
                    <TeamInitial>{(match.teamA?.name || "A")[0]}</TeamInitial>
                    <TeamNameSmall>{match.teamA?.name || "Team A"}</TeamNameSmall>
                    <MatchScoreSmall>
                      {match.innings1?.runs ?? "-"}/{match.innings1?.wickets ?? "-"}
                    </MatchScoreSmall>
                  </MatchTeamRow>
                  <MatchTeamRow>
                    <TeamInitial $alt>{(match.teamB?.name || "B")[0]}</TeamInitial>
                    <TeamNameSmall>{match.teamB?.name || "Team B"}</TeamNameSmall>
                    <MatchScoreSmall>
                      {match.innings2?.runs ?? "-"}/{match.innings2?.wickets ?? "-"}
                    </MatchScoreSmall>
                  </MatchTeamRow>
                </MatchCard>
              ))}
            </>
          )}
        </MatchList>

        <ConnectionStatus $connected={connected}>
          {connected ? "LIVE" : "CONNECTING..."}
        </ConnectionStatus>
      </LeftPanel>

      {/* Main Scoreboard */}
      <MainPanel>
        {matchData ? (
          <ScoreboardContent data={matchData} />
        ) : (
          <NoMatchSelected>
            <span>Select a match</span>
          </NoMatchSelected>
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
    <ScoreboardGrid>
      {/* Top Row - Main Score */}
      <TopSection>
        {/* Status Badge */}
        <StatusBadge $status={data.status}>
          {data.status === "in_progress" ? "LIVE" : data.status?.toUpperCase().replace("_", " ")}
        </StatusBadge>

        {/* Main Score Display */}
        <MainScoreBlock>
          <BattingTeamName>{battingTeam}</BattingTeamName>
          <ScoreDisplay>
            <BigRuns>{data.runs || 0}</BigRuns>
            <ScoreDivider>/</ScoreDivider>
            <BigWickets>{data.wickets || 0}</BigWickets>
            <OversText>({data.overs || "0.0"})</OversText>
          </ScoreDisplay>
        </MainScoreBlock>

        {/* Run Rate & Target Info */}
        <RateBlock>
          <RateItem>
            <RateLabel>CRR</RateLabel>
            <RateValue>{data.runRate || "0.00"}</RateValue>
          </RateItem>
          {isSecondInnings && data.target && (
            <>
              <RateItem $highlight>
                <RateLabel>TARGET</RateLabel>
                <RateValue>{data.target}</RateValue>
              </RateItem>
              <RateItem $highlight>
                <RateLabel>NEED</RateLabel>
                <RateValue>{data.requiredRuns > 0 ? data.requiredRuns : 0}</RateValue>
              </RateItem>
              <RateItem>
                <RateLabel>BALLS</RateLabel>
                <RateValue>{data.ballsRemaining || 0}</RateValue>
              </RateItem>
              <RateItem $highlight>
                <RateLabel>RRR</RateLabel>
                <RateValue>{data.requiredRunRate || "-"}</RateValue>
              </RateItem>
            </>
          )}
        </RateBlock>
      </TopSection>

      {/* Middle Row - Batsmen & Bowler */}
      <MiddleSection>
        {/* Batsmen */}
        <PlayersBlock>
          <BlockTitle>BATTING</BlockTitle>
          <BatsmenContainer>
            {data.striker && (
              <BatsmanRow $striker>
                <BatsmanName>{data.striker.name} *</BatsmanName>
                <BatsmanStats>
                  <StatBig>{data.striker.runs}</StatBig>
                  <StatSmall>({data.striker.balls})</StatSmall>
                  <StatMeta>4s:{data.striker.fours} 6s:{data.striker.sixes}</StatMeta>
                </BatsmanStats>
              </BatsmanRow>
            )}
            {data.nonStriker && (
              <BatsmanRow>
                <BatsmanName>{data.nonStriker.name}</BatsmanName>
                <BatsmanStats>
                  <StatBig>{data.nonStriker.runs}</StatBig>
                  <StatSmall>({data.nonStriker.balls})</StatSmall>
                  <StatMeta>4s:{data.nonStriker.fours} 6s:{data.nonStriker.sixes}</StatMeta>
                </BatsmanStats>
              </BatsmanRow>
            )}
          </BatsmenContainer>
          {data.partnership && (data.partnership.runs > 0 || data.partnership.balls > 0) && (
            <PartnershipText>
              Partnership: {data.partnership.runs} ({data.partnership.balls})
            </PartnershipText>
          )}
        </PlayersBlock>

        {/* Bowler */}
        <PlayersBlock>
          <BlockTitle>BOWLING</BlockTitle>
          {data.bowler && (
            <BowlerContainer>
              <BowlerName>{data.bowler.name}</BowlerName>
              <BowlerStats>
                <BowlerFigure>
                  <span>{data.bowler.overs}</span>
                  <small>O</small>
                </BowlerFigure>
                <BowlerFigure>
                  <span>{data.bowler.maidens}</span>
                  <small>M</small>
                </BowlerFigure>
                <BowlerFigure>
                  <span>{data.bowler.runs}</span>
                  <small>R</small>
                </BowlerFigure>
                <BowlerFigure $highlight>
                  <span>{data.bowler.wickets}</span>
                  <small>W</small>
                </BowlerFigure>
                <BowlerFigure>
                  <span>{data.bowler.economy}</span>
                  <small>EC</small>
                </BowlerFigure>
              </BowlerStats>
            </BowlerContainer>
          )}
        </PlayersBlock>

        {/* This Over */}
        <PlayersBlock>
          <BlockTitle>THIS OVER</BlockTitle>
          <ThisOverContainer>
            {data.thisOver && data.thisOver.length > 0 ? (
              data.thisOver.map((ball, idx) => (
                <BallCircle key={idx} $type={getBallType(ball)}>
                  {formatBall(ball)}
                </BallCircle>
              ))
            ) : (
              <NewOverText>New Over</NewOverText>
            )}
          </ThisOverContainer>
          <ExtrasText>
            Extras: {data.extras?.total || 0} (Wd:{data.extras?.wides || 0} Nb:{data.extras?.noBalls || 0} B:{data.extras?.byes || 0} Lb:{data.extras?.legByes || 0})
          </ExtrasText>
        </PlayersBlock>
      </MiddleSection>

      {/* Bottom Row - First Innings & Result */}
      <BottomSection>
        {isSecondInnings && data.firstInnings && (
          <FirstInningsBlock>
            {data.firstInnings.battingTeam}: {data.firstInnings.runs}/{data.firstInnings.wickets} ({data.firstInnings.overs} ov)
          </FirstInningsBlock>
        )}
        {data.status === "completed" && data.result && (
          <ResultBlock>{data.result}</ResultBlock>
        )}
        <BrandBlock>CricZone</BrandBlock>
      </BottomSection>
    </ScoreboardGrid>
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
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// Styled Components - TV Optimized (Landscape, No Scroll)
const TVContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #0a0f1c 0%, #1a1f3c 100%);
  color: #fff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
`;

const LeftPanel = styled.aside`
  width: 280px;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
`;

const TournamentName = styled.h1`
  font-size: 18px;
  font-weight: 700;
  color: #60a5fa;
  margin: 0 0 20px 0;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MatchList = styled.div`
  flex: 1;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
`;

const MatchGroupLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${props => props.$live ? '#22c55e' : '#64748b'};
  margin: 12px 0 8px;
  letter-spacing: 1px;
`;

const MatchCard = styled.div`
  background: ${props => props.$selected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
  border: 2px solid ${props => props.$selected ? '#3b82f6' : 'transparent'};
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;

  ${props => props.$live && css`
    border-color: ${props.$selected ? '#22c55e' : 'rgba(34, 197, 94, 0.4)'};
    background: ${props.$selected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'};
  `}

  &:hover {
    background: rgba(59, 130, 246, 0.2);
  }
`;

const MatchTeamRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  &:last-child { margin-bottom: 0; }
`;

const TeamInitial = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: ${props => props.$alt ? '#8b5cf6' : '#3b82f6'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
`;

const TeamNameSmall = styled.span`
  flex: 1;
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MatchScoreSmall = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #60a5fa;
`;

const LiveDot = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const ConnectionStatus = styled.div`
  padding: 10px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: ${props => props.$connected ? '#22c55e' : '#f59e0b'};
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 10px;
  ${props => props.$connected && css`animation: ${pulse} 2s ease-in-out infinite;`}
`;

const MainPanel = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
`;

const NoMatchSelected = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #64748b;
`;

const ScoreboardGrid = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TopSection = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
`;

const StatusBadge = styled.div`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 1px;
  ${props => props.$status === 'in_progress' && css`
    background: #22c55e;
    animation: ${pulse} 2s ease-in-out infinite;
  `}
  ${props => props.$status === 'completed' && css`background: #6366f1;`}
  ${props => props.$status === 'innings_break' && css`background: #f59e0b;`}
  ${props => !['in_progress', 'completed', 'innings_break'].includes(props.$status) && css`background: #64748b;`}
`;

const MainScoreBlock = styled.div`
  flex: 1;
`;

const BattingTeamName = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 4px;
`;

const ScoreDisplay = styled.div`
  display: flex;
  align-items: baseline;
  gap: 2px;
`;

const BigRuns = styled.span`
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
`;

const ScoreDivider = styled.span`
  font-size: 48px;
  color: #64748b;
  margin: 0 4px;
`;

const BigWickets = styled.span`
  font-size: 48px;
  font-weight: 700;
  color: #f87171;
`;

const OversText = styled.span`
  font-size: 24px;
  color: #94a3b8;
  margin-left: 12px;
`;

const RateBlock = styled.div`
  display: flex;
  gap: 16px;
`;

const RateItem = styled.div`
  text-align: center;
  padding: 10px 16px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 10px;
  min-width: 70px;
`;

const RateLabel = styled.div`
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 4px;
`;

const RateValue = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: #fff;
`;

const MiddleSection = styled.div`
  flex: 1;
  display: flex;
  gap: 16px;
`;

const PlayersBlock = styled.div`
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
`;

const BlockTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 1px;
  margin-bottom: 12px;
`;

const BatsmenContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BatsmanRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: ${props => props.$striker ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 10px;
  border-left: 4px solid ${props => props.$striker ? '#22c55e' : 'transparent'};
`;

const BatsmanName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  flex: 1;
`;

const BatsmanStats = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const StatBig = styled.span`
  font-size: 28px;
  font-weight: 800;
  color: #fff;
`;

const StatSmall = styled.span`
  font-size: 14px;
  color: #94a3b8;
`;

const StatMeta = styled.span`
  font-size: 12px;
  color: #64748b;
  margin-left: 8px;
`;

const PartnershipText = styled.div`
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 8px;
  font-size: 13px;
  color: #60a5fa;
  text-align: center;
`;

const BowlerContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const BowlerName = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
`;

const BowlerStats = styled.div`
  display: flex;
  gap: 12px;
`;

const BowlerFigure = styled.div`
  text-align: center;
  padding: 10px 14px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 10px;

  span {
    display: block;
    font-size: 24px;
    font-weight: 800;
    color: #fff;
  }
  small {
    font-size: 10px;
    color: #94a3b8;
    letter-spacing: 1px;
  }
`;

const ThisOverContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const BallCircle = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
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

const NewOverText = styled.span`
  color: #64748b;
  font-size: 14px;
`;

const ExtrasText = styled.div`
  margin-top: 12px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
`;

const BottomSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
`;

const FirstInningsBlock = styled.div`
  font-size: 16px;
  color: #94a3b8;
`;

const ResultBlock = styled.div`
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #a78bfa;
`;

const BrandBlock = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #60a5fa;
`;

const ErrorContainer = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0a0f1c;
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
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
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
  background: #0a0f1c;
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid #334155;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  margin-bottom: 16px;
`;

const LoadingText = styled.div`
  font-size: 18px;
  color: #94a3b8;
`;

export default TournamentTVScoreboard;
