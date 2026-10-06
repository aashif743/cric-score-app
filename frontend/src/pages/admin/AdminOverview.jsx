import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, StatCard, Card, MiniBars, Spinner } from "./ui.jsx";

export default function AdminOverview() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminService.overview(user.token)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setErr("Failed to load overview."); });
    return () => { cancelled = true; };
  }, [user.token]);

  if (err) return <div className="text-rose-600 font-semibold">{err}</div>;
  if (!data) return <Spinner label="Loading overview…" />;

  const { users, tournaments, matches, auctions, topCreators, signups } = data;
  const fmt = tournaments.byFormat || {};

  return (
    <div>
      <PageHeader title="Overview" subtitle="Key numbers across CricZone" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={users.total} sub={`+${users.new7} this week`} accent="blue" />
        <StatCard label="Tournaments" value={tournaments.total} sub={`${tournaments.approved} featured`} accent="violet" />
        <StatCard label="Matches" value={matches.total} sub={`${matches.completionRate}% completed`} accent="green" />
        <StatCard label="Pending approvals" value={tournaments.pendingApprovals} sub="awaiting review" accent={tournaments.pendingApprovals > 0 ? "amber" : "slate"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Card title="New sign-ups (last 30 days)" right={<span className="text-sm font-bold text-slate-500">+{users.new30}</span>}>
            <MiniBars data={signups} />
          </Card>
        </div>
        <Card title="At a glance">
          <ul className="space-y-3 text-sm">
            <Row label="New users (7d)" value={users.new7} />
            <Row label="New users (30d)" value={users.new30} />
            <Row label="Disabled accounts" value={users.disabled} />
            <Row label="Live / in-progress matches" value={matches.inProgress} />
            <Row label="Scheduled matches" value={matches.scheduled} />
            <Row label="Private tournaments" value={tournaments.private} />
            <Row label="Auctions" value={auctions.total} />
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Tournaments by format">
          <ul className="space-y-3 text-sm">
            <Row label="League" value={fmt.league || 0} />
            <Row label="Knockout" value={fmt.knockout || 0} />
            <Row label="Quick" value={fmt.quick || 0} />
          </ul>
        </Card>
        <Card title="Top tournament creators">
          {topCreators.length === 0 ? (
            <div className="text-sm text-slate-400">No data.</div>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {topCreators.map((c, i) => (
                <li key={c.id || i} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{c.name}</div>
                    <div className="text-xs text-slate-400 truncate">{c.email}</div>
                  </div>
                  <span className="font-bold text-slate-700 ml-3">{c.tournaments}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </li>
  );
}
