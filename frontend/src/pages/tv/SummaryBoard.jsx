import React from "react";
import styled from "styled-components";
import { NoScroll, TvScreen } from "./LiveBoard";

// End-of-match summary shown on the tournament TV between matches — a landscape
// broadcast card: each innings column shows the batting team + score, its top
// batters, then the fielding team's top bowlers; the result sits in a footer.
const SummaryBoard = ({ summary, title }) => {
  const inns = [summary.innings1, summary.innings2].filter(Boolean);

  return (
    <><NoScroll />
    <Screen>
      <Header>
        <Kicker>MATCH SUMMARY</Kicker>
        <Title>{title}</Title>
        <RightSpace />
      </Header>

      <Columns>
        {inns.map((inn, i) => (
          <Col key={i}>
            <TeamHead>
              <TeamName>{inn.battingTeam}</TeamName>
              <TeamScore>{inn.runs}-{inn.wickets} <small>({inn.overs} ov)</small></TeamScore>
            </TeamHead>

            <List>
              {inn.topBatters.map((b, j) => (
                <Row key={j}>
                  <Nm>{b.name}</Nm>
                  <Val>{b.runs}{b.notOut ? "*" : ""} <em>({b.balls})</em></Val>
                </Row>
              ))}
              {inn.topBatters.length === 0 && <Empty>—</Empty>}
            </List>

            <SubHead>{inn.bowlingTeam || "Bowling"}</SubHead>
            <List>
              {inn.topBowlers.map((b, j) => (
                <Row key={j}>
                  <Nm>{b.name}</Nm>
                  <Val $bowl>{b.wickets}-{b.runs} <em>({b.overs})</em></Val>
                </Row>
              ))}
              {inn.topBowlers.length === 0 && <Empty>—</Empty>}
            </List>
          </Col>
        ))}
        {inns.length === 0 && <Muted>Match summary will appear here.</Muted>}
      </Columns>

      {summary.playerOfMatch ? (
        <Potm>
          <span>PLAYER OF THE MATCH</span>
          <b>{summary.playerOfMatch}</b>
          {summary.playerOfMatchLine ? <i>{summary.playerOfMatchLine}</i> : null}
        </Potm>
      ) : null}

      {summary.result ? <ResultBar>{summary.result}</ResultBar> : null}
    </Screen></>
  );
};

const Screen = TvScreen;
const Header = styled.header`
  flex-shrink: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1vw;
`;
const Kicker = styled.div`
  justify-self: start; font-size: clamp(12px, 2vh, 26px); font-weight: 900; letter-spacing: 3px;
  color: #64748b; text-transform: uppercase;
`;
const Title = styled.h1`
  margin: 0; text-align: center; font-weight: 900; letter-spacing: -.5px; color: #e2e8f0;
  font-size: clamp(20px, 3.4vh, 54px);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60vw;
`;
const RightSpace = styled.div``;

const Columns = styled.section`
  flex: 1; min-height: 0; display: flex; gap: 2vw; margin-top: 1vh;
  @media (orientation: portrait) { flex-direction: column; }
`;
const Col = styled.div`
  flex: 1; min-width: 0; overflow: hidden;
  background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09);
  border-radius: 1.8vh; padding: 1.6vh 1.6vw;
  display: flex; flex-direction: column; gap: .8vh;
`;
const TeamHead = styled.div`
  display: flex; align-items: baseline; justify-content: space-between; gap: 1vw;
  padding-bottom: 1vh; border-bottom: 2px solid rgba(255,255,255,.1);
`;
const TeamName = styled.div`
  font-size: clamp(22px, 4.2vh, 60px); font-weight: 900; color: #60a5fa; letter-spacing:-.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;
const TeamScore = styled.div`
  font-size: clamp(24px, 4.6vh, 66px); font-weight: 900; color: #fff; white-space: nowrap;
  small { font-size: .5em; color: #94a3b8; font-weight: 700; }
`;
const SubHead = styled.div`
  margin-top: .6vh; font-size: clamp(12px, 1.9vh, 24px); font-weight: 800; letter-spacing: 1.5px;
  color: #94a3b8; text-transform: uppercase;
`;
const List = styled.div`display: flex; flex-direction: column;`;
const Row = styled.div`
  display: flex; align-items: baseline; justify-content: space-between; gap: 1vw;
  padding: .55vh 0; border-bottom: 1px solid rgba(255,255,255,.05);
`;
const Nm = styled.div`
  font-size: clamp(16px, 3vh, 42px); font-weight: 700; color: #e2e8f0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;
const Val = styled.div`
  font-size: clamp(16px, 3vh, 42px); font-weight: 900; white-space: nowrap;
  color: ${p => p.$bowl ? "#fca5a5" : "#fff"};
  em { font-style: normal; color: #94a3b8; font-size: .62em; font-weight: 700; }
`;
const Empty = styled.div`color: #475569; font-size: clamp(14px, 2.4vh, 30px); padding: .55vh 0;`;
const Muted = styled.div`color: #64748b; font-size: clamp(16px, 2.6vh, 32px); margin: auto;`;

const Potm = styled.div`
  flex-shrink: 0; display: flex; align-items: baseline; gap: 1.2vw; justify-content: center;
  padding: 1vh 2vw; border-radius: 1.4vh;
  background: linear-gradient(135deg, rgba(37,99,235,.22), rgba(99,102,241,.22));
  border: 1px solid rgba(96,165,250,.4);
  span { font-size: clamp(11px, 1.7vh, 22px); font-weight: 900; letter-spacing: 2px; color: #93c5fd; }
  b { font-size: clamp(18px, 3.2vh, 44px); font-weight: 900; color: #fff; }
  i { font-style: normal; font-size: clamp(14px, 2.4vh, 32px); color: #cbd5e1; font-weight: 700; }
`;
const ResultBar = styled.div`
  flex-shrink: 0; text-align: center; padding: 1.4vh 2vw; border-radius: 1.4vh;
  background: linear-gradient(135deg, #16a34a, #15803d);
  font-size: clamp(20px, 4vh, 60px); font-weight: 900; color: #fff; letter-spacing: .5px;
  text-transform: uppercase;
`;

export default SummaryBoard;
