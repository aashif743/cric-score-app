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

// Canonical seed order for a power-of-two bracket. Returns seed numbers
// (1-based) in slot order, e.g. size 8 -> [1,8,4,5,2,7,3,6]. This guarantees
// seed 1 and seed 2 can only meet in the final, 1 v 4 / 2 v 3 in the semis, etc.
function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next = [];
    for (const s of order) {
      next.push(s);
      next.push(n + 1 - s); // pair each seed with its mirror
    }
    order = next;
  }
  return order;
}

function generateKnockoutBracket(teamNames) {
  const N = teamNames.length;
  if (N < 2) throw new Error('Knockout requires at least 2 teams');

  const numRounds = Math.ceil(Math.log2(N));
  const slots = 2 ** numRounds;
  const byes = slots - N;

  // Lay round 1 out in canonical seed order. Seeds 1..N are the entered teams;
  // seeds > N are byes. Because byes are the highest seed numbers, they fall on
  // the slots opposite the strongest teams — so the top `byes` seeds advance for
  // free, and (since size > N > size/2) no pair is ever bye-vs-bye.
  const order = seedOrder(slots);
  const teamForSeed = (s) => (s <= N ? teamNames[s - 1] : null);

  const r1Count = slots / 2;
  const slotInfo = { 1: [] };
  for (let i = 0; i < r1Count; i++) {
    const a = teamForSeed(order[2 * i]);
    const b = teamForSeed(order[2 * i + 1]);
    if (a !== null && b !== null) {
      slotInfo[1].push({ teamA: a, teamB: b, isBye: false });
    } else {
      // Exactly one side is a bye — store the real team in teamA so the
      // promotion step (teamA || teamB) carries it into round 2.
      slotInfo[1].push({ teamA: a || b, teamB: null, isBye: true });
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
