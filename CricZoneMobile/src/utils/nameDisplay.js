// Display-only name shortening for compact screens (live scoring, full scorecard,
// public/TV/overlay). The FULL name is always what's stored — this only changes
// how it's RENDERED, so editing/suggestions/stats still show the full name and
// cross-match stats never merge two different people.
//
//   "Indika Lakshitha Milshan" -> "I.L. Milshan"
//   "Kamal Perera"             -> "K. Perera"
//   "Milshan" / "Batsman 1"    -> unchanged (single word / placeholder)

// Names we must NOT shorten (generated placeholders, TBD).
const isPlaceholder = (n) => {
  const s = (n || '').trim();
  if (!s) return true;
  if (/^(batsman|bowler|player)\s+\d+$/i.test(s)) return true;
  if (/^new\s+batsman$/i.test(s)) return true;
  if (/\splayer\s+\d+$/i.test(s)) return true; // "{Team} Player 3"
  if (s.toUpperCase() === 'TBD') return true;
  return false;
};

// Scoreboard-style short form: all words but the last become initials, the last
// word is kept as the surname.
export const shortenName = (name) => {
  const s = (name || '').trim();
  if (!s || isPlaceholder(s)) return s;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return s;
  const surname = words[words.length - 1];
  const initials = words.slice(0, -1).map((w) => `${w[0].toUpperCase()}.`).join('');
  return `${initials} ${surname}`;
};

// Shorten a LIST of names shown together, numbering any that collide (identical
// full names, or different names that shorten to the same thing) so the scorer
// can still tell them apart: "K. Perera (1)", "K. Perera (2)".
export const shortenList = (names = []) => {
  const shorts = names.map(shortenName);
  const counts = {};
  shorts.forEach((s) => { const k = s.toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
  const seen = {};
  return shorts.map((s) => {
    const k = s.toLowerCase();
    if (counts[k] > 1 && !isPlaceholder(s)) {
      seen[k] = (seen[k] || 0) + 1;
      return `${s} (${seen[k]})`;
    }
    return s;
  });
};

// Shorten one name given the list of names it appears alongside (for duplicate
// numbering). Matches by position of the first equal full name.
export const shortenWithContext = (name, contextNames = []) => {
  const idx = contextNames.findIndex((n) => (n || '') === (name || ''));
  if (idx < 0) return shortenName(name);
  return shortenList(contextNames)[idx];
};

export { isPlaceholder as isPlaceholderDisplayName };
