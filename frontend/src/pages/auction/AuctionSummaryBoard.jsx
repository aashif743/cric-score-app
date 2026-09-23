import React from "react";
import { formatMoney, retainedEntries } from "../../utils/auctionFormat";
import { cx } from "../../components/auction/ui.jsx";
import fullLogo from "../../assets/criczone_full_logo.png";
import brand from "../../assets/criczone_icon.png";

// One professional, modern auction-summary board reused by:
//  • the Results page export card (variant="export" — light, print-clean)
//  • the big screen when the auction finishes (variant="screen" — dark)
//  • the OBS overlay when finished (variant="overlay" — dark, translucent)
// Includes the CricZone logo + a faint watermark.
export default function AuctionSummaryBoard({ state, variant = "screen", className }) {
  const a = state?.auction;
  if (!a) return null;
  const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });

  const teams = (state.teams || []).map((t) => {
    const bought = (state.players || [])
      .filter((p) => p.status === "sold" && String(p.soldTo) === String(t._id))
      .sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0));
    const spent = bought.reduce((s, p) => s + (p.soldPrice || 0), 0);
    const squad = [...retainedEntries(t), ...bought];
    return { ...t, squad, spent, remaining: Math.max(0, (t.purse || 0) - spent - (t.retainedCost || 0)) };
  });
  const sold = (state.players || []).filter((p) => p.status === "sold");
  const totalSpend = sold.reduce((s, p) => s + (p.soldPrice || 0), 0);
  const priciest = sold.slice().sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0))[0] || null;

  const T = variant === "export"
    ? { bg: "bg-white", text: "text-slate-900", sub: "text-slate-500", card: "border-slate-200 bg-slate-50", divide: "divide-slate-100", chip: "border-slate-200 bg-white text-slate-500", left: "text-emerald-600", spent: "text-slate-600", wm: 0.04 }
    : { bg: "bg-[#0b1120]", text: "text-white", sub: "text-white/50", card: "border-white/10 bg-white/[0.04]", divide: "divide-white/10", chip: "border-white/10 bg-white/5 text-white/60", left: "text-emerald-400", spent: "text-white/60", wm: 0.05 };

  const initials = (name) => {
    const p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
  };

  return (
    <div className={cx("relative overflow-hidden", T.bg, T.text, className)}>
      {/* watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img src={fullLogo} alt="" className="w-[62%] max-w-[560px] object-contain" style={{ opacity: T.wm }} />
      </div>

      <div className="relative flex h-full flex-col p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: variant === "export" ? "#e2e8f0" : "rgba(255,255,255,0.1)" }}>
          <img src={fullLogo} alt="CricZone" className="h-9 w-auto object-contain lg:h-11" />
          <div className="min-w-0 text-center">
            <div className={cx("text-[10px] font-black uppercase tracking-[0.35em] lg:text-xs", T.sub)}>Auction Results</div>
            <div className="truncate text-2xl font-black lg:text-3xl">{a.name}</div>
          </div>
          {a.logoUrl
            ? <img src={a.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-black/5 lg:h-14 lg:w-14" />
            : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black text-white lg:h-14 lg:w-14">{initials(a.name)}</div>}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-2.5 py-4 sm:grid-cols-4">
          {[
            { l: "Players sold", v: String(sold.length) },
            { l: "Total spend", v: money(totalSpend) },
            { l: "Teams", v: String(teams.length) },
            { l: "Priciest buy", v: priciest ? money(priciest.soldPrice) : "—", s: priciest ? priciest.name : "" },
          ].map((s) => (
            <div key={s.l} className={cx("rounded-2xl border px-3 py-2.5 text-center", T.card)}>
              <div className={cx("text-[9px] font-black uppercase tracking-wide lg:text-[10px]", T.sub)}>{s.l}</div>
              <div className="mt-0.5 text-lg font-black tabular-nums lg:text-xl">{s.v}</div>
              {s.s ? <div className={cx("truncate text-[10px] font-bold", T.sub)}>{s.s}</div> : null}
            </div>
          ))}
        </div>

        {/* Teams grid */}
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <div key={t._id} className={cx("flex flex-col overflow-hidden rounded-2xl border", T.card)}>
              <div className="flex items-center gap-2.5 border-b p-3" style={{ borderColor: variant === "export" ? "#e2e8f0" : "rgba(255,255,255,0.08)" }}>
                {t.logoUrl
                  ? <img src={t.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
                  : <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">{initials(t.name)}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-black">{t.name}</div>
                  <div className={cx("text-[10px] font-bold", T.sub)}>{t.squad.length} players</div>
                </div>
                <div className="text-right">
                  <div className={cx("text-sm font-black tabular-nums", T.left)}>{money(t.remaining)}</div>
                  <div className={cx("text-[9px] font-bold uppercase", T.sub)}>left · spent {money(t.spent)}</div>
                </div>
              </div>
              <div className={cx("flex-1 divide-y px-3", T.divide)}>
                {t.squad.length === 0
                  ? <div className={cx("py-4 text-center text-xs", T.sub)}>No players</div>
                  : t.squad.map((p) => (
                    <div key={p._id} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="flex-1 truncate font-semibold">{p.name}</span>
                      {p.captain ? <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">C</span> : null}
                      {p.isOwner ? <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-indigo-400">Owner</span> : null}
                      {p.retained ? <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-500">{p.manager ? (p.plays ? "Mgr·Plays" : "Mgr") : "Ret"}</span> : null}
                      <span className={cx("shrink-0 font-black tabular-nums", T.left)}>{p.retained && !p.soldPrice ? <span className={T.sub}>Free</span> : money(p.soldPrice)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={cx("mt-4 flex items-center justify-center gap-2 border-t pt-3 text-xs font-bold", T.sub)} style={{ borderColor: variant === "export" ? "#e2e8f0" : "rgba(255,255,255,0.1)" }}>
          <img src={brand} alt="" className="h-4 w-4 rounded object-contain" />
          Generated with <span className={variant === "export" ? "text-slate-900" : "text-white"}>CricZone</span>
        </div>
      </div>
    </div>
  );
}
