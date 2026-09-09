import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  FiActivity, FiAward, FiUsers, FiBarChart2, FiZap, FiTv, FiArrowRight, FiCheck,
  FiPlay, FiSmartphone, FiSettings, FiMonitor,
} from "react-icons/fi";
import { FaApple, FaGooglePlay } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import brand from "../assets/criczone_icon.png";

// Real store links — replace these two when they're ready.
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

const EASE = [0.22, 1, 0.36, 1];
const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: EASE },
};

export default function LandingPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const goAuction = () => navigate(user ? "/auctions" : "/auth");

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <Header user={user} onAuction={goAuction} />
      <Hero onAuction={goAuction} />
      <Marquee />
      <Stats />
      <Features />
      <HowItWorks />
      <AuctionSpotlight onAuction={goAuction} />
      <DownloadCTA />
      <Footer />
    </div>
  );
}

// ------------------------------------------------------------------ Header ---
function Header({ user, onAuction }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2">
          <img src={brand} alt="CricZone" className="h-9 w-9 rounded-xl object-cover shadow-lg" />
          <span className="text-lg font-black tracking-tight">CricZone</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 dark:text-slate-300 md:flex">
          <a href="#features" className="transition hover:text-indigo-600 dark:hover:text-white">Features</a>
          <a href="#how" className="transition hover:text-indigo-600 dark:hover:text-white">How it works</a>
          <a href="#auction" className="transition hover:text-indigo-600 dark:hover:text-white">Auction</a>
          <a href="#download" className="transition hover:text-indigo-600 dark:hover:text-white">Download</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={onAuction} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:bg-indigo-700">
            {user ? "Auctions" : "Sign in"}
          </button>
        </div>
      </div>
    </header>
  );
}

// -------------------------------------------------------------------- Hero ---
function Hero({ onAuction }) {
  return (
    <section className="relative overflow-hidden">
      {/* animated gradient mesh + grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 animate-pulse-glow rounded-full bg-indigo-400/40 blur-3xl dark:bg-indigo-600/25" />
        <div className="absolute right-0 top-24 h-[26rem] w-[26rem] animate-float-slow rounded-full bg-violet-400/40 blur-3xl dark:bg-violet-600/20" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-float rounded-full bg-sky-400/30 blur-3xl [animation-delay:-1.5s] dark:bg-sky-600/15" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.06)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:pt-20 lg:grid-cols-2 lg:pb-24">
        {/* copy */}
        <div className="text-center lg:text-left">
          <motion.div {...fadeUp} className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-4 py-1.5 text-xs font-bold text-indigo-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-indigo-300 lg:mx-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            Live scoring · Tournaments · Player Auctions
          </motion.div>

          <motion.h1 {...fadeUp} className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Run your cricket league{" "}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 bg-clip-text text-transparent">like the pros.</span>
            </span>
          </motion.h1>

          <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }} className="mx-auto mt-5 max-w-xl text-lg font-medium text-slate-600 dark:text-slate-300 lg:mx-0">
            Score ball-by-ball, run full tournaments with points tables and playoffs, and hold professional live player auctions — all in one beautiful platform.
          </motion.p>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.16 }} className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <button onClick={onAuction} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:bg-indigo-700">
              Run a Player Auction <FiArrowRight />
            </button>
            <a href="#features" className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-6 py-3.5 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20">
              <FiPlay /> See features
            </a>
          </motion.div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.24 }} className="mt-6 flex items-center justify-center gap-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 lg:justify-start">
            <FiCheck className="text-emerald-500" /> Free to start
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <FiCheck className="text-emerald-500" /> No card required
          </motion.div>
        </div>

        {/* animated product mockups */}
        <HeroMockups />
      </div>
    </section>
  );
}

