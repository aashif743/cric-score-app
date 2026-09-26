import React from "react";
import { formatMoney } from "../../utils/auctionFormat";
import { cx } from "../../components/auction/ui.jsx";
import brand from "../../assets/criczone_icon.png";

// Full-screen "Team purses" board shown when the admin flips the purse toggle.
// Reused by the big screen and the OBS overlay. Highlights the current top
// bidder and shows each team's remaining purse big & readable from far.
export default function AuctionPurseBoard({ state, className }) {
  const a = state?.auction;
  if (!a) return null;
  const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });

  const board = [...(state.teams || [])].map((t) => {
    const bought = (state.players || []).filter((p) => p.status === "sold" && String(p.soldTo) === String(t._id)).length;
    return { ...t, squad: bought + (t.retainedCount || 0), spent: t.spent || 0, remaining: Math.max(0, (t.purse || 0) - (t.spent || 0) - (t.retainedCost || 0)) };
  }).sort((x, y) => y.remaining - x.remaining);

  const initials = (name) => {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
  };
  const cols = board.length <= 4 ? "sm:grid-cols-2" : board.length <= 9 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

  return (
    <div className={cx("flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0b1220]/95 p-6 text-white backdrop-blur-md lg:p-10", className)}>
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <div className="truncate text-xs font-black uppercase tracking-[0.35em] text-white/40 lg:text-sm">{a.name}</div>
          <div className="truncate text-3xl font-black uppercase tracking-tight lg:text-5xl">Team Purses</div>
        </div>
        {a.logoUrl
          ? <img src={a.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-white/15 lg:h-20 lg:w-20" />
          : <img src={brand} alt="" className="h-12 w-12 shrink-0 object-contain lg:h-16 lg:w-16" />}
      </div>

      <div className={cx("grid flex-1 content-start gap-3 lg:gap-4", cols)}>
        {board.map((t) => {
          const isTop = a.currentBidTeam && String(a.currentBidTeam) === String(t._id);
          const pct = t.purse ? Math.round(((t.purse - t.remaining) / t.purse) * 100) : 0;
          return (
            <div key={t._id} className={cx("rounded-2xl p-4 ring-1 lg:p-5", isTop ? "bg-amber-400/15 ring-amber-400/50" : "bg-white/[0.03] ring-white/10")}>
              <div className="flex items-center gap-3">
                {t.logoUrl
                  ? <img src={t.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover lg:h-14 lg:w-14" />
                  : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-base font-black lg:h-14 lg:w-14">{initials(t.name)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-black lg:text-2xl">{t.name}</div>
                  <div className="truncate text-xs font-bold text-white/40 lg:text-sm">{t.squad} player{t.squad === 1 ? "" : "s"} · spent {money(t.spent)}</div>
                </div>
                {isTop && <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-black">Top bid</span>}
              </div>
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/40 lg:text-xs">Purse remaining</div>
              <div className="text-4xl font-black tabular-nums text-emerald-400 lg:text-6xl">{money(t.remaining)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${100 - pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
