import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiActivity, FiAward, FiUsers, FiBarChart2, FiZap, FiTv, FiArrowRight, FiCheck,
} from "react-icons/fi";
import { FaApple, FaGooglePlay } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

// Real store links — replace these two when they're ready.
const APP_STORE_URL = "#";
const PLAY_STORE_URL = "#";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

export default function LandingPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const goAuction = () => navigate(user ? "/auctions" : "/auth");

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <Header user={user} onAuction={goAuction} />
      <Hero onAuction={goAuction} />
      <Features />
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
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black text-white shadow-lg">C</div>
          <span className="text-lg font-black tracking-tight">CricZone</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 dark:text-slate-300 md:flex">
          <a href="#features" className="hover:text-indigo-600 dark:hover:text-white">Features</a>
          <a href="#auction" className="hover:text-indigo-600 dark:hover:text-white">Auction</a>
          <a href="#download" className="hover:text-indigo-600 dark:hover:text-white">Download</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={onAuction} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700">
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
      {/* animated background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 animate-float rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-600/20" />
        <div className="absolute right-0 top-40 h-80 w-80 animate-float rounded-full bg-violet-400/30 blur-3xl [animation-delay:-3s] dark:bg-violet-600/20" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 animate-float rounded-full bg-sky-400/20 blur-3xl [animation-delay:-1.5s] dark:bg-sky-600/10" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 text-center sm:pt-24">
        <motion.div {...fadeUp} className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-4 py-1.5 text-xs font-bold text-indigo-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-indigo-300">
          <FiZap /> Live scoring · Tournaments · Player Auctions
        </motion.div>
        <motion.h1 {...fadeUp} className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          The complete platform for{" "}
          <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 bg-clip-text text-transparent">cricket leagues</span>
        </motion.h1>
        <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }} className="mx-auto mt-5 max-w-2xl text-lg font-medium text-slate-600 dark:text-slate-300">
          Score matches ball-by-ball, run full tournaments, and hold professional live player auctions — all in one place.
        </motion.p>

        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.16 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <StoreBadges />
        </motion.div>

        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.24 }} className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <span>or</span>
          <button onClick={onAuction} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            Run a Player Auction <FiArrowRight />
          </button>
        </motion.div>
      </div>
    </section>
  );
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
        <h2 className="text-3xl font-black sm:text-4xl">Everything your league needs</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">From the first ball to the final bid.</p>
      </motion.div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5">
            <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${f.color} text-white shadow-lg transition-transform group-hover:scale-110`}>
              <f.icon size={22} />
            </div>
            <h3 className="text-lg font-black">{f.title}</h3>
            <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">{f.desc}</p>
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
      <motion.div {...fadeUp} className="overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 text-white shadow-2xl sm:p-12">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-widest">New</div>
            <h2 className="text-3xl font-black leading-tight sm:text-4xl">Professional live player auctions</h2>
            <p className="mt-3 max-w-md text-white/80">Run your league's auction like the pros — a cinematic big screen up front, the auctioneer in control, and every purse calculated automatically.</p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/20"><FiCheck size={12} /></span>{p}</li>
              ))}
            </ul>
            <button onClick={onAuction} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-indigo-700 shadow-lg transition hover:bg-slate-100">
              Start an auction <FiArrowRight />
            </button>
          </div>
          {/* mini mock of the auction card */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="rounded-3xl bg-black/25 p-5 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-black">V</div>
              <div><div className="text-xl font-black">Star Batsman</div><div className="text-xs text-white/60">Batsman · Base ₹20 L</div></div>
            </div>
            <div className="mt-4 rounded-2xl bg-black/30 p-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Current bid</div>
              <div className="text-4xl font-black text-amber-300">₹1.25 Cr</div>
              <div className="text-sm font-bold">Team Titans</div>
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
      <motion.div {...fadeUp}>
        <h2 className="text-3xl font-black sm:text-4xl">Get CricZone on your phone</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">Score and manage your matches anywhere. Download the app and take your league with you.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3"><StoreBadges /></div>
      </motion.div>
    </section>
  );
}

// --------------------------------------------------------------- Store badges ---
function StoreBadges() {
  return (
    <>
      <a href={APP_STORE_URL} className="flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-2.5 text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
        <FaApple size={26} />
        <span className="text-left leading-tight"><span className="block text-[10px] font-medium opacity-70">Download on the</span><span className="block text-base font-black">App Store</span></span>
      </a>
      <a href={PLAY_STORE_URL} className="flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-2.5 text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
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
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">C</div>
          <span className="font-black">CricZone</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-white">Privacy</Link>
          <Link to="/terms" className="hover:text-indigo-600 dark:hover:text-white">Terms</Link>
          <Link to="/support" className="hover:text-indigo-600 dark:hover:text-white">Support</Link>
        </div>
        <div className="text-xs text-slate-400">© {new Date().getFullYear()} CricZone. All rights reserved.</div>
      </div>
    </footer>
  );
}
