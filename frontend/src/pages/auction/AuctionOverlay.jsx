import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";
import AuctionSummaryBoard from "./AuctionSummaryBoard.jsx";
import AuctionPurseBoard from "./AuctionPurseBoard.jsx";

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
  const [idReveal, setIdReveal] = useState(null); // announce the drawn player's ID first
  const [flash, setFlash] = useState(null); // { type:'sold'|'unsold', player, team, price }
  const revealTimer = useRef(null);
  const flashTimer = useRef(null);
  const initRef = useRef(false);
  const prevPlayerRef = useRef(null);
  const skipRevealRef = useRef(false); // skip the ID reveal for a restore (undo)

  // When a new player is drawn, flash the big ID before the lower-third shows.
  // useLayoutEffect so it's committed before paint (no lower-third flash first).
  useLayoutEffect(() => {
    if (!state?.auction) return;
    const pid = state.auction.currentPlayer ? String(state.auction.currentPlayer) : null;
    if (!initRef.current) { initRef.current = true; prevPlayerRef.current = pid; return; }
    const prev = prevPlayerRef.current;
    prevPlayerRef.current = pid;
    if (pid && pid !== prev) {
      setFlash(null); clearTimeout(flashTimer.current); // clear any sold/unsold result
      if (skipRevealRef.current) {
        skipRevealRef.current = false;
        setIdReveal(null); clearTimeout(revealTimer.current);
      } else {
        const player = state.players?.find((p) => String(p._id) === pid);
        if (player) {
          setIdReveal(player);
          clearTimeout(revealTimer.current);
          revealTimer.current = setTimeout(() => setIdReveal(null), 2400);
        }
      }
    } else if (!pid) {
      setIdReveal(null); clearTimeout(revealTimer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.auction?.currentPlayer]);

  // Make the whole page transparent while this overlay is mounted, so OBS's
  // Browser Source shows ONLY the floating bar / popups over the live video.
  // Done with inline styles (not a class) so it can't depend on a stylesheet
  // that isn't loaded — otherwise the app's dark background fills the frame.
  useEffect(() => {
    const root = document.getElementById("root");
    const prev = {
      html: document.documentElement.style.background,
      body: document.body.style.background,
      root: root ? root.style.background : "",
    };
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    if (root) root.style.background = "transparent";
    document.documentElement.classList.add("overlay-obs");
    document.body.classList.add("overlay-obs");
    return () => {
      document.documentElement.style.background = prev.html;
      document.body.style.background = prev.body;
      if (root) root.style.background = prev.root;
      document.documentElement.classList.remove("overlay-obs");
      document.body.classList.remove("overlay-obs");
    };
  }, []);

  useEffect(() => {
    auctionService.getPublic(shareId).then((d) => { setState(d); setAuctionId(d.auctionId); }).catch(() => setState(null));
  }, [shareId]);

  useAuctionSocket(auctionId, (payload) => {
    setState((prev) => ({ ...prev, ...payload }));
    // Show the sold/unsold result as a floating popup (same info as the big
    // screen). It clears when the next player is brought up.
    const showFlash = (type, info) => {
      const player = payload.players?.find((p) => String(p._id) === String(info.playerId));
      const team = payload.teams?.find((t) => String(t._id) === String(info.teamId));
      setFlash({ type, player, team, price: info.price });
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 120000);
    };
    if (payload.justSold) showFlash("sold", payload.justSold);
    else if (payload.justUnsold) showFlash("unsold", payload.justUnsold);
    else if (payload.justRestored) { skipRevealRef.current = true; setFlash(null); clearTimeout(flashTimer.current); }
  });

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

  // Auction finished → show the results summary over the stream.
  if (a.status === "completed") {
    return (
      <div className="fixed inset-0 grid place-items-center p-[3vh]">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="h-full w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
          <AuctionSummaryBoard state={state} variant="overlay" className="h-full" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
    {/* Purse board — full-screen takeover when the admin turns purses on (closes
        the sold/unsold popup and hides the bar); off returns to normal. */}
    <AnimatePresence>
      {a.showPurses && (
        <motion.div key="obs-purse" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3 }}
          className={`pointer-events-none fixed z-40 flex ${position === "top" ? "inset-x-0 top-0 justify-center pt-[3vh]" : "inset-x-0 bottom-0 justify-center pb-[3vh]"}`}>
          {/* Compact floating panel that scales with the stream canvas — video
              stays visible around it. Width caps so it never fills the screen. */}
          <AuctionPurseBoard state={state} compact className="max-h-[70vh] w-[min(58vw,860px)] shadow-2xl ring-1 ring-white/10" />
        </motion.div>
      )}
    </AnimatePresence>

    {/* ID reveal — big number announced before the lower-third appears. Kept as a
        compact centered card so the stream video stays visible around it. */}
    <AnimatePresence>
      {idReveal && !a.showPurses && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
          <motion.div initial={{ scale: 0.4, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 13 }}
            className="rounded-[2.5rem] bg-slate-950/80 px-16 py-10 text-center shadow-2xl ring-1 ring-white/15 backdrop-blur-md">
            <div className="text-lg font-black uppercase tracking-[0.5em] text-white/50">Player</div>
            <div className="font-black leading-none text-white drop-shadow-[0_0_50px_rgba(129,140,248,0.6)]" style={{ fontSize: "clamp(6rem,18vw,16rem)" }}>#{idReveal.code}</div>
            <div className="text-base font-black uppercase tracking-[0.4em] text-indigo-300">On the block</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* SOLD / UNSOLD — a floating popup (no full backdrop, so the live video
        shows around it), same info as the big screen. */}
    <AnimatePresence>
      {flash && !a.showPurses && (() => {
        const sold = flash.type === "sold";
        const p = flash.player;
        return (
          <motion.div initial={{ opacity: 0, scale: 0.85, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            className="pointer-events-none fixed inset-0 z-40 grid place-items-center px-6">
            <div className="flex w-full max-w-2xl items-stretch overflow-hidden rounded-3xl bg-slate-950/90 shadow-2xl ring-1 ring-white/15 backdrop-blur-md">
              <div className={`flex items-center px-6 text-2xl font-black lg:text-3xl ${sold ? "bg-gradient-to-b from-emerald-400 to-green-600 text-black" : "bg-gradient-to-b from-slate-600 to-slate-800 text-white"}`}>{sold ? "SOLD" : "UNSOLD"}</div>
              <div className="flex flex-1 items-center gap-4 p-5">
                {p && (p.photoUrl
                  ? <img src={p.photoUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover object-top ring-2 ring-white/15" />
                  : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl font-black text-white">{(p.name || "?")[0]}</div>)}
                <div className="min-w-0 flex-1 text-white">
                  <div className="flex items-center gap-2">
                    {p?.code ? <span className="shrink-0 rounded bg-white/15 px-2 py-0.5 text-sm font-black tabular-nums">#{p.code}</span> : null}
                    <span className="truncate text-2xl font-black">{p ? p.name : "Player"}</span>
                  </div>
                  {sold ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-3xl font-black tabular-nums text-amber-300">{money(flash.price)}</span>
                      <span className="text-white/40">→</span>
                      {flash.team?.logoUrl ? <img src={flash.team.logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" /> : null}
                      <span className="truncate text-lg font-black">{flash.team ? flash.team.name : ""}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-lg font-bold text-white/50">No bids — returned to the pool</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}
    </AnimatePresence>

    <div className={`pointer-events-none fixed inset-x-0 ${position === "top" ? "top-0" : "bottom-0"} p-5`}>
      <AnimatePresence mode="wait">
        {idReveal || a.showPurses ? null : current ? (
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
    </>
  );
}
