// Single-elimination bracket generator using standard tournament seeding.
// Input:  array of team names (entry order = seed order, seed 1 first)
// Output: { matches, numRounds, slots, byes }
//
// For N teams the bracket size is the next power of two >= N, giving
// (size - N) byes. Byes are awarded to the TOP seeds and distributed with the
// canonical seeding order, so the strongest teams skip round 1 and two byes
// never meet — exactly how professional knockout draws are seeded.
//
// A round-1 bye slot creates no match; its team is promoted straight into the
// round-2 slot. Match defs carry { round, bracketSlot, teamA, teamB,
// parentRound, parentSlot, parentSide }. Works for any N >= 2.

function generateKnockoutBracket(teamNames) {
  const N = teamNames.length;
  if (N < 2) throw new Error('Knockout requires at least 2 teams');

  const numRounds = Math.ceil(Math.log2(N));
  const slots = 2 ** numRounds;
  const byes = slots - N;

  // Sequential draw with byes, laid out so teams read 1..N top-to-bottom (like a
  // hand-drawn scorer's bracket). The first `games` pairings are real games
  // between teams 1..2*games (1v2, 3v4, …); every remaining team gets a BYE into
  // round 2. The bye's side alternates so the draw stays visually balanced.
  const r1Count = slots / 2;           // round-1 pairings
  const games = N - r1Count;           // real first-round games (rest are byes)
  const slotInfo = { 1: [] };
  for (let j = 1; j <= r1Count; j++) {
    if (j <= games) {
      slotInfo[1].push({ teamA: teamNames[2 * j - 2], teamB: teamNames[2 * j - 1], isBye: false });
    } else {
      const team = teamNames[games + j - 1]; // seed (games + j), in entry order
      const teamLeft = (j - games) % 2 === 1;
      slotInfo[1].push(teamLeft
        ? { teamA: team, teamB: null, isBye: true }
        : { teamA: null, teamB: team, isBye: true });
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
