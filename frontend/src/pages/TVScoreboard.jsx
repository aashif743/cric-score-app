import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import styled, { keyframes, css } from "styled-components";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const TVScoreboard = () => {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/overlay/${matchId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastUpdate(new Date());
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
    fetchData();

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

    socket.on("score-updated", () => {
      // Refetch full data on any update for comprehensive display
      fetchData();
    });

    // Periodic refresh as backup
    const refreshInterval = setInterval(fetchData, 5000);

    return () => {
      socket.disconnect();
      clearInterval(refreshInterval);
    };
  }, [matchId, fetchData]);

  if (error) {
    return (
      <ErrorContainer>
        <ErrorIcon>!</ErrorIcon>
        <ErrorText>{error}</ErrorText>
        <RetryButton onClick={fetchData}>Retry</RetryButton>
      </ErrorContainer>
    );
  }

  if (!data) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
        <LoadingText>Loading scoreboard...</LoadingText>
      </LoadingContainer>
    );
  }

  const isSecondInnings = data.currentInnings === 2;
  const battingTeam = data.battingTeam || data.teamA?.name;
  const bowlingTeam = data.bowlingTeam || data.teamB?.name;

  return (
    <Container>
      {/* Header */}
      <Header>
        <MatchTitle>{data.teamA?.name} vs {data.teamB?.name}</MatchTitle>
        <MatchInfo>{data.totalOvers} Overs Match</MatchInfo>
        <StatusBadge $status={data.status} $connected={connected}>
          {data.status === "in_progress" ? "LIVE" : data.status?.toUpperCase().replace("_", " ")}
        </StatusBadge>
      </Header>

      {/* Main Score Section */}
      <MainScoreSection>
        <BattingTeamName>{battingTeam}</BattingTeamName>
        <BigScore>
          <Runs>{data.runs || 0}</Runs>
          <Separator>/</Separator>
          <Wickets>{data.wickets || 0}</Wickets>
        </BigScore>
        <OversDisplay>({data.overs || "0.0"} overs)</OversDisplay>

        {/* First innings score for reference in 2nd innings */}
        {isSecondInnings && data.firstInnings && (
          <FirstInningsRef>
            {data.firstInnings.battingTeam}: {data.firstInnings.runs}/{data.firstInnings.wickets} ({data.firstInnings.overs})
          </FirstInningsRef>
        )}
      </MainScoreSection>

      {/* Target & Required Section (2nd Innings) */}
      {isSecondInnings && data.target && (
        <TargetSection>
          <TargetBox>
            <TargetLabel>Target</TargetLabel>
            <TargetValue>{data.target}</TargetValue>
          </TargetBox>
          <TargetBox $highlight>
            <TargetLabel>Need</TargetLabel>
            <TargetValue>{data.requiredRuns > 0 ? data.requiredRuns : 0}</TargetValue>
          </TargetBox>
          <TargetBox>
            <TargetLabel>Balls</TargetLabel>
            <TargetValue>{data.ballsRemaining || 0}</TargetValue>
          </TargetBox>
          <TargetBox $highlight>
            <TargetLabel>Req RR</TargetLabel>
            <TargetValue>{data.requiredRunRate || "-"}</TargetValue>
          </TargetBox>
        </TargetSection>
      )}

      {/* Run Rate Section */}
      <RateSection>
        <RateBox>
          <RateLabel>Current Run Rate</RateLabel>
          <RateValue>{data.runRate || "0.00"}</RateValue>
        </RateBox>
        {isSecondInnings && data.requiredRunRate && (
          <RateBox>
            <RateLabel>Required Run Rate</RateLabel>
            <RateValue $highlight>{data.requiredRunRate}</RateValue>
          </RateBox>
        )}
      </RateSection>

      {/* Batsmen Section */}
      <BatsmenSection>
        <SectionTitle>Batting</SectionTitle>
        <BatsmenGrid>
          {/* Striker */}
          {data.striker && (
            <BatsmanCard $isStriker>
              <BatsmanHeader>
                <BatsmanName>{data.striker.name}</BatsmanName>
                <StrikerBadge>*</StrikerBadge>
              </BatsmanHeader>
              <BatsmanScore>{data.striker.runs}</BatsmanScore>
              <BatsmanBalls>({data.striker.balls})</BatsmanBalls>
              <BatsmanStats>
                <StatItem>
                  <StatLabel>SR</StatLabel>
                  <StatValue>{data.striker.strikeRate}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>4s</StatLabel>
                  <StatValue>{data.striker.fours}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>6s</StatLabel>
                  <StatValue>{data.striker.sixes}</StatValue>
                </StatItem>
              </BatsmanStats>
            </BatsmanCard>
          )}

          {/* Non-Striker */}
          {data.nonStriker && (
            <BatsmanCard>
              <BatsmanHeader>
                <BatsmanName>{data.nonStriker.name}</BatsmanName>
              </BatsmanHeader>
              <BatsmanScore>{data.nonStriker.runs}</BatsmanScore>
              <BatsmanBalls>({data.nonStriker.balls})</BatsmanBalls>
              <BatsmanStats>
                <StatItem>
                  <StatLabel>SR</StatLabel>
                  <StatValue>{data.nonStriker.strikeRate}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>4s</StatLabel>
                  <StatValue>{data.nonStriker.fours}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>6s</StatLabel>
                  <StatValue>{data.nonStriker.sixes}</StatValue>
                </StatItem>
              </BatsmanStats>
            </BatsmanCard>
          )}
        </BatsmenGrid>

        {/* Partnership */}
        {data.partnership && (data.partnership.runs > 0 || data.partnership.balls > 0) && (
          <PartnershipBar>
            Partnership: {data.partnership.runs} runs ({data.partnership.balls} balls)
          </PartnershipBar>
        )}
      </BatsmenSection>

      {/* Bowler Section */}
      <BowlerSection>
        <SectionTitle>Bowling - {bowlingTeam}</SectionTitle>
        {data.bowler && (
          <BowlerCard>
            <BowlerName>{data.bowler.name}</BowlerName>
            <BowlerSpell>
              <SpellItem>
                <SpellLabel>O</SpellLabel>
                <SpellValue>{data.bowler.overs}</SpellValue>
              </SpellItem>
              <SpellItem>
                <SpellLabel>M</SpellLabel>
                <SpellValue>{data.bowler.maidens}</SpellValue>
              </SpellItem>
              <SpellItem>
                <SpellLabel>R</SpellLabel>
                <SpellValue>{data.bowler.runs}</SpellValue>
              </SpellItem>
              <SpellItem $highlight>
                <SpellLabel>W</SpellLabel>
                <SpellValue>{data.bowler.wickets}</SpellValue>
              </SpellItem>
              <SpellItem>
                <SpellLabel>Econ</SpellLabel>
                <SpellValue>{data.bowler.economy}</SpellValue>
              </SpellItem>
            </BowlerSpell>
          </BowlerCard>
        )}
      </BowlerSection>

      {/* This Over */}
      <ThisOverSection>
        <SectionTitle>This Over</SectionTitle>
        <ThisOverBalls>
          {data.thisOver && data.thisOver.length > 0 ? (
            data.thisOver.map((ball, index) => (
              <BallCircle key={index} $type={getBallType(ball)}>
                {formatBall(ball)}
              </BallCircle>
            ))
          ) : (
            <NoBalls>New over</NoBalls>
          )}
        </ThisOverBalls>
      </ThisOverSection>

      {/* Extras */}
      <ExtrasSection>
        <SectionTitle>Extras: {data.extras?.total || 0}</SectionTitle>
        <ExtrasBreakdown>
          <ExtrasItem>Wd: {data.extras?.wides || 0}</ExtrasItem>
          <ExtrasItem>Nb: {data.extras?.noBalls || 0}</ExtrasItem>
          <ExtrasItem>B: {data.extras?.byes || 0}</ExtrasItem>
          <ExtrasItem>Lb: {data.extras?.legByes || 0}</ExtrasItem>
        </ExtrasBreakdown>
      </ExtrasSection>

      {/* Fall of Wickets */}
      {data.recentWickets && data.recentWickets.length > 0 && (
        <FallOfWicketsSection>
          <SectionTitle>Fall of Wickets</SectionTitle>
          <WicketsList>
            {data.recentWickets.map((fow, index) => (
              <WicketItem key={index}>
                {fow.score}/{fow.wicket} ({fow.batsman}, {fow.over} ov)
              </WicketItem>
            ))}
          </WicketsList>
        </FallOfWicketsSection>
      )}

      {/* Match Result */}
      {data.status === "completed" && data.result && (
        <ResultSection>
          <ResultText>{data.result}</ResultText>
        </ResultSection>
      )}

      {/* Footer */}
      <Footer>
        <ConnectionStatus $connected={connected}>
          {connected ? "Connected" : "Reconnecting..."}
        </ConnectionStatus>
        {lastUpdate && (
          <UpdateTime>Last updated: {lastUpdate.toLocaleTimeString()}</UpdateTime>
        )}
        <PoweredBy>CricZone</PoweredBy>
      </Footer>
    </Container>
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
  padding: 40px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-y: auto;
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

const Header = styled.header`
  text-align: center;
  margin-bottom: 40px;
  position: relative;
`;

const MatchTitle = styled.h1`
  font-size: 42px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const MatchInfo = styled.div`
  font-size: 20px;
  color: #94a3b8;
`;

const StatusBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px 20px;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  ${props => props.$status === 'in_progress' && css`
    background: #22c55e;
    animation: ${pulse} 2s ease-in-out infinite;
  `}
  ${props => props.$status === 'completed' && css`
    background: #6366f1;
  `}
  ${props => props.$status === 'innings_break' && css`
    background: #f59e0b;
  `}
  ${props => !props.$connected && css`
    background: #ef4444;
  `}
`;

const MainScoreSection = styled.section`
  text-align: center;
  margin-bottom: 40px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const BattingTeamName = styled.div`
  font-size: 32px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 16px;
`;

const BigScore = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
`;

const Runs = styled.span`
  font-size: 120px;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(180deg, #ffffff 0%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Separator = styled.span`
  font-size: 80px;
  color: #64748b;
`;

const Wickets = styled.span`
  font-size: 80px;
  font-weight: 700;
  color: #f87171;
`;

const OversDisplay = styled.div`
  font-size: 28px;
  color: #94a3b8;
  margin-top: 16px;
`;

const FirstInningsRef = styled.div`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 20px;
  color: #64748b;
`;

const TargetSection = styled.section`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const TargetBox = styled.div`
  text-align: center;
  padding: 24px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 16px;
  border: 1px solid ${props => props.$highlight ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
`;

const TargetLabel = styled.div`
  font-size: 16px;
  color: #94a3b8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const TargetValue = styled.div`
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
`;

const RateSection = styled.section`
  display: flex;
  justify-content: center;
  gap: 60px;
  margin-bottom: 40px;
`;

const RateBox = styled.div`
  text-align: center;
`;

const RateLabel = styled.div`
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
`;

const RateValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.$highlight ? '#f87171' : '#22c55e'};
`;

const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: 0 0 20px 0;
`;

const BatsmenSection = styled.section`
  margin-bottom: 32px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
`;

const BatsmenGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
`;

const BatsmanCard = styled.div`
  padding: 24px;
  background: ${props => props.$isStriker ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 16px;
  border: 2px solid ${props => props.$isStriker ? 'rgba(34, 197, 94, 0.5)' : 'transparent'};
  text-align: center;
`;

const BatsmanHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
`;

const BatsmanName = styled.div`
  font-size: 22px;
  font-weight: 600;
  color: #ffffff;
`;

const StrikerBadge = styled.span`
  font-size: 28px;
  color: #22c55e;
`;

const BatsmanScore = styled.div`
  font-size: 56px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
`;

const BatsmanBalls = styled.div`
  font-size: 20px;
  color: #64748b;
  margin-bottom: 16px;
`;

const BatsmanStats = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
`;

const StatValue = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #94a3b8;
`;

const PartnershipBar = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 12px;
  text-align: center;
  font-size: 18px;
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.3);
`;

const BowlerSection = styled.section`
  margin-bottom: 32px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
`;

const BowlerCard = styled.div`
  padding: 20px;
  background: rgba(168, 85, 247, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(168, 85, 247, 0.3);
`;

const BowlerName = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 16px;
  text-align: center;
`;

const BowlerSpell = styled.div`
  display: flex;
  justify-content: center;
  gap: 32px;
`;

const SpellItem = styled.div`
  text-align: center;
  padding: 12px 20px;
  background: ${props => props.$highlight ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 12px;
`;

const SpellLabel = styled.div`
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 4px;
`;

const SpellValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
`;

const ThisOverSection = styled.section`
  margin-bottom: 32px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
`;

const ThisOverBalls = styled.div`
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
`;

const BallCircle = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  ${props => {
    switch (props.$type) {
      case 'wicket':
        return css`background: #ef4444; color: white;`;
      case 'wide':
      case 'noball':
        return css`background: #f59e0b; color: white;`;
      case 'four':
        return css`background: #22c55e; color: white;`;
      case 'six':
        return css`background: #8b5cf6; color: white;`;
      case 'dot':
        return css`background: #374151; color: #9ca3af;`;
      default:
        return css`background: #1e40af; color: white;`;
    }
  }}
`;

const NoBalls = styled.div`
  color: #64748b;
  font-size: 18px;
`;

const ExtrasSection = styled.section`
  margin-bottom: 32px;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  ${SectionTitle} {
    margin: 0;
  }
`;

const ExtrasBreakdown = styled.div`
  display: flex;
  gap: 24px;
`;

const ExtrasItem = styled.span`
  color: #94a3b8;
  font-size: 16px;
`;

const FallOfWicketsSection = styled.section`
  margin-bottom: 32px;
  padding: 24px;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(239, 68, 68, 0.2);
`;

const WicketsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
`;

const WicketItem = styled.div`
  padding: 10px 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 16px;
`;

const ResultSection = styled.section`
  margin-bottom: 32px;
  padding: 32px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2));
  border-radius: 20px;
  text-align: center;
  border: 2px solid rgba(99, 102, 241, 0.5);
`;

const ResultText = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
`;

const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #64748b;
  font-size: 14px;
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  &::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${props => props.$connected ? '#22c55e' : '#ef4444'};
  }
`;

const UpdateTime = styled.div``;

const PoweredBy = styled.div`
  font-weight: 600;
  color: #60a5fa;
`;

export default TVScoreboard;
