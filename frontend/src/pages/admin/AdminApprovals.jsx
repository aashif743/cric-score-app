import React, { useContext, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, Card, Badge, Btn, Spinner, Reveal, EmptyState, fadeRise } from "./ui.jsx";
import { FiInbox, FiSearch } from "react-icons/fi";

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
    try { setRes(await adminService.listTournaments(user.token, { filter, search, page })); }
    catch (_) { setRes({ data: [], total: 0, pages: 1 }); }
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
      <PageHeader title="Tournament approvals" subtitle="Only approved tournaments appear on everyone's dashboard." />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setPage(1); }}
              className="relative px-4 py-1.5 rounded-lg text-sm font-semibold"
            >
              {filter === f.id && (
                <motion.div layoutId="approvals-filter" className="absolute inset-0 rounded-lg bg-blue-600"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className={`relative z-10 ${filter === f.id ? "text-white" : "text-slate-500"}`}>{f.label}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
          />
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card><EmptyState icon={FiInbox} title="Nothing here" hint="No tournaments match this filter." /></Card>
      ) : (
        <Reveal className="space-y-3">
          {items.map((t) => (
            <motion.div
              key={t._id}
              variants={fadeRise}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-lg hover:shadow-slate-200/60 flex items-center gap-4"
            >
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-100" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-black text-lg shrink-0">
                  {(t.name || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 truncate">{t.name}</span>
                  {t.approved ? <Badge color="green" dot>Featured</Badge> : t.listed ? <Badge color="amber" dot>Requested</Badge> : null}
                  {t.visibility === "private" ? <Badge color="rose">Private</Badge> : null}
                  <Badge color="blue">{t.format}</Badge>
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">
                  {t.numberOfTeams} teams · {t.matchCount} matches · by {t.owner?.name || "Unknown"} <span className="text-slate-400">({t.owner?.email || "—"})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!t.approved ? (
                  <Btn variant="emerald" disabled={busy === t._id} onClick={() => approve(t._id, true)}>Approve</Btn>
                ) : (
                  <Btn variant="amber" disabled={busy === t._id} onClick={() => approve(t._id, false)}>Unfeature</Btn>
                )}
                {t.listed && !t.approved ? (
                  <Btn variant="ghost" disabled={busy === t._id} onClick={() => reject(t._id)}>Reject</Btn>
                ) : null}
                <Btn variant="soft" disabled={busy === t._id} onClick={() => del(t._id, t.name)}>Delete</Btn>
              </div>
            </motion.div>
          ))}
        </Reveal>
      )}

      <Pager page={page} pages={res?.pages || 1} onPage={setPage} />
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-7">
      <Btn variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Btn>
      <span className="text-sm font-semibold text-slate-500">Page {page} / {pages}</span>
      <Btn variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
    </div>
  );
}
