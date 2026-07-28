// Helpers to turn an empty ("TBD") bracket slot into a human label describing
// WHO will play there — e.g. "Group A 1st", "Winner of Match 3", "Q1 Loser".

export const ordinal = (n) => {
  if (!n && n !== 0) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// "A1" -> "Group A 1st", "B2" -> "Group B 2nd". Returns null if not a group src.
export const groupSourceLabel = (src) => {
  if (!src || typeof src !== 'string') return null;
  const m = /^([A-Z])(\d+)$/.exec(src.trim());
  if (!m) return null;
  return `Group ${m[1]} ${ordinal(parseInt(m[2], 10))}`;
};

// Number knockout matches in play order (round asc, then slot asc) → 1..N, so a
// feeder can be referenced as "Winner of Match {n}".
export const knockoutGameNumbers = (koMatches = []) => {
  const sorted = [...koMatches].sort(
    (a, b) => (a.round || 0) - (b.round || 0) || (a.bracketSlot || 0) - (b.bracketSlot || 0),
  );
  const map = {};
  sorted.forEach((m, i) => { map[String(m._id)] = i + 1; });
  return map;
};

// The label for a slot ('A' | 'B') of a knockout/playoff match — what will fill
// it. Priority: explicit group source (league) → winner/loser feeder (both
// knockout & qualifier) → "TBD".
//   match       the knockout match whose slot we're labelling
//   slot        'A' | 'B'
//   koMatches   all knockout-stage matches of the tournament
//   gameNoMap   result of knockoutGameNumbers(koMatches) (optional)
export const slotSourceLabel = (match, slot, koMatches = [], gameNoMap = null) => {
  if (!match) return 'TBD';
  const gameNo = gameNoMap || knockoutGameNumbers(koMatches);

  // 1) League group source ("A1" → "Group A 1st").
  const src = slot === 'A' ? match.liveState?.sourceA : match.liveState?.sourceB;
  const g = groupSourceLabel(src);
  if (g) return g;

  // 2) A match whose WINNER advances into this slot.
  const winFeeder = koMatches.find(
    (m) => String(m.nextMatchId) === String(match._id) && m.nextMatchSlot === slot,
  );
  if (winFeeder) {
    const lbl = winFeeder.matchLabel || `Match ${gameNo[String(winFeeder._id)] ?? '?'}`;
    return `Winner of ${lbl}`;
  }

  // 3) A match whose LOSER drops into this slot (IPL qualifier: Q1 loser → Q2).
  const loseFeeder = koMatches.find(
    (m) => String(m.loserNextMatchId) === String(match._id) && m.loserNextMatchSlot === slot,
  );
  if (loseFeeder) {
    const lbl = loseFeeder.matchLabel || `Match ${gameNo[String(loseFeeder._id)] ?? '?'}`;
    return `Loser of ${lbl}`;
  }

  return 'TBD';
};

// Convenience: is this slot still unknown (shows a source label rather than a team)?
export const isTBD = (name) => !name || name === 'TBD';
