// Money formatting/parsing for auctions. Cricket auctions think in Lakh (L) and
// Crore (Cr); "plain" just groups digits. Amounts are always plain integers
// (e.g. rupees) under the hood.

const CRORE = 10000000;
const LAKH = 100000;

const trim = (s) => s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");

// 12500000 → "₹1.25 Cr", 2000000 → "₹20 L"
export function formatMoney(amount, { symbol = "₹", format = "inr" } = {}) {
  const n = Math.round(Number(amount) || 0);
  if (format !== "inr") return `${symbol}${n.toLocaleString()}`;
  if (Math.abs(n) >= CRORE) return `${symbol}${trim((n / CRORE).toFixed(2))} Cr`;
  if (Math.abs(n) >= LAKH) return `${symbol}${trim((n / LAKH).toFixed(2))} L`;
  return `${symbol}${n.toLocaleString("en-IN")}`;
}

// Short form without the symbol, for tight spaces: "1.25 Cr".
export function shortMoney(amount, format = "inr") {
  return formatMoney(amount, { symbol: "", format }).trim();
}

// Parse a human amount into an integer:
//  "1.5cr" → 15000000, "20 l" → 2000000, "2,00,000" → 200000, "500000" → 500000
export function parseMoney(input) {
  if (input == null) return 0;
  const s = String(input).trim().toLowerCase().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^(-?\d*\.?\d+)\s*(cr|crore|l|lakh|lac|k)?$/);
  if (!m) return Math.round(Number(s.replace(/[^\d.-]/g, "")) || 0);
  const val = parseFloat(m[1]);
  const unit = m[2];
  if (unit === "cr" || unit === "crore") return Math.round(val * CRORE);
  if (unit === "l" || unit === "lakh" || unit === "lac") return Math.round(val * LAKH);
  if (unit === "k") return Math.round(val * 1000);
  return Math.round(val);
}
