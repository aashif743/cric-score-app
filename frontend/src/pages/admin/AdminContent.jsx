import React, { useContext, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, Card, StatCard, Spinner, Badge, Btn, Reveal, EmptyState } from "./ui.jsx";
import { FiUserX, FiLink, FiFolderMinus, FiClock } from "react-icons/fi";

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
      setIssues(iss); setAudit(log);
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
      <PageHeader title="Content cleanup" subtitle="Find and remove orphaned or junk data safely." />

      <Reveal className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Matches, no owner" value={issues.orphanMatchesNoUser} accent={issues.orphanMatchesNoUser ? "rose" : "slate"} icon={FiUserX} />
        <StatCard label="Matches, no tournament" value={issues.orphanMatchesNoTournament} accent={issues.orphanMatchesNoTournament ? "amber" : "slate"} icon={FiLink} />
        <StatCard label="Empty tournaments" value={issues.emptyTournaments} accent={issues.emptyTournaments ? "amber" : "slate"} icon={FiFolderMinus} />
      </Reveal>

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
              hint="⚠️ Also removes quick/standalone matches. Use with care."
              count={issues.orphanMatchesNoTournament}
              danger
              busy={busy === "noTournament"}
              onClick={() => cleanOrphans("noTournament", issues.orphanMatchesNoTournament)}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title={<span className="flex items-center gap-2"><FiClock className="text-slate-400" /> Recent admin actions</span>}>
          {!audit?.data?.length ? (
            <EmptyState title="No actions logged yet" hint="Approvals, disables and deletes will appear here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {audit.data.map((a, i) => (
                <motion.li
                  key={a._id}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="py-2.5 flex items-center justify-between text-sm gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <Badge color={actionColor(a.action)}>{a.action}</Badge>
                    <span className="text-slate-500 truncate">{a.targetType} {a.details?.name || a.details?.email || ""}</span>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 text-right">
                    <div className="truncate max-w-[180px]">{a.adminEmail}</div>
                    <div>{new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function actionColor(action = "") {
  if (action.includes("delete") || action.includes("reject") || action.includes("disable")) return "rose";
  if (action.includes("approve") || action.includes("enable")) return "green";
  if (action.includes("Admin")) return "violet";
  return "slate";
}

function CleanupRow({ label, hint, count, onClick, busy, danger }) {
  return (
    <motion.div whileHover={{ scale: 1.005 }} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800 text-sm">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge color={count ? (danger ? "rose" : "amber") : "slate"}>{count}</Badge>
        <Btn variant={danger ? "danger" : "dark"} disabled={!count || busy} onClick={onClick}>
          {busy ? "Deleting…" : "Delete"}
        </Btn>
      </div>
    </motion.div>
  );
}
