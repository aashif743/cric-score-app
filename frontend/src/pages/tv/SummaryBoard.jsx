import React from "react";
import styled, { keyframes } from "styled-components";
import { NoScroll, TvScreen } from "./LiveBoard";
import brand from "../../assets/criczone_icon.png";

// Distinct, consistent colour per team so the two sides are easy to tell apart.
const TEAM_A = { main: "#3b82f6", grad: "linear-gradient(90deg,#2563eb,#1e40af)", tint: "rgba(59,130,246,.18)", border: "rgba(59,130,246,.6)" };
const TEAM_B = { main: "#f97316", grad: "linear-gradient(90deg,#ea580c,#9a3412)", tint: "rgba(249,115,22,.18)", border: "rgba(249,115,22,.6)" };

const SummaryBoard = ({ summary, title }) => {
  const inns = [summary.innings1, summary.innings2].filter(Boolean);
  const aName = summary.teamA?.name;
  const eq = (x, y) => (x || "").trim().toLowerCase() === (y || "").trim().toLowerCase();
  const colorFor = (name) => (eq(name, aName) ? TEAM_A : TEAM_B);

  return (
    <><NoScroll />
    <Screen>
      <HeaderBar>
        <Kicker>MATCH SUMMARY</Kicker>
        <LeagueName>{title}</LeagueName>
        <Logo src={brand} alt="CricZone" />
      </HeaderBar>

      <Columns>
        {inns.map((inn, i) => {
          const bat = colorFor(inn.battingTeam);
          const bowl = colorFor(inn.bowlingTeam);
          return (
            <Col key={i} $border={bat.main}>
              <TeamHead $grad={bat.grad}>
                <TeamName>{inn.battingTeam}</TeamName>
                <ScoreWrap>
                  <Score>{inn.runs}-{inn.wickets}</Score>
                  <OversLabel>{String(inn.overs || "0.0")} OV</OversLabel>
                </ScoreWrap>
              </TeamHead>

              <Section>
                <SecLabel $c={bat.main}>Batting</SecLabel>
                {inn.topBatters.length ? inn.topBatters.map((b, j) => (
                  <Row key={j}>
                    <Nm>{b.name}</Nm>
                    <Chip><b>{b.runs}{b.notOut ? "*" : ""}</b><Sub>({b.balls})</Sub></Chip>
                  </Row>
                )) : <Row><Nm>—</Nm></Row>}
              </Section>

              <BowlBlock>
                <BowlBand $tint={bowl.tint} $border={bowl.border}>
                  <Swatch $c={bowl.main} /> {inn.bowlingTeam || "Bowling"} <BowlTag>BOWLING</BowlTag>
                </BowlBand>
                <Section>
                  {inn.topBowlers.length ? inn.topBowlers.map((b, j) => (
                    <Row key={j}>
                      <Nm>{b.name}</Nm>
                      <Chip $bg={bowl.tint} $bd={bowl.border} $c={bowl.main}><b>{b.wickets}-{b.runs}</b><Sub $c={bowl.main}>({b.overs})</Sub></Chip>
                    </Row>
                  )) : <Row><Nm>—</Nm></Row>}
                </Section>
              </BowlBlock>
            </Col>
          );
        })}
        {inns.length === 0 && <Muted>Match summary will appear here.</Muted>}
      </Columns>

      {summary.result ? (
        <ResultWrap>
          <ResultBar>
            <ResultText>{summary.result}</ResultText>
          </ResultBar>
        </ResultWrap>
      ) : null}
    </Screen></>
  );
};

const glow = keyframes`0%,100%{box-shadow:0 0 0 rgba(34,197,94,.0),0 12px 34px rgba(0,0,0,.4)}50%{box-shadow:0 0 34px rgba(34,197,94,.45),0 12px 34px rgba(0,0,0,.4)}`;

const Screen = styled(TvScreen)`gap: 1.8vh; padding: 2.4vh 2.6vw;`;

const HeaderBar = styled.header`
  flex-shrink: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1vw;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 1.2vh; padding: 1vh 1.6vw;
`;
const Kicker = styled.div`justify-self: start; font-size: clamp(11px,1.8vh,24px); font-weight: 900; letter-spacing: 3px; color: #94a3b8; text-transform: uppercase;`;
const LeagueName = styled.h1`
  margin: 0; text-align: center; font-weight: 900; letter-spacing: .5px; text-transform: uppercase; color: #fbbf24;
  font-size: clamp(18px,3.2vh,50px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55vw;
`;
const Logo = styled.img`justify-self: end; height: clamp(28px,5vh,64px); width: auto; object-fit: contain;`;

