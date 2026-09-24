import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiMaximize2, FiMinimize2 } from "react-icons/fi";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";
import AuctionSummaryBoard from "./AuctionSummaryBoard.jsx";

// Floating full-screen toggle — for projecting the big screen edge-to-edge.
function FullscreenButton() {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  return (
    <button onClick={toggle} title={fs ? "Exit full screen" : "Full screen (for projector)"}
      className="fixed right-4 top-4 z-[60] grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white">
      {fs ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
    </button>
  );
}

// Cinematic projector/big-screen view of a live auction. Read-only, driven by
// the public snapshot + socket updates. Designed for 16:9 screens.
export default function AuctionBigScreen() {
  const { shareId } = useParams();
  const [state, setState] = useState(null);
  const [auctionId, setAuctionId] = useState(null);
  const [flash, setFlash] = useState(null); // { type: 'sold'|'unsold', player, team, price }
  const [shuffle, setShuffle] = useState(null); // { mode, count } — reorder animation
  const timer = useRef(null);
  const shuffleTimer = useRef(null);

  useEffect(() => {
    auctionService.getPublic(shareId).then((d) => { setState(d); setAuctionId(d.auctionId); }).catch(() => setState(null));
  }, [shareId]);

  useAuctionSocket(auctionId, (payload) => {
    setState((prev) => ({ ...prev, ...payload }));
    // Sold/unsold result stays on screen until the auctioneer brings up the next
    // player (a long safety timeout clears it if they never do).
    const showFlash = (type, info) => {
      const player = payload.players?.find((p) => String(p._id) === String(info.playerId));
      const team = payload.teams?.find((t) => String(t._id) === String(info.teamId));
      setFlash({ type, player, team, price: info.price });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), 120000);
    };
    if (payload.justSold) showFlash("sold", payload.justSold);
    else if (payload.justUnsold) showFlash("unsold", payload.justUnsold);
    else if (payload.justReordered) {
      setShuffle(payload.justReordered);
      clearTimeout(shuffleTimer.current);
      shuffleTimer.current = setTimeout(() => setShuffle(null), 3400);
    }
  });

  // Close the sold/unsold result the moment a new player is brought up.
  useEffect(() => {
    if (state?.auction?.currentPlayer) { setFlash(null); clearTimeout(timer.current); }
  }, [state?.auction?.currentPlayer]);

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
      const bought = state.players.filter((p) => String(p.soldTo) === String(t._id)).length;
      // Retained players + a playing manager count toward the squad total.
      return { ...t, squad: bought + (t.retainedCount || 0), remaining: Math.max(0, (t.purse || 0) - (t.spent || 0) - (t.retainedCost || 0)) };
    }).sort((x, y) => y.remaining - x.remaining);
    return { a, money, current, bidTeam, nextPlayer, soldCount, board, total: state.players.length };
  }, [state]);

  if (!d) return <div className="grid min-h-screen place-items-center bg-[#05060f] text-slate-500">Connecting to the auction…</div>;
  const { a, money, current, bidTeam, nextPlayer, soldCount, board, total } = d;

  // Auction finished → show the results summary instead of the live view.
  if (a.status === "completed") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen">
        <FullscreenButton />
        <AuctionSummaryBoard state={state} variant="screen" className="min-h-screen" />
      </motion.div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white" style={{ backgroundColor: "#05060f" }}>
      <FullscreenButton />
      {/* cover image background (dimmed for readability) */}
      {a.coverUrl && (
        <div className="pointer-events-none absolute inset-0">
          <img src={a.coverUrl} alt="" className="h-full w-full scale-105 object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05060f]/85 via-[#05060f]/70 to-[#05060f]/95" />
        </div>
      )}

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
          {a.logoUrl
            ? <img src={a.logoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover shadow-lg ring-2 ring-white/15" />
            : <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black shadow-lg shadow-indigo-900/40">{(a.name || "A")[0]}</div>}
          <div>
            <h1 className="text-xl font-black leading-tight tracking-tight lg:text-2xl">{a.name}</h1>
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">
              {[a.venue, [a.date, a.time].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Player Auction"}
            </div>
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

      <div className={`relative grid gap-6 px-6 pb-6 lg:px-10 lg:pb-10 ${a.showPurses ? "lg:grid-cols-5" : "grid-cols-1"}`}>
        {/* Main stage — full width by default; shares space when purses are shown */}
        <div className={a.showPurses ? "lg:col-span-3" : ""}>
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current._id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-[76vh] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.04] backdrop-blur-sm">
                {/* Left: full-height player image */}
                <div className="relative h-full w-[40%] shrink-0 bg-gradient-to-br from-indigo-900/40 to-violet-900/40 sm:w-[44%]">
                  {current.photoUrl
                    ? <img src={current.photoUrl} alt="" className="h-full w-full object-cover object-top" />
                    : <div className="grid h-full w-full place-items-center text-[16rem] font-black text-white/15">{current.name[0]}</div>}
                  <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-r from-transparent to-[#05060f]/70" />
                  {current.isOverseas && <span className="absolute left-5 top-5 rounded-full bg-sky-500 px-4 py-2 text-base font-black shadow-lg">✈ OVERSEAS</span>}
                </div>

                {/* Right: player details + current bid */}
                <div className="flex flex-1 flex-col justify-between p-8 lg:p-12">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.35em] text-white/40 lg:text-base">On the block</div>
                    <div className={`mt-2 font-black leading-[0.92] ${a.showPurses ? "text-5xl lg:text-7xl" : "text-6xl lg:text-9xl"}`}>{current.name}</div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {current.role && <Tag>{current.role}</Tag>}
                      {current.category && <Tag tone="amber">{current.category}</Tag>}
                    </div>
                    <div className="mt-4 text-base font-bold uppercase tracking-[0.2em] text-white/40 lg:text-xl">Base price · {money(current.basePrice)}</div>
                    <PlayerStats stats={current.stats} />
                  </div>

                  {/* Current bid — the biggest thing on screen */}
                  <div className="rounded-3xl bg-black/40 p-6 lg:p-8">
                    <div className="text-sm font-black uppercase tracking-[0.35em] text-white/40 lg:text-lg">Current Bid</div>
                    <AnimatePresence mode="popLayout">
                      <motion.div key={a.currentBid} initial={{ scale: 0.6, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                        className={`font-black tabular-nums leading-none text-amber-300 drop-shadow-[0_0_30px_rgba(252,211,77,0.4)] ${a.showPurses ? "text-7xl lg:text-8xl" : "text-8xl lg:text-[10rem]"}`}>
                        {money(a.currentBid)}
                      </motion.div>
                    </AnimatePresence>
                    <div className="mt-3 flex items-center gap-3">
                      {bidTeam ? (
                        <>
                          {bidTeam.logoUrl ? <img src={bidTeam.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-lg font-black">{bidTeam.name[0]}</div>}
                          <span className="text-3xl font-black lg:text-4xl">{bidTeam.name}</span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-white/40">Awaiting first bid…</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="grid h-[76vh] place-items-center rounded-[2.5rem] border border-white/10 bg-white/[0.04]">
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

        {/* Teams leaderboard — only when the admin toggles "Show purses". */}
        <AnimatePresence>
        {a.showPurses && (
        <motion.div key="purses" initial={{ opacity: 0, x: 48 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 48 }} transition={{ type: "spring", stiffness: 200, damping: 26 }} className="lg:col-span-2">
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
        </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* SOLD / UNSOLD result — stays until the next player is brought up */}
      <AnimatePresence>
        {flash && (() => {
          const sold = flash.type === "sold";
          const p = flash.player;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 grid place-items-center bg-black/85 p-6 backdrop-blur-md lg:p-10">
              <motion.div initial={{ scale: 0.7, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 16 }}
                className="w-full max-w-5xl overflow-hidden rounded-[2.5rem] shadow-2xl ring-1 ring-white/10">
                <div className={`py-5 text-center lg:py-6 ${sold ? "bg-gradient-to-r from-emerald-400 to-green-600" : "bg-gradient-to-r from-slate-600 to-slate-800"}`}>
                  <div className={`text-6xl font-black tracking-tight lg:text-8xl ${sold ? "text-black" : "text-white"}`}>{sold ? "SOLD" : "UNSOLD"}</div>
                </div>
                <div className="flex items-center gap-8 bg-[#0b1120] p-8 lg:p-10">
                  {p && (p.photoUrl
                    ? <img src={p.photoUrl} alt="" className="h-44 w-44 shrink-0 rounded-3xl object-cover object-top ring-4 ring-white/10 lg:h-56 lg:w-56" />
                    : <div className="grid h-44 w-44 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-indigo-600/40 to-violet-700/40 text-7xl font-black text-white/80 lg:h-56 lg:w-56">{(p.name || "?")[0]}</div>)}
                  <div className="min-w-0 flex-1 text-white">
                    <div className="truncate text-5xl font-black leading-tight lg:text-7xl">{p ? p.name : "Player"}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      {p?.role && <Tag>{p.role}</Tag>}
                      {p?.category && <Tag tone="amber">{p.category}</Tag>}
                    </div>
                    {sold ? (
                      <>
                        <div className="mt-6 text-xs font-black uppercase tracking-[0.35em] text-white/40 lg:text-sm">Sold for</div>
                        <div className="text-7xl font-black tabular-nums leading-none text-amber-300 drop-shadow-[0_0_30px_rgba(252,211,77,0.4)] lg:text-8xl">{money(flash.price)}</div>
                        <div className="mt-4 flex items-center gap-3">
                          <span className="text-lg font-bold uppercase tracking-widest text-white/40">Bought by</span>
                          {flash.team && (flash.team.logoUrl
                            ? <img src={flash.team.logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                            : <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-base font-black">{flash.team.name[0]}</div>)}
                          <span className="text-3xl font-black lg:text-4xl">{flash.team ? flash.team.name : ""}</span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-6 text-2xl font-bold text-white/50 lg:text-3xl">No bids — returned to the pool</div>
                    )}
                  </div>
                </div>
                <div className="bg-black/50 py-3 text-center text-xs font-black uppercase tracking-[0.3em] text-white/40 lg:text-sm">Bring up the next player to continue →</div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* PLAYERS RESHUFFLED — transparency animation when the admin reorders the
          queue, so owners visibly see it happen. */}
      <AnimatePresence>
        {shuffle && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 grid place-items-center bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.7, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="w-[min(92vw,660px)] rounded-[2.25rem] border border-white/15 bg-gradient-to-br from-indigo-600/90 to-violet-700/90 p-10 text-center shadow-2xl">
              {/* animated deck of cards flying into order */}
              <div className="mx-auto mb-8 flex h-24 items-center justify-center gap-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div key={i}
                    initial={{ x: (i - 2) * 84, y: -70, rotate: (i - 2) * 20, opacity: 0 }}
                    animate={{ x: [(i - 2) * 84, 0, 0], y: [-70, 0, 0], rotate: [(i - 2) * 20, 0, 0], opacity: 1 }}
                    transition={{ duration: 0.9, delay: 0.08 + i * 0.11, ease: "easeOut" }}
                    className="h-20 w-14 rounded-xl bg-white shadow-xl ring-1 ring-black/10"
                    style={{ zIndex: 10 - i }}>
                    <div className="mt-1.5 ml-1.5 h-2 w-6 rounded-full bg-indigo-300" />
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="text-5xl font-black tracking-tight text-white lg:text-6xl">PLAYERS RESHUFFLED</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
                className="mt-3 text-2xl font-bold text-white/85">{shuffleLabel(shuffle.mode)}</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.78 }}
                className="mt-1 text-base font-semibold text-white/50">{shuffle.count} players re-ordered · fair & random</motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SHUFFLE_LABELS = {
  shuffle: "Randomised order",
  priceDesc: "Ordered: highest base price first",
  priceAsc: "Ordered: lowest base price first",
  name: "Ordered: A → Z",
};
const shuffleLabel = (m) => SHUFFLE_LABELS[m] || "New order";

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