function HeroMockups() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="relative mx-auto h-[26rem] w-full max-w-md"
    >
      {/* rotating glow ring */}
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full bg-[conic-gradient(from_0deg,rgba(99,102,241,0.35),rgba(139,92,246,0.15),rgba(56,189,248,0.35),rgba(99,102,241,0.35))] blur-2xl" />

      {/* live scoreboard card */}
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-0 top-4 w-64 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-red-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
          </span>
          <span className="text-[10px] font-bold text-slate-400">T20 · 14.2 ov</span>
        </div>
        <div className="mt-3 text-3xl font-black tracking-tight">
          142<span className="text-slate-400">/3</span>
        </div>
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Jaffna Kings</div>
        <div className="mt-3 space-y-1.5">
          <Row name="P. Nissanka *" val="64 (38)" />
          <Row name="K. Mendis" val="41 (29)" />
        </div>
        <div className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-xs font-black text-emerald-600 dark:text-emerald-400">
          CRR 9.86 · Need 59 off 34
        </div>
      </motion.div>

      {/* auction card */}
      <motion.div
        animate={{ y: [0, 14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute bottom-2 right-0 w-60 rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-5 text-white shadow-2xl shadow-violet-600/30"
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60">On the block</div>
        <div className="mt-1 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-xl font-black">W</div>
          <div>
            <div className="text-base font-black leading-tight">W. Hasaranga</div>
            <div className="text-[11px] text-white/60">Bowler · Base Rs 1,000,000</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-black/25 p-3 text-center">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Current bid</div>
          <div className="text-2xl font-black text-amber-300">Rs 5,500,000</div>
          <div className="text-[11px] font-bold">Galle Gladiators</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const Row = ({ name, val }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="font-semibold text-slate-600 dark:text-slate-300">{name}</span>
    <span className="font-black tabular-nums text-slate-800 dark:text-white">{val}</span>
  </div>
);

// ---------------------------------------------------------------- Marquee ---
function Marquee() {
  const items = ["Ball-by-ball scoring", "Points tables", "Knockout brackets", "Live player auctions", "Big-screen mode", "Stream overlays", "Public scorecards", "Real-time sync"];
  const loop = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-slate-200/70 bg-slate-50/60 py-4 dark:border-white/5 dark:bg-white/[0.02]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent dark:from-slate-950" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent dark:from-slate-950" />
      <div className="flex w-max animate-marquee items-center gap-10">
        {loop.map((t, i) => (
          <span key={i} className="flex items-center gap-10 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t}<span className="text-indigo-400">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Stats ---
const STATS = [
  { value: 50000, suffix: "+", label: "Balls scored" },
  { value: 1200, suffix: "+", label: "Matches played" },
  { value: 300, suffix: "+", label: "Tournaments run" },
  { value: 99.9, suffix: "%", label: "Realtime uptime", decimals: 1 },
];

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div key={s.label} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="text-3xl font-black tracking-tight sm:text-4xl">
              <Counter to={s.value} decimals={s.decimals || 0} />{s.suffix}
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Counter({ to, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf;
    const start = performance.now();
    const dur = 1400;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  const display = n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span ref={ref}>{display}</span>;
}

// ---------------------------------------------------------------- Features ---
const FEATURES = [
  { icon: FiActivity, title: "Live ball-by-ball scoring", desc: "Fast, accurate scoring with instant public scorecards and stats.", color: "from-emerald-500 to-teal-500" },
  { icon: FiAward, title: "Tournaments & brackets", desc: "Leagues, groups, points tables and knockout playoffs, auto-managed.", color: "from-amber-500 to-orange-500" },
  { icon: FiUsers, title: "Player Auctions", desc: "Run a real-event auction with purses, live bidding and a big screen.", color: "from-indigo-500 to-violet-500" },
  { icon: FiBarChart2, title: "Deep stats", desc: "Batting, bowling and tournament leaderboards that update live.", color: "from-sky-500 to-blue-500" },
  { icon: FiTv, title: "TV & stream overlays", desc: "Broadcast-ready scoreboards and overlays for your streams.", color: "from-pink-500 to-rose-500" },
  { icon: FiZap, title: "Real-time everywhere", desc: "Every score and bid syncs instantly across all devices.", color: "from-fuchsia-500 to-purple-500" },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20">
      <motion.div {...fadeUp} className="mb-12 text-center">
        <div className="mb-3 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Features</div>
        <h2 className="text-3xl font-black sm:text-4xl">Everything your league needs</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">From the first ball to the final bid.</p>
      </motion.div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1.5 hover:shadow-2xl dark:border-white/10 dark:bg-white/5">
            <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${f.color} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30`} />
            <div className={`relative mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.color} text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3`}>
              <f.icon size={22} />
            </div>
            <h3 className="relative text-lg font-black">{f.title}</h3>
            <p className="relative mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// -------------------------------------------------------------- How it works ---
const STEPS = [
  { icon: FiSettings, title: "Set up your league", desc: "Create teams, add players and pick your tournament format in minutes." },
  { icon: FiSmartphone, title: "Score & bid live", desc: "Score matches ball-by-ball and run auctions with live bidding on any device." },
  { icon: FiMonitor, title: "Share the big screen", desc: "Cast public scorecards, points tables and a cinematic auction screen." },
];

function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-5 py-20">
      <motion.div {...fadeUp} className="mb-14 text-center">
        <div className="mb-3 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">How it works</div>
        <h2 className="text-3xl font-black sm:text-4xl">Up and running in three steps</h2>
      </motion.div>
      <div className="relative grid gap-8 md:grid-cols-3">
        {/* connector line */}
        <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent dark:via-indigo-500/30 md:block" />
        {STEPS.map((s, i) => (
          <motion.div key={s.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.12 }} className="relative text-center">
            <div className="relative z-10 mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-indigo-600 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:text-indigo-300 dark:ring-white/10">
              <s.icon size={26} />
              <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-xs font-black text-white">{i + 1}</span>
            </div>
            <h3 className="mt-5 text-lg font-black">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-slate-600 dark:text-slate-300">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// -------------------------------------------------------- Auction spotlight ---
function AuctionSpotlight({ onAuction }) {
  const points = ["Set team purses & base prices", "Live bidding on a big screen", "Auto purse calculation & undo", "Owners follow on their phones"];
  return (
    <section id="auction" className="mx-auto max-w-6xl px-5 py-12">
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 text-white shadow-2xl sm:p-12">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 animate-float-slow rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 animate-float rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-widest">✦ New</div>
            <h2 className="text-3xl font-black leading-tight sm:text-4xl">Professional live player auctions</h2>
            <p className="mt-3 max-w-md text-white/80">Run your league's auction like the pros — a cinematic big screen up front, the auctioneer in control, and every purse calculated automatically.</p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/20"><FiCheck size={12} /></span>{p}</li>
              ))}
            </ul>
            <button onClick={onAuction} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100">
              Start an auction <FiArrowRight />
            </button>
          </div>
          {/* mini mock of the auction card */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }}
            className="rounded-3xl bg-black/25 p-5 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-black">K</div>
              <div><div className="text-xl font-black">Kusal Mendis</div><div className="text-xs text-white/60">Batsman · Base Rs 1,000,000</div></div>
            </div>
            <div className="mt-4 rounded-2xl bg-black/30 p-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Current bid</div>
              <div className="text-4xl font-black text-amber-300">Rs 5,500,000</div>
              <div className="text-sm font-bold">Galle Gladiators</div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

// -------------------------------------------------------------- Download CTA ---
function DownloadCTA() {
  return (
    <section id="download" className="mx-auto max-w-4xl px-5 py-20 text-center">
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-pulse-glow rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-600/20" />
        <div className="relative">
          <h2 className="text-3xl font-black sm:text-4xl">Get CricZone on your phone</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">Score and manage your matches anywhere. Download the app and take your league with you.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3"><StoreBadges /></div>
        </div>
      </motion.div>
    </section>
  );
}

// --------------------------------------------------------------- Store badges ---
function StoreBadges() {
  return (
    <>
      <a href={APP_STORE_URL} className="flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-2.5 text-white transition hover:-translate-y-0.5 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
        <FaApple size={26} />
        <span className="text-left leading-tight"><span className="block text-[10px] font-medium opacity-70">Download on the</span><span className="block text-base font-black">App Store</span></span>
      </a>
      <a href={PLAY_STORE_URL} className="flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-2.5 text-white transition hover:-translate-y-0.5 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
        <FaGooglePlay size={22} />
        <span className="text-left leading-tight"><span className="block text-[10px] font-medium opacity-70">GET IT ON</span><span className="block text-base font-black">Google Play</span></span>
      </a>
    </>
  );
}

// ------------------------------------------------------------------ Footer ---
function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10 transition-colors dark:border-white/10 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <img src={brand} alt="CricZone" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-black">CricZone</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <Link to="/privacy" className="transition hover:text-indigo-600 dark:hover:text-white">Privacy</Link>
          <Link to="/terms" className="transition hover:text-indigo-600 dark:hover:text-white">Terms</Link>
          <Link to="/support" className="transition hover:text-indigo-600 dark:hover:text-white">Support</Link>
        </div>
        <div className="text-xs text-slate-400">© {new Date().getFullYear()} CricZone. All rights reserved.</div>
      </div>
    </footer>
  );
}
