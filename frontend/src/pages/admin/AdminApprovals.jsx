import React, { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, Card, Badge, Spinner } from "./ui.jsx";

const FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Featured" },
  { id: "all", label: "All" },
];

export default function AdminApprovals() {
  const { user } = useContext(AuthContext);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminService.listTournaments(user.token, { filter, search, page });
      setRes(r);
    } catch (_) { setRes({ data: [], total: 0, pages: 1 }); }
    finally { setLoading(false); }
  }, [user.token, filter, search, page]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, id) => {
    setBusy(id);
    try { await fn(); await load(); } catch (e) { alert(e?.error || "Action failed."); }
    finally { setBusy(null); }
  };

  const approve = (id, v) => act(() => adminService.approveTournament(user.token, id, v), id);
  const reject = (id) => act(() => adminService.rejectTournament(user.token, id), id);
  const del = (id, name) => {
    if (!window.confirm(`Delete "${name}" and ALL its matches? This cannot be undone.`)) return;
    act(() => adminService.deleteTournament(user.token, id), id);
  };

  const items = res?.data || [];

  return (
    <div>
      <PageHeader
        title="Tournament approvals"
        subtitle="Only approved tournaments appear on everyone's dashboard."
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${
                filter === f.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name…"
          className="flex-1 min-w-[180px] px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card><div className="text-center text-slate-400 py-8 text-sm font-semibold">No tournaments here.</div></Card>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t._id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center font-extrabold text-lg">
                  {(t.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 truncate">{t.name}</span>
                  {t.approved ? <Badge color="green">Featured</Badge> : t.listed ? <Badge color="amber">Requested</Badge> : null}
                  {t.visibility === "private" ? <Badge color="rose">Private</Badge> : null}
                  <Badge color="blue">{t.format}</Badge>
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">
                  {t.numberOfTeams} teams · {t.matchCount} matches · by {t.owner?.name || "Unknown"} ({t.owner?.email || "—"})
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!t.approved ? (
                  <button
                    disabled={busy === t._id}
                    onClick={() => approve(t._id, true)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approve
                  </button>
                ) : (
                  <button
                    disabled={busy === t._id}
                    onClick={() => approve(t._id, false)}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-400 disabled:opacity-50"
                  >
                    Unfeature
                  </button>
                )}
                {t.listed && !t.approved ? (
                  <button
                    disabled={busy === t._id}
                    onClick={() => reject(t._id)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                ) : null}
                <button
                  disabled={busy === t._id}
                  onClick={() => del(t._id, t.name)}
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-sm font-bold hover:bg-rose-100 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pager page={page} pages={res?.pages || 1} onPage={setPage} />
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold disabled:opacity-40"
      >
        Prev
      </button>
      <span className="text-sm font-semibold text-slate-500">Page {page} / {pages}</span>
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
