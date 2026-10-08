// Display-only name shortening for public/TV/overlay views. Mirrors the mobile
// app's helper. Full names stay stored; this only changes rendering.
//   "Indika Lakshitha Milshan" -> "I.L. Milshan"
//   "Kamal Perera"             -> "K. Perera"

const isPlaceholder = (n) => {
  const s = (n || "").trim();
  if (!s) return true;
  if (/^(batsman|bowler|player)\s+\d+$/i.test(s)) return true;
  if (/^new\s+batsman$/i.test(s)) return true;
  if (/\splayer\s+\d+$/i.test(s)) return true;
  if (s.toUpperCase() === "TBD") return true;
  return false;
};

export const shortenName = (name) => {
  const s = (name || "").trim();
  if (!s || isPlaceholder(s)) return s;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return s;
  const surname = words[words.length - 1];
  const initials = words.slice(0, -1).map((w) => `${w[0].toUpperCase()}.`).join("");
  return `${initials} ${surname}`;
};

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
