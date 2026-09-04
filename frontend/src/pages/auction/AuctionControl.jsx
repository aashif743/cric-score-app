import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiChevronLeft, FiAward, FiMonitor, FiRotateCcw, FiX, FiCheck, FiRefreshCw, FiInbox, FiVideo,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";
import { Spinner, toast, cx } from "../../components/auction/ui.jsx";

export default function AuctionControl() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.token) return;
    auctionService.get(id, user.token)
      .then((data) => {
        if (data && data.isAdmin === false) { navigate(`/auctions/${id}/team`, { replace: true }); return; }
        setState(data);
      })
      .catch(() => setState(null)).finally(() => setLoading(false));
  }, [id, user?.token]);

  // Live sync (in case a second admin device or the big screen also acts).
  useAuctionSocket(id, (payload) => setState((prev) => ({ ...prev, ...payload })));

  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { const next = await fn(); setState((prev) => ({ ...prev, ...next })); }
    catch (e) { toast.error(e?.error || e?.message || "Action failed"); }
    finally { setBusy(false); }
  };

  const derived = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const pending = state.players.filter((p) => p.status === "pending").sort((x, y) => x.order - y.order);
    const unsold = state.players.filter((p) => p.status === "unsold");
    const soldCount = state.players.filter((p) => p.status === "sold").length;
    const remaining = (t) => Math.max(0, (t.purse || 0) - (t.spent || 0));
    return { a, money, current, bidTeam, pending, unsold, soldCount, remaining };
  }, [state]);

  if (loading) return <Center><Spinner size={30} className="text-indigo-400" /></Center>;
  if (!derived) return <Center>Auction not found.</Center>;
  const { a, money, current, bidTeam, pending, unsold, soldCount, remaining } = derived;
  const online = a.settings?.biddingMode === "online";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-5 text-white">
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
            <TopBtn onClick={() => navigate(`/auctions/${id}/results`)} icon={FiAward}>Results</TopBtn>
            <TopBtn onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/auction/overlay/${a.shareId}`); toast.success("Stream overlay link copied — add it as an OBS Browser Source (1920×1080)."); }} icon={FiVideo}>Overlay link</TopBtn>
            <a href={`/auction/screen/${a.shareId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20"><FiMonitor size={14} /> Big Screen ↗</a>
          </div>
        </div>

        {/* Progress strip */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
          <Pill label="Sold" value={soldCount} tone="emerald" />
          <Pill label="Up next" value={pending.length} tone="slate" />
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

                <div className="mt-5 rounded-2xl bg-black/25 p-4 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/60">Current bid</div>
                  <AnimatePresence mode="popLayout">
                    <motion.div key={a.currentBid} initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-5xl font-black tabular-nums">{money(a.currentBid)}</motion.div>
                  </AnimatePresence>
                  <div className="mt-1 text-sm font-bold text-amber-300">{bidTeam ? bidTeam.name : "No bids yet"}</div>
                </div>

                {/* Team bid buttons */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-white/50">{online ? "Owners bid from their devices — tap to bid on their behalf" : "Tap a team to record their bid"}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {state.teams.map((t) => {
                      const isTop = bidTeam && String(bidTeam._id) === String(t._id);
                      return (
                        <button key={t._id} disabled={busy || isTop} onClick={() => act(() => auctionService.bid(id, t._id, user.token))}
                          className={cx("rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] disabled:cursor-not-allowed",
                            isTop ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20")}>
                          <div className="truncate text-sm font-black">{t.name}</div>
                          <div className={cx("text-[11px] font-bold", isTop ? "text-black/70" : "text-white/60")}>{money(remaining(t))} left</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button disabled={busy} onClick={() => act(() => auctionService.undo(id, user.token))} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-3 text-sm font-black transition hover:bg-white/20 disabled:opacity-50"><FiRotateCcw size={15} /> Undo</button>
                  <button disabled={busy} onClick={() => act(() => auctionService.unsold(id, user.token))} className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500/90 py-3 text-sm font-black transition hover:bg-red-500 disabled:opacity-50"><FiX size={16} /> Unsold</button>
                  <button disabled={busy || !bidTeam} onClick={() => act(() => auctionService.sell(id, user.token))} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:opacity-50"><FiCheck size={16} /> SOLD</button>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[20rem] place-items-center rounded-3xl border-2 border-dashed border-white/15 text-center">
                <div>
                  <FiInbox className="mx-auto mb-3 text-white/30" size={40} />
                  <div className="text-lg font-black text-white/70">No player on the block</div>
                  <div className="text-sm text-white/40">Pick a player from the queue to start bidding →</div>
                </div>
              </div>
            )}
          </div>

          {/* Queue + teams */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/5">
              <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-white/50">Up next ({pending.length})</div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {pending.length === 0 ? (
                  <div className="px-1 py-3">
                    <div className="text-sm text-white/40">No players left in the pool.</div>
                    {unsold.length > 0 && (
                      <button disabled={busy} onClick={() => act(() => auctionService.reauctionUnsold(id, user.token))}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/90 py-2 text-xs font-black text-black transition hover:bg-amber-400">
                        <FiRefreshCw size={13} /> Re-auction {unsold.length} unsold
                      </button>
                    )}
                  </div>
                ) : (
                  pending.map((p) => (
                    <button key={p._id} disabled={busy} onClick={() => act(() => auctionService.open(id, p._id, user.token))}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/10 disabled:opacity-50">
                      {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-bold">{p.name[0]}</div>}
                      <span className="flex-1 truncate text-sm font-bold">{p.name}</span>
                      <span className="text-[11px] font-bold text-white/50">{money(p.basePrice)}</span>
                    </button>
                  )))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/5">
              <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-white/50">Purses remaining</div>
              <div className="space-y-1">
                {[...state.teams].sort((x, y) => remaining(y) - remaining(x)).map((t) => (
                  <div key={t._id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                    <span className="truncate font-bold">{t.name}</span>
                    <span className="font-black tabular-nums text-emerald-400">{money(remaining(t))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
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
