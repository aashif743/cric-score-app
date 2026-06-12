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

  // Build first-round sources via cross-pairing. Each pair of groups (g, g+1)
  // contributes a block of QFs: [g1 vs gp1_2, gp1_1 vs g2, g3 vs gp1_4, ...].
  // Blocks are then interleaved across the bracket so winners from the same
  // group-pair are kept on opposite halves until the final — preventing two
  // teams from the same group-pair meeting again in the very next round.
  const blocks = [];
  for (let g = 0; g < numGroups; g += 2) {
    const a = groupLetter(g);
    const b = g + 1 < numGroups ? groupLetter(g + 1) : groupLetter(g);
    const block = [];
    for (let p = 1; p <= teamsAdvance; p += 2) {
      block.push(`${a}${p}`);
      block.push(`${b}${p + 1 <= teamsAdvance ? p + 1 : p}`);
      if (p + 1 <= teamsAdvance) {
        block.push(`${b}${p}`);
        block.push(`${a}${p + 1}`);
      }
    }
    blocks.push(block);
  }
  // Round-robin interleave the blocks so adjacent first-round matches come
  // from different group-pairs whenever possible.
  const sources = [];
  let still = true;
  for (let i = 0; still; i += 2) {
    still = false;
    for (const block of blocks) {
      if (i < block.length) {
        sources.push(block[i]);
        sources.push(block[i + 1]);
        still = true;
      }
    }
  }
  // Pad up to the next power of two with byes so brackets are clean.
  const numRounds = Math.ceil(Math.log2(sources.length));
  const slots = 2 ** numRounds;
  while (sources.length < slots) sources.push(null);

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

function generateLeagueBracket(teamNames, numGroups, teamsAdvance, matchesPerPair) {
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
  const { knockoutMatches } = buildKnockoutMatches(numGroups, teamsAdvance);
  return { groups, groupMatches, knockoutMatches };
}

module.exports = { generateLeagueBracket, snakeDistribute, roundRobinPairs };
