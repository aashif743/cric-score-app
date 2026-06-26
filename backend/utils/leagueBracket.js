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
function buildKnockoutMatches(numGroups, teamsAdvance) {
  if (teamsAdvance < 1) return { knockoutMatches: [], sources: [] };
  const totalAdvancing = numGroups * teamsAdvance;
  if (totalAdvancing < 2) return { knockoutMatches: [], sources: [] };
  const groupLetter = (i) => String.fromCharCode(65 + i);

  // Seed the qualifiers, then place them into the canonical bracket order.
  // Seeding: all group winners first (A1, B1, …), then all runners-up
  // (A2, B2, …), and so on. So group winners are the top seeds — the canonical
  // order keeps them apart (winners on opposite halves), pairs the best with the
  // weakest, and cross-pairs winners against other groups' lower finishers.
  // This always yields exactly `totalAdvancing` distinct qualifiers (the old
  // block logic duplicated sources for a single group / odd group counts).
  const seedList = [];
  for (let p = 1; p <= teamsAdvance; p++) {
    for (let g = 0; g < numGroups; g++) {
      seedList.push(`${groupLetter(g)}${p}`);
    }
  }
  // Pad up to the next power of two with byes (which fall on the top seeds).
  const numRounds = Math.ceil(Math.log2(seedList.length));
  const slots = 2 ** numRounds;
  const order = seedBracketOrder(slots);
  const sources = order.map((s) => (s <= seedList.length ? seedList[s - 1] : null));

  // Build the bracket: round 1 from sources, then halve each round.
  // slotInfo[r] tracks which slots are byes (single source) vs real (two sources).
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
      // If a child slot is a bye, its single source feeds upward directly.
      const sA = cA.isBye ? (cA.sourceA || cA.sourceB) : null;
      const sB = cB.isBye ? (cB.sourceA || cB.sourceB) : null;
      slotInfo[r].push({ sourceA: sA, sourceB: sB, isBye: false });
    }
  }
  const knockoutMatches = [];
  for (let r = 1; r <= numRounds; r++) {
    slotInfo[r].forEach((slot, i) => {
      if (r === 1 && slot.isBye) return;
      knockoutMatches.push({
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
  return { knockoutMatches, sources };
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

// IPL-style playoffs for the top 4 qualifiers (S1..S4):
//   Qualifier 1 : S1 v S2  → winner to Final, loser to Qualifier 2
//   Eliminator  : S3 v S4  → winner to Qualifier 2, loser out
//   Qualifier 2 : Q1 loser v Eliminator winner → winner to Final, loser out
//   Final       : Q1 winner v Q2 winner
// Match defs carry winner links (parent*) and, for Q1, a loser link
// (loserParent*). Q2/Final sources are null (filled by result propagation).
function buildQualifierPlayoff(numGroups, teamsAdvance) {
  const seeds = qualifierSeeds(numGroups, teamsAdvance);
  if (seeds.length !== 4) {
    // Qualifier playoffs are a strict top-4 format; fall back to a normal bracket.
    return buildKnockoutMatches(numGroups, teamsAdvance);
  }
  const [s1, s2, s3, s4] = seeds;
  const knockoutMatches = [
    {
      round: 1, bracketSlot: 1, matchLabel: 'Qualifier 1',
      sourceA: s1, sourceB: s2,
      parentRound: 3, parentSlot: 1, parentSide: 'A',          // winner → Final A
      loserParentRound: 2, loserParentSlot: 1, loserParentSide: 'A', // loser → Qualifier 2 A
    },
    {
      round: 1, bracketSlot: 2, matchLabel: 'Eliminator',
      sourceA: s3, sourceB: s4,
      parentRound: 2, parentSlot: 1, parentSide: 'B',          // winner → Qualifier 2 B
    },
    {
      round: 2, bracketSlot: 1, matchLabel: 'Qualifier 2',
      sourceA: null, sourceB: null,
      parentRound: 3, parentSlot: 1, parentSide: 'B',          // winner → Final B
    },
    {
      round: 3, bracketSlot: 1, matchLabel: 'Final',
      sourceA: null, sourceB: null,
      parentRound: null, parentSlot: null, parentSide: null,
    },
  ];
  return { knockoutMatches, sources: seeds };
}

function generateLeagueBracket(teamNames, numGroups, teamsAdvance, matchesPerPair, playoffFormat) {
  if (!Array.isArray(teamNames) || teamNames.length < 2) {
    throw new Error('League requires at least 2 teams');
  }
  if (numGroups < 1) throw new Error('numGroups must be >= 1');
  if (matchesPerPair < 1) throw new Error('matchesPerPair must be >= 1');

  const groups = snakeDistribute(teamNames, numGroups);
  // A group needs at least 2 teams to play anything.
  if (groups.some((g) => g.length < 2)) {
    throw new Error('Each group needs at least 2 teams');
  }
  if (teamsAdvance > 0 && groups.some((g) => g.length < teamsAdvance)) {
    throw new Error('teamsAdvancePerGroup cannot exceed smallest group size');
  }

  const groupMatches = buildGroupMatches(groups, matchesPerPair);
  // Qualifier playoffs need exactly 4 qualifiers; otherwise use a normal bracket.
  const useQualifier =
    playoffFormat === 'qualifier' && teamsAdvance > 0 && numGroups * teamsAdvance === 4;
  const { knockoutMatches } = useQualifier
    ? buildQualifierPlayoff(numGroups, teamsAdvance)
    : buildKnockoutMatches(numGroups, teamsAdvance);
  return { groups, groupMatches, knockoutMatches };
}

module.exports = {
  generateLeagueBracket,
  buildKnockoutMatches,
  buildQualifierPlayoff,
  snakeDistribute,
  roundRobinPairs,
};
