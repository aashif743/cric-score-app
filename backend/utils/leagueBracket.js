// League tournament generator.
//
// Input:  teamNames, numGroups, teamsAdvance, matchesPerPair
// Output:
//   - groups:           teamNames split into N groups by snake order
//   - groupMatches:     round-robin pairs per group, repeated `matchesPerPair` times
//   - knockoutMatches:  cross-paired single-elimination bracket of TBD slots
//                       (empty array when teamsAdvance is 0 or fewer than 2 teams
//                       would advance overall)
//
// `groupMatches` carry { group, roundInGroup, teamA, teamB }.
// `knockoutMatches` carry { round, bracketSlot, parentRound, parentSlot,
//                           parentSide, sourceA, sourceB } where sourceA/B
// describe where the slot will be filled from (e.g. "A1" = group A position 1).
// teamA/teamB on knockout matches are always null until the group stage finishes.

// Canonical seed order for a power-of-two bracket (1-based seed numbers in slot
// order), e.g. size 8 -> [1,8,4,5,2,7,3,6]. Keeps seed 1 & 2 in opposite halves
// (only meet in the final), 1 v 4 / 2 v 3 in the semis, etc.
function seedBracketOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next = [];
    for (const s of order) { next.push(s); next.push(n + 1 - s); }
    order = next;
  }
  return order;
}

// Snake order: round-robin draft. Spreads strong/weak teams evenly if the
// input list is roughly ranked. e.g. [t1..t6], 2 groups →
// A: t1, t4, t5 ; B: t2, t3, t6
function snakeDistribute(teamNames, numGroups) {
  const groups = Array.from({ length: numGroups }, () => []);
  teamNames.forEach((team, i) => {
    const round = Math.floor(i / numGroups);
    const idx = round % 2 === 0 ? i % numGroups : numGroups - 1 - (i % numGroups);
    groups[idx].push(team);
  });
  return groups;
}

// Circle method (Berger tables) round-robin pairings. Returns rounds; each
// round is an array of {teamA, teamB} pairs. Handles odd n via a bye (skipped).
function roundRobinPairs(teams) {
  const n = teams.length;
  if (n < 2) return [];
  const arr = n % 2 === 1 ? [...teams, null] : [...teams];
  const m = arr.length;
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a && b) pairs.push({ teamA: a, teamB: b });
    }
    rounds.push(pairs);
    // Rotate: fix arr[0], rotate the rest right by 1.
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

function buildGroupMatches(groups, matchesPerPair) {
  const out = [];
  const groupLetter = (i) => String.fromCharCode(65 + i);
  groups.forEach((group, gIdx) => {
    const letter = groupLetter(gIdx);
    const rounds = roundRobinPairs(group);
    // Repeat the round-robin matchesPerPair times. On odd repeats, swap home/away.
    for (let rep = 0; rep < matchesPerPair; rep++) {
      rounds.forEach((roundPairs, rIdx) => {
        roundPairs.forEach((pair) => {
          const teamA = rep % 2 === 0 ? pair.teamA : pair.teamB;
          const teamB = rep % 2 === 0 ? pair.teamB : pair.teamA;
          out.push({
            group: letter,
            roundInGroup: rep * rounds.length + rIdx + 1,
            teamA, teamB,
          });
        });
      });
    }
  });
  return out;
}

// Build a single-elimination bracket of TBD slots.
//
// Sources are labelled "A1", "B2", etc. — group letter + finishing position.
// Cross-pairing means group winners face second-placed teams from other groups.
// We lay out the first round as [A1, B2, B1, A2, C1, D2, D1, C2, ...] which
// keeps same-group teams on opposite halves of the bracket where possible.
// Build a single-elimination bracket from an explicit, ordered seed list (seed 1
// first). Byes fall on the TOP seeds via the canonical seeding order, so strong
// teams skip round 1 and two byes never meet. Returns match defs carrying
// { round, bracketSlot, sourceA, sourceB, parentRound, parentSlot, parentSide }
// (winner links) plus numRounds. Works for any list length >= 2.
function buildBracketFromSeeds(seedList) {
  const n = seedList.length;
  if (n < 2) return { matches: [], numRounds: 0, sources: [] };
  const numRounds = Math.ceil(Math.log2(n));
  const slots = 2 ** numRounds;
  const order = seedBracketOrder(slots);
  const sources = order.map((s) => (s <= n ? seedList[s - 1] : null));

  const slotInfo = { 1: [] };
  const r1Count = slots / 2;
  for (let i = 0; i < r1Count; i++) {
    const sA = sources[2 * i];
    const sB = sources[2 * i + 1];
    slotInfo[1].push({ sourceA: sA, sourceB: sB, isBye: !sA || !sB });
  }
  for (let r = 2; r <= numRounds; r++) {
    const count = slots / 2 ** r;
    slotInfo[r] = [];
    for (let i = 0; i < count; i++) {
      const cA = slotInfo[r - 1][2 * i];
      const cB = slotInfo[r - 1][2 * i + 1];
      const sA = cA.isBye ? (cA.sourceA || cA.sourceB) : null;
      const sB = cB.isBye ? (cB.sourceA || cB.sourceB) : null;
      slotInfo[r].push({ sourceA: sA, sourceB: sB, isBye: false });
    }
  }
  const matches = [];
  for (let r = 1; r <= numRounds; r++) {
    slotInfo[r].forEach((slot, i) => {
      if (r === 1 && slot.isBye) return;
      matches.push({
        round: r,
        bracketSlot: i + 1,
        sourceA: slot.sourceA,
        sourceB: slot.sourceB,
        parentRound: r < numRounds ? r + 1 : null,
        parentSlot: r < numRounds ? Math.floor(i / 2) + 1 : null,
        parentSide: i % 2 === 0 ? 'A' : 'B',
      });
    });
  }
  return { matches, numRounds, sources };
}

