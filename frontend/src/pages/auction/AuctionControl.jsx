import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney } from "../../utils/auctionFormat";

export default function AuctionControl() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.token) return;
    auctionService.get(id, user.token).then(setState).catch(() => setState(null)).finally(() => setLoading(false));
  }, [id, user?.token]);

  // Live sync (in case a second admin device or the big screen also acts).
  useAuctionSocket(id, (payload) => setState((prev) => ({ ...prev, ...payload })));

  const flash = (msg) => { setErr(msg); setTimeout(() => setErr(""), 2500); };
  const act = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { const next = await fn(); setState((prev) => ({ ...prev, ...next })); }
    catch (e) { flash(e?.error || e?.message || "Action failed"); }
    finally { setBusy(false); }
  };

  const derived = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const pending = state.players.filter((p) => p.status === "pending").sort((x, y) => x.order - y.order);
    const remaining = (t) => Math.max(0, (t.purse || 0) - (t.spent || 0));
    return { a, money, current, bidTeam, pending, remaining };
  }, [state]);

  if (loading) return <Center text="Loading…" />;
  if (!derived) return <Center text="Auction not found." />;
  const { a, money, current, bidTeam, pending, remaining } = derived;

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-5 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={() => navigate(`/auctions/${id}/setup`)} className="text-xs font-bold text-slate-400 hover:text-white">← Setup</button>
            <h1 className="text-xl font-black">{a.name} <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400">Live control</span></h1>
          </div>
          <a href={`/auction/screen/${a.shareId}`} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">Open Big Screen ↗</a>
        </div>

        {err && <div className="mb-3 rounded-xl bg-red-500/90 px-4 py-2 text-sm font-bold">{err}</div>}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Current lot + bidding */}
          <div className="lg:col-span-2">
            {current ? (
              <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 shadow-xl">
                <div className="flex items-center gap-4">
                  {current.photoUrl
                    ? <img src={current.photoUrl} alt="" className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white/20" />
                    : <div className="grid h-24 w-24 place-items-center rounded-2xl bg-white/15 text-3xl font-black">{current.name[0]}</div>}
                  <div className="flex-1">
                    <div className="text-2xl font-black">{current.name}</div>
                    <div className="text-sm font-semibold text-white/70">{[current.role, current.category].filter(Boolean).join(" · ")} · Base {money(current.basePrice)}</div>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-black/25 p-4 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/60">Current bid</div>
                  <div className="text-5xl font-black tabular-nums">{money(a.currentBid)}</div>
                  <div className="mt-1 text-sm font-bold text-amber-300">{bidTeam ? bidTeam.name : "No bids yet"}</div>
                </div>

                {/* Team bid buttons */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {state.teams.map((t) => {
                    const isTop = bidTeam && String(bidTeam._id) === String(t._id);
                    return (
                      <button key={t._id} disabled={busy || isTop} onClick={() => act(() => auctionService.bid(id, t._id, user.token))}
                        className={`rounded-xl px-3 py-2.5 text-left transition ${isTop ? "bg-amber-400 text-black" : "bg-white/12 hover:bg-white/20"}`}>
                        <div className="truncate text-sm font-black">{t.name}</div>
                        <div className={`text-[11px] font-bold ${isTop ? "text-black/70" : "text-white/60"}`}>{money(remaining(t))} left</div>
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button disabled={busy} onClick={() => act(() => auctionService.undo(id, user.token))} className="rounded-xl bg-white/12 py-3 text-sm font-black hover:bg-white/20">↶ Undo</button>
                  <button disabled={busy} onClick={() => act(() => auctionService.unsold(id, user.token))} className="rounded-xl bg-red-500/90 py-3 text-sm font-black hover:bg-red-500">Unsold</button>
                  <button disabled={busy || !bidTeam} onClick={() => act(() => auctionService.sell(id, user.token))} className="rounded-xl bg-emerald-500 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-50">SOLD ✔</button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-white/15 py-16 text-center text-white/50">
                <div className="text-lg font-bold">No player on the block</div>
                <div className="text-sm">Pick a player from the queue to start bidding →</div>
              </div>
            )}
          </div>

          {/* Queue + teams */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-white/50">Up next ({pending.length})</div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {pending.length === 0 ? <div className="px-1 py-3 text-sm text-white/40">All players done.</div> :
                  pending.map((p) => (
                    <button key={p._id} disabled={busy} onClick={() => act(() => auctionService.open(id, p._id, user.token))}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10">
                      {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-xs font-bold">{p.name[0]}</div>}
                      <span className="flex-1 truncate text-sm font-bold">{p.name}</span>
                      <span className="text-[11px] font-bold text-white/50">{money(p.basePrice)}</span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-3">
              <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-white/50">Purses</div>
              <div className="space-y-1">
                {state.teams.map((t) => (
                  <div key={t._id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                    <span className="truncate font-bold">{t.name}</span>
                    <span className="font-black text-emerald-400">{money(remaining(t))}</span>
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

const Center = ({ text }) => <div className="grid min-h-screen place-items-center bg-slate-900 text-slate-400">{text}</div>;
