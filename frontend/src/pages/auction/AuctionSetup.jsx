import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import { formatMoney, parseMoney } from "../../utils/auctionFormat";
import ImageUpload from "../../components/auction/ImageUpload";
import AuctionShell from "./AuctionShell.jsx";

const TABS = ["Teams", "Players", "Settings"];

export default function AuctionSetup() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState("Teams");
  const [state, setState] = useState(null); // { auction, teams, players }
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setState(await auctionService.get(id, user.token)); }
    catch (e) { setState(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user?.token) load(); /* eslint-disable-next-line */ }, [id, user?.token]);

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;
  if (!state) return <div className="grid min-h-screen place-items-center text-slate-400">Auction not found.</div>;

  const { auction, teams, players } = state;
  const money = (n) => formatMoney(n, { symbol: auction.currencySymbol, format: auction.currencyFormat });

  const goLive = (
    <button onClick={() => navigate(`/auctions/${id}/live`)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700">Go Live →</button>
  );

  return (
    <AuctionShell active="setup" auctionId={id} auctionName={auction.name} shareId={auction.shareId} title={auction.name} status={auction.status} right={goLive}>
      <div className="max-w-5xl">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}>
              {t}
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

// ------------------------------------------------------------------ Teams ---
function TeamsTab({ id, token, teams, defaultPurse, money, onChange }) {
  const [form, setForm] = useState({ name: "", ownerName: "", ownerEmail: "", purse: "", logoUrl: "" });
  const add = async () => {
    if (!form.name.trim()) return;
    await auctionService.addTeam(id, {
      name: form.name.trim(), ownerName: form.ownerName.trim(), ownerEmail: form.ownerEmail.trim(),
      logoUrl: form.logoUrl, purse: form.purse ? parseMoney(form.purse) : defaultPurse,
    }, token);
    setForm({ name: "", ownerName: "", ownerEmail: "", purse: "", logoUrl: "" });
    onChange(await auctionService.get(id, token));
  };
  const del = async (tid) => { await auctionService.deleteTeam(id, tid, token); onChange(await auctionService.get(id, token)); };

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-4">
        <div className="mb-2"><ImageUpload value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} round label="Team logo" /></div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Team name" className="rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Owner name" className="rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          <input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="Owner email (login)" className="rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          <div className="flex gap-2">
            <input value={form.purse} onChange={(e) => setForm({ ...form, purse: e.target.value })} placeholder={`Purse (${money(defaultPurse)})`} className="w-full rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            <button onClick={add} className="rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white">Add</button>
          </div>
        </div>
      </div>
      {teams.length === 0 ? <Empty text="No teams yet — add the bidding teams above." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <div key={t._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-4">
              <div className="flex items-center gap-3">
                {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">{t.name[0]}</div>}
                <div>
                <div className="font-black text-slate-900 dark:text-white">{t.name}</div>
                <div className="text-xs text-slate-500">{t.ownerName || "—"} {t.ownerEmail ? `· ${t.ownerEmail}` : ""}</div>
                <div className="mt-1 text-sm font-bold text-emerald-600">Purse {money(t.purse)}</div>
                </div>
              </div>
              <button onClick={() => del(t._id)} className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Players ---
function PlayersTab({ id, token, players, money, onChange }) {
  const [form, setForm] = useState({ name: "", role: "", category: "", basePrice: "", photoUrl: "", isOverseas: false });
  const [bulk, setBulk] = useState("");
  const add = async () => {
    if (!form.name.trim()) return;
    await auctionService.addPlayer(id, {
      name: form.name.trim(), role: form.role.trim(), category: form.category.trim(),
      basePrice: parseMoney(form.basePrice), photoUrl: form.photoUrl.trim(), isOverseas: form.isOverseas,
    }, token);
    setForm({ name: "", role: "", category: "", basePrice: "", photoUrl: "", isOverseas: false });
    onChange(await auctionService.get(id, token));
  };
  const importBulk = async () => {
    // Each line: Name, BasePrice, Role, Category
    const rows = bulk.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [name, basePrice, role, category] = line.split(",").map((x) => (x || "").trim());
      return { name, basePrice: parseMoney(basePrice), role, category };
    }).filter((r) => r.name);
    if (!rows.length) return;
    await auctionService.addPlayersBulk(id, rows, token);
    setBulk("");
    onChange(await auctionService.get(id, token));
  };
  const del = async (pid) => { await auctionService.deletePlayer(id, pid, token); onChange(await auctionService.get(id, token)); };

  return (
    <div>
      <div className="mb-3 grid gap-2 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-4 sm:grid-cols-6">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Player name" className="sm:col-span-2 rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role" className="rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Grade" className="rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <input value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} placeholder="Base (20 L)" className="rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        <button onClick={add} className="rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white">Add</button>
        <div className="flex items-center gap-6 sm:col-span-6">
          <ImageUpload value={form.photoUrl} onChange={(url) => setForm({ ...form, photoUrl: url })} round label="Player photo" />
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={form.isOverseas} onChange={(e) => setForm({ ...form, isOverseas: e.target.checked })} /> Overseas</label>
        </div>
      </div>

      <details className="mb-4 rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-700">Bulk import (one player per line: Name, BasePrice, Role, Grade)</summary>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder={"Virat Kohli, 2Cr, Batsman, A\nJasprit Bumrah, 2Cr, Bowler, A"} className="mt-2 w-full rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 p-3 text-sm outline-none focus:border-indigo-500" />
        <button onClick={importBulk} className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Import players</button>
      </details>

      {players.length === 0 ? <Empty text="No players yet — add them above or bulk import." /> : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
          {players.map((p, i) => (
            <div key={p._id} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-slate-100 dark:border-white/10" : ""}`}>
              <span className="w-6 text-xs font-bold text-slate-400">{i + 1}</span>
              {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-500 dark:bg-white/10">{p.name[0]}</div>}
              <div className="flex-1">
                <div className="font-bold text-slate-900 dark:text-white">{p.name} {p.isOverseas && <span className="text-[10px] text-sky-500">✈</span>}</div>
                <div className="text-xs text-slate-500">{[p.role, p.category].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="text-sm font-bold text-slate-700">{money(p.basePrice)}</div>
              <StatusChip status={p.status} />
              <button onClick={() => del(p._id)} className="rounded px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- Settings ---
function SettingsTab({ id, token, auction, money, onChange }) {
  const s = auction.settings;
  const [f, setF] = useState({
    defaultPurse: money(s.defaultPurse),
    tier1Step: money(s.incrementTiers?.[0]?.step || 500000),
    tier1UpTo: s.incrementTiers?.[0]?.upTo ? money(s.incrementTiers[0].upTo) : "",
    tier2Step: money(s.incrementTiers?.[1]?.step || 1000000),
    minSquadSize: s.minSquadSize || 0,
    maxSquadSize: s.maxSquadSize || 25,
    enforceMaxBid: s.enforceMaxBid,
  });
  const [saved, setSaved] = useState(false);
  const save = async () => {
    const tiers = [
      { upTo: f.tier1UpTo ? parseMoney(f.tier1UpTo) : null, step: parseMoney(f.tier1Step) },
      { upTo: null, step: parseMoney(f.tier2Step) },
    ];
    await auctionService.update(id, { settings: {
      defaultPurse: parseMoney(f.defaultPurse), incrementTiers: tiers,
      minSquadSize: Number(f.minSquadSize) || 0, maxSquadSize: Number(f.maxSquadSize) || 25,
      enforceMaxBid: !!f.enforceMaxBid,
    } }, token);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
    onChange(await auctionService.get(id, token));
  };
  const Field = ({ label, k, placeholder }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder}
        className="w-full rounded-lg border-2 border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder-slate-400 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
    </label>
  );

  return (
    <div className="max-w-lg rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default purse per team" k="defaultPurse" placeholder="1 Cr" />
        <div />
        <Field label="Increment (below…)" k="tier1Step" placeholder="5 L" />
        <Field label="…up to" k="tier1UpTo" placeholder="1 Cr" />
        <Field label="Increment (above that)" k="tier2Step" placeholder="10 L" />
        <div />
        <Field label="Min squad size" k="minSquadSize" placeholder="0" />
        <Field label="Max squad size" k="maxSquadSize" placeholder="25" />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={f.enforceMaxBid} onChange={(e) => setF({ ...f, enforceMaxBid: e.target.checked })} />
        Stop a team bidding beyond what it needs to fill its minimum squad
      </label>
      <button onClick={save} className="mt-5 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
        {saved ? "Saved ✓" : "Save settings"}
      </button>
    </div>
  );
}

const Empty = ({ text }) => <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400 dark:border-white/15 dark:bg-white/5">{text}</div>;
const StatusChip = ({ status }) => {
  const map = { pending: "bg-slate-100 text-slate-500", current: "bg-amber-100 text-amber-700", sold: "bg-emerald-100 text-emerald-700", unsold: "bg-red-100 text-red-600" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${map[status] || map.pending}`}>{status}</span>;
};
