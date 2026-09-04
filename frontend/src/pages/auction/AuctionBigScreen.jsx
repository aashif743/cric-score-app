import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";

// Cinematic projector/big-screen view of a live auction. Read-only, driven by
// the public snapshot + socket updates. Designed for 16:9 screens.
export default function AuctionBigScreen() {
  const { shareId } = useParams();
  const [state, setState] = useState(null);
  const [auctionId, setAuctionId] = useState(null);
  const [flash, setFlash] = useState(null); // { type: 'sold'|'unsold', player, team, price }
  const timer = useRef(null);

  useEffect(() => {
    auctionService.getPublic(shareId).then((d) => { setState(d); setAuctionId(d.auctionId); }).catch(() => setState(null));
  }, [shareId]);

  useAuctionSocket(auctionId, (payload) => {
    setState((prev) => ({ ...prev, ...payload }));
    const showFlash = (type, info) => {
      const player = payload.players?.find((p) => String(p._id) === String(info.playerId));
      const team = payload.teams?.find((t) => String(t._id) === String(info.teamId));
      setFlash({ type, player, team, price: info.price });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), 5000);
    };
    if (payload.justSold) showFlash("sold", payload.justSold);
    else if (payload.justUnsold) showFlash("unsold", payload.justUnsold);
  });

  const d = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const pending = state.players.filter((p) => p.status === "pending").sort((x, y) => x.order - y.order);
    const nextPlayer = pending.find((p) => String(p._id) !== String(a.currentPlayer)) || null;
    const soldCount = state.players.filter((p) => p.status === "sold").length;
    const board = [...state.teams].map((t) => {
      const squad = state.players.filter((p) => String(p.soldTo) === String(t._id));
      return { ...t, squad: squad.length, remaining: Math.max(0, (t.purse || 0) - (t.spent || 0)) };
    }).sort((x, y) => y.remaining - x.remaining);
    return { a, money, current, bidTeam, nextPlayer, soldCount, board, total: state.players.length };
  }, [state]);

  if (!d) return <div className="grid min-h-screen place-items-center bg-[#05060f] text-slate-500">Connecting to the auction…</div>;
  const { a, money, current, bidTeam, nextPlayer, soldCount, board, total } = d;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white" style={{ backgroundColor: "#05060f" }}>
      {/* animated ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-[38rem] w-[38rem] animate-pulse-glow rounded-full bg-indigo-700/25 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[34rem] w-[34rem] animate-float-slow rounded-full bg-violet-700/25 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[30rem] w-[30rem] animate-float rounded-full bg-sky-700/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-4 lg:px-10 lg:py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black shadow-lg shadow-indigo-900/40">{(a.name || "A")[0]}</div>
          <div>
            <h1 className="text-xl font-black leading-tight tracking-tight lg:text-2xl">{a.name}</h1>
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">Player Auction</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Stat label="Sold" value={soldCount} />
          <Stat label="Remaining" value={Math.max(0, total - soldCount)} />
          <div className="flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" /></span>
            <span className="text-xs font-black uppercase tracking-widest text-red-300">Live</span>
          </div>
        </div>
      </header>

      <div className="relative grid gap-6 px-6 pb-6 lg:grid-cols-5 lg:px-10 lg:pb-10">
        {/* Main stage */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current._id} initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm lg:p-8">
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <div className="relative shrink-0">
                    {current.photoUrl
                      ? <img src={current.photoUrl} alt="" className="h-48 w-48 rounded-3xl object-cover ring-4 ring-white/10 lg:h-56 lg:w-56" />
                      : <div className="grid h-48 w-48 place-items-center rounded-3xl bg-gradient-to-br from-indigo-600/40 to-violet-700/40 text-7xl font-black lg:h-56 lg:w-56">{current.name[0]}</div>}
                    {current.isOverseas && <span className="absolute -right-2 -top-2 rounded-full bg-sky-500 px-3 py-1 text-xs font-black shadow-lg">✈ OVERSEAS</span>}
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-4xl font-black leading-tight lg:text-6xl">{current.name}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {current.role && <Tag>{current.role}</Tag>}
                      {current.category && <Tag tone="amber">{current.category}</Tag>}
                    </div>
                    <div className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-white/40">Base price · {money(current.basePrice)}</div>
                    <PlayerStats stats={current.stats} />
                  </div>
                </div>

                {/* Current bid */}
                <div className="mt-6 overflow-hidden rounded-3xl bg-black/40 p-6 lg:mt-8">
                  <div className="text-center text-xs font-black uppercase tracking-[0.35em] text-white/40 lg:text-sm">Current Bid</div>
                  <AnimatePresence mode="popLayout">
                    <motion.div key={a.currentBid} initial={{ scale: 0.6, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="my-1 text-center text-6xl font-black tabular-nums text-amber-300 drop-shadow-[0_0_25px_rgba(252,211,77,0.35)] lg:text-8xl">
                      {money(a.currentBid)}
                    </motion.div>
                  </AnimatePresence>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    {bidTeam ? (
                      <>
                        {bidTeam.logoUrl ? <img src={bidTeam.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-sm font-black">{bidTeam.name[0]}</div>}
                        <span className="text-2xl font-black lg:text-3xl">{bidTeam.name}</span>
                      </>
                    ) : (
                      <span className="text-xl font-bold text-white/40">Awaiting first bid…</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid min-h-[26rem] place-items-center rounded-[2rem] border border-white/10 bg-white/[0.04]">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-16 w-16 animate-spin-slow rounded-full border-4 border-white/10 border-t-indigo-400" />
                  <div className="text-3xl font-black text-white/70">Next player coming up…</div>
                  <div className="mt-2 text-white/40">The auctioneer is preparing the next lot.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Next up preview */}
          {nextPlayer && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Next up</span>
              {nextPlayer.photoUrl ? <img src={nextPlayer.photoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 font-black">{nextPlayer.name[0]}</div>}
              <div className="flex-1">
                <div className="text-lg font-black">{nextPlayer.name}</div>
                <div className="text-xs font-semibold text-white/50">{[nextPlayer.role, nextPlayer.category].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="text-sm font-black text-white/60">Base {money(nextPlayer.basePrice)}</div>
            </div>
          )}
        </div>

        {/* Teams leaderboard */}
        <div className="lg:col-span-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-black uppercase tracking-[0.25em] text-white/40">Teams</div>
              <div className="text-[11px] font-bold text-white/30">Purse remaining</div>
            </div>
            <div className="space-y-2.5">
              {board.map((t, i) => {
                const isTop = bidTeam && String(bidTeam._id) === String(t._id);
                const pct = t.purse ? Math.round(((t.purse - t.remaining) / t.purse) * 100) : 0;
                return (
                  <motion.div key={t._id} layout transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`rounded-2xl p-3 ring-1 transition ${isTop ? "bg-amber-400/15 ring-amber-400/40" : "bg-white/[0.03] ring-white/5"}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-sm font-black text-white/30">{i + 1}</span>
                      {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-sm font-black">{t.name[0]}</div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-lg font-black">{t.name}</span>
                          {isTop && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase text-black">Top bid</span>}
                        </div>
                        <div className="text-[11px] font-bold text-white/40">{t.squad} player{t.squad === 1 ? "" : "s"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black tabular-nums text-emerald-400">{money(t.remaining)}</div>
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${100 - pct}%` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SOLD / UNSOLD flash */}
      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 grid place-items-center bg-black/75 backdrop-blur-md">
            <motion.div initial={{ scale: 0.4, rotate: flash.type === "sold" ? -10 : 4 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              className={`rounded-[2.5rem] px-16 py-12 text-center shadow-2xl ${flash.type === "sold" ? "bg-gradient-to-br from-emerald-400 to-green-600" : "bg-gradient-to-br from-slate-600 to-slate-800"}`}>
              <div className={`text-7xl font-black tracking-tight lg:text-8xl ${flash.type === "sold" ? "text-black" : "text-white"}`}>
                {flash.type === "sold" ? "SOLD!" : "UNSOLD"}
              </div>
              {flash.player && <div className={`mt-3 text-4xl font-black ${flash.type === "sold" ? "text-black/90" : "text-white/90"}`}>{flash.player.name}</div>}
              {flash.type === "sold" && (
                <div className="mt-2 text-2xl font-black text-black/80">{money(flash.price)} → {flash.team ? flash.team.name : ""}</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerStats({ stats }) {
  const entries = useMemo(() => {
    if (!stats || typeof stats !== "object") return [];
    return Object.entries(stats).filter(([, v]) => v !== "" && v != null && typeof v !== "object").slice(0, 4);
  }, [stats]);
  if (!entries.length) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-white/5 px-3 py-1.5 text-center ring-1 ring-white/10">
          <div className="text-lg font-black leading-none tabular-nums">{String(v)}</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">{k}</div>
        </div>
      ))}
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="hidden text-center sm:block">
    <div className="text-2xl font-black tabular-nums">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</div>
  </div>
);
const Tag = ({ children, tone }) => (
  <span className={`rounded-full px-3 py-1 text-sm font-black ${tone === "amber" ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/80"}`}>{children}</span>
);
