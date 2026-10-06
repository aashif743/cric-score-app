import React, { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, Card, Badge, Spinner } from "./ui.jsx";
import { Pager } from "./AdminApprovals.jsx";

export default function AdminUsers() {
  const { user } = useContext(AuthContext);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminService.listUsers(user.token, { search, page });
      setRes(r);
    } catch (_) { setRes({ data: [], total: 0, pages: 1 }); }
    finally { setLoading(false); }
  }, [user.token, search, page]);

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

  return (
    <div>
      <PageHeader title="Users" subtitle={`${res?.total ?? "…"} total accounts`} />

      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search name, email, or phone…"
        className="w-full mb-4 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
      />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card><div className="text-center text-slate-400 py-8 text-sm font-semibold">No users found.</div></Card>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 bg-slate-50">
                  <th className="px-4 py-3 font-bold">User</th>
                  <th className="px-4 py-3 font-bold">Tournaments</th>
                  <th className="px-4 py-3 font-bold">Role</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u._id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{u.name || "—"}</div>
                      <div className="text-xs text-slate-400">{u.email || u.phoneNumber || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">{u.tournaments}</td>
                    <td className="px-4 py-3">
                      {u.role === "admin" ? <Badge color="violet">Admin</Badge> : <Badge>User</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {u.status === "disabled" ? <Badge color="rose">Disabled</Badge> : <Badge color="green">Active</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          disabled={busy === u._id}
                          onClick={() => toggleRole(u)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                        >
                          {u.role === "admin" ? "Revoke admin" : "Make admin"}
                        </button>
                        <button
                          disabled={busy === u._id}
                          onClick={() => toggleStatus(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${
                            u.status === "disabled"
                              ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                          }`}
                        >
                          {u.status === "disabled" ? "Enable" : "Disable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pager page={page} pages={res?.pages || 1} onPage={setPage} />
    </div>
  );
}
