import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiUsers, FiUser, FiSettings, FiPlus, FiTrash2, FiLink, FiZap, FiChevronRight,
  FiUploadCloud, FiGlobe, FiCheck, FiInfo,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import { formatMoney, parseMoney, CURRENCIES, auctionCurrencyCode } from "../../utils/auctionFormat";
import ImageUpload from "../../components/auction/ImageUpload";
import AuctionShell from "./AuctionShell.jsx";
import {
  Button, Field, Input, Textarea, Select, Toggle, EmptyState, Spinner, toast, confirmDialog, isEmail, cx,
} from "../../components/auction/ui.jsx";

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

        {tab === "Teams" && <TeamsTab id={id} token={user.token} teams={teams} defaultPurse={auction.settings.defaultPurse} money={money} onChange={setState} />}
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
function TeamsTab({ id, token, teams, defaultPurse, money, onChange }) {
  const blank = { name: "", ownerName: "", ownerEmail: "", purse: "", logoUrl: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Team name is required.";
    else if (teams.some((t) => t.name.toLowerCase() === form.name.trim().toLowerCase())) e.name = "A team with this name already exists.";
    if (form.ownerEmail.trim() && !isEmail(form.ownerEmail)) e.ownerEmail = "Enter a valid email address.";
    if (form.purse.trim() && parseMoney(form.purse) <= 0) e.purse = "Enter a valid purse amount.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const add = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    try {
      setBusy(true);
      await auctionService.addTeam(id, {
        name: form.name.trim(), ownerName: form.ownerName.trim(), ownerEmail: form.ownerEmail.trim().toLowerCase(),
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
          <Field label="Owner name" hint="Optional">
            <Input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="e.g. Kamal Perera" />
          </Field>
          <Field label="Owner email (login)" error={errors.ownerEmail} hint="Owners log in with this to follow their team">
            <Input type="email" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} placeholder="owner@email.com" error={!!errors.ownerEmail} />
          </Field>
          <Field label="Purse" error={errors.purse} hint={`Leave blank to use the default (${money(defaultPurse)})`}>
            <Input value={form.purse} onChange={(e) => set("purse", e.target.value)} placeholder={money(defaultPurse)} error={!!errors.purse} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
        </div>
        <div className="mt-4"><Button icon={FiPlus} loading={busy} onClick={add}>Add team</Button></div>
      </Card>

      {teams.length === 0 ? (
        <EmptyState icon={FiUsers} title="No teams yet" desc="Add the bidding teams above. You need at least 2 to run an auction." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t, i) => (
            <motion.div key={t._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex min-w-0 items-center gap-3">
                {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">{t.name[0]}</div>}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-black text-slate-900 dark:text-white">{t.name}</span>
                    {t.ownerEmail && <InviteChip status={t.inviteStatus} />}
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{t.ownerName || "No owner"} {t.ownerEmail ? `· ${t.ownerEmail}` : ""}</div>
                  <div className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">Purse {money(t.purse)}</div>
                </div>
              </div>
              <button onClick={() => del(t)} title="Remove team" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiTrash2 size={15} /></button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Players ---
function PlayersTab({ id, token, players, money, onChange }) {
  const blank = { name: "", role: "", category: "", basePrice: "", photoUrl: "", isOverseas: false };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

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
        name: form.name.trim(), role: form.role.trim(), category: form.category.trim(),
        basePrice: parseMoney(form.basePrice), photoUrl: form.photoUrl.trim(), isOverseas: form.isOverseas,
      }, token);
      setForm(blank); setErrors({});
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
            <Input value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} placeholder="500,000" error={!!errors.basePrice} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <div className="flex items-end pb-1 sm:col-span-2 lg:col-span-1">
            <Toggle checked={form.isOverseas} onChange={(v) => set("isOverseas", v)} label="Overseas player" />
          </div>
        </div>
        <div className="mt-4"><Button icon={FiPlus} loading={busy} onClick={add}>Add player</Button></div>

        {showBulk && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 border-t border-slate-100 pt-5 dark:border-white/10">
            <Field label="Bulk import" hint="One player per line — Name, BasePrice, Role, Grade">
              <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder={"Kusal Mendis, 1500000, Batsman, A\nWanindu Hasaranga, 1500000, Bowler, A"} />
            </Field>
            <div className="mt-3 flex items-center gap-3">
              <Button variant="dark" icon={FiUploadCloud} loading={bulkBusy} onClick={importBulk}>Import {parsedBulk.length || ""} players</Button>
              {bulk.trim() && <span className="text-xs font-bold text-slate-400">{parsedBulk.length} valid line{parsedBulk.length === 1 ? "" : "s"} detected</span>}
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
            {players.map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
                {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{p.name[0]}</div>}
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

// --------------------------------------------------------------- Settings ---
function SettingsTab({ id, token, auction, money, onChange }) {
  const s = auction.settings;
  const [f, setF] = useState({
    currencyCode: auctionCurrencyCode(auction),
    defaultPurse: money(s.defaultPurse),
    tier1Step: money(s.incrementTiers?.[0]?.step || 500000),
    tier1UpTo: s.incrementTiers?.[0]?.upTo ? money(s.incrementTiers[0].upTo) : "",
    tier2Step: money(s.incrementTiers?.[1]?.step || 1000000),
    minSquadSize: s.minSquadSize || 0,
    maxSquadSize: s.maxSquadSize || 25,
    enforceMaxBid: s.enforceMaxBid,
    biddingMode: s.biddingMode || "manual",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e = {};
    if (parseMoney(f.defaultPurse) <= 0) e.defaultPurse = "Enter a valid purse (e.g. 10,000,000).";
    if (parseMoney(f.tier1Step) <= 0) e.tier1Step = "Enter a valid increment.";
    if (parseMoney(f.tier2Step) <= 0) e.tier2Step = "Enter a valid increment.";
    const min = Number(f.minSquadSize) || 0, max = Number(f.maxSquadSize) || 0;
    if (max <= 0) e.maxSquadSize = "Max squad size must be at least 1.";
    else if (min > max) e.maxSquadSize = "Max must be greater than or equal to min.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    try {
      setBusy(true);
      const tiers = [
        { upTo: f.tier1UpTo ? parseMoney(f.tier1UpTo) : null, step: parseMoney(f.tier1Step) },
        { upTo: null, step: parseMoney(f.tier2Step) },
      ];
      await auctionService.update(id, {
        currencyCode: f.currencyCode,
        settings: {
          defaultPurse: parseMoney(f.defaultPurse), incrementTiers: tiers,
          minSquadSize: Number(f.minSquadSize) || 0, maxSquadSize: Number(f.maxSquadSize) || 25,
          enforceMaxBid: !!f.enforceMaxBid, biddingMode: f.biddingMode,
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
    <div className="max-w-2xl space-y-5">
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
        <SectionTitle>Currency</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auction currency" hint="Amounts across the auction use this currency">
            <Select value={f.currencyCode} onChange={(e) => set("currencyCode", e.target.value)}>
              {Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Purse & bidding</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default purse per team" required error={errors.defaultPurse} hint="Used when a team's purse is left blank">
            <Input value={f.defaultPurse} onChange={(e) => set("defaultPurse", e.target.value)} placeholder="10,000,000" error={!!errors.defaultPurse} />
          </Field>
          <div />
          <Field label="Increment (below…)" required error={errors.tier1Step}>
            <Input value={f.tier1Step} onChange={(e) => set("tier1Step", e.target.value)} placeholder="250,000" error={!!errors.tier1Step} />
          </Field>
          <Field label="…up to" hint="Bids below this use the first increment">
            <Input value={f.tier1UpTo} onChange={(e) => set("tier1UpTo", e.target.value)} placeholder="5,000,000" />
          </Field>
          <Field label="Increment (above that)" required error={errors.tier2Step}>
            <Input value={f.tier2Step} onChange={(e) => set("tier2Step", e.target.value)} placeholder="500,000" error={!!errors.tier2Step} />
          </Field>
        </div>
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
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
          <Toggle checked={f.enforceMaxBid} onChange={(v) => set("enforceMaxBid", v)}
            label="Protect minimum squad" desc="Stop a team bidding beyond what it needs to still fill its minimum squad." />
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
