// Compute group standings from a tournament's match list.
//
// Points convention (cricket league standard):
//   win = 2, tie/no-result = 1, loss = 0
// Tie-break: points desc → NRR desc → head-to-head (only when two-way tie)
//
// `matches` is the array on the tournament fetch response. Each match should
// have status, teamA, teamB, innings1, innings2, matchSummary, result.

const oversToDecimal = (overs) => {
  if (!overs && overs !== 0) return 0;
  const [whole, balls] = overs.toString().split('.');
  return (parseInt(whole, 10) || 0) + (parseInt(balls, 10) || 0) / 6;
};

const winnerOf = (m) => {
  if (m.matchSummary?.winner) return m.matchSummary.winner;
  const idx = m.result?.indexOf(' won by ') ?? -1;
  return idx > 0 ? m.result.slice(0, idx) : '';
};

export function computeGroupStandings(matches, teamNames) {
  const row = (team) => ({
    team, played: 0, won: 0, lost: 0, tied: 0, points: 0,
    runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0,
    h2h: {},
    nrr: 0,
  });
  const table = Object.fromEntries(teamNames.map((t) => [t, row(t)]));

  matches.forEach((m) => {
    if (m.status !== 'completed') return;
    const a = m.teamA?.name; const b = m.teamB?.name;
    if (!a || !b || !table[a] || !table[b]) return;
    const i1 = m.innings1 || {}; const i2 = m.innings2 || {};

    const aFirst = i1.battingTeam === a;
    const aBat = aFirst ? i1 : i2;
    const bBat = aFirst ? i2 : i1;
    const aRuns = aBat.runs || 0;
    const aOv = oversToDecimal(aBat.overs);
    const bRuns = bBat.runs || 0;
    const bOv = oversToDecimal(bBat.overs);

    table[a].played++; table[b].played++;
    table[a].runsFor += aRuns; table[a].runsAgainst += bRuns;
    table[a].oversFor += aOv;  table[a].oversAgainst += bOv;
    table[b].runsFor += bRuns; table[b].runsAgainst += aRuns;
    table[b].oversFor += bOv;  table[b].oversAgainst += aOv;

    const winner = winnerOf(m);
    if (winner === a) {
      table[a].won++; table[b].lost++;
      table[a].points += 2;
      table[a].h2h[b] = 'won'; table[b].h2h[a] = 'lost';
    } else if (winner === b) {
      table[b].won++; table[a].lost++;
      table[b].points += 2;
      table[b].h2h[a] = 'won'; table[a].h2h[b] = 'lost';
    } else {
      table[a].tied++; table[b].tied++;
      table[a].points += 1; table[b].points += 1;
      table[a].h2h[b] = 'tied'; table[b].h2h[a] = 'tied';
    }
  });

  Object.values(table).forEach((r) => {
    const rrFor = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
    const rrAgainst = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
    r.nrr = +(rrFor - rrAgainst).toFixed(3);
  });

  return Object.values(table).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.nrr !== x.nrr) return y.nrr - x.nrr;
    if (x.h2h[y.team] === 'won') return -1;
    if (y.h2h[x.team] === 'won') return 1;
    return 0;
  });
}

// Format NRR for display: "+1.234" / "-0.482". Treat -0 as "0.000".
export function formatNRR(nrr) {
  if (!Number.isFinite(nrr) || nrr === 0) return '0.000';
  return (nrr > 0 ? '+' : '') + nrr.toFixed(3);
}

// Work out, for each team in a group, whether it has already CLINCHED a top-N
// (advance) place, been ELIMINATED, or is still in contention — accounting for
// the matches that haven't been played yet. Returns { [team]: 'Q' | 'E' | null }.
//
// The maths is deliberately conservative so it can NEVER show a wrong (Q): a
// team is only marked qualified when it is guaranteed a top-N finish under EVERY
// possible set of remaining results.
//
//  • A win is worth 2 points, a tie/no-result 1 — matching computeGroupStandings.
//  • floor(t)  = t's points if it LOSES every remaining match (its worst case).
//  • ceiling(t)= t's points if it WINS every remaining match (its best case).
//
//  Clinched (Q): fewer than `advance` OTHER teams can still reach team X's floor.
//     If at most advance-1 teams can end level-or-above X, X is at worst Nth →
//     guaranteed to qualify. (Two rivals who still play each other can't both hit
//     their ceiling, so counting them independently only ever UNDER-claims — safe.)
//  Eliminated (E): at least `advance` teams ALREADY have more points than X's
//     ceiling, so X can never climb into the top N no matter what.
//  Otherwise: null — still to be decided (e.g. a last-match "decider").
//
// Once the group is fully played we defer to the final NRR-resolved order, so a
// team that sneaks the last spot on net run rate is correctly shown as (Q).
export function computeQualification(standings, groupMatches, teamNames, advance) {
  const status = {};
  (teamNames || []).forEach((t) => { status[t] = null; });
  if (!advance || advance <= 0 || !Array.isArray(standings) || standings.length === 0) {
    return status;
  }

  const points = {};
  standings.forEach((r) => { points[r.team] = r.points || 0; });

  // Count each team's still-to-be-decided matches (anything not completed or
  // abandoned — an abandoned game won't be replayed, so it yields no more points).
  const remaining = {};
  (teamNames || []).forEach((t) => { remaining[t] = 0; });
  let totalRemaining = 0;
  (groupMatches || []).forEach((m) => {
    if (m.status === 'completed' || m.status === 'abandoned') return;
    const a = m.teamA?.name; const b = m.teamB?.name;
    if (a && remaining[a] !== undefined) remaining[a] += 1;
    if (b && remaining[b] !== undefined) remaining[b] += 1;
    totalRemaining += 1;
  });

  // Group finished → the standings order (points → NRR → H2H) is final.
  if (totalRemaining === 0) {
    standings.forEach((r, i) => { status[r.team] = i < advance ? 'Q' : 'E'; });
    return status;
  }

  const WIN = 2;
  const floorPts = (t) => (points[t] || 0);
  const ceilPts = (t) => (points[t] || 0) + WIN * (remaining[t] || 0);

  standings.forEach((r) => {
    const x = r.team;
    // Clinched: fewer than `advance` other teams can reach X's worst-case points.
    const canReachX = standings.filter((o) => o.team !== x && ceilPts(o.team) >= floorPts(x)).length;
    if (canReachX < advance) { status[x] = 'Q'; return; }
    // Eliminated: at least `advance` teams already sit above X's best-case points.
    const surelyAbove = standings.filter((o) => o.team !== x && floorPts(o.team) > ceilPts(x)).length;
    if (surelyAbove >= advance) { status[x] = 'E'; return; }
    status[x] = null;
  });
  return status;
}

// 3-letter short code for a team (uppercase). Falls back to first 3 letters.
export function shortCode(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0] + (words[2]?.[0] || '')).toUpperCase();
  return name.substring(0, 3).toUpperCase();
}
