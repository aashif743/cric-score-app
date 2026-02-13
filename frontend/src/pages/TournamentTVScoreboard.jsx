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
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);

  // Fetch tournament data
  const fetchTournament = useCallback(async () => {
    try {
      const res = await publicService.getPublicTournament(shareId);
      if (res.success) {
        const { matches: m, ...t } = res.data;
        setTournament(t);
        setMatches(m || []);

        // Auto-select live match if exists
        const liveMatch = m?.find(match =>
          match.status === 'in_progress' || match.status === 'innings_break'
        );
        if (liveMatch && !selectedMatch) {
          setSelectedMatch(liveMatch._id);
        }
      } else {
        setError("Tournament not found");
      }
    } catch (err) {
      setError(err?.error || "Failed to load tournament");
    }
  }, [shareId, selectedMatch]);

  // Fetch match overlay data
  const fetchMatchData = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}`);
      const json = await res.json();
      if (json.success) {
        setMatchData(json.data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch match data:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  // Fetch match data when selected
  useEffect(() => {
    if (selectedMatch) {
      fetchMatchData(selectedMatch);
    }
  }, [selectedMatch, fetchMatchData]);

  // Setup WebSocket connection
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
      // Join all match rooms for this tournament
      matches.forEach(match => {
        socket.emit("join-match", match._id);
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("score-updated", (payload) => {
      // Refetch data on any update
      if (selectedMatch) {
        fetchMatchData(selectedMatch);
      }
      fetchTournament();
    });

    // Periodic refresh
    const refreshInterval = setInterval(() => {
      fetchTournament();
      if (selectedMatch) {
        fetchMatchData(selectedMatch);
      }
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(refreshInterval);
    };
  }, [matches, selectedMatch, fetchMatchData, fetchTournament]);

  // Re-join rooms when matches change
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      matches.forEach(match => {
        socketRef.current.emit("join-match", match._id);
      });
    }
  }, [matches]);

  if (error) {
    return (
      <ErrorContainer>
        <ErrorIcon>!</ErrorIcon>
        <ErrorText>{error}</ErrorText>
        <RetryButton onClick={fetchTournament}>Retry</RetryButton>
      </ErrorContainer>
    );
  }

  if (!tournament) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
        <LoadingText>Loading tournament...</LoadingText>
      </LoadingContainer>
    );
  }

  const liveMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'innings_break');
  const completedMatches = matches.filter(m => m.status === 'completed');
  const upcomingMatches = matches.filter(m => m.status === 'scheduled' || !m.status);

  return (
    <Container>
      {/* Tournament Header */}
      <TournamentHeader>
        <TournamentName>{tournament.name}</TournamentName>
        <TournamentInfo>
          {tournament.teams?.length || 0} Teams | {matches.length} Matches
        </TournamentInfo>
        <ConnectionBadge $connected={connected}>
          {connected ? "Live" : "Reconnecting..."}
        </ConnectionBadge>
      </TournamentHeader>

      <MainContent>
        {/* Match List Sidebar */}
        <MatchListSidebar>
          <SidebarTitle>Matches</SidebarTitle>

          {/* Live Matches */}
          {liveMatches.length > 0 && (
            <MatchSection>
              <MatchSectionTitle $live>Live Now</MatchSectionTitle>
              {liveMatches.map(match => (
                <MatchItem
                  key={match._id}
                  $selected={selectedMatch === match._id}
                  $live
                  onClick={() => setSelectedMatch(match._id)}
                >
                  <MatchTeams>
                    <TeamName>{match.teamA?.name || "Team A"}</TeamName>
                    <VsText>vs</VsText>
                    <TeamName>{match.teamB?.name || "Team B"}</TeamName>
                  </MatchTeams>
                  <MatchScore>
                    {match.innings1 && (
                      <ScoreText>
                        {match.innings1.runs}/{match.innings1.wickets}
                      </ScoreText>
                    )}
                    {match.innings2 && (
                      <ScoreText>
                        {match.innings2.runs}/{match.innings2.wickets}
                      </ScoreText>
                    )}
                  </MatchScore>
                  <LiveIndicator />
                </MatchItem>
              ))}
            </MatchSection>
          )}

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <MatchSection>
              <MatchSectionTitle>Completed</MatchSectionTitle>
              {completedMatches.slice(0, 5).map(match => (
                <MatchItem
                  key={match._id}
                  $selected={selectedMatch === match._id}
                  onClick={() => setSelectedMatch(match._id)}
                >
                  <MatchTeams>
                    <TeamName>{match.teamA?.name || "Team A"}</TeamName>
                    <VsText>vs</VsText>
                    <TeamName>{match.teamB?.name || "Team B"}</TeamName>
                  </MatchTeams>
                  <MatchScore>
                    {match.innings1 && (
                      <ScoreText $small>
                        {match.innings1.runs}/{match.innings1.wickets}
                      </ScoreText>
                    )}
                    {match.innings2 && (
                      <ScoreText $small>
                        {match.innings2.runs}/{match.innings2.wickets}
                      </ScoreText>
                    )}
                  </MatchScore>
                </MatchItem>
              ))}
            </MatchSection>
          )}

          {/* Upcoming Matches */}
          {upcomingMatches.length > 0 && (
            <MatchSection>
              <MatchSectionTitle>Upcoming</MatchSectionTitle>
              {upcomingMatches.slice(0, 3).map(match => (
                <MatchItem
                  key={match._id}
                  $selected={selectedMatch === match._id}
                  $upcoming
                  onClick={() => setSelectedMatch(match._id)}
                >
                  <MatchTeams>
                    <TeamName>{match.teamA?.name || "Team A"}</TeamName>
                    <VsText>vs</VsText>
                    <TeamName>{match.teamB?.name || "Team B"}</TeamName>
                  </MatchTeams>
                </MatchItem>
              ))}
            </MatchSection>
          )}
        </MatchListSidebar>

        {/* Main Scoreboard */}
        <ScoreboardArea>
          {selectedMatch && matchData ? (
            <FullScoreboard data={matchData} />
          ) : liveMatches.length > 0 ? (
            <SelectPrompt>
              <PromptIcon>🏏</PromptIcon>
              <PromptText>Select a match from the sidebar</PromptText>
            </SelectPrompt>
          ) : (
            <NoLiveMatch>
              <PromptIcon>📺</PromptIcon>
              <PromptText>No live matches right now</PromptText>
              <PromptSubtext>
                {completedMatches.length > 0
                  ? "Select a completed match to view scorecard"
                  : "Matches will appear here when they start"}
              </PromptSubtext>
            </NoLiveMatch>
          )}
        </ScoreboardArea>
      </MainContent>

      {/* Footer */}
      <Footer>
        <PoweredBy>CricZone</PoweredBy>
        {lastUpdate && (
          <UpdateTime>Last updated: {lastUpdate.toLocaleTimeString()}</UpdateTime>
        )}
      </Footer>
    </Container>
  );
};

// Full Scoreboard Component (embedded)
const FullScoreboard = ({ data }) => {
  const isSecondInnings = data.currentInnings === 2;
  const battingTeam = data.battingTeam || data.teamA?.name;
  const bowlingTeam = data.bowlingTeam || data.teamB?.name;

  return (
    <ScoreboardContainer>
      {/* Match Status */}
      <StatusRow>
        <StatusBadge $status={data.status}>
          {data.status === "in_progress" ? "LIVE" : data.status?.toUpperCase().replace("_", " ")}
        </StatusBadge>
        {data.result && <ResultText>{data.result}</ResultText>}
      </StatusRow>

      {/* Main Score */}
      <MainScoreArea>
        <BattingTeamLabel>{battingTeam}</BattingTeamLabel>
        <BigScore>
          <RunsValue>{data.runs || 0}</RunsValue>
          <ScoreSeparator>/</ScoreSeparator>
          <WicketsValue>{data.wickets || 0}</WicketsValue>
        </BigScore>
        <OversValue>({data.overs || "0.0"} overs)</OversValue>

        {isSecondInnings && data.firstInnings && (
          <FirstInningsInfo>
            {data.firstInnings.battingTeam}: {data.firstInnings.runs}/{data.firstInnings.wickets} ({data.firstInnings.overs})
          </FirstInningsInfo>
        )}
      </MainScoreArea>

      {/* Target Info (2nd Innings) */}
      {isSecondInnings && data.target && (
        <TargetRow>
          <TargetItem>
            <TargetLabel>Target</TargetLabel>
            <TargetValue>{data.target}</TargetValue>
          </TargetItem>
          <TargetItem $highlight>
            <TargetLabel>Need</TargetLabel>
            <TargetValue>{data.requiredRuns > 0 ? data.requiredRuns : 0}</TargetValue>
          </TargetItem>
          <TargetItem>
            <TargetLabel>Balls</TargetLabel>
            <TargetValue>{data.ballsRemaining || 0}</TargetValue>
          </TargetItem>
          <TargetItem $highlight>
            <TargetLabel>Req RR</TargetLabel>
            <TargetValue>{data.requiredRunRate || "-"}</TargetValue>
          </TargetItem>
        </TargetRow>
      )}

      {/* Run Rate */}
      <RateRow>
        <RateItem>
          <RateLabel>Run Rate</RateLabel>
          <RateValue>{data.runRate || "0.00"}</RateValue>
        </RateItem>
        {isSecondInnings && data.requiredRunRate && (
          <RateItem>
            <RateLabel>Required RR</RateLabel>
            <RateValue $highlight>{data.requiredRunRate}</RateValue>
          </RateItem>
        )}
      </RateRow>

      {/* Batsmen */}
      <PlayersSection>
        <SectionLabel>Batting</SectionLabel>
        <BatsmenRow>
          {data.striker && (
            <BatsmanBox $striker>
              <BatsmanName>{data.striker.name} *</BatsmanName>
              <BatsmanRuns>{data.striker.runs}</BatsmanRuns>
              <BatsmanBalls>({data.striker.balls})</BatsmanBalls>
              <BatsmanMeta>
                SR: {data.striker.strikeRate} | 4s: {data.striker.fours} | 6s: {data.striker.sixes}
              </BatsmanMeta>
            </BatsmanBox>
          )}
          {data.nonStriker && (
            <BatsmanBox>
              <BatsmanName>{data.nonStriker.name}</BatsmanName>
              <BatsmanRuns>{data.nonStriker.runs}</BatsmanRuns>
              <BatsmanBalls>({data.nonStriker.balls})</BatsmanBalls>
              <BatsmanMeta>
                SR: {data.nonStriker.strikeRate} | 4s: {data.nonStriker.fours} | 6s: {data.nonStriker.sixes}
              </BatsmanMeta>
            </BatsmanBox>
          )}
        </BatsmenRow>

        {data.partnership && (data.partnership.runs > 0 || data.partnership.balls > 0) && (
          <PartnershipInfo>
            Partnership: {data.partnership.runs} ({data.partnership.balls})
          </PartnershipInfo>
        )}
      </PlayersSection>

      {/* Bowler */}
      {data.bowler && (
        <PlayersSection>
          <SectionLabel>Bowling - {bowlingTeam}</SectionLabel>
          <BowlerBox>
            <BowlerName>{data.bowler.name}</BowlerName>
            <BowlerFigures>
              {data.bowler.overs} - {data.bowler.maidens} - {data.bowler.runs} - {data.bowler.wickets}
            </BowlerFigures>
            <BowlerEcon>Econ: {data.bowler.economy}</BowlerEcon>
          </BowlerBox>
        </PlayersSection>
      )}

      {/* This Over */}
      <ThisOverRow>
        <SectionLabel>This Over</SectionLabel>
        <BallsRow>
          {data.thisOver && data.thisOver.length > 0 ? (
            data.thisOver.map((ball, index) => (
              <BallCircle key={index} $type={getBallType(ball)}>
                {formatBall(ball)}
              </BallCircle>
            ))
          ) : (
            <NoBallsText>New over</NoBallsText>
          )}
        </BallsRow>
      </ThisOverRow>

      {/* Extras */}
      <ExtrasRow>
        <SectionLabel>Extras: {data.extras?.total || 0}</SectionLabel>
        <ExtrasDetail>
          Wd: {data.extras?.wides || 0} | Nb: {data.extras?.noBalls || 0} | B: {data.extras?.byes || 0} | Lb: {data.extras?.legByes || 0}
        </ExtrasDetail>
      </ExtrasRow>

      {/* Fall of Wickets */}
      {data.recentWickets && data.recentWickets.length > 0 && (
        <FowRow>
          <SectionLabel>Fall of Wickets</SectionLabel>
          <FowList>
            {data.recentWickets.map((fow, index) => (
              <FowItem key={index}>
                {fow.score}/{fow.wicket} ({fow.batsman}, {fow.over})
              </FowItem>
            ))}
          </FowList>
        </FowRow>
      )}
    </ScoreboardContainer>
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

// Styled Components
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const ErrorContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  color: #f87171;
`;

const ErrorIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #7f1d1d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: bold;
  margin-bottom: 24px;
`;

const ErrorText = styled.div`
  font-size: 24px;
  margin-bottom: 24px;
`;

const RetryButton = styled.button`
  background: #3b82f6;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  &:hover {
    background: #2563eb;
  }
`;

const LoadingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  color: white;
`;

const LoadingSpinner = styled.div`
  width: 60px;
  height: 60px;
  border: 4px solid #334155;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  margin-bottom: 24px;
`;

const LoadingText = styled.div`
  font-size: 20px;
  color: #94a3b8;
`;

const TournamentHeader = styled.header`
  padding: 24px 40px;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TournamentName = styled.h1`
  font-size: 32px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const TournamentInfo = styled.div`
  font-size: 16px;
  color: #94a3b8;
  flex: 1;
`;

const ConnectionBadge = styled.div`
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  background: ${props => props.$connected ? '#22c55e' : '#ef4444'};
  ${props => props.$connected && css`animation: ${pulse} 2s ease-in-out infinite;`}
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const MatchListSidebar = styled.aside`
  width: 320px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  padding: 20px;
`;

const SidebarTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #94a3b8;
  margin: 0 0 20px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const MatchSection = styled.div`
  margin-bottom: 24px;
`;

const MatchSectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$live ? '#22c55e' : '#64748b'};
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const MatchItem = styled.div`
  padding: 16px;
  background: ${props => props.$selected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  border: 2px solid ${props => props.$selected ? '#3b82f6' : 'transparent'};
  position: relative;
  transition: all 0.2s;

  ${props => props.$live && css`
    border-color: ${props.$selected ? '#22c55e' : 'rgba(34, 197, 94, 0.5)'};
    background: ${props.$selected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)'};
  `}

  ${props => props.$upcoming && css`
    opacity: 0.7;
  `}

  &:hover {
    background: ${props => props.$live ? 'rgba(34, 197, 94, 0.25)' : 'rgba(59, 130, 246, 0.15)'};
  }
`;

const MatchTeams = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const TeamName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VsText = styled.span`
  font-size: 12px;
  color: #64748b;
`;

const MatchScore = styled.div`
  display: flex;
  gap: 16px;
`;

const ScoreText = styled.span`
  font-size: ${props => props.$small ? '14px' : '16px'};
  font-weight: 700;
  color: #60a5fa;
`;

const LiveIndicator = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const ScoreboardArea = styled.main`
  flex: 1;
  padding: 32px;
  overflow-y: auto;
`;

const SelectPrompt = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const NoLiveMatch = styled(SelectPrompt)``;

const PromptIcon = styled.div`
  font-size: 64px;
  margin-bottom: 24px;
`;

const PromptText = styled.div`
  font-size: 24px;
  color: #94a3b8;
  margin-bottom: 8px;
`;

const PromptSubtext = styled.div`
  font-size: 16px;
  color: #64748b;
`;

const ScoreboardContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
`;

const StatusBadge = styled.div`
  padding: 8px 20px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 700;
  ${props => props.$status === 'in_progress' && css`
    background: #22c55e;
    animation: ${pulse} 2s ease-in-out infinite;
  `}
  ${props => props.$status === 'completed' && css`background: #6366f1;`}
  ${props => props.$status === 'innings_break' && css`background: #f59e0b;`}
`;

const ResultText = styled.div`
  font-size: 18px;
  color: #a78bfa;
  font-weight: 600;
`;

const MainScoreArea = styled.div`
  text-align: center;
  padding: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  margin-bottom: 24px;
`;

const BattingTeamLabel = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 12px;
`;

const BigScore = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
`;

const RunsValue = styled.span`
  font-size: 96px;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
`;

const ScoreSeparator = styled.span`
  font-size: 64px;
  color: #64748b;
`;

const WicketsValue = styled.span`
  font-size: 64px;
  font-weight: 700;
  color: #f87171;
`;

const OversValue = styled.div`
  font-size: 24px;
  color: #94a3b8;
  margin-top: 12px;
`;

const FirstInningsInfo = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 18px;
  color: #64748b;
`;

const TargetRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
`;

const TargetItem = styled.div`
  text-align: center;
  padding: 20px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 12px;
  border: 1px solid ${props => props.$highlight ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
`;

const TargetLabel = styled.div`
  font-size: 12px;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 6px;
`;

const TargetValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
`;

const RateRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 48px;
  margin-bottom: 24px;
`;

const RateItem = styled.div`
  text-align: center;
`;

const RateLabel = styled.div`
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 4px;
`;

const RateValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.$highlight ? '#f87171' : '#22c55e'};
`;

const PlayersSection = styled.div`
  margin-bottom: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
`;

const SectionLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
`;

const BatsmenRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
`;

const BatsmanBox = styled.div`
  padding: 20px;
  background: ${props => props.$striker ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 12px;
  text-align: center;
  border: 2px solid ${props => props.$striker ? 'rgba(34, 197, 94, 0.5)' : 'transparent'};
`;

const BatsmanName = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
`;

const BatsmanRuns = styled.div`
  font-size: 42px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
`;

const BatsmanBalls = styled.div`
  font-size: 16px;
  color: #64748b;
  margin-bottom: 12px;
`;

const BatsmanMeta = styled.div`
  font-size: 13px;
  color: #94a3b8;
`;

const PartnershipInfo = styled.div`
  margin-top: 16px;
  padding: 12px;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 8px;
  text-align: center;
  font-size: 16px;
  color: #60a5fa;
`;

const BowlerBox = styled.div`
  padding: 20px;
  background: rgba(168, 85, 247, 0.1);
  border-radius: 12px;
  text-align: center;
`;

const BowlerName = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 12px;
`;

const BowlerFigures = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #a78bfa;
  margin-bottom: 8px;
`;

const BowlerEcon = styled.div`
  font-size: 14px;
  color: #94a3b8;
`;

const ThisOverRow = styled.div`
  margin-bottom: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
`;

const BallsRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const BallCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
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

const NoBallsText = styled.span`
  color: #64748b;
  font-size: 16px;
`;

const ExtrasRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  margin-bottom: 20px;

  ${SectionLabel} {
    margin-bottom: 0;
  }
`;

const ExtrasDetail = styled.div`
  font-size: 14px;
  color: #94a3b8;
`;

const FowRow = styled.div`
  padding: 20px;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(239, 68, 68, 0.2);
`;

const FowList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const FowItem = styled.div`
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 14px;
`;

const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 40px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  font-size: 14px;
`;

const PoweredBy = styled.div`
  font-weight: 600;
  color: #60a5fa;
`;

const UpdateTime = styled.div``;

export default TournamentTVScoreboard;