// Standard single-elimination bracket of all qualifiers. Sources are labelled
// "A1", "B2", … (group letter + finishing position); group winners are the top
// seeds, so the canonical order cross-pairs winners against other groups' lower
// finishers and keeps same-group teams apart where possible.
function buildKnockoutMatches(numGroups, teamsAdvance) {
  if (teamsAdvance < 1) return { knockoutMatches: [], sources: [] };
  if (numGroups * teamsAdvance < 2) return { knockoutMatches: [], sources: [] };
  const seedList = qualifierSeeds(numGroups, teamsAdvance);
  const { matches, sources } = buildBracketFromSeeds(seedList);
  return { knockoutMatches: matches, sources };
}

// Qualifiers as seeds: group winners first (A1, B1, …), then runners-up.
function qualifierSeeds(numGroups, teamsAdvance) {
  const groupLetter = (i) => String.fromCharCode(65 + i);
  const seeds = [];
  for (let p = 1; p <= teamsAdvance; p++) {
    for (let g = 0; g < numGroups; g++) seeds.push(`${groupLetter(g)}${p}`);
  }
  return seeds;
}

// General IPL-style playoff for M = numGroups × teamsAdvance qualifiers (M ≥ 4):
//   • The top 2 seeds (group winners A1, B1) get byes straight to Qualifier 1.
//   • The other M-2 seeds play a seeded single-elimination knockout whose FINAL
//     match is the Eliminator.
//   • Qualifier 1 winner → Final, loser → Qualifier 2.
//     Eliminator winner → Qualifier 2. Qualifier 2 winner → Final.
// So exactly 4 teams reach the playoff stage. This reproduces the classic 4-team
// (M=4: 0 pre-rounds) and the 6-team (M=6: one knockout round) formats exactly,
// and extends to any larger field. Round numbering: the "others" sub-bracket
// occupies rounds 1..r (Eliminator = round r), Qualifier 1 shares round r,
// Qualifier 2 = round r+1, Final = round r+2.
function buildGeneralPlayoff(numGroups, teamsAdvance) {
  const M = numGroups * teamsAdvance;
  if (M < 4) return buildKnockoutMatches(numGroups, teamsAdvance);

  // Sources are GROUP POSITIONS — group winners first (A1, B1, …), then
  // runners-up (A2, B2, …), etc. So the two group winners bye to Qualifier 1
  // and the rest cross-pair in the pre-Eliminator knockout (A2 v B3, B2 v A3, …).
  // These slots are filled from each group's standings as it completes, and the
  // labels read as group + place ("A2", "B3") everywhere.
  const seeds = qualifierSeeds(numGroups, teamsAdvance);
  const [q1a, q1b, ...others] = seeds;            // top 2 group winners → Qualifier 1
  const sub = buildBracketFromSeeds(others);       // K = M-2 teams → Eliminator
  const r = sub.numRounds;                          // Eliminator is at round r, slot 1
  const q2Round = r + 1;
  const finalRound = r + 2;
  const isElim = (m) => m.round === r && m.bracketSlot === 1;

  // Number the pre-Eliminator knockout matches "Knockout 1..n" in play order.
  const koNo = new Map();
  sub.matches
    .filter((m) => !isElim(m))
    .sort((a, b) => a.round - b.round || a.bracketSlot - b.bracketSlot)
    .forEach((m, i) => koNo.set(`${m.round}_${m.bracketSlot}`, i + 1));

  const knockoutMatches = sub.matches.map((m) => ({
    round: m.round,
    bracketSlot: m.bracketSlot,
    matchLabel: isElim(m) ? 'Eliminator' : `Knockout ${koNo.get(`${m.round}_${m.bracketSlot}`)}`,
    sourceA: m.sourceA,
    sourceB: m.sourceB,
    // The Eliminator (sub-bracket final) feeds Qualifier 2 (B); inner matches
    // keep their winner links inside the sub-bracket.
    parentRound: isElim(m) ? q2Round : m.parentRound,
    parentSlot: isElim(m) ? 1 : m.parentSlot,
    parentSide: isElim(m) ? 'B' : m.parentSide,
  }));

  // Qualifier 1 shares the Eliminator's round (slot 2 to avoid a collision).
  knockoutMatches.push({
    round: r, bracketSlot: 2, matchLabel: 'Qualifier 1',
    sourceA: q1a, sourceB: q1b,
    parentRound: finalRound, parentSlot: 1, parentSide: 'A',           // winner → Final A
    loserParentRound: q2Round, loserParentSlot: 1, loserParentSide: 'A', // loser → Qualifier 2 A
  });
  knockoutMatches.push({
    round: q2Round, bracketSlot: 1, matchLabel: 'Qualifier 2',
    sourceA: null, sourceB: null,
    parentRound: finalRound, parentSlot: 1, parentSide: 'B',            // winner → Final B
  });
  knockoutMatches.push({
    round: finalRound, bracketSlot: 1, matchLabel: 'Final',
    sourceA: null, sourceB: null,
    parentRound: null, parentSlot: null, parentSide: null,
  });

  return { knockoutMatches, sources: seeds };
}

