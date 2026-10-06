import React, { useContext, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, Card, Badge, Btn, Spinner, EmptyState } from "./ui.jsx";
import { Pager } from "./AdminApprovals.jsx";
import { FiSearch, FiUsers } from "react-icons/fi";

export default function AdminUsers() {
  const { user } = useContext(AuthContext);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRes(await adminService.listUsers(user.token, { search, page, all: viewAll })); }
    catch (_) { setRes({ data: [], total: 0, pages: 1 }); }
    finally { setLoading(false); }
  }, [user.token, search, page, viewAll]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, id) => {
    setBusy(id);
    try { await fn(); await load(); } catch (e) { alert(e?.error || "Action failed."); }
    finally { setBusy(null); }
  };
  const toggleStatus = (u) =>
    act(() => adminService.setUserStatus(user.token, u._id, u.status === "disabled" ? "active" : "disabled"), u._id);
  const toggleRole = (u) => {
    const makeAdmin = u.role !== "admin";
    if (!window.confirm(makeAdmin ? `Make ${u.email || u.name} an admin?` : `Remove admin from ${u.email || u.name}?`)) return;
    act(() => adminService.setUserRole(user.token, u._id, makeAdmin ? "admin" : "user"), u._id);
  };

  const items = res?.data || [];
  const avatarGrad = ["from-blue-500 to-indigo-500", "from-violet-500 to-purple-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-rose-500 to-pink-500"];

  return (
    <div>
      <PageHeader title="Users" subtitle={`${res?.total ?? "…"} total accounts`} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, or phone…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
          />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {[{ id: false, label: "Paginated" }, { id: true, label: "View all" }].map((o) => (
            <button
              key={String(o.id)}
              onClick={() => { setViewAll(o.id); setPage(1); }}
              className="relative px-4 py-1.5 rounded-lg text-sm font-semibold"
            >
              {viewAll === o.id && (
                <motion.div layoutId="users-view-toggle" className="absolute inset-0 rounded-lg bg-slate-900"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className={`relative z-10 ${viewAll === o.id ? "text-white" : "text-slate-500"}`}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {res && !loading ? (
        <div className="text-xs font-semibold text-slate-400 mb-2.5">
          {viewAll
            ? `Showing all ${items.length} user${items.length === 1 ? "" : "s"}`
            : `Showing ${items.length} of ${res.total} user${res.total === 1 ? "" : "s"}`}
        </div>
      ) : null}

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card><EmptyState icon={FiUsers} title="No users found" hint="Try a different search." /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className={`overflow-x-auto ${viewAll ? "max-h-[68vh] overflow-y-auto" : ""}`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-100/95 backdrop-blur">
                  <th className="px-5 py-3.5 font-bold">User</th>
                  <th className="px-5 py-3.5 font-bold">Tournaments</th>
                  <th className="px-5 py-3.5 font-bold">Role</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u, i) => (
                  <motion.tr
                    key={u._id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.025, 0.5) }}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGrad[i % avatarGrad.length]} text-white flex items-center justify-center font-bold shrink-0`}>
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{u.name || "—"}</div>
                          <div className="text-xs text-slate-400 truncate">{u.email || u.phoneNumber || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-700 tabular-nums">{u.tournaments}</td>
                    <td className="px-5 py-3.5">
                      {u.role === "admin" ? <Badge color="violet" dot>Admin</Badge> : <Badge>User</Badge>}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.status === "disabled" ? <Badge color="rose" dot>Disabled</Badge> : <Badge color="green" dot>Active</Badge>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <Btn variant="ghost" disabled={busy === u._id} onClick={() => toggleRole(u)} className="!px-3 !py-1.5 !text-xs">
                          {u.role === "admin" ? "Revoke admin" : "Make admin"}
                        </Btn>
                        <Btn variant={u.status === "disabled" ? "emerald" : "soft"} disabled={busy === u._id} onClick={() => toggleStatus(u)} className="!px-3 !py-1.5 !text-xs">
                          {u.status === "disabled" ? "Enable" : "Disable"}
                        </Btn>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pager page={page} pages={res?.pages || 1} onPage={setPage} />
    </div>
  );
}
