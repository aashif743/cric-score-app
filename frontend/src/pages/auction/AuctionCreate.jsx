import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiChevronLeft, FiCalendar, FiClock, FiMapPin, FiUsers, FiEye, FiLock,
  FiZap, FiCheck, FiTag,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import { CURRENCIES, parseMoney, formatMoney, currencyMeta } from "../../utils/auctionFormat";
import AuctionShell from "./AuctionShell.jsx";
import ImageUpload from "../../components/auction/ImageUpload";
import { Button, Field, Input, Select, Toggle, toast, cx } from "../../components/auction/ui.jsx";

const SPORTS = ["Cricket", "Football", "Basketball", "Volleyball", "Badminton", "Other"];

export default function AuctionCreate() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [f, setF] = useState({
    logoUrl: "", coverUrl: "",
    name: "", sport: "Cricket", venue: "", date: "", time: "",
    currencyCode: "LKR",
    purse: "", minBid: "", increment: "", playersPerTeam: "11",
    remoteBidding: false, visibility: "public",
  });
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const cur = currencyMeta(f.currencyCode);
  const money = (n) => formatMoney(n, { symbol: cur.symbol, format: cur.format });

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Auction name is required.";
    if (!f.purse.trim() || parseMoney(f.purse) <= 0) e.purse = "Enter the purse each team gets.";
    if (f.minBid.trim() && parseMoney(f.minBid) < 0) e.minBid = "Enter a valid amount.";
    if (!f.increment.trim() || parseMoney(f.increment) <= 0) e.increment = "Enter a bid increment.";
    if (!f.playersPerTeam || Number(f.playersPerTeam) < 1) e.playersPerTeam = "At least 1 player per team.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) { toast.error("Please fix the highlighted fields."); return; }
    try {
      setBusy(true);
      const players = Number(f.playersPerTeam) || 11;
      const payload = {
        name: f.name.trim(), sport: f.sport, logoUrl: f.logoUrl, coverUrl: f.coverUrl,
        venue: f.venue.trim(), date: f.date, time: f.time, visibility: f.visibility,
        currencyCode: f.currencyCode,
        settings: {
          defaultPurse: parseMoney(f.purse),
          minBid: f.minBid.trim() ? parseMoney(f.minBid) : 0,
          playersPerTeam: players,
          incrementTiers: [{ upTo: null, step: parseMoney(f.increment) }],
          minSquadSize: 0, maxSquadSize: players,
          biddingMode: f.remoteBidding ? "online" : "manual",
          enforceMaxBid: true,
        },
      };
      const a = await auctionService.create(payload, user.token);
      toast.success("Auction created — now add your teams and players.");
      navigate(`/auctions/${a._id}/setup`);
    } catch (e) {
      toast.error(e?.error || "Could not create the auction.");
    } finally { setBusy(false); }
  };

  const back = <Button variant="ghost" icon={FiChevronLeft} onClick={() => navigate("/auctions")}>Cancel</Button>;

  return (
    <AuctionShell active="list" title="Create Auction" right={back}>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="space-y-5 lg:col-span-2">
          {/* Branding */}
          <Card>
            <SectionTitle icon={FiTag}>Branding</SectionTitle>
            <ImageUpload wide value={f.coverUrl} onChange={(url) => set("coverUrl", url)} label="Cover image" hint="Wide banner shown on the big screen & owner view" />
            <div className="mt-4"><ImageUpload value={f.logoUrl} onChange={(url) => set("logoUrl", url)} round={false} label="Profile / logo" hint="Square crest for headers & share cards" /></div>
          </Card>

          {/* Details */}
          <Card>
            <SectionTitle icon={FiZap}>Auction details</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Auction name" required error={errors.name} className="sm:col-span-2">
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Blasters Premier League 2026" error={!!errors.name} autoFocus />
              </Field>
              <Field label="Sport">
                <Select value={f.sport} onChange={(e) => set("sport", e.target.value)}>
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Venue" hint="Optional">
                <Input icon={FiMapPin} value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. R. Premadasa Stadium" />
              </Field>
              <Field label="Auction date">
                <Input icon={FiCalendar} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Auction time">
                <Input icon={FiClock} type="time" value={f.time} onChange={(e) => set("time", e.target.value)} />
              </Field>
            </div>
          </Card>

          {/* Bidding */}
          <Card>
            <SectionTitle icon={FiTag}>Bidding & currency</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bid unit" hint="How amounts are shown" className="sm:col-span-2">
                <Select value={f.currencyCode} onChange={(e) => set("currencyCode", e.target.value)}>
                  {Object.values(CURRENCIES).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Purse per team" required error={errors.purse} hint={`Total each team can spend`}>
                <Input value={f.purse} onChange={(e) => set("purse", e.target.value)} placeholder={cur.format === "points" ? "100000" : "1,000,000"} error={!!errors.purse} />
              </Field>
              <Field label="Minimum / base bid" error={errors.minBid} hint="Starting price for a player">
                <Input value={f.minBid} onChange={(e) => set("minBid", e.target.value)} placeholder={cur.format === "points" ? "500" : "10,000"} error={!!errors.minBid} />
              </Field>
              <Field label="Bid increment" required error={errors.increment} hint="Each raise goes up by this">
                <Input value={f.increment} onChange={(e) => set("increment", e.target.value)} placeholder={cur.format === "points" ? "100" : "5,000"} error={!!errors.increment} />
              </Field>
              <Field label="Players per team" required error={errors.playersPerTeam}>
                <Input icon={FiUsers} type="number" min="1" value={f.playersPerTeam} onChange={(e) => set("playersPerTeam", e.target.value)} error={!!errors.playersPerTeam} />
              </Field>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <Toggle checked={f.remoteBidding} onChange={(v) => set("remoteBidding", v)}
                label="Remote team bidding" desc="Owners place bids from their own devices. Off = the auctioneer records every bid." />
            </div>
          </Card>

          {/* Visibility */}
          <Card>
            <SectionTitle icon={FiEye}>Visibility</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "public", icon: FiEye, title: "Public", desc: "Anyone with the share link can watch the big screen & stream." },
                { key: "private", icon: FiLock, title: "Private", desc: "Only people you share links with can follow the auction." },
              ].map((v) => {
                const active = f.visibility === v.key;
                return (
                  <button key={v.key} type="button" onClick={() => set("visibility", v.key)}
                    className={cx("relative rounded-2xl border-2 p-4 text-left transition", active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20")}>
                    {active && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-white"><FiCheck size={12} /></span>}
                    <v.icon className={cx("mb-2", active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400")} size={20} />
                    <div className={cx("text-sm font-black", active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100")}>{v.title}</div>
                    <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{v.desc}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button icon={FiCheck} loading={busy} onClick={submit}>Create auction</Button>
            <Button variant="soft" onClick={() => navigate("/auctions")}>Cancel</Button>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Live preview</div>
            <motion.div layout className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-white/5">
              <div className="relative h-32 bg-gradient-to-br from-indigo-500 to-violet-600">
                {f.coverUrl && <img src={f.coverUrl} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 left-0 flex items-end gap-3 p-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/15 text-xl font-black text-white ring-2 ring-white/30 backdrop-blur">
                    {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full object-cover" /> : (f.name.trim()[0] || "A")}
                  </div>
                  <div className="pb-1 text-white">
                    <div className="text-lg font-black leading-tight drop-shadow">{f.name.trim() || "Your auction name"}</div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">{f.sport}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 p-4 text-sm">
                <Row icon={FiCalendar} label="When" value={f.date ? `${f.date}${f.time ? ` · ${f.time}` : ""}` : "Date not set"} />
                <Row icon={FiMapPin} label="Venue" value={f.venue.trim() || "—"} />
                <Row icon={FiTag} label="Purse / team" value={f.purse.trim() ? money(parseMoney(f.purse)) : "—"} />
                <Row icon={FiZap} label="Increment" value={f.increment.trim() ? money(parseMoney(f.increment)) : "—"} />
                <Row icon={FiUsers} label="Players / team" value={f.playersPerTeam || "—"} />
                <Row icon={f.remoteBidding ? FiZap : FiCheck} label="Bidding" value={f.remoteBidding ? "Remote (owners bid)" : "Manual (auctioneer)"} />
                <Row icon={f.visibility === "public" ? FiEye : FiLock} label="Visibility" value={f.visibility === "public" ? "Public" : "Private"} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AuctionShell>
  );
}

const Card = ({ children }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">{children}</div>
);
const SectionTitle = ({ icon: Icon, children }) => (
  <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
    {Icon && <Icon size={15} className="text-indigo-500" />}{children}
  </h3>
);
const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2">
    <Icon size={14} className="text-slate-400" />
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="ml-auto truncate font-bold text-slate-800 dark:text-white">{value}</span>
  </div>
);