const Columns = styled.section`flex: 1; min-height: 0; display: flex; gap: 2.4vw; @media (orientation: portrait){flex-direction:column;}`;
const Col = styled.div`
  flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column;
  padding-bottom: 1.4vh;
  background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08);
  border-top: 6px solid ${p => p.$border}; border-radius: 1.4vh;
`;
const TeamHead = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 1vw; padding: 1.8vh 1.8vw; background: ${p => p.$grad};
`;
const TeamName = styled.div`
  font-size: clamp(20px,4.2vh,60px); font-weight: 900; color: #fff; letter-spacing: -.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,.3);
`;
const ScoreWrap = styled.div`display: flex; align-items: baseline; gap: .6vw; flex-shrink: 0;`;
const Score = styled.div`font-size: clamp(26px,5.2vh,72px); font-weight: 900; color: #fff; line-height: 1;`;
const OversLabel = styled.div`font-size: clamp(10px,1.6vh,20px); font-weight: 800; color: rgba(255,255,255,.9); letter-spacing: 1px;`;

const Section = styled.div`display: flex; flex-direction: column; padding: 0 1.8vw;`;
const SecLabel = styled.div`
  font-size: clamp(10px,1.5vh,18px); font-weight: 900; letter-spacing: 2px; color: ${p => p.$c || "#64748b"}; text-transform: uppercase; padding: 1.6vh 0 .6vh;
`;
const Row = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 1.2vw; padding: 1vh 0; border-bottom: 1px solid rgba(255,255,255,.06);
`;
const Nm = styled.div`
  font-size: clamp(15px,3.1vh,44px); font-weight: 700; color: #f1f5f9;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;
/* Uniform chip size for every batter score & bowling spell so they line up. */
const Chip = styled.div`
  display: inline-flex; align-items: baseline; justify-content: center; gap: 6px; flex-shrink: 0;
  min-width: clamp(96px, 9vw, 180px);
  padding: .6vh 1vw; border-radius: 1vh;
  background: ${p => p.$bg || "rgba(255,255,255,.1)"};
  border: 1px solid ${p => p.$bd || "rgba(255,255,255,.14)"};
  b { font-size: clamp(16px,3.2vh,46px); font-weight: 900; color: ${p => p.$c || "#fff"}; }
`;
const Sub = styled.span`font-size: clamp(11px,1.8vh,22px); color: ${p => p.$c ? p.$c : "#94a3b8"}; opacity: ${p => p.$c ? .8 : 1}; font-weight: 700;`;

const BowlBlock = styled.div`margin-top: auto; padding-top: 2.4vh;`;
const BowlBand = styled.div`
  display: flex; align-items: center; gap: .7vw;
  font-size: clamp(12px,1.9vh,26px); font-weight: 900; letter-spacing: .5px; color: #fff; text-transform: uppercase;
  padding: 1.2vh 1.8vw; background: ${p => p.$tint}; border-top: 1px solid ${p => p.$border}; border-bottom: 1px solid ${p => p.$border};
`;
const BowlTag = styled.span`margin-left: auto; font-size: .62em; letter-spacing: 2px; color: #cbd5e1;`;
const Swatch = styled.span`width: clamp(11px,1.8vh,22px); height: clamp(11px,1.8vh,22px); border-radius: 5px; background: ${p => p.$c}; display: inline-block;`;
const Muted = styled.div`color: #64748b; font-size: clamp(16px,2.6vh,32px); margin: auto;`;

const ResultWrap = styled.div`flex-shrink: 0; display: flex; justify-content: center;`;
const ResultBar = styled.div`
  display: inline-flex; align-items: center; justify-content: center; max-width: 92vw;
  padding: 1.4vh 3.4vw; border-radius: 999px;
  background: linear-gradient(135deg, #16a34a, #15803d);
  border: 2px solid rgba(255,255,255,.18);
  animation: ${glow} 2.4s ease-in-out infinite;
`;
const ResultText = styled.div`
  font-size: clamp(22px,4.6vh,66px); font-weight: 900; color: #fff; letter-spacing: .5px; text-transform: uppercase;
  text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,.3); white-space: nowrap;
`;

export default SummaryBoard;
