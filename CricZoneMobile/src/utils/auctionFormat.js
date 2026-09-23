// Currency formatting for the auction viewer — mirrors the web's auctionFormat.
// "inr" → Lakh/Crore grouping; "plain" → thousands grouping; "points" → "N pts".
const CRORE = 10000000;
const LAKH = 100000;

const trim = (s) => s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

export function formatMoney(amount, { symbol = 'Rs', format = 'plain' } = {}) {
  const n = Math.round(Number(amount) || 0);
  if (format === 'points') return `${n.toLocaleString()} pts`;
  if (format !== 'inr') return `${symbol}${n.toLocaleString()}`;
  if (Math.abs(n) >= CRORE) return `${symbol}${trim((n / CRORE).toFixed(2))} Cr`;
  if (Math.abs(n) >= LAKH) return `${symbol}${trim((n / LAKH).toFixed(2))} L`;
  return `${symbol}${n.toLocaleString('en-IN')}`;
}

// Convenience: format using an auction's currency fields.
export function money(auction, amount) {
  return formatMoney(amount, { symbol: auction?.currencySymbol || 'Rs', format: auction?.currencyFormat || 'plain' });
}
