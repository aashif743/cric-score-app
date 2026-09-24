import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiChevronLeft, FiAward, FiMonitor, FiRotateCcw, FiX, FiCheck, FiRefreshCw, FiInbox,
  FiVideo, FiPlus, FiMinus, FiArrowUp, FiArrowDown, FiChevronsUp, FiZap, FiPlay, FiShuffle, FiDollarSign, FiCheckCircle,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney, teamRemaining, retainedEntries, nextBidAmount } from "../../utils/auctionFormat";
import { Spinner, toast, cx, confirmDialog } from "../../components/auction/ui.jsx";

export default function AuctionControl() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("available"); // available | sold | unsold
  const [auto, setAuto] = useState(false);
  const [selTeam, setSelTeam] = useState(null); // team id whose detail popup is open
  const [confirmSale, setConfirmSale] = useState(false); // show the "confirm sale" popup
  const autoTimer = useRef(null);

  useEffect(() => {
    if (!user?.token) return;
    auctionService.get(id, user.token)
      .then((data) => {
        if (data && data.isAdmin === false) { navigate(`/auctions/${id}/team`, { replace: true }); return; }
        setState(data);
      })
      .catch(() => setState(null)).finally(() => setLoading(false));
  }, [id, user?.token]);

  useAuctionSocket(id, (payload) => setState((prev) => ({ ...prev, ...payload })));

  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { const next = await fn(); setState((prev) => ({ ...prev, ...next })); }
    catch (e) { toast.error(e?.error || e?.message || "Action failed"); }
    finally { setBusy(false); }
  };

  // Fast bid marking: update the UI INSTANTLY (optimistic), then send the bid in
  // the background. Requests are chained so they hit the server in click order
  // (no races), while the auctioneer can keep clicking at full speed — no waiting
  // for the round-trip. The socket / responses reconcile to authoritative state.
  const bidChain = useRef(Promise.resolve());
  const markBidFast = (team) => {
    setState((prev) => {
      if (!prev?.auction) return prev;
      const a = prev.auction;
      if (a.currentBidTeam && String(a.currentBidTeam) === String(team._id)) return prev; // can't outbid self
      const amount = nextBidAmount(a); // first bid = base price, else + tier increment
      return { ...prev, auction: { ...a, currentBid: amount, currentBidTeam: team._id, bidCount: (a.bidCount || 0) + 1 } };
    });
    bidChain.current = bidChain.current
      .catch(() => {})
      .then(() => auctionService.bid(id, team._id, user.token))
      .then((next) => { if (next) setState((prev) => ({ ...prev, ...next })); })
      .catch((e) => {
        toast.error(e?.error || "Bid not accepted");
        // Re-sync to the server's authoritative state after a rejected bid.
        return auctionService.get(id, user.token).then((data) => setState((prev) => ({ ...prev, ...data }))).catch(() => {});
      });
  };

  const d = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const teamById = Object.fromEntries(state.teams.map((t) => [String(t._id), t]));
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const pending = state.players.filter((p) => p.status === "pending").sort((x, y) => (x.order || 0) - (y.order || 0));
    const sold = state.players.filter((p) => p.status === "sold").sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0));
    const unsold = state.players.filter((p) => p.status === "unsold");
    const remaining = (t) => teamRemaining(t);
    // Most a team may bid now (min-squad protection). Falls back to remaining.
    const maxBid = (t) => (typeof t.maxBid === "number" ? t.maxBid : teamRemaining(t));
    return { a, money, teamById, current, bidTeam, pending, sold, unsold, remaining, maxBid };
  }, [state]);

  // Auto-advance: when enabled and the block is empty, open the next player.
  const currentId = d?.current?._id ? String(d.current._id) : null;
  const nextPendingId = d?.pending?.[0]?._id ? String(d.pending[0]._id) : null;
  useEffect(() => {
    clearTimeout(autoTimer.current);
    if (!auto || busy || currentId || !nextPendingId) return;
    autoTimer.current = setTimeout(() => {
      act(() => auctionService.open(id, nextPendingId, user.token));
    }, 1500);
    return () => clearTimeout(autoTimer.current);
    // eslint-disable-next-line
  }, [auto, busy, currentId, nextPendingId]);

  if (loading) return <Center><Spinner size={30} className="text-indigo-400" /></Center>;
  if (!d) return <Center>Auction not found.</Center>;
  const { a, money, teamById, current, bidTeam, pending, sold, unsold, remaining, maxBid } = d;
  const online = a.settings?.biddingMode === "online";
  const canAdjust = !!bidTeam && !busy;

  const TABS = [
    { key: "available", label: "Available", count: pending.length },
    { key: "sold", label: "Sold", count: sold.length },
    { key: "unsold", label: "Unsold", count: unsold.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-5 text-white" style={{ backgroundColor: "#0b1120" }}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={() => navigate(`/auctions/${id}/setup`)} className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition hover:text-white"><FiChevronLeft size={14} /> Setup</button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black">{a.name}</h1>
              <Badge tone="emerald">● Live control</Badge>
              {online && <Badge tone="sky">Online bidding</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => act(() => auctionService.setBigScreen(id, !a.showPurses, user.token))}
              className={cx("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition",
                a.showPurses ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-white/10 hover:bg-white/20")}
              title="Show or hide the teams' purses on the big screen">
              <FiDollarSign size={14} /> {a.showPurses ? "Purses: ON" : "Show purses"}
            </button>
            {a.status !== "completed" && (
              <button
                onClick={async () => {
                  const ok = await confirmDialog({ title: "Finish this auction?", message: "This ends the auction and marks it completed. The big screen and OBS overlay will switch to the results summary. You can still view/export results afterwards.", confirmText: "Finish auction", tone: "danger" });
                  if (ok) act(() => auctionService.finish(id, user.token));
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600"
                title="End the auction and show the results">
                <FiCheckCircle size={14} /> Finish
              </button>
            )}
            <TopBtn onClick={() => navigate(`/auctions/${id}/results`)} icon={FiAward}>Results</TopBtn>
            <TopBtn onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/auction/overlay/${a.shareId}`); toast.success("Stream overlay link copied — add it as an OBS Browser Source (1920×1080)."); }} icon={FiVideo}>Overlay link</TopBtn>
            <a href={`/auction/screen/${a.shareId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20"><FiMonitor size={14} /> Big Screen ↗</a>
          </div>
        </div>

        {/* Progress strip */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
          <Pill label="Sold" value={sold.length} tone="emerald" />
          <Pill label="Available" value={pending.length} tone="slate" />
          <Pill label="Unsold" value={unsold.length} tone="red" />
          <Pill label="Teams" value={state.teams.length} tone="slate" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Current lot + bidding */}
          <div className="lg:col-span-2">
            {current ? (
              <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 shadow-2xl shadow-indigo-900/40">
                <div className="flex items-center gap-4">
                  {current.photoUrl
                    ? <img src={current.photoUrl} alt="" className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white/20" />
                    : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-white/15 text-3xl font-black">{current.name[0]}</div>}
                  <div className="flex-1">
                    <div className="text-2xl font-black">{current.name}{current.isOverseas && <span className="ml-2 text-sm text-sky-300">✈</span>}</div>
                    <div className="text-sm font-semibold text-white/70">{[current.role, current.category].filter(Boolean).join(" · ") || "—"} · Base {money(current.basePrice)}</div>
                  </div>
                </div>

                {/* Current bid with manual up/down */}
                <div className="mt-5 flex items-stretch gap-2">
                  <button disabled={!canAdjust} onClick={() => act(() => auctionService.adjustBid(id, "down", user.token))}
                    title="Lower the current bid by one increment"
                    className="grid w-16 place-items-center rounded-2xl bg-black/25 text-white transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40">
                    <FiMinus size={22} /><span className="text-[9px] font-black uppercase">Bid&nbsp;down</span>
                  </button>
                  <div className="flex-1 rounded-2xl bg-black/25 p-4 text-center">
                    <div className="text-xs font-bold uppercase tracking-widest text-white/60">Current bid</div>
                    <AnimatePresence mode="popLayout">
                      <motion.div key={a.currentBid} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-5xl font-black tabular-nums">{money(a.currentBid)}</motion.div>
                    </AnimatePresence>
                    <div className="mt-1 text-sm font-bold text-amber-300">{bidTeam ? bidTeam.name : "No bids yet"}</div>
                  </div>
                  <button disabled={!canAdjust} onClick={() => act(() => auctionService.adjustBid(id, "up", user.token))}
                    title="Raise the current bid by one increment"
                    className="grid w-16 place-items-center rounded-2xl bg-black/25 text-white transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40">
                    <FiPlus size={22} /><span className="text-[9px] font-black uppercase">Bid&nbsp;up</span>
                  </button>
                </div>

                {/* Team bid buttons */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-white/50">{online ? "Owners bid from their devices — tap to bid on their behalf" : "Tap a team to record their bid"}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {state.teams.map((t) => {
                      const isTop = bidTeam && String(bidTeam._id) === String(t._id);
                      const full = !!t.full;
                      return (
                        <button key={t._id} disabled={isTop || full} onClick={() => markBidFast(t)}
                          title={full ? "Squad is full — can't bid" : undefined}
                          className={cx("rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] disabled:cursor-not-allowed",
                            isTop ? "bg-amber-400 text-black" : full ? "bg-white/5 opacity-50" : "bg-white/10 hover:bg-white/20")}>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-black">{t.name}</span>
                            {full && <span className="shrink-0 rounded bg-red-500/80 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">Full</span>}
                          </div>
                          <div className={cx("text-[11px] font-bold", isTop ? "text-black/70" : "text-white/60")}>{full ? "Max squad reached" : `${money(remaining(t))} left`}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary actions */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button disabled={busy} onClick={() => act(() => auctionService.undo(id, user.token))} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-sm font-black transition hover:bg-white/20 disabled:opacity-50"><FiRotateCcw size={15} /> Undo</button>
                  <button disabled={busy} onClick={() => act(() => auctionService.unsold(id, user.token))} className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500/90 py-3 text-sm font-black transition hover:bg-red-500 disabled:opacity-50"><FiX size={16} /> Unsold</button>
                  <button disabled={busy || !bidTeam} onClick={() => setConfirmSale(true)} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:opacity-50"><FiCheck size={16} /> SOLD</button>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[20rem] place-items-center rounded-3xl border-2 border-dashed border-white/15 text-center">
                <div>
                  <FiInbox className="mx-auto mb-3 text-white/30" size={40} />
                  <div className="text-lg font-black text-white/70">No player on the block</div>
                  <div className="text-sm text-white/40">Pick a player from the list to start bidding →</div>
                  {pending.length > 0 && (
                    <button disabled={busy} onClick={() => act(() => auctionService.open(id, pending[0]._id, user.token))}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-black transition hover:bg-indigo-400 disabled:opacity-50">
                      <FiPlay size={15} /> Bring up {pending[0].name}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column: players + purses */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/5">
              {/* Filter tabs */}
              <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={cx("rounded-lg px-2 py-1.5 text-xs font-black transition", tab === t.key ? "bg-indigo-500 text-white" : "text-white/50 hover:text-white")}>
                    {t.label} <span className="opacity-70">{t.count}</span>
                  </button>
                ))}
              </div>

              {/* Auto-advance toggle + queue ordering (only on Available) */}
              {tab === "available" && (
                <>
                  <button onClick={() => setAuto((v) => !v)}
                    className={cx("mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition", auto ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-white/60 hover:bg-white/10")}>
                    <span className={cx("relative h-4 w-7 shrink-0 rounded-full transition", auto ? "bg-emerald-500" : "bg-white/20")}>
                      <span className={cx("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", auto ? "left-3.5" : "left-0.5")} />
                    </span>
                    <FiZap size={13} /> Auto-advance next player {auto ? "· ON" : "· OFF"}
                  </button>
                  <div className="mb-2 flex items-center gap-1">
                    <span className="mr-1 text-[10px] font-black uppercase tracking-wide text-white/40">Order</span>
                    {[
                      { mode: "shuffle", label: "Shuffle", icon: FiShuffle },
                      { mode: "priceDesc", label: "High → Low", icon: FiArrowDown },
                      { mode: "priceAsc", label: "Low → High", icon: FiArrowUp },
                    ].map((o) => (
                      <button key={o.mode} disabled={busy || pending.length < 2}
                        onClick={() => act(() => auctionService.reorderPending(id, o.mode, user.token))}
                        title={o.mode === "shuffle" ? "Randomise the queue" : `Order the queue by base price (${o.label})`}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] font-bold text-white/70 transition hover:bg-white/15 disabled:opacity-40">
                        <o.icon size={12} /> {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="max-h-[26rem] space-y-1 overflow-y-auto pr-0.5">
                {tab === "available" && (
                  pending.length === 0 ? <Empty text="No players left in the pool." /> : pending.map((p, i) => (
                    <div key={p._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                      <button disabled={busy} onClick={() => act(() => auctionService.open(id, p._id, user.token))} className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50" title="Bring this player up">
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-bold">{p.name[0]}</div>}
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                        <span className="text-[11px] font-bold text-white/50">{money(p.basePrice)}</span>
                      </button>
                      {/* reorder controls */}
                      <div className="flex items-center gap-0.5">
                        <IconBtn disabled={busy || i === 0} onClick={() => act(() => auctionService.movePlayer(id, p._id, "top", user.token))} title="Move to top"><FiChevronsUp size={13} /></IconBtn>
                        <IconBtn disabled={busy || i === 0} onClick={() => act(() => auctionService.movePlayer(id, p._id, "up", user.token))} title="Move up"><FiArrowUp size={13} /></IconBtn>
                        <IconBtn disabled={busy || i === pending.length - 1} onClick={() => act(() => auctionService.movePlayer(id, p._id, "down", user.token))} title="Move down"><FiArrowDown size={13} /></IconBtn>
                      </div>
                    </div>
                  ))
                )}

                {tab === "sold" && (
                  sold.length === 0 ? <Empty text="No players sold yet." /> : sold.map((p) => {
                    const t = teamById[String(p.soldTo)];
                    return (
                      <div key={p._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-bold">{p.name[0]}</div>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{p.name}</div>
                          <div className="truncate text-[11px] font-bold text-white/40">{t ? t.name : "—"}</div>
                        </div>
                        <span className="text-sm font-black text-emerald-400">{money(p.soldPrice)}</span>
                      </div>
                    );
                  })
                )}

                {tab === "unsold" && (
                  unsold.length === 0 ? <Empty text="No unsold players." /> : (
                    <>
                      <button disabled={busy} onClick={() => act(() => auctionService.reauctionUnsold(id, user.token))}
                        className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/90 py-2 text-xs font-black text-black transition hover:bg-amber-400 disabled:opacity-50">
                        <FiRefreshCw size={13} /> Re-auction all {unsold.length}
                      </button>
                      {unsold.map((p) => (
                        <div key={p._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                          {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-bold">{p.name[0]}</div>}
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                          <IconBtn disabled={busy} onClick={() => act(() => auctionService.open(id, p._id, user.token))} title="Bring this player up"><FiPlay size={12} /></IconBtn>
                        </div>
                      ))}
                    </>
                  )
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/5">
              <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-white/50">Teams · tap for squad</div>
              <div className="grid grid-cols-2 gap-2">
                {[...state.teams].sort((x, y) => remaining(y) - remaining(x)).map((t) => {
                  const bought = state.players.filter((p) => p.status === "sold" && String(p.soldTo) === String(t._id)).length;
                  const size = bought + (t.retainedCount || 0);
                  return (
                    <button key={t._id} onClick={() => setSelTeam(t._id)}
                      className="rounded-xl bg-white/5 p-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[0.98]">
                      <div className="flex items-center gap-2">
                        {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-[11px] font-black">{t.name[0]}</div>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-black">{t.name}</div>
                          <div className="text-[10px] font-bold text-white/40">{size} player{size === 1 ? "" : "s"}</div>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-white/10 pt-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[9px] font-bold uppercase text-white/40">Left</span>
                          <span className="text-sm font-black tabular-nums text-emerald-400">{money(remaining(t))}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[9px] font-bold uppercase text-white/40">Max bid</span>
                          <span className="text-[11px] font-bold tabular-nums text-white/60">{money(maxBid(t))}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team detail popup — squad, purse & key numbers */}
      {selTeam && (() => {
        const t = teamById[String(selTeam)];
        if (!t) { return null; }
        const bought = state.players
          .filter((p) => p.status === "sold" && String(p.soldTo) === String(t._id))
          .sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0));
        const squad = [...retainedEntries(t), ...bought];
        const boughtSpend = bought.reduce((s, p) => s + (p.soldPrice || 0), 0);
        const minSquad = a.settings?.minSquadSize || 0;
        const maxSquad = a.settings?.maxSquadSize || 0;
        const Tag = ({ cls, children }) => <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide", cls)}>{children}</span>;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelTeam(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-700 p-4">
                {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-sm font-black text-white">{t.name[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-black text-white">{t.name}</div>
                  <div className="truncate text-[11px] font-bold text-white/70">{t.ownerName || "No owner"}{t.ownerEmail ? ` · ${t.ownerEmail}` : ""}</div>
                </div>
                <button onClick={() => setSelTeam(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"><FiX size={16} /></button>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                {[
                  { l: "Purse", v: money(t.purse), c: "text-white" },
                  { l: "Spent", v: money(t.spent), c: "text-white" },
                  { l: "Remaining", v: money(remaining(t)), c: "text-emerald-400" },
                  { l: "Max bid", v: money(maxBid(t)), c: "text-amber-300" },
                ].map((s) => (
                  <div key={s.l} className="rounded-lg bg-white/5 px-2 py-2 text-center ring-1 ring-white/5">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-white/40">{s.l}</div>
                    <div className={cx("text-sm font-black tabular-nums", s.c)}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="max-h-[50vh] overflow-y-auto border-t border-white/10 p-3">
                <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-wide text-white/40">
                  <span>Squad ({squad.length}{minSquad || maxSquad ? ` · min ${minSquad} / max ${maxSquad}` : ""})</span>
                  <span>bought {money(boughtSpend)}</span>
                </div>
                {squad.length === 0 ? (
                  <div className="py-6 text-center text-sm font-medium text-white/40">No players yet.</div>
                ) : (
                  <div className="space-y-1">
                    {squad.map((p) => (
                      <div key={p._id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                        {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-xs font-bold text-white">{p.name[0]}</div>}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-white">{p.name}</span>
                            {p.captain && <Tag cls="bg-indigo-600 text-white">C</Tag>}
                            {p.isOwner && <Tag cls="bg-indigo-500/20 text-indigo-300">Owner</Tag>}
                            {p.retained && <Tag cls="bg-amber-500/20 text-amber-300">{p.manager ? (p.plays ? "Mgr · Plays" : "Manager") : "Retained"}</Tag>}
                          </div>
                          {p.role && <div className="text-[10px] font-medium text-white/40">{p.role}</div>}
                        </div>
                        <span className="shrink-0 text-sm font-black text-emerald-400">{p.retained && !p.soldPrice ? <span className="text-white/40">Free</span> : money(p.soldPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm sale popup — final check before the hammer falls */}
      {confirmSale && current && bidTeam && (() => {
        const price = a.currentBid || 0;
        const bought = state.players.filter((p) => p.status === "sold" && String(p.soldTo) === String(bidTeam._id)).length;
        const squadAfter = bought + (bidTeam.retainedCount || 0) + 1;
        const leftAfter = Math.max(0, remaining(bidTeam) - price);
        const minSquad = a.settings?.minSquadSize || 0;
        const maxSquad = a.settings?.maxSquadSize || 0;
        const close = () => setConfirmSale(false);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
              <div className="bg-gradient-to-r from-emerald-600 to-green-700 px-4 py-3 text-center">
                <div className="text-xs font-black uppercase tracking-widest text-white/80">Confirm sale</div>
              </div>

              <div className="p-4">
                {/* Player */}
                <div className="flex items-center gap-3">
                  {current.photoUrl ? <img src={current.photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/15 text-xl font-black text-white">{current.name[0]}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-black text-white">{current.name}</div>
                    <div className="truncate text-[11px] font-bold text-white/50">{[current.role, current.category].filter(Boolean).join(" · ") || "Player"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-white/40">Price</div>
                    <div className="text-2xl font-black tabular-nums text-emerald-400">{money(price)}</div>
                  </div>
                </div>

                {/* Sold to */}
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                  {bidTeam.logoUrl ? <img src={bidTeam.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xs font-black text-white">{bidTeam.name[0]}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase text-white/40">Sold to</div>
                    <div className="truncate text-sm font-black text-white">{bidTeam.name}</div>
                  </div>
                </div>

                {/* After-sale numbers */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-center ring-1 ring-white/5">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-white/40">Balance after</div>
                    <div className="text-sm font-black tabular-nums text-emerald-400">{money(leftAfter)}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-center ring-1 ring-white/5">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-white/40">Squad after</div>
                    <div className="text-sm font-black tabular-nums text-white">{squadAfter}{minSquad || maxSquad ? <span className="text-white/40"> / {maxSquad || "—"}</span> : null}</div>
                  </div>
                </div>
                {maxSquad > 0 && squadAfter > maxSquad && (
                  <div className="mt-2 rounded-lg bg-red-500/15 px-3 py-2 text-center text-[11px] font-bold text-red-300">⚠ This exceeds the team's max squad size ({maxSquad}).</div>
                )}

                {/* Actions */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button disabled={busy} onClick={close}
                    className="rounded-xl bg-white/10 py-2.5 text-sm font-black text-white/80 transition hover:bg-white/20 disabled:opacity-50">Cancel</button>
                  <button disabled={busy} onClick={() => { close(); act(() => auctionService.undo(id, user.token)); }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/90 py-2.5 text-sm font-black text-black transition hover:bg-amber-400 disabled:opacity-50"><FiRotateCcw size={14} /> Undo bid</button>
                  <button disabled={busy} onClick={() => { close(); act(() => auctionService.sell(id, user.token)); }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-black transition hover:bg-emerald-400 disabled:opacity-50"><FiCheck size={16} /> Confirm</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const Center = ({ children }) => <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">{children}</div>;
const Badge = ({ tone, children }) => {
  const map = { emerald: "bg-emerald-500/20 text-emerald-400", sky: "bg-sky-500/20 text-sky-300" };
  return <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-black uppercase", map[tone])}>{children}</span>;
};
const Pill = ({ label, value, tone }) => {
  const map = { emerald: "text-emerald-400", red: "text-red-400", slate: "text-white/80" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 ring-1 ring-white/5">
      <span className={cx("font-black tabular-nums", map[tone])}>{value}</span>
      <span className="text-white/50">{label}</span>
    </span>
  );
};
const TopBtn = ({ onClick, icon: Icon, children }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20"><Icon size={14} /> {children}</button>
);
const IconBtn = ({ onClick, disabled, title, children }) => (
  <button onClick={onClick} disabled={disabled} title={title} className="grid h-6 w-6 place-items-center rounded-md bg-white/5 text-white/60 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">{children}</button>
);
const Empty = ({ text }) => <div className="px-1 py-6 text-center text-sm text-white/40">{text}</div>;
