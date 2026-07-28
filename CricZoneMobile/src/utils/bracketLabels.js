// Helpers to turn an empty ("TBD") bracket slot into a human label describing
// WHO will play there — e.g. "Group A 1st", "Winner of Match 3", "Q1 Loser".

export const ordinal = (n) => {
  if (!n && n !== 0) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// "A1" -> "Group A 1st", "B2" -> "Group B 2nd". Returns null if not a group src.
// short=true gives a compact form ("A 1st") for tight bracket nodes.
export const groupSourceLabel = (src, short = false) => {
  if (!src || typeof src !== 'string') return null;
  const m = /^([A-Z])(\d+)$/.exec(src.trim());
  if (!m) return null;
  const pos = ordinal(parseInt(m[2], 10));
  return short ? `${m[1]} ${pos}` : `Group ${m[1]} ${pos}`;
};

// Compact match label used in tight nodes: "Qualifier 1"->"Q1", "Eliminator"->
// "Elim", "Qualifier 2"->"Q2", "Final"->"Final", "Semifinal"->"SF".
const abbrevMatchLabel = (label) => {
  if (!label) return null;
  const map = { 'Qualifier 1': 'Q1', 'Qualifier 2': 'Q2', 'Eliminator': 'Elim', 'Final': 'Final', 'Semifinal': 'SF' };
  return map[label] || label;
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
export const slotSourceLabel = (match, slot, koMatches = [], gameNoMap = null, opts = {}) => {
  if (!match) return 'TBD';
  const short = !!opts.short;
  const gameNo = gameNoMap || knockoutGameNumbers(koMatches);

  // 1) League group source ("A1" → "Group A 1st" / short "A 1st").
  const src = slot === 'A' ? match.liveState?.sourceA : match.liveState?.sourceB;
  const g = groupSourceLabel(src, short);
  if (g) return g;

  // 2) A match whose WINNER advances into this slot.
  const winFeeder = koMatches.find(
    (m) => String(m.nextMatchId) === String(match._id) && m.nextMatchSlot === slot,
  );
  if (winFeeder) {
    if (short) return `${abbrevMatchLabel(winFeeder.matchLabel) || `M${gameNo[String(winFeeder._id)] ?? '?'}`} Winner`;
    const lbl = winFeeder.matchLabel || `Match ${gameNo[String(winFeeder._id)] ?? '?'}`;
    return `Winner of ${lbl}`;
  }

  // 3) A match whose LOSER drops into this slot (IPL qualifier: Q1 loser → Q2).
  const loseFeeder = koMatches.find(
    (m) => String(m.loserNextMatchId) === String(match._id) && m.loserNextMatchSlot === slot,
  );
  if (loseFeeder) {
    if (short) return `${abbrevMatchLabel(loseFeeder.matchLabel) || `M${gameNo[String(loseFeeder._id)] ?? '?'}`} Loser`;
    const lbl = loseFeeder.matchLabel || `Match ${gameNo[String(loseFeeder._id)] ?? '?'}`;
    return `Loser of ${lbl}`;
  }

  return 'TBD';
};

// Convenience: is this slot still unknown (shows a source label rather than a team)?
export const isTBD = (name) => !name || name === 'TBD';
