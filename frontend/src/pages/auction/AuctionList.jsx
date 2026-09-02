import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiSettings, FiZap, FiLink, FiTrash2, FiUsers, FiUser, FiCheckCircle } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import AuctionShell from "./AuctionShell.jsx";

const STATUS = {
  draft: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
};

export default function AuctionList() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setLoading(true); setAuctions(await auctionService.list(user.token)); }
    catch (e) { setAuctions([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user?.token) load(); /* eslint-disable-next-line */ }, [user?.token]);

  const create = async () => {
    if (!name.trim() || busy) return;
    try { setBusy(true); const a = await auctionService.create({ name: name.trim() }, user.token); navigate(`/auctions/${a._id}/setup`); }
    catch (e) { alert(e?.error || "Could not create the auction"); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this auction and all its teams & players?")) return;
    await auctionService.remove(id, user.token).catch(() => {});
    load();
  };

  const newBtn = (
    <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700">
      <FiPlus /> New Auction
    </button>
  );

  return (
    <AuctionShell active="list" title="My Auctions" right={newBtn}>
      {creating && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Auction name</label>
          <div className="flex gap-2">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="e.g. Premier League Season 5 Auction"
              className="flex-1 rounded-xl border-2 border-slate-200 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 dark:border-white/10" />
            <button onClick={create} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "…" : "Create"}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400">Loading…</div>
      ) : auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-white/15 dark:bg-white/5">
          <p className="text-lg font-bold text-slate-500">No auctions yet</p>
          <p className="text-sm text-slate-400">Create your first auction to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {auctions.map((a) => (
            <div key={a._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-lg font-black">{a.name}</h3>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${STATUS[a.status] || STATUS.draft}`}>{a.status}</span>
              </div>
              <div className="mb-4 flex gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1"><FiUsers size={13} /> {a.teamCount} teams</span>
                <span className="inline-flex items-center gap-1"><FiUser size={13} /> {a.playerCount} players</span>
                <span className="inline-flex items-center gap-1"><FiCheckCircle size={13} /> {a.soldCount} sold</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => navigate(`/auctions/${a._id}/setup`)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"><FiSettings size={13} /> Setup</button>
                <button onClick={() => navigate(`/auctions/${a._id}/live`)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><FiZap size={13} /> Live</button>
                <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/auction/screen/${a.shareId}`); alert("Big-screen link copied!"); }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900"><FiLink size={13} /> Screen link</button>
                <button onClick={() => remove(a._id)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><FiTrash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AuctionShell>
  );
}
