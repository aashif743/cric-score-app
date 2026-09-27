import React from "react";
import { formatMoney } from "../../utils/auctionFormat";
import { cx } from "../../components/auction/ui.jsx";
import brand from "../../assets/criczone_icon.png";

// Team-purses board shown when the admin flips the purse toggle. Two sizes:
//   • full  (big screen) — fills the stage, readable from far.
//   • compact (OBS overlay) — a smaller floating panel that scales with the
//     stream canvas so the live video stays visible around it.
export default function AuctionPurseBoard({ state, className, compact = false }) {
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

  // Size tokens — compact (OBS) vs full (big screen).
  const s = compact
    ? { pad: "p-3 lg:p-4", head: "mb-2 pb-2", sub: "text-[8px] lg:text-[10px]", title: "text-lg lg:text-2xl",
        logo: "h-8 w-8 lg:h-11 lg:w-11", gap: "gap-2 lg:gap-2.5", tile: "p-2 lg:p-2.5", tlogo: "h-7 w-7 lg:h-9 lg:w-9",
        name: "text-xs lg:text-sm", meta: "text-[9px] lg:text-[10px]", label: "mt-1.5 text-[8px] lg:text-[9px]",
        purse: "text-lg lg:text-2xl", bar: "mt-1 h-1", tag: "text-[7px] lg:text-[8px]" }
    : { pad: "p-6 lg:p-10", head: "mb-5 pb-4", sub: "text-xs lg:text-sm", title: "text-3xl lg:text-5xl",
        logo: "h-14 w-14 lg:h-20 lg:w-20", gap: "gap-3 lg:gap-4", tile: "p-4 lg:p-5", tlogo: "h-11 w-11 lg:h-14 lg:w-14",
        name: "text-lg lg:text-2xl", meta: "text-xs lg:text-sm", label: "mt-3 text-[10px] lg:text-xs",
        purse: "text-4xl lg:text-6xl", bar: "mt-2 h-1.5", tag: "text-[10px]" };

  return (
    <div className={cx("flex flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b1220]/95 text-white backdrop-blur-md lg:rounded-[2.5rem]", s.pad, className)}>
      <div className={cx("flex items-center justify-between gap-3 border-b border-white/10", s.head)}>
        <div className="min-w-0">
          <div className={cx("truncate font-black uppercase tracking-[0.3em] text-white/40", s.sub)}>{a.name}</div>
          <div className={cx("truncate font-black uppercase tracking-tight", s.title)}>Team Purses</div>
        </div>
        {a.logoUrl
          ? <img src={a.logoUrl} alt="" className={cx("shrink-0 rounded-2xl object-cover ring-2 ring-white/15", s.logo)} />
          : <img src={brand} alt="" className={cx("shrink-0 object-contain", s.logo)} />}
      </div>

      <div className={cx("grid flex-1 content-start", s.gap, cols)}>
        {board.map((t) => {
          const isTop = a.currentBidTeam && String(a.currentBidTeam) === String(t._id);
          const pct = t.purse ? Math.round(((t.purse - t.remaining) / t.purse) * 100) : 0;
          return (
            <div key={t._id} className={cx("rounded-2xl ring-1", s.tile, isTop ? "bg-amber-400/15 ring-amber-400/50" : "bg-white/[0.03] ring-white/10")}>
              <div className="flex items-center gap-2.5">
                {t.logoUrl
                  ? <img src={t.logoUrl} alt="" className={cx("shrink-0 rounded-xl object-cover", s.tlogo)} />
                  : <div className={cx("grid shrink-0 place-items-center rounded-xl bg-white/10 font-black", s.tlogo, compact ? "text-xs" : "text-base")}>{initials(t.name)}</div>}
                <div className="min-w-0 flex-1">
                  <div className={cx("truncate font-black", s.name)}>{t.name}</div>
                  <div className={cx("truncate font-bold text-white/40", s.meta)}>{t.squad} player{t.squad === 1 ? "" : "s"} · spent {money(t.spent)}</div>
                </div>
                {isTop && <span className={cx("shrink-0 rounded-full bg-amber-400 px-2 py-0.5 font-black uppercase text-black", s.tag)}>Top bid</span>}
              </div>
              <div className={cx("font-black uppercase tracking-widest text-white/40", s.label)}>Purse remaining</div>
              <div className={cx("font-black tabular-nums text-emerald-400", s.purse)}>{money(t.remaining)}</div>
              <div className={cx("overflow-hidden rounded-full bg-white/10", s.bar)}>
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${100 - pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
