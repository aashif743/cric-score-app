import React, { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, Card, StatCard, Spinner, Badge } from "./ui.jsx";

export default function AdminContent() {
  const { user } = useContext(AuthContext);
  const [issues, setIssues] = useState(null);
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [iss, log] = await Promise.all([
        adminService.contentIssues(user.token),
        adminService.auditLog(user.token, 1),
      ]);
      setIssues(iss);
      setAudit(log);
    } catch (_) { /* leave */ }
  }, [user.token]);

  useEffect(() => { load(); }, [load]);

  const cleanOrphans = async (type, count) => {
    if (!count) return;
    if (!window.confirm(`Permanently delete ${count} orphaned match${count === 1 ? "" : "es"} (${type})? This cannot be undone.`)) return;
    setBusy(type);
    try { await adminService.deleteOrphanMatches(user.token, type); await load(); }
    catch (e) { alert(e?.error || "Cleanup failed."); }
    finally { setBusy(null); }
  };

  if (!issues) return <><PageHeader title="Content cleanup" /><Spinner label="Scanning…" /></>;

  return (
    <div>
      <PageHeader title="Content cleanup" subtitle="Find and remove orphaned / junk data safely." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Matches with no user" value={issues.orphanMatchesNoUser} accent={issues.orphanMatchesNoUser ? "rose" : "slate"} />
        <StatCard label="Matches with no tournament" value={issues.orphanMatchesNoTournament} accent={issues.orphanMatchesNoTournament ? "amber" : "slate"} />
        <StatCard label="Empty tournaments" value={issues.emptyTournaments} accent={issues.emptyTournaments ? "amber" : "slate"} />
      </div>

      <div className="mt-4">
        <Card title="Cleanup actions">
          <div className="space-y-3">
            <CleanupRow
              label="Delete orphaned matches (no owner)"
              hint="Matches whose user account is missing. Safe to remove."
              count={issues.orphanMatchesNoUser}
              busy={busy === "noUser"}
              onClick={() => cleanOrphans("noUser", issues.orphanMatchesNoUser)}
            />
            <CleanupRow
              label="Delete standalone matches with no tournament link"
              hint="⚠️ This also removes quick/standalone matches. Use with care."
              count={issues.orphanMatchesNoTournament}
              danger
              busy={busy === "noTournament"}
              onClick={() => cleanOrphans("noTournament", issues.orphanMatchesNoTournament)}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Recent admin actions">
          {!audit?.data?.length ? (
            <div className="text-sm text-slate-400">No actions logged yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {audit.data.map((a) => (
                <li key={a._id} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">{a.action}</span>
                    <span className="text-slate-400"> · {a.targetType} {a.details?.name || a.details?.email || ""}</span>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 ml-3">
                    {a.adminEmail} · {new Date(a.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function CleanupRow({ label, hint, count, onClick, busy, danger }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 text-sm">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge color={count ? (danger ? "rose" : "amber") : "slate"}>{count}</Badge>
        <button
          disabled={!count || busy}
          onClick={onClick}
          className={`px-3.5 py-2 rounded-lg text-sm font-bold disabled:opacity-40 ${
            danger ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
