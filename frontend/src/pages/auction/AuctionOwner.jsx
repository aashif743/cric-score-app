import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import useAuctionSocket from "../../hooks/useAuctionSocket";
import { formatMoney, nextBidAmount } from "../../utils/auctionFormat";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import brand from "../../assets/criczone_icon.png";

export default function AuctionOwner() {
  const { id } = useParams();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user?.token) return;
    auctionService.get(id, user.token).then(setState).catch(() => setState(null)).finally(() => setLoading(false));
  }, [id, user?.token]);

  useAuctionSocket(id, (payload) => setState((prev) => ({ ...prev, ...payload })));

  const d = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const myTeam = state.teams.find((t) => String(t._id) === String(state.myTeamId)) || null;
    const squad = myTeam ? state.players.filter((p) => String(p.soldTo) === String(myTeam._id)) : [];
    const current = state.players.find((p) => String(p._id) === String(a.currentPlayer)) || null;
    const bidTeam = state.teams.find((t) => String(t._id) === String(a.currentBidTeam)) || null;
    const remaining = myTeam ? Math.max(0, myTeam.purse - myTeam.spent) : 0;
    const online = a.settings?.biddingMode === "online";
    const next = nextBidAmount(a);
    const iAmTop = myTeam && String(a.currentBidTeam) === String(myTeam._id);
    const canBid = online && !!current && !iAmTop && next <= remaining;
    return { a, money, myTeam, squad, current, bidTeam, remaining, online, next, iAmTop, canBid };
  }, [state]);

  const flash = (m) => { setErr(m); setTimeout(() => setErr(""), 2500); };
  const bid = async () => {
    if (busy) return;
    setBusy(true);
    try { const nx = await auctionService.ownerBid(id, user.token); setState((prev) => ({ ...prev, ...nx })); }
    catch (e) { flash(e?.error || "Could not place the bid"); }
    finally { setBusy(false); }
  };

  if (loading) return <Center text="Loading…" />;
  if (!d) return <Center text="Auction not found." />;
  if (!d.myTeam) return <Center text="You're not assigned to a team in this auction. Ask the organiser to add your email." />;
  const { a, money, myTeam, squad, current, bidTeam, remaining, online, next, iAmTop, canBid } = d;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
        <img src={brand} alt="CricZone" className="h-8 w-8 rounded-lg object-cover" />
        <span className="font-black">CricZone Auction</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => { logout(); navigate("/"); }} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">Log out</button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {err && <div className="rounded-xl bg-red-500/90 px-4 py-2 text-sm font-bold text-white">{err}</div>}

        {/* My team */}
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">{a.name}</div>
          <div className="mt-1 text-3xl font-black">{myTeam.name}</div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Purse" value={money(myTeam.purse)} />
            <Stat label="Spent" value={money(myTeam.spent)} />
            <Stat label="Remaining" value={money(remaining)} highlight />
          </div>
        </div>

        {/* Current lot + bid */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">On the block now</div>
          {current ? (
            <>
              <div className="flex items-center gap-4">
                {current.photoUrl ? <img src={current.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-200 text-xl font-black text-slate-500">{current.name[0]}</div>}
                <div className="flex-1">
                  <div className="text-lg font-black">{current.name}</div>
                  <div className="text-xs font-semibold text-slate-500">{[current.role, current.category].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black">{money(a.currentBid)}</div>
                  <div className="text-xs font-bold text-amber-600">{bidTeam ? bidTeam.name : "No bids"}</div>
                </div>
              </div>

              {online ? (
                <button onClick={bid} disabled={!canBid || busy}
                  className={`mt-4 w-full rounded-2xl py-4 text-lg font-black transition ${
                    canBid ? "bg-emerald-500 text-black hover:bg-emerald-400" : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500"}`}>
                  {iAmTop ? "You're the top bidder" : next > remaining ? "Not enough purse" : busy ? "Bidding…" : `Bid ${money(next)}`}
                </button>
              ) : (
                <div className="mt-4 rounded-xl bg-slate-100 py-3 text-center text-sm font-bold text-slate-500 dark:bg-white/5">Bidding is handled by the auctioneer</div>
              )}
            </>
          ) : <div className="py-4 text-center text-sm text-slate-400">Waiting for the next player…</div>}
        </div>

        {/* My squad */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">My squad ({squad.length})</div>
            <div className="text-xs font-bold text-slate-500">Spent {money(myTeam.spent)}</div>
          </div>
          {squad.length === 0 ? <div className="py-6 text-center text-sm text-slate-400">No players bought yet.</div> : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {squad.map((p) => (
                <div key={p._id} className="flex items-center gap-3 py-2.5">
                  {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">{p.name[0]}</div>}
                  <div className="flex-1"><div className="font-bold">{p.name}</div><div className="text-xs text-slate-500">{p.role || "—"}</div></div>
                  <div className="font-black text-emerald-600">{money(p.soldPrice)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, highlight }) => (
  <div className={`rounded-xl px-2 py-3 ${highlight ? "bg-white/20" : "bg-white/10"}`}>
    <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">{label}</div>
    <div className="text-lg font-black tabular-nums">{value}</div>
  </div>
);
const Center = ({ text }) => <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center text-slate-400 dark:bg-slate-950">{text}</div>;
