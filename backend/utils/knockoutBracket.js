// Single-elimination bracket generator.
// Input:  array of team names
// Output: { matches, numRounds }
//
// Strategy: pad the team list with `null` for byes (placed at the end of round 1).
// Round-1 bye positions don't get a match created; instead the bye team is
// promoted directly into the corresponding round-2 slot. This keeps the schedule
// clean (no useless "bye" rows) and works for any N >= 2.

function generateKnockoutBracket(teamNames) {
  const N = teamNames.length;
  if (N < 2) throw new Error('Knockout requires at least 2 teams');

  const numRounds = Math.ceil(Math.log2(N));
  const slots = 2 ** numRounds;
  const byes = slots - N;

  // Round-1 layout: first (slots/2 - byes) pairs are real (two teams).
  // The remaining `byes` pairs each have one team (side A) plus a bye (side B).
  // This guarantees no pair contains two byes for any N >= 2.
  const r1Count = slots / 2;
  const realPairs = r1Count - byes;
  const slotInfo = { 1: [] };
  let teamIdx = 0;
  for (let i = 0; i < r1Count; i++) {
    if (i < realPairs) {
      slotInfo[1].push({ teamA: teamNames[teamIdx++], teamB: teamNames[teamIdx++], isBye: false });
    } else {
      slotInfo[1].push({ teamA: teamNames[teamIdx++], teamB: null, isBye: true });
    }
  }

  for (let r = 2; r <= numRounds; r++) {
    const count = slots / (2 ** r);
    slotInfo[r] = [];
    for (let i = 0; i < count; i++) {
      const cA = slotInfo[r - 1][2 * i];
      const cB = slotInfo[r - 1][2 * i + 1];
      let teamA = null, teamB = null;
      if (cA && cA.isBye) teamA = cA.teamA || cA.teamB;
      if (cB && cB.isBye) teamB = cB.teamA || cB.teamB;
      slotInfo[r].push({ teamA, teamB, isBye: false });
    }
  }

  // Flatten into match definitions, skipping round-1 bye positions.
  const matches = [];
  for (let r = 1; r <= numRounds; r++) {
    slotInfo[r].forEach((slot, i) => {
      if (r === 1 && slot.isBye) return;
      matches.push({
        round: r,
        bracketSlot: i + 1, // 1-indexed for display
        teamA: slot.teamA,
        teamB: slot.teamB,
        parentRound: r < numRounds ? r + 1 : null,
        parentSlot: r < numRounds ? Math.floor(i / 2) + 1 : null,
        parentSide: i % 2 === 0 ? 'A' : 'B',
      });
    });
  }

  return { matches, numRounds, slots, byes };
}

module.exports = { generateKnockoutBracket };
