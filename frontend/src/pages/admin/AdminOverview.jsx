import React, { useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import { PageHeader, StatCard, Card, MiniBars, Spinner, Reveal, fadeRise } from "./ui.jsx";
import {
  FiUsers, FiAward, FiActivity, FiClock, FiTrendingUp, FiRadio, FiCalendar, FiEyeOff, FiDollarSign,
} from "react-icons/fi";

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
      <PageHeader title="Overview" subtitle="A live pulse of everything happening across CricZone" />

      <Reveal className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total users" value={users.total} sub={`+${users.new7} this week`} accent="blue" icon={FiUsers} />
        <StatCard label="Tournaments" value={tournaments.total} sub={`${tournaments.approved} featured`} accent="violet" icon={FiAward} />
        <StatCard label="Matches" value={matches.total} sub={`${matches.completionRate}% completed`} accent="green" icon={FiActivity} />
        <StatCard label="Pending approvals" value={tournaments.pendingApprovals} sub="awaiting review" accent={tournaments.pendingApprovals > 0 ? "amber" : "slate"} icon={FiClock} />
      </Reveal>

      <Reveal className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <motion.div variants={fadeRise} className="lg:col-span-2">
          <Card
            title="New sign-ups"
            right={<span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600"><FiTrendingUp /> +{users.new30} <span className="text-slate-400 font-medium">/ 30d</span></span>}
          >
            <MiniBars data={signups} accent="blue" />
          </Card>
        </motion.div>
        <Card title="At a glance">
          <ul className="space-y-1">
            <Row icon={FiRadio} label="Live / in-progress" value={matches.inProgress} accent="rose" />
            <Row icon={FiCalendar} label="Scheduled matches" value={matches.scheduled} accent="blue" />
            <Row icon={FiUsers} label="New users (7d)" value={users.new7} accent="green" />
            <Row icon={FiEyeOff} label="Disabled accounts" value={users.disabled} accent="slate" />
            <Row icon={FiDollarSign} label="Auctions" value={auctions.total} accent="amber" />
          </ul>
        </Card>
      </Reveal>

      <Reveal className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title="Tournaments by format">
          <div className="space-y-3 pt-1">
            <FormatBar label="League" value={fmt.league || 0} total={tournaments.total} accent="blue" />
            <FormatBar label="Knockout" value={fmt.knockout || 0} total={tournaments.total} accent="violet" />
            <FormatBar label="Quick" value={fmt.quick || 0} total={tournaments.total} accent="amber" />
          </div>
        </Card>
        <Card title="Top tournament creators">
          {topCreators.length === 0 ? (
            <div className="text-sm text-slate-400 py-6 text-center">No data.</div>
          ) : (
            <ul className="space-y-1">
              {topCreators.map((c, i) => (
                <motion.li
                  key={c.id || i}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-slate-50"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate text-sm">{c.name}</div>
                    <div className="text-xs text-slate-400 truncate">{c.email}</div>
                  </div>
                  <span className="font-black text-slate-700 tabular-nums">{c.tournaments}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  );
}

function Row({ icon: Icon, label, value, accent = "slate" }) {
  const c = { rose: "text-rose-500", blue: "text-blue-500", green: "text-emerald-500", amber: "text-amber-500", slate: "text-slate-400" };
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon className={`text-base ${c[accent] || c.slate}`} />
      <span className="text-slate-500 text-sm flex-1">{label}</span>
      <span className="font-bold text-slate-800 tabular-nums">{value}</span>
    </li>
  );
}

function FormatBar({ label, value, total, accent }) {
  const grad = { blue: "from-blue-500 to-indigo-500", violet: "from-violet-500 to-purple-500", amber: "from-amber-500 to-orange-500" }[accent];
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-slate-800 tabular-nums">{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${grad}`}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
