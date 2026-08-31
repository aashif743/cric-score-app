import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  live: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
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
    try {
      setLoading(true);
      setAuctions(await auctionService.list(user.token));
    } catch (e) {
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.token) load(); /* eslint-disable-next-line */ }, [user?.token]);

  const create = async () => {
    if (!name.trim() || busy) return;
    try {
      setBusy(true);
      const a = await auctionService.create({ name: name.trim() }, user.token);
      navigate(`/auctions/${a._id}/setup`);
    } catch (e) {
      alert(e?.error || "Could not create the auction");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this auction and all its teams & players?")) return;
    await auctionService.remove(id, user.token).catch(() => {});
    load();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Player Auctions</h1>
            <p className="text-sm text-slate-500">Run a live player auction for your league.</p>
          </div>
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700"
          >
            + New Auction
          </button>
        </div>

        {creating && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Auction name</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Premier League Season 5 Auction"
                className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500"
              />
              <button onClick={create} disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {busy ? "…" : "Create"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading…</div>
        ) : auctions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-lg font-bold text-slate-500">No auctions yet</p>
            <p className="text-sm text-slate-400">Create your first auction to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {auctions.map((a) => (
              <div key={a._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-lg font-black text-slate-900">{a.name}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${STATUS_STYLES[a.status] || STATUS_STYLES.draft}`}>
                    {a.status}
                  </span>
                </div>
                <div className="mb-4 flex gap-4 text-xs font-semibold text-slate-500">
                  <span>{a.teamCount} teams</span>
                  <span>{a.playerCount} players</span>
                  <span>{a.soldCount} sold</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => navigate(`/auctions/${a._id}/setup`)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Setup</button>
                  <button onClick={() => navigate(`/auctions/${a._id}/live`)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Live Control</button>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/auction/screen/${a.shareId}`); alert("Big-screen link copied!"); }}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-black"
                  >
                    Copy Big-Screen Link
                  </button>
                  <button onClick={() => remove(a._id)} className="ml-auto rounded-lg px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
