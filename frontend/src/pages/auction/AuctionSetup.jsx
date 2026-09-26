import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiUsers, FiUser, FiSettings, FiPlus, FiTrash2, FiLink, FiZap, FiChevronRight,
  FiUploadCloud, FiGlobe, FiCheck, FiInfo,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import { formatMoney, parseMoney, groupDigits, CURRENCIES, auctionCurrencyCode } from "../../utils/auctionFormat";
import ImageUpload from "../../components/auction/ImageUpload";
import AuctionShell from "./AuctionShell.jsx";
import {
  Button, Field, Input, MoneyInput, Textarea, Select, Toggle, EmptyState, Spinner, toast, confirmDialog, isEmail, cx,
} from "../../components/auction/ui.jsx";
import { FiTrendingUp, FiX, FiStar, FiAward, FiDownload, FiFile, FiEdit2 } from "react-icons/fi";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";

const ROLES = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"];

export default function AuctionSetup() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState("Teams");
  const [state, setState] = useState(null); // { auction, teams, players }
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await auctionService.get(id, user.token);
      if (data && data.isAdmin === false) { navigate(`/auctions/${id}/team`, { replace: true }); return; }
      setState(data);
    }
    catch (e) { setState(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user?.token) load(); /* eslint-disable-next-line */ }, [id, user?.token]);

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400"><Spinner size={30} className="text-indigo-500" /></div>;
  if (!state) return <div className="grid min-h-screen place-items-center text-slate-400">Auction not found.</div>;

  const { auction, teams, players } = state;
  const money = (n) => formatMoney(n, { symbol: auction.currencySymbol, format: auction.currencyFormat });

  const goLive = () => {
    if (teams.length < 2) { toast.warning("Add at least 2 teams before going live."); setTab("Teams"); return; }
    if (players.length < 1) { toast.warning("Add at least 1 player before going live."); setTab("Players"); return; }
    navigate(`/auctions/${id}/live`);
  };
  const copyOwnerLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/auctions/${id}/team`);
    toast.success("Owner link copied — share it with your team owners.");
  };

  const right = (
    <>
      <Button variant="soft" icon={FiLink} onClick={copyOwnerLink} className="hidden sm:inline-flex">Owner link</Button>
      <Button variant="success" icon={FiZap} onClick={goLive}>Go Live</Button>
    </>
  );

  const TABS = [
    { key: "Teams", icon: FiUsers, count: teams.length },
    { key: "Players", icon: FiUser, count: players.length },
    { key: "Settings", icon: FiSettings },
  ];

  return (
    <AuctionShell active="setup" auctionId={id} auctionName={auction.name} shareId={auction.shareId} title={auction.name} status={auction.status} right={right}>
      <div className="max-w-5xl">
        {/* Readiness banner */}
        <ReadinessBanner teams={teams.length} players={players.length} onFix={setTab} />

        {/* Tabs */}
        <div className="mb-6 inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cx("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
                tab === t.key ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white")}>
              <t.icon size={15} /> {t.key}
              {t.count != null && (
                <span className={cx("rounded-full px-1.5 py-0.5 text-[10px] font-black", tab === t.key ? "bg-white/20" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300")}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "Teams" && <TeamsTab id={id} token={user.token} teams={teams} auction={auction} defaultPurse={auction.settings.defaultPurse} money={money} onChange={setState} />}
        {tab === "Players" && <PlayersTab id={id} token={user.token} players={players} money={money} onChange={setState} />}
        {tab === "Settings" && <SettingsTab id={id} token={user.token} auction={auction} money={money} onChange={setState} />}
      </div>
    </AuctionShell>
  );
}

function ReadinessBanner({ teams, players, onFix }) {
  const ready = teams >= 2 && players >= 1;
  if (ready) return null;
  const needs = [];
  if (teams < 2) needs.push({ label: `Add ${2 - teams} more team${2 - teams > 1 ? "s" : ""}`, tab: "Teams" });
  if (players < 1) needs.push({ label: "Add at least 1 player", tab: "Players" });
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
      <FiInfo className="text-amber-500" size={18} />
      <span className="text-sm font-bold text-amber-800 dark:text-amber-200">Finish setup to go live:</span>
      {needs.map((n) => (
        <button key={n.tab} onClick={() => onFix(n.tab)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-100 dark:bg-white/10 dark:text-amber-200">
          {n.label} <FiChevronRight size={12} />
        </button>
      ))}
    </div>
  );
}

const Card = ({ children, className }) => (
  <div className={cx("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5", className)}>{children}</div>
);
const SectionTitle = ({ children }) => (
  <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{children}</h3>
);

// ------------------------------------------------------------------ Teams ---
function TeamsTab({ id, token, teams, auction, defaultPurse, money, onChange }) {
  const squadSize = auction?.settings?.playersPerTeam || 0;
  const includesRetained = auction?.settings?.squadIncludesRetained !== false;
  const blank = { name: "", purse: "", logoUrl: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null); // team id whose retention editor is open
  const [renaming, setRenaming] = useState(null); // team id being renamed
  const [renameVal, setRenameVal] = useState("");
  const startRename = (t) => { setRenaming(t._id); setRenameVal(t.name); };
  const saveRename = async (t) => {
    const nm = renameVal.trim();
    if (!nm || nm === t.name) { setRenaming(null); return; }
    if (teams.some((x) => String(x._id) !== String(t._id) && x.name.toLowerCase() === nm.toLowerCase())) { toast.error("Another team already uses that name."); return; }
    try {
      await auctionService.updateTeam(id, t._id, { name: nm }, token);
      setRenaming(null);
      onChange(await auctionService.get(id, token));
      toast.success("Team renamed.");
    } catch (e) { toast.error(e?.error || "Could not rename the team."); }
  };
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Team name is required.";
    else if (teams.some((t) => t.name.toLowerCase() === form.name.trim().toLowerCase())) e.name = "A team with this name already exists.";
    if (form.purse.trim() && parseMoney(form.purse) <= 0) e.purse = "Enter a valid purse amount.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const add = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    try {
      setBusy(true);
      await auctionService.addTeam(id, {
        name: form.name.trim(),
        logoUrl: form.logoUrl, purse: form.purse ? parseMoney(form.purse) : defaultPurse,
      }, token);
      setForm(blank); setErrors({});
      toast.success(`Team "${form.name.trim()}" added.`);
      onChange(await auctionService.get(id, token));
    } catch (e) { toast.error(e?.error || "Could not add the team."); }
    finally { setBusy(false); }
  };

  const del = async (t) => {
    const ok = await confirmDialog({ title: "Remove team?", message: `Remove "${t.name}" from this auction?`, confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try { await auctionService.deleteTeam(id, t._id, token); toast.success("Team removed."); onChange(await auctionService.get(id, token)); }
    catch (e) { toast.error("Could not remove the team."); }
  };

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle>Add a team</SectionTitle>
        <div className="mb-4"><ImageUpload value={form.logoUrl} onChange={(url) => set("logoUrl", url)} round label="Team logo" hint="Optional · shown on the big screen" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Team name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Colombo Kings" error={!!errors.name} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <Field label="Purse" error={errors.purse} hint={`Leave blank to use the default (${money(defaultPurse)})`}>
            <MoneyInput value={form.purse} onChange={(v) => set("purse", v)} placeholder={groupDigits(defaultPurse)} error={!!errors.purse} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-400">Add the team's owner &amp; managers, retained players and captain from <span className="font-bold text-slate-500 dark:text-slate-300">Manage squad</span> after the team is created.</p>
        <div className="mt-4"><Button icon={FiPlus} loading={busy} onClick={add}>Add team</Button></div>
      </Card>

      {teams.length === 0 ? (
        <EmptyState icon={FiUsers} title="No teams yet" desc="Add the bidding teams above. You need at least 2 to run an auction." />
      ) : (
        <div className="grid gap-3">
          {teams.map((t, i) => {
            const rc = t.retainedCount || 0;
            // "Included" mode: retained fill some of the N slots → buy the rest.
            // "Extra" mode: buy all N; retained add to the squad on top.
            const buys = includesRetained ? Math.max(0, squadSize - rc) : squadSize;
            const total = includesRetained ? squadSize : squadSize + rc;
            return (
            <motion.div key={t._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <ImageUpload compact round value={t.logoUrl}
                    onChange={async (url) => { await auctionService.updateTeam(id, t._id, { logoUrl: url }, token); onChange(await auctionService.get(id, token)); }} />
                  <div className="min-w-0 flex-1">
                    {renaming === t._id ? (
                      <div className="flex items-center gap-1.5">
                        <Input value={renameVal} autoFocus onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRename(t); if (e.key === "Escape") setRenaming(null); }} className="h-8 py-1" />
                        <button onClick={() => saveRename(t)} title="Save" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><FiCheck size={16} /></button>
                        <button onClick={() => setRenaming(null)} title="Cancel" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><FiX size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-black text-slate-900 dark:text-white">{t.name}</span>
                          <button onClick={() => startRename(t)} title="Rename team" className="shrink-0 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"><FiEdit2 size={13} /></button>
                          {t.ownerEmail && <InviteChip status={t.inviteStatus} />}
                        </div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{t.ownerName || "No owner"} {t.ownerEmail ? `· ${t.ownerEmail}` : ""}</div>
                        <div className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          Purse {money(t.remaining ?? t.purse)}{t.retainedCost ? <span className="font-medium text-slate-400"> · {money(t.retainedCost)} retained</span> : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => del(t)} title="Remove team" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiTrash2 size={15} /></button>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {rc > 0 ? (
                      <>Squad: <span className="font-black text-slate-700 dark:text-slate-200">{rc}</span> retained · buys <span className="font-black text-slate-700 dark:text-slate-200">{buys}</span>{squadSize ? <> · total <span className="font-black text-slate-700 dark:text-slate-200">{total}</span></> : null}</>
                    ) : (
                      <>No retained players / managers yet</>
                    )}
                  </div>
                  <button onClick={() => setExpanded(expanded === t._id ? null : t._id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                    {expanded === t._id ? "Close" : "Manage squad"} <FiChevronRight size={12} className={cx("transition", expanded === t._id ? "rotate-90" : "")} />
                  </button>
                </div>
                {expanded === t._id && (
                  <RetentionEditor id={id} token={token} team={t} money={money}
                    onSaved={async () => { onChange(await auctionService.get(id, token)); }} />
                )}
              </div>
            </motion.div>
          );})}
        </div>
      )}
    </div>
  );
}

// Per-team editor for retained players + owner/managers + captain. Retained and
// playing managers fill squad slots; optional prices deduct from the purse. One
// manager can be the OWNER (logs in with an email); one member is the captain.
function RetentionEditor({ id, token, team, money, onSaved }) {
  const [managers, setManagers] = useState(
    (team.managers || []).map((m) => ({ name: m.name || "", plays: !!m.plays, price: groupDigits(m.price || ""), showPrice: !!m.price, photoUrl: m.photoUrl || "", email: m.email || "", isOwner: !!m.isOwner }))
  );
  const [retained, setRetained] = useState(
    (team.retainedPlayers || []).map((p) => ({ name: p.name || "", role: p.role || "", price: groupDigits(p.price || ""), showPrice: !!p.price, photoUrl: p.photoUrl || "" }))
  );
  const [captain, setCaptain] = useState(team.captainName || "");
  const [busy, setBusy] = useState(false);
  const addMgr = () => setManagers((m) => [...m, { name: "", plays: false, price: "", showPrice: false, photoUrl: "", email: "", isOwner: m.length === 0 }]);
  const setMgr = (i, patch) => setManagers((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  // Exactly one owner — set this one, clear the others.
  const setOwner = (i) => setManagers((m) => m.map((row, idx) => ({ ...row, isOwner: idx === i })));
  const delMgr = (i) => setManagers((m) => m.filter((_, idx) => idx !== i));
  const addRow = () => setRetained((r) => [...r, { name: "", role: "", price: "", showPrice: false, photoUrl: "" }]);
  const setRow = (i, patch) => setRetained((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const delRow = (i) => setRetained((r) => r.filter((_, idx) => idx !== i));

  // Everyone who can be captain (named retained players + named managers).
  const captainOptions = [
    ...retained.filter((p) => p.name.trim()).map((p) => p.name.trim()),
    ...managers.filter((m) => m.name.trim()).map((m) => m.name.trim()),
  ];

  const save = async () => {
    try {
      setBusy(true);
      await auctionService.updateTeam(id, team._id, {
        managers: managers
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name.trim(), plays: m.plays, price: parseMoney(m.price), photoUrl: m.photoUrl || "", email: (m.email || "").trim().toLowerCase(), isOwner: !!m.isOwner })),
        retainedPlayers: retained
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), role: p.role.trim(), price: parseMoney(p.price), photoUrl: p.photoUrl || "" })),
        captainName: captain,
      }, token);
      toast.success("Squad updated.");
      onSaved && (await onSaved());
    } catch (e) { toast.error(e?.error || "Could not save the squad."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 space-y-4 rounded-xl bg-slate-50 p-3.5 dark:bg-white/5">
      {/* Retained players */}
      <div>
        <div className="mb-0.5 flex items-center gap-2">
          <FiUser className="text-indigo-500" size={13} />
          <span className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Retained players</span>
        </div>
        <p className="mb-2.5 text-[11px] font-medium text-slate-400">Already in the squad — not put up for bidding.</p>
        <div className="space-y-2.5">
          {retained.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <ImageUpload compact round value={p.photoUrl} onChange={(url) => setRow(i, { photoUrl: url })} />
                <Input className="min-w-0 flex-1" value={p.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Player name" />
                <Select className="min-w-0 flex-1" value={p.role} onChange={(e) => setRow(i, { role: e.target.value })}>
                  <option value="">Role…</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
                <button type="button" onClick={() => delRow(i)} title="Remove player"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiTrash2 size={15} /></button>
              </div>
              <div className="mt-2.5">
                <PriceControl value={p.price} shown={p.showPrice}
                  onAdd={() => setRow(i, { showPrice: true })}
                  onClear={() => setRow(i, { showPrice: false, price: "" })}
                  onChange={(v) => setRow(i, { price: v })} />
              </div>
            </div>
          ))}
          {retained.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs font-medium text-slate-400 dark:border-white/10">No retained players yet.</div>}
        </div>
        <button type="button" onClick={addRow} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-white/15 dark:text-indigo-400 dark:hover:bg-white/5">
          <FiPlus size={14} /> Add retained player
        </button>
      </div>

      {/* Owner & managers — one is the owner (logs in); each may play or not. */}
      <div>
        <div className="mb-0.5 flex items-center gap-2">
          <FiUsers className="text-indigo-500" size={13} />
          <span className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Owner &amp; managers</span>
        </div>
        <p className="mb-2.5 text-[11px] font-medium text-slate-400">The owner logs in with their email. A “playing” manager takes a squad slot; “staff only” doesn’t.</p>
        <div className="space-y-2.5">
          {managers.map((m, i) => (
            <div key={i} className={cx("rounded-xl border bg-white p-3 dark:bg-white/[0.03]", m.isOwner ? "border-indigo-300 dark:border-indigo-500/40" : "border-slate-200 dark:border-white/10")}>
              <div className="flex items-center gap-2">
                <ImageUpload compact round value={m.photoUrl} onChange={(url) => setMgr(i, { photoUrl: url })} />
                <Input className="min-w-0 flex-1" value={m.name} onChange={(e) => setMgr(i, { name: e.target.value })} placeholder="Owner / manager name" />
                <button type="button" onClick={() => delMgr(i)} title="Remove"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiTrash2 size={15} /></button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                <PlaySegment plays={m.plays} onChange={(v) => setMgr(i, { plays: v })} />
                <PriceControl value={m.price} shown={m.showPrice}
                  onAdd={() => setMgr(i, { showPrice: true })}
                  onClear={() => setMgr(i, { showPrice: false, price: "" })}
                  onChange={(v) => setMgr(i, { price: v })} />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => (m.isOwner ? setMgr(i, { isOwner: false }) : setOwner(i))}
                  className={cx("inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-black transition",
                    m.isOwner ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                              : "border-slate-200 text-slate-500 hover:border-indigo-300 dark:border-white/10 dark:text-slate-400")}>
                  <FiStar size={13} className={m.isOwner ? "fill-current" : ""} /> {m.isOwner ? "Owner (logs in)" : "Make owner"}
                </button>
                {m.isOwner && (
                  <Input className="min-w-0 flex-1" type="email" value={m.email} onChange={(e) => setMgr(i, { email: e.target.value })} placeholder="owner@email.com — login email" />
                )}
              </div>
            </div>
          ))}
          {managers.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs font-medium text-slate-400 dark:border-white/10">No owner/managers yet.</div>}
        </div>
        <button type="button" onClick={addMgr} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-white/15 dark:text-indigo-400 dark:hover:bg-white/5">
          <FiPlus size={14} /> Add owner / manager
        </button>
      </div>

      {/* Captain — one per team, chosen from retained players + managers. */}
      <div>
        <div className="mb-0.5 flex items-center gap-2">
          <FiAward className="text-indigo-500" size={13} />
          <span className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Team captain</span>
        </div>
        <p className="mb-2.5 text-[11px] font-medium text-slate-400">One captain per team — pick from the retained players &amp; managers above.</p>
        <Select className="sm:max-w-xs" value={captainOptions.includes(captain) ? captain : ""} onChange={(e) => setCaptain(e.target.value)}>
          <option value="">No captain</option>
          {captainOptions.map((n, idx) => <option key={`${n}-${idx}`} value={n}>{n}</option>)}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
        <Button icon={FiCheck} loading={busy} onClick={save}>Save squad</Button>
        <span className="text-xs font-medium text-slate-400">Price is optional — add it only for paid retentions/managers (deducted from purse).</span>
      </div>
    </div>
  );
}

// Clear two-option control for whether a manager plays. Much more readable than
// a single ✓/✗ toggle — the active choice is filled and labelled in full.
function PlaySegment({ plays, onChange }) {
  const base = "rounded-md px-3 py-1.5 text-xs font-bold transition";
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/5">
      <button type="button" onClick={() => onChange(true)}
        className={cx(base, plays ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white")}>
        Plays for the team
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={cx(base, !plays ? "bg-slate-700 text-white shadow-sm dark:bg-white/20" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white")}>
        Staff only
      </button>
    </div>
  );
}

// Optional price: shows a compact "Add price" button until clicked, then the
// money field (with an × to drop the price again). Keeps rows clean when most
// retentions are free.
function PriceControl({ value, shown, onAdd, onClear, onChange }) {
  if (!shown) {
    return (
      <button type="button" onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-white/15 dark:text-slate-400 dark:hover:text-indigo-300">
        <FiPlus size={12} /> Add price
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      <MoneyInput className="w-40" value={value} onChange={onChange} placeholder="Price" autoFocus />
      <button type="button" onClick={onClear} title="Remove price"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiX size={14} /></button>
    </div>
  );
}

// The next player ID this auction will use (mirrors the server: max numeric
// code + 1). Shown pre-filled in the add form so the organiser sees the ID
// before adding — and can override it.
function computeNextCode(players) {
  let max = 0;
  (players || []).forEach((p) => {
    const n = parseInt(String(p.code ?? "").trim(), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  });
  return String(max + 1);
}

// ---------------------------------------------------------------- Players ---
function PlayersTab({ id, token, players, money, onChange }) {
  const blank = { name: "", code: "", role: "", category: "", basePrice: "", photoUrl: "", isOverseas: false };
  const [form, setForm] = useState(blank);
  const [codeTouched, setCodeTouched] = useState(false); // did the user override the ID?
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const nextCode = useMemo(() => computeNextCode(players), [players]);
  const shownCode = codeTouched ? form.code : nextCode; // pre-filled ID, editable

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Player name is required.";
    if (form.basePrice.trim() && parseMoney(form.basePrice) <= 0) e.basePrice = "Enter a valid base price (e.g. 500,000).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const add = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    try {
      setBusy(true);
      await auctionService.addPlayer(id, {
        // Only send an explicit ID if the user overrode it; otherwise let the
        // server auto-assign (== the pre-filled next ID they saw).
        name: form.name.trim(), code: codeTouched ? form.code.trim() : "", role: form.role.trim(), category: form.category.trim(),
        basePrice: parseMoney(form.basePrice), photoUrl: form.photoUrl.trim(), isOverseas: form.isOverseas,
      }, token);
      setForm(blank); setErrors({}); setCodeTouched(false);
      toast.success(`Player "${form.name.trim()}" added.`);
      onChange(await auctionService.get(id, token));
    } catch (e) { toast.error(e?.error || "Could not add the player."); }
    finally { setBusy(false); }
  };

  const parsedBulk = useMemo(() => bulk.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, basePrice, role, category] = line.split(",").map((x) => (x || "").trim());
    return { name, basePrice: parseMoney(basePrice), role, category };
  }).filter((r) => r.name), [bulk]);

  const importBulk = async () => {
    if (!parsedBulk.length) { toast.error("Add at least one valid line (Name, BasePrice, Role, Grade)."); return; }
    try {
      setBulkBusy(true);
      await auctionService.addPlayersBulk(id, parsedBulk, token);
      toast.success(`${parsedBulk.length} player${parsedBulk.length > 1 ? "s" : ""} imported.`);
      setBulk(""); setShowBulk(false);
      onChange(await auctionService.get(id, token));
    } catch (e) { toast.error(e?.error || "Bulk import failed."); }
    finally { setBulkBusy(false); }
  };

  // Download a ready-to-fill Excel template (headers + a couple of example rows).
  const downloadTemplate = () => {
    const example = [
      { ID: 1, Name: "Kusal Mendis", "Base Price": 500000, Role: "Batsman", Category: "A", Overseas: "No" },
      { ID: 2, Name: "Wanindu Hasaranga", "Base Price": 1000000, Role: "All-rounder", Category: "Marquee", Overseas: "No" },
    ];
    const ws = XLSX.utils.json_to_sheet(example, { header: ["ID", "Name", "Base Price", "Role", "Category", "Overseas"] });
    ws["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    XLSX.writeFile(wb, "criczone-players-template.xlsx");
  };

  // Read an uploaded .xlsx/.csv, map its rows to players and bulk-import them.
  const importExcel = async (file) => {
    if (!file) return;
    try {
      setBulkBusy(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const players = json.map((row) => {
        const r = {};
        Object.keys(row).forEach((k) => { r[String(k).trim().toLowerCase()] = row[k]; });
        return {
          code: String(r.id ?? r["player id"] ?? r.code ?? r["#"] ?? "").trim(),
          name: String(r.name || r["player name"] || r.player || "").trim(),
          basePrice: parseMoney(r["base price"] ?? r.baseprice ?? r.base ?? r.price ?? 0),
          role: String(r.role || "").trim(),
          category: String(r.category || r.grade || "").trim(),
          isOverseas: /^(y|yes|true|1|overseas)$/i.test(String(r.overseas ?? r.isoverseas ?? "").trim()),
        };
      }).filter((p) => p.name);
      if (!players.length) { toast.error("No valid rows found. Use the template's columns (ID, Name, Base Price, Role, Category, Overseas)."); return; }
      await auctionService.addPlayersBulk(id, players, token);
      toast.success(`${players.length} player${players.length > 1 ? "s" : ""} imported from Excel.`);
      setShowBulk(false);
      onChange(await auctionService.get(id, token));
    } catch (e) {
      toast.error(e?.error || "Could not read that file. Use the downloaded template format.");
    } finally { setBulkBusy(false); }
  };

  const del = async (p) => {
    const ok = await confirmDialog({ title: "Remove player?", message: `Remove "${p.name}" from the pool?`, confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try { await auctionService.deletePlayer(id, p._id, token); toast.success("Player removed."); onChange(await auctionService.get(id, token)); }
    catch (e) { toast.error("Could not remove the player."); }
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Add a player</SectionTitle>
          <button onClick={() => setShowBulk((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
            <FiUploadCloud size={14} /> Bulk import
          </button>
        </div>

        <div className="mb-4"><ImageUpload value={form.photoUrl} onChange={(url) => set("photoUrl", url)} round label="Player photo" hint="Optional · shown when the player is on the block" /></div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Player ID" hint="Auto-generated · edit to change">
            <Input value={shownCode} onChange={(e) => { setCodeTouched(true); setForm((f) => ({ ...f, code: e.target.value })); }} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <Field label="Player name" required error={errors.name} className="lg:col-span-1">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kusal Mendis" error={!!errors.name} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <Field label="Role" hint="Optional">
            <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="">Select role…</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Grade / category" hint="Optional">
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. A / Marquee" />
          </Field>
          <Field label="Base price" error={errors.basePrice} hint="e.g. 500,000">
            <MoneyInput value={form.basePrice} onChange={(v) => set("basePrice", v)} placeholder="500,000" error={!!errors.basePrice} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <div className="flex items-end pb-1 sm:col-span-2 lg:col-span-1">
            <Toggle checked={form.isOverseas} onChange={(v) => set("isOverseas", v)} label="Overseas player" />
          </div>
        </div>
        <div className="mt-4"><Button icon={FiPlus} loading={busy} onClick={add}>Add player</Button></div>

        {showBulk && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 border-t border-slate-100 pt-5 dark:border-white/10">
            {/* Excel import */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="text-sm font-black text-slate-700 dark:text-slate-200">Import from Excel</div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Download the template, fill in your players, then upload the file. Columns: <span className="font-bold">ID, Name, Base Price, Role, Category, Overseas</span>. Leave ID blank to auto-number.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Button variant="soft" icon={FiDownload} onClick={downloadTemplate}>Download template</Button>
                <label className={cx("inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700", bulkBusy && "cursor-not-allowed opacity-60")}>
                  {bulkBusy ? <Spinner size={16} /> : <FiFile size={16} />} Upload Excel
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={bulkBusy}
                    onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; importExcel(f); }} />
                </label>
              </div>
            </div>

            {/* Paste alternative */}
            <div className="mt-4">
              <Field label="Or paste a list" hint="One player per line — Name, BasePrice, Role, Grade">
                <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder={"Kusal Mendis, 1500000, Batsman, A\nWanindu Hasaranga, 1500000, Bowler, A"} />
              </Field>
              <div className="mt-3 flex items-center gap-3">
                <Button variant="dark" icon={FiUploadCloud} loading={bulkBusy} onClick={importBulk}>Import {parsedBulk.length || ""} players</Button>
                {bulk.trim() && <span className="text-xs font-bold text-slate-400">{parsedBulk.length} valid line{parsedBulk.length === 1 ? "" : "s"} detected</span>}
              </div>
            </div>
          </motion.div>
        )}
      </Card>

      {players.length === 0 ? (
        <EmptyState icon={FiUser} title="No players yet" desc="Add players one by one above, or use bulk import to paste a whole list." />
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 py-3">
            <SectionTitle>Player pool ({players.length})</SectionTitle>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {players.map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-5 py-3">
                <PlayerIdInput id={id} token={token} player={p} onChange={onChange} />
                <ImageUpload compact round value={p.photoUrl}
                  onChange={async (url) => { await auctionService.updatePlayer(id, p._id, { photoUrl: url }, token); onChange(await auctionService.get(id, token)); }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <span className="truncate">{p.name}</span>
                    {p.isOverseas && <FiGlobe size={13} className="shrink-0 text-sky-500" title="Overseas" />}
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{[p.role, p.category].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className="hidden text-sm font-bold text-slate-700 dark:text-slate-200 sm:block">{money(p.basePrice)}</div>
                <StatusChip status={p.status} />
                <button onClick={() => del(p)} title="Remove player" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiTrash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// Inline-editable player ID shown at the start of each pool row. Saves on blur
// or Enter; reverts on error (e.g. duplicate ID).
function PlayerIdInput({ id, token, player, onChange }) {
  const [val, setVal] = useState(player.code || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(player.code || ""); }, [player.code]);
  const save = async () => {
    const next = val.trim();
    if (next === (player.code || "")) { setVal(next); return; }
    if (!next) { setVal(player.code || ""); return; }
    try {
      setSaving(true);
      await auctionService.updatePlayer(id, player._id, { code: next }, token);
      onChange(await auctionService.get(id, token));
      toast.success("Player ID updated.");
    } catch (e) {
      toast.error(e?.error || "Could not update the ID.");
      setVal(player.code || "");
    } finally { setSaving(false); }
  };
  return (
    <input value={val} disabled={saving} onChange={(e) => setVal(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      title="Player ID — click to edit"
      className="w-12 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1 text-center text-xs font-black text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-indigo-500/20" />
  );
}

// --------------------------------------------------------------- Settings ---
// Split the stored incrementTiers into the bounded rows (each with an "up to")
// and the single final "and above" step (the tier whose upTo is null).
function splitTiers(incrementTiers) {
  const list = Array.isArray(incrementTiers) && incrementTiers.length
    ? incrementTiers
    : [{ upTo: null, step: 500000 }];
  const bounded = list.filter((t) => t.upTo != null).map((t) => ({ step: groupDigits(t.step), upTo: groupDigits(t.upTo) }));
  const above = list.find((t) => t.upTo == null) || list[list.length - 1];
  return { bounded, aboveStep: groupDigits(above?.step || 500000) };
}

function SettingsTab({ id, token, auction, money, onChange }) {
  const s = auction.settings;
  const initTiers = splitTiers(s.incrementTiers);
  const [f, setF] = useState({
    currencyCode: auctionCurrencyCode(auction),
    defaultPurse: groupDigits(s.defaultPurse),
    minSquadSize: s.minSquadSize || 0,
    maxSquadSize: s.maxSquadSize || 25,
    enforceMaxBid: s.enforceMaxBid,
    squadIncludesRetained: s.squadIncludesRetained !== false,
    biddingMode: s.biddingMode || "manual",
  });
  // Tiered bid increments: `tiers` are bounded rows ("+step up to limit"),
  // `aboveStep` is the raise once the bid passes the last limit.
  const [tiers, setTiers] = useState(initTiers.bounded);
  const [aboveStep, setAboveStep] = useState(initTiers.aboveStep);
  const [errors, setErrors] = useState({});
  const [tierError, setTierError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const setTier = (i, k, v) => { setTiers((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r))); setTierError(""); };
  const addTier = () => setTiers((rows) => [...rows, { step: "", upTo: "" }]);
  const removeTier = (i) => setTiers((rows) => rows.filter((_, idx) => idx !== i));

  const validate = () => {
    const e = {};
    if (parseMoney(f.defaultPurse) <= 0) e.defaultPurse = "Enter a valid purse (e.g. 10,000,000).";
    const min = Number(f.minSquadSize) || 0, max = Number(f.maxSquadSize) || 0;
    if (max <= 0) e.maxSquadSize = "Max squad size must be at least 1.";
    else if (min > max) e.maxSquadSize = "Max must be greater than or equal to min.";
    // Tiers: every bounded row needs a positive step + limit, limits must
    // increase, and the final "and above" step must be positive.
    let te = "";
    let prev = 0;
    for (let i = 0; i < tiers.length; i++) {
      const step = parseMoney(tiers[i].step), upTo = parseMoney(tiers[i].upTo);
      if (step <= 0) { te = `Tier ${i + 1}: enter an increment.`; break; }
      if (upTo <= 0) { te = `Tier ${i + 1}: enter the "up to" limit.`; break; }
      if (upTo <= prev) { te = `Tier ${i + 1}: each "up to" limit must be higher than the one above.`; break; }
      prev = upTo;
    }
    if (!te && parseMoney(aboveStep) <= 0) te = "Enter the increment for amounts above the last limit.";
    setTierError(te);
    setErrors(e);
    return Object.keys(e).length === 0 && !te;
  };

  const save = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    try {
      setBusy(true);
      const incrementTiers = [
        ...tiers
          .map((t) => ({ upTo: parseMoney(t.upTo), step: parseMoney(t.step) }))
          .sort((a, b) => a.upTo - b.upTo),
        { upTo: null, step: parseMoney(aboveStep) },
      ];
      await auctionService.update(id, {
        currencyCode: f.currencyCode,
        settings: {
          defaultPurse: parseMoney(f.defaultPurse), incrementTiers,
          minSquadSize: Number(f.minSquadSize) || 0, maxSquadSize: Number(f.maxSquadSize) || 25,
          enforceMaxBid: !!f.enforceMaxBid, squadIncludesRetained: !!f.squadIncludesRetained, biddingMode: f.biddingMode,
        },
      }, token);
      toast.success("Settings saved.");
      onChange(await auctionService.get(id, token));
    } catch (e) { toast.error(e?.error || "Could not save settings."); }
    finally { setBusy(false); }
  };

  const modes = [
    { key: "manual", title: "Manual (real event)", desc: "You mark each bid on the control panel as owners bid in the room." },
    { key: "online", title: "Online (owners bid)", desc: "Owners place bids from their own devices; you confirm the sale." },
  ];

  return (
    <div className="max-w-4xl space-y-5">
      {/* Import to app — scan/share this to pull the auction's teams & players
          into a tournament in the CricZone mobile app (usually after the auction). */}
      <Card>
        <SectionTitle>Import to app</SectionTitle>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="shrink-0 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
            <QRCodeSVG value={typeof window !== "undefined" ? `${window.location.origin}/auction/screen/${auction.shareId}` : auction.shareId} size={116} level="M" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              In the CricZone app, create a tournament → <span className="font-bold">Import from Auction</span> → scan this QR (or paste the code) to auto-fill teams, logos &amp; squads. Best used after the auction finishes.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{auction.shareId}</span>
              <Button variant="soft" onClick={() => { navigator.clipboard?.writeText(auction.shareId); toast.success("Share code copied"); }}>Copy code</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Bidding mode</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((m) => {
            const active = f.biddingMode === m.key;
            return (
              <button key={m.key} type="button" onClick={() => set("biddingMode", m.key)}
                className={cx("relative rounded-2xl border-2 p-4 text-left transition", active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20")}>
                {active && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-white"><FiCheck size={12} /></span>}
                <div className={cx("text-sm font-black", active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100")}>{m.title}</div>
                <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{m.desc}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Currency & purse</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auction currency" hint="Amounts across the auction use this currency">
            <Select value={f.currencyCode} onChange={(e) => set("currencyCode", e.target.value)}>
              {Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Default purse per team" required error={errors.defaultPurse} hint="Used when a team's purse is left blank">
            <MoneyInput value={f.defaultPurse} onChange={(v) => set("defaultPurse", v)} placeholder="10,000,000" error={!!errors.defaultPurse} />
          </Field>
        </div>
      </Card>

      {/* Tiered bid increments — raise the step as the bid climbs. */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <FiTrendingUp className="text-indigo-500" size={16} />
          <SectionTitle>Bid increments</SectionTitle>
        </div>
        <p className="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          Set how much each raise adds. Add tiers so the step grows as the price climbs — e.g. +10,000 up to 100,000, then +20,000 up to 500,000, then +30,000 above.
        </p>
        <div className="space-y-2.5">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={i === 0 ? "Increment" : ""} className="flex-1">
                <MoneyInput value={t.step} onChange={(v) => setTier(i, "step", v)} placeholder="10,000" />
              </Field>
              <span className="pb-3 text-xs font-bold text-slate-400">up to</span>
              <Field label={i === 0 ? "Bid reaches" : ""} className="flex-1">
                <MoneyInput value={t.upTo} onChange={(v) => setTier(i, "upTo", v)} placeholder="100,000" />
              </Field>
              <button type="button" onClick={() => removeTier(i)} title="Remove tier"
                className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                <FiTrash2 size={15} />
              </button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Field label={tiers.length === 0 ? "Increment" : ""} className="flex-1">
              <MoneyInput value={aboveStep} onChange={(v) => { setAboveStep(v); setTierError(""); }} placeholder="30,000" />
            </Field>
            <span className="pb-3 text-xs font-bold text-slate-400">and above</span>
            <div className="flex-1" />
            <div className="mb-1 h-9 w-9 shrink-0" />
          </div>
        </div>
        {tierError && <p className="mt-2 text-xs font-semibold text-red-500">{tierError}</p>}
        <button type="button" onClick={addTier} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
          <FiPlus size={14} /> Add tier
        </button>
      </Card>

      <Card>
        <SectionTitle>Squad rules</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Min squad size" error={errors.minSquadSize}>
            <Input type="number" min="0" value={f.minSquadSize} onChange={(e) => set("minSquadSize", e.target.value)} placeholder="0" />
          </Field>
          <Field label="Max squad size" required error={errors.maxSquadSize}>
            <Input type="number" min="1" value={f.maxSquadSize} onChange={(e) => set("maxSquadSize", e.target.value)} placeholder="25" error={!!errors.maxSquadSize} />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <Toggle checked={f.enforceMaxBid} onChange={(v) => set("enforceMaxBid", v)}
              label="Protect minimum squad" desc="Stop a team bidding beyond what it needs to still fill its minimum squad." />
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <Toggle checked={f.squadIncludesRetained} onChange={(v) => set("squadIncludesRetained", v)}
              label="Players-per-team includes retained / managers" desc="On: retained members count within the number, so the team buys fewer. Off: they're extra on top of the number bought." />
          </div>
        </div>
      </Card>

      <Button icon={FiCheck} loading={busy} onClick={save}>Save settings</Button>
    </div>
  );
}

const InviteChip = ({ status }) => {
  const map = {
    pending: { cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", label: "Invite sent" },
    accepted: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300", label: "Joined" },
    rejected: { cls: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300", label: "Declined" },
  };
  const m = map[status];
  if (!m) return null;
  return <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase", m.cls)}>{m.label}</span>;
};

const StatusChip = ({ status }) => {
  const map = {
    pending: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300",
    current: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    sold: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    unsold: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300",
  };
  return <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase", map[status] || map.pending)}>{status}</span>;
};
