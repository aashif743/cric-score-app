import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";

export default function AuctionBigScreen() {
  const { shareId } = useParams();
  const [state, setState] = useState(null);
  const [auctionId, setAuctionId] = useState(null);
  const [sold, setSold] = useState(null); // { player, team, price } overlay
  const soldTimer = useRef(null);

  useEffect(() => {
    auctionService.getPublic(shareId).then((d) => { setState(d); setAuctionId(d.auctionId); }).catch(() => setState(null));
  }, [shareId]);

  useAuctionSocket(auctionId, (payload) => {
    setState((prev) => ({ ...prev, ...payload }));
    if (payload.justSold) {
      const player = payload.players?.find((p) => String(p._id) === String(payload.justSold.playerId));
      const team = payload.teams?.find((t) => String(t._id) === String(payload.justSold.teamId));
      setSold({ player, team, price: payload.justSold.price });
      clearTimeout(soldTimer.current);
      soldTimer.current = setTimeout(() => setSold(null), 5000);
    }
  });

  const d = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const board = [...state.teams].map((t) => ({ ...t, remaining: Math.max(0, (t.purse || 0) - (t.spent || 0)) }))
      .sort((x, y) => y.remaining - x.remaining);
    return { a, money, current, bidTeam, board };
  }, [state]);

  if (!d) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-500">Connecting to the auction…</div>;
  const { a, money, current, bidTeam, board } = d;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5">
        <h1 className="text-2xl font-black tracking-tight">{a.name}</h1>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-400">Live Auction</div>
      </div>

      <div className="grid gap-6 px-8 pb-8 lg:grid-cols-3">
        {/* Main stage */}
        <div className="lg:col-span-2">
          {current ? (
            <div className="rounded-[2rem] bg-white/5 p-8 ring-1 ring-white/10">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                {current.photoUrl
                  ? <img src={current.photoUrl} alt="" className="h-56 w-56 rounded-3xl object-cover ring-8 ring-white/10" />
                  : <div className="grid h-56 w-56 place-items-center rounded-3xl bg-white/10 text-7xl font-black">{current.name[0]}</div>}
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-5xl font-black leading-tight">{current.name}</div>
                  <div className="mt-2 text-lg font-bold text-white/60">
                    {[current.role, current.category].filter(Boolean).join("  ·  ")}
                    {current.isOverseas && <span className="ml-2 text-sky-400">✈ Overseas</span>}
                  </div>
                  <div className="mt-1 text-sm font-bold uppercase tracking-widest text-white/40">Base price {money(current.basePrice)}</div>
                </div>
              </div>

              <div className="mt-8 rounded-3xl bg-black/30 p-6 text-center">
                <div className="text-sm font-black uppercase tracking-[0.3em] text-white/40">Current Bid</div>
                <AnimatePresence mode="popLayout">
                  <motion.div key={a.currentBid} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                    className="my-1 text-7xl font-black tabular-nums text-amber-300">
                    {money(a.currentBid)}
                  </motion.div>
                </AnimatePresence>
                <div className="text-2xl font-black">{bidTeam ? bidTeam.name : <span className="text-white/40">Awaiting bids…</span>}</div>
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-[24rem] place-items-center rounded-[2rem] bg-white/5 ring-1 ring-white/10">
              <div className="text-center">
                <div className="text-3xl font-black text-white/70">Next player coming up…</div>
                <div className="mt-2 text-white/40">The auctioneer is preparing the next lot.</div>
              </div>
            </div>
          )}
        </div>

        {/* Purse leaderboard */}
        <div className="rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10">
          <div className="mb-3 text-sm font-black uppercase tracking-widest text-white/40">Purse Remaining</div>
          <div className="space-y-2">
            {board.map((t, i) => (
              <div key={t._id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <span className="w-5 text-center text-sm font-black text-white/40">{i + 1}</span>
                {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-xs font-black">{t.name[0]}</div>}
                <span className="flex-1 truncate text-lg font-black">{t.name}</span>
                <span className="text-lg font-black tabular-nums text-emerald-400">{money(t.remaining)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SOLD overlay */}
      <AnimatePresence>
        {sold && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur">
            <motion.div initial={{ scale: 0.5, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }}
              className="rounded-[2rem] bg-gradient-to-br from-emerald-500 to-green-600 px-16 py-10 text-center shadow-2xl">
              <div className="text-6xl font-black tracking-tight text-black">SOLD!</div>
              {sold.player && <div className="mt-2 text-3xl font-black text-black/90">{sold.player.name}</div>}
              <div className="mt-1 text-2xl font-black text-black/80">{money(sold.price)} → {sold.team ? sold.team.name : ""}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
