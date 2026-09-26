import React from "react";
import { formatMoney } from "../../utils/auctionFormat";
import { cx } from "../../components/auction/ui.jsx";
import fullLogo from "../../assets/criczone_full_logo.png";
import brand from "../../assets/criczone_icon.png";

// Ranked "Top sold players" leaderboard — a professional, broadcast-style board
// reused for the on-screen view and the PNG / PDF export. Sorted highest →
// lowest sold price. `limit` caps the rows (null / 0 = all).
export default function AuctionLeaderboard({ state, limit = 10, className }) {
  const a = state?.auction;
  if (!a) return null;
  const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
  const teamName = (id) => (state.teams || []).find((t) => String(t._id) === String(id))?.name || "—";

  const sold = (state.players || [])
    .filter((p) => p.status === "sold")
    .sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0));
  const rows = limit && limit > 0 ? sold.slice(0, limit) : sold;
  // Title follows the selected filter: Top 5 / 10 / 20 → "TOP N SOLD PLAYERS";
  // All → "SOLD PLAYERS".
  const title = limit && limit > 0 ? `TOP ${limit} SOLD PLAYERS` : "SOLD PLAYERS";

  const initials = (name) => {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
  };

  return (
    <div className={cx("relative overflow-hidden bg-[#0b1220] text-white", className)}>
      {/* diagonal light streak + faint watermark */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -inset-x-24 inset-y-0 skew-x-12 bg-gradient-to-r from-transparent via-white/[0.045] to-transparent" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img src={fullLogo} alt="" className="w-[55%] max-w-[520px] object-contain" style={{ opacity: 0.04 }} />
      </div>

      <div className="relative">
        {/* Header band — CricZone full logo (left) + title + auction logo (right) */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-white to-slate-200 px-6 py-4 lg:px-8 lg:py-5">
          <img src={fullLogo} alt="CricZone" className="h-12 w-auto shrink-0 object-contain lg:h-16" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 lg:text-sm">{a.name}</div>
            <div className="truncate text-2xl font-black uppercase leading-tight tracking-tight text-slate-900 lg:text-4xl">{title}</div>
          </div>
          {a.logoUrl
            ? <img src={a.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1 shadow lg:h-20 lg:w-20" />
            : null}
        </div>

        {/* Column header */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-black/30 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/45 lg:px-8 lg:text-sm">
          <div className="w-7 shrink-0 lg:w-9">#</div>
          <div className="min-w-0 flex-1">Player</div>
          <div className="hidden w-24 shrink-0 sm:block lg:w-36">Team</div>
          <div className="w-24 shrink-0 text-right lg:w-36">Price</div>
        </div>

        {/* Rows */}
        <div>
          {rows.length === 0 ? (
            <div className="px-8 py-16 text-center text-white/40">No players sold yet.</div>
          ) : rows.map((p, i) => {
            const top = i < 3;
            return (
              <div key={p._id}
                className={cx("flex items-center gap-3 border-b border-white/5 px-6 py-2.5 lg:px-8",
                  top ? "bg-gradient-to-r from-amber-500/[0.12] to-transparent" : i % 2 ? "bg-white/[0.02]" : "")}>
                <div className={cx("w-7 shrink-0 text-xl font-black tabular-nums lg:w-9 lg:text-2xl", top ? "text-amber-400" : "text-white/55")}>{i + 1}</div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {p.photoUrl
                    ? <img src={p.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover object-top ring-1 ring-white/15 lg:h-11 lg:w-11" />
                    : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-black text-white/70 lg:h-11 lg:w-11">{initials(p.name)}</div>}
                  <span className={cx("truncate text-base font-black uppercase tracking-tight lg:text-2xl", top ? "text-amber-300" : "text-white")}>{p.name}</span>
                </div>
                <div className="hidden w-24 shrink-0 truncate text-sm font-bold text-white/70 sm:block lg:w-36 lg:text-base">{teamName(p.soldTo)}</div>
                <div className={cx("w-24 shrink-0 text-right text-base font-black tabular-nums lg:w-36 lg:text-2xl", top ? "text-amber-300" : "text-white")}>{money(p.soldPrice)}</div>
              </div>
            );
          })}
        </div>

        {/* gold footer strip + attribution */}
        <div className="h-2.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-600" />
        <div className="flex items-center justify-center gap-2 bg-black/40 py-2.5 text-[11px] font-bold text-white/40">
          <img src={brand} alt="" className="h-4 w-4 object-contain" /> Generated with <span className="text-white/70">CricZone</span>
        </div>
      </div>
    </div>
  );
}
