import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiPlus, FiSettings, FiZap, FiLink, FiTrash2, FiUsers, FiUser, FiCheckCircle,
  FiAward, FiGrid, FiRadio, FiEye, FiShield, FiMail, FiCheck, FiX,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import AuctionShell from "./AuctionShell.jsx";
import { Button, Modal, Field, Input, EmptyState, Spinner, toast, confirmDialog } from "../../components/auction/ui.jsx";

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
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState("");

  const load = async () => {
    try { setLoading(true); const r = await auctionService.list(user.token); setAuctions(r.auctions); setInvites(r.invites); }
    catch (e) { setAuctions([]); setInvites([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user?.token) load(); /* eslint-disable-next-line */ }, [user?.token]);

  const respondInvite = async (inv, accept) => {
    try {
      setInviteBusy(inv.teamId + (accept ? "-a" : "-r"));
      await auctionService.respondInvite(inv.auctionId, accept, user.token);
      toast.success(accept ? `You joined ${inv.auctionName} as ${inv.teamName}.` : "Invitation declined.");
      await load();
    } catch (e) { toast.error(e?.error || "Could not respond to the invitation."); }
    finally { setInviteBusy(""); }
  };

  const overview = useMemo(() => ({
    total: auctions.length,
    live: auctions.filter((a) => a.status === "live").length,
    teams: auctions.reduce((s, a) => s + (a.teamCount || 0), 0),
    sold: auctions.reduce((s, a) => s + (a.soldCount || 0), 0),
  }), [auctions]);

  const openCreate = () => { setName(""); setError(""); setCreating(true); };
  const create = async () => {
    if (!name.trim()) { setError("Please enter a name for your auction."); return; }
    try {
      setBusy(true);
      const a = await auctionService.create({ name: name.trim() }, user.token);
      toast.success("Auction created — let's set it up.");
      navigate(`/auctions/${a._id}/setup`);
    } catch (e) {
      toast.error(e?.error || "Could not create the auction.");
    } finally { setBusy(false); }
  };

  const remove = async (a) => {
    const ok = await confirmDialog({
      title: "Delete this auction?",
      message: `"${a.name}" and all its teams & players will be permanently removed. This cannot be undone.`,
      confirmText: "Delete", tone: "danger",
    });
    if (!ok) return;
    try { await auctionService.remove(a._id, user.token); toast.success("Auction deleted."); load(); }
    catch (e) { toast.error("Could not delete the auction."); }
  };

  const copyScreen = (a) => {
    navigator.clipboard?.writeText(`${window.location.origin}/auction/screen/${a.shareId}`);
    toast.success("Big-screen link copied to clipboard.");
  };

  const newBtn = <Button icon={FiPlus} onClick={openCreate}>New Auction</Button>;

  return (
    <AuctionShell active="list" title="My Auctions" right={newBtn}>
      {/* Pending invitations */}
      {invites.length > 0 && (
        <div className="mb-6 space-y-3">
          {invites.map((inv) => (
            <motion.div key={inv.teamId} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-500/25 dark:bg-violet-500/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white"><FiMail size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-900 dark:text-white">You're invited to <span className="text-violet-700 dark:text-violet-300">{inv.auctionName}</span></div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">as owner of <span className="font-black">{inv.teamName}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="success" icon={FiCheck} loading={inviteBusy === inv.teamId + "-a"} onClick={() => respondInvite(inv, true)} className="px-3 py-2 text-xs">Accept</Button>
                <Button variant="soft" icon={FiX} loading={inviteBusy === inv.teamId + "-r"} onClick={() => respondInvite(inv, false)} className="px-3 py-2 text-xs">Decline</Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Overview */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={FiGrid} label="Auctions" value={overview.total} tint="indigo" />
        <Stat icon={FiRadio} label="Live now" value={overview.live} tint="emerald" />
        <Stat icon={FiUsers} label="Teams" value={overview.teams} tint="violet" />
        <Stat icon={FiCheckCircle} label="Players sold" value={overview.sold} tint="amber" />
      </div>

      {loading ? (
        <div className="grid place-items-center py-24 text-slate-400"><Spinner size={30} className="text-indigo-500" /></div>
      ) : auctions.length === 0 ? (
        <EmptyState icon={FiAward} title="No auctions yet"
          desc="Create your first player auction — add teams, set purses and go live on the big screen."
          action={<Button icon={FiPlus} onClick={openCreate}>Create your first auction</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {auctions.map((a, i) => {
            const total = a.playerCount || 0;
            const pct = total ? Math.round(((a.soldCount || 0) / total) * 100) : 0;
            const isOwner = a.role === "owner";
            return (
              <motion.div key={a._id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-500/30">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${isOwner ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"}`}>
                    {isOwner ? <><FiEye size={11} /> Owner</> : <><FiShield size={11} /> Admin</>}
                  </span>
                  <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${STATUS[a.status] || STATUS.draft}`}>{a.status}</span>
                </div>
                <div className="mb-3">
                  <h3 className="text-lg font-black leading-tight text-slate-900 dark:text-white">{a.name}</h3>
                  {isOwner && a.myTeamName && <div className="mt-0.5 text-xs font-bold text-violet-600 dark:text-violet-300">Your team · {a.myTeamName}</div>}
                </div>

                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1"><FiUsers size={13} /> {a.teamCount || 0} teams</span>
                  <span className="inline-flex items-center gap-1"><FiUser size={13} /> {total} players</span>
                  <span className="inline-flex items-center gap-1"><FiCheckCircle size={13} /> {a.soldCount || 0} sold</span>
                </div>

                {/* progress */}
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Auction progress</span><span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                  </div>
                </div>

                {isOwner ? (
                  <div className="mt-auto">
                    <Button variant="primary" icon={FiEye} onClick={() => navigate(`/auctions/${a._id}/team`)} className="w-full">View my team</Button>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button variant="soft" icon={FiSettings} onClick={() => navigate(`/auctions/${a._id}/setup`)} className="px-3 py-2 text-xs">Setup</Button>
                    <Button variant="success" icon={FiZap} onClick={() => navigate(`/auctions/${a._id}/live`)} className="px-3 py-2 text-xs">Live</Button>
                    <Button variant="dark" icon={FiLink} onClick={() => copyScreen(a)} className="px-3 py-2 text-xs">Screen</Button>
                    <button onClick={() => remove(a)} title="Delete auction"
                      className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiTrash2 size={15} /></button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create a new auction" subtitle="You can add teams, players and settings next.">
        <Field label="Auction name" required error={error} hint="e.g. Premier League Season 5 Auction">
          <Input autoFocus value={name} onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Enter auction name" error={!!error} />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="soft" onClick={() => setCreating(false)}>Cancel</Button>
          <Button icon={FiPlus} loading={busy} onClick={create}>Create auction</Button>
        </div>
      </Modal>
    </AuctionShell>
  );
}

function Stat({ icon: Icon, label, value, tint }) {
  const tints = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tints[tint]}`}><Icon size={18} /></span>
      <div className="min-w-0">
        <div className="text-xl font-black text-slate-900 dark:text-white">{value}</div>
        <div className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      </div>
    </div>
  );
}