// Back-compat alias: the "qualifier" format is now the general playoff.
function buildQualifierPlayoff(numGroups, teamsAdvance) {
  return buildGeneralPlayoff(numGroups, teamsAdvance);
}

// Whether the requested playoff format is valid for the given group setup.
// The IPL-style "qualifier" playoff works for ANY 4+ qualifiers (the general
// builder handles the pre-Eliminator knockout rounds). Anything else, or fewer
// than 4 qualifiers, falls back to a plain knockout. 'qualifier6' is accepted as
// a legacy alias for 'qualifier'.
function normalizePlayoffFormat(playoffFormat, numGroups, teamsAdvance) {
  if (teamsAdvance < 1) return 'knockout';
  const M = numGroups * teamsAdvance;
  if ((playoffFormat === 'qualifier' || playoffFormat === 'qualifier6') && M >= 4) return 'qualifier';
  return 'knockout';
}

// Single entry point for building the playoff/knockout stage for any format.
function buildPlayoff(numGroups, teamsAdvance, playoffFormat) {
  const fmt = normalizePlayoffFormat(playoffFormat, numGroups, teamsAdvance);
  if (fmt === 'qualifier') return buildGeneralPlayoff(numGroups, teamsAdvance);
  return buildKnockoutMatches(numGroups, teamsAdvance);
}

function generateLeagueBracket(teamNames, numGroups, teamsAdvance, matchesPerPair, playoffFormat, groupsOverride) {
  if (!Array.isArray(teamNames) || teamNames.length < 2) {
    throw new Error('League requires at least 2 teams');
  }
  if (numGroups < 1) throw new Error('numGroups must be >= 1');
  if (matchesPerPair < 1) throw new Error('matchesPerPair must be >= 1');

  // A caller can pass an explicit groups arrangement (e.g. after the owner swaps
  // two teams between groups); otherwise fall back to the snake distribution.
  const groups = (Array.isArray(groupsOverride) && groupsOverride.length)
    ? groupsOverride.map((g) => [...g])
    : snakeDistribute(teamNames, numGroups);
  // A group needs at least 2 teams to play anything.
  if (groups.some((g) => g.length < 2)) {
    throw new Error('Each group needs at least 2 teams');
  }
  if (teamsAdvance > 0 && groups.some((g) => g.length < teamsAdvance)) {
    throw new Error('teamsAdvancePerGroup cannot exceed smallest group size');
  }

  const groupMatches = buildGroupMatches(groups, matchesPerPair);
  const { knockoutMatches } = buildPlayoff(numGroups, teamsAdvance, playoffFormat);
  return { groups, groupMatches, knockoutMatches };
}

module.exports = {
  generateLeagueBracket,
  buildKnockoutMatches,
  buildBracketFromSeeds,
  buildQualifierPlayoff,
  buildGeneralPlayoff,
  buildPlayoff,
  normalizePlayoffFormat,
  snakeDistribute,
  roundRobinPairs,
};
