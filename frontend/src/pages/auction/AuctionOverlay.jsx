import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";

// Transparent broadcast overlay for OBS / streaming software (Facebook Live,
// YouTube, etc.). Add as a Browser Source at 1920×1080 over your live video.
// A compact "lower third" shows the player on the block, the live bid and the
// top teams. The page background is transparent so only this bar renders.
//   ?position=bottom|top   where the bar sits (default bottom)
//   ?teams=0               hide the mini team strip
export default function AuctionOverlay() {
  const { shareId } = useParams();
  const [params] = useSearchParams();
  const position = params.get("position") === "top" ? "top" : "bottom";
  const showTeams = params.get("teams") !== "0";

  const [state, setState] = useState(null);
  const [auctionId, setAuctionId] = useState(null);

  // Opt in to a fully transparent page only while this overlay is mounted.
  useEffect(() => {
    document.documentElement.classList.add("overlay-obs");
    document.body.classList.add("overlay-obs");
    return () => {
      document.documentElement.classList.remove("overlay-obs");
      document.body.classList.remove("overlay-obs");
    };
  }, []);

  useEffect(() => {
    auctionService.getPublic(shareId).then((d) => { setState(d); setAuctionId(d.auctionId); }).catch(() => setState(null));
  }, [shareId]);

  useAuctionSocket(auctionId, (payload) => setState((prev) => ({ ...prev, ...payload })));

  const d = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const board = [...state.teams].map((t) => ({ ...t, remaining: Math.max(0, (t.purse || 0) - (t.spent || 0)) }))
      .sort((x, y) => y.remaining - x.remaining).slice(0, 4);
    return { a, money, current, bidTeam, board };
  }, [state]);

  if (!d) return <div className="min-h-screen" />;
  const { a, money, current, bidTeam, board } = d;

  return (
    <div className={`pointer-events-none fixed inset-x-0 ${position === "top" ? "top-0" : "bottom-0"} p-5`}>
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div key={current._id}
            initial={{ opacity: 0, y: position === "top" ? -40 : 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: position === "top" ? -30 : 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mx-auto flex max-w-6xl items-stretch gap-3">
            {/* Player + bid card */}
            <div className="flex flex-1 items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 shadow-2xl backdrop-blur-md">
              {/* accent bar */}
              <div className="h-14 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
              {current.photoUrl
                ? <img src={current.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-2 ring-white/15" />
                : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/10 text-2xl font-black text-white">{current.name[0]}</div>}

              <div className="min-w-0">
                <div className="truncate text-2xl font-black leading-tight text-white">
                  {current.name}{current.isOverseas && <span className="ml-2 align-middle text-xs text-sky-400">✈</span>}
                </div>
                <div className="truncate text-xs font-bold uppercase tracking-wider text-white/50">
                  {[current.role, current.category].filter(Boolean).join(" · ") || "Player"} · Base {money(current.basePrice)}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-4 pl-4">
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Current Bid</div>
                  <AnimatePresence mode="popLayout">
                    <motion.div key={a.currentBid} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      className="text-4xl font-black leading-none tabular-nums text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.35)]">
                      {money(a.currentBid)}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                  {bidTeam ? (
                    <>
                      {bidTeam.logoUrl ? <img src={bidTeam.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-xs font-black text-white">{bidTeam.name[0]}</div>}
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-white/40">Top bid</div>
                        <div className="max-w-[8rem] truncate text-sm font-black text-white">{bidTeam.name}</div>
                      </div>
                    </>
                  ) : <span className="px-2 text-sm font-bold text-white/40">No bids yet</span>}
                </div>
              </div>
            </div>

            {/* Team strip */}
            {showTeams && (
              <div className="hidden w-64 shrink-0 flex-col justify-center rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-2.5 shadow-2xl backdrop-blur-md lg:flex">
                <div className="mb-1 text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Purse remaining</div>
                <div className="space-y-1">
                  {board.map((t) => (
                    <div key={t._id} className="flex items-center gap-2">
                      {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-5 w-5 rounded object-cover" /> : <div className="grid h-5 w-5 place-items-center rounded bg-white/10 text-[8px] font-black text-white">{t.name[0]}</div>}
                      <span className="flex-1 truncate text-xs font-bold text-white/80">{t.name}</span>
                      <span className="text-xs font-black tabular-nums text-emerald-400">{money(t.remaining)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/85 px-5 py-3 shadow-2xl backdrop-blur-md">
            {a.logoUrl
              ? <img src={a.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/15" />
              : <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" /></span>}
            <span className="text-sm font-black text-white">{a.name}</span>
            <span className="text-sm font-semibold text-white/50">· Next player coming up…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
