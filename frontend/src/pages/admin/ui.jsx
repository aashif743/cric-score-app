import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// ───────────────────────── motion presets ─────────────────────────
export const fadeRise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

// Accent gradient + text/soft colours per theme key.
export const ACCENTS = {
  blue:   { grad: "from-blue-500 to-indigo-500",   text: "text-blue-600",   soft: "bg-blue-50 text-blue-700",     ring: "shadow-blue-500/25" },
  violet: { grad: "from-violet-500 to-purple-500", text: "text-violet-600", soft: "bg-violet-50 text-violet-700", ring: "shadow-violet-500/25" },
  green:  { grad: "from-emerald-500 to-teal-500",  text: "text-emerald-600",soft: "bg-emerald-50 text-emerald-700",ring: "shadow-emerald-500/25" },
  amber:  { grad: "from-amber-500 to-orange-500",  text: "text-amber-600",  soft: "bg-amber-50 text-amber-700",   ring: "shadow-amber-500/25" },
  rose:   { grad: "from-rose-500 to-pink-500",     text: "text-rose-600",   soft: "bg-rose-50 text-rose-700",     ring: "shadow-rose-500/25" },
  slate:  { grad: "from-slate-600 to-slate-700",   text: "text-slate-700",  soft: "bg-slate-100 text-slate-600",  ring: "shadow-slate-500/20" },
};

// ───────────────────────── count-up ─────────────────────────
export function useCountUp(target = 0, duration = 900) {
  const [val, setVal] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (target - from) * eased);
      setVal(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else ref.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ───────────────────────── primitives ─────────────────────────
export function PageHeader({ title, subtitle, right }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-start justify-between mb-7"
    >
      <div>
        <h1 className="text-[28px] leading-none font-black tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="text-slate-500 mt-2 text-sm font-medium">{subtitle}</p> : null}
      </div>
      {right}
    </motion.div>
  );
}

export function StatCard({ label, value, sub, accent = "blue", icon: Icon, delay = 0 }) {
  const a = ACCENTS[accent] || ACCENTS.blue;
  const n = useCountUp(Number.isFinite(value) ? value : 0);
  const display = Number.isFinite(value) ? n : value;
  return (
    <motion.div
      variants={fadeRise}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur border border-slate-200/70 p-5 shadow-sm hover:shadow-xl hover:shadow-slate-300/50 transition-shadow"
    >
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${a.grad}`} />
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${a.grad} opacity-[0.07] group-hover:opacity-[0.13] transition-opacity`} />
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        {Icon ? (
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.grad} text-white flex items-center justify-center shadow-lg ${a.ring}`}>
            <Icon className="text-[17px]" />
          </div>
        ) : null}
      </div>
      <div className={`text-[32px] leading-tight font-black mt-2 tabular-nums ${a.text}`}>{display}</div>
      {sub ? <div className="text-xs font-semibold text-slate-400 mt-0.5">{sub}</div> : null}
    </motion.div>
  );
}

export function Card({ title, children, right, className = "", delay = 0 }) {
  return (
    <motion.div
      variants={fadeRise}
      className={`rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between mb-4">
          {title ? <h2 className="font-bold text-slate-900 tracking-tight">{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </motion.div>
  );
}

// Animated gradient bar chart for a [{date, count}] series.
export function MiniBars({ data = [], height = 150, accent = "blue" }) {
  const a = ACCENTS[accent] || ACCENTS.blue;
  if (!data.length) return <div className="text-sm text-slate-400 py-10 text-center font-medium">No data yet.</div>;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.count / max) * (height - 6));
          return (
            <motion.div
              key={i}
              className={`flex-1 rounded-t-md bg-gradient-to-t ${a.grad} relative group`}
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * (0.4 / n), ease: [0.22, 1, 0.36, 1] }}
              title={`${d.date}: ${d.count}`}
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                {d.count}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export function Badge({ children, color = "slate", dot = false }) {
  const map = {
    slate:  "bg-slate-100 text-slate-600 ring-slate-200",
    green:  "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber:  "bg-amber-50 text-amber-700 ring-amber-200",
    blue:   "bg-blue-50 text-blue-700 ring-blue-200",
    rose:   "bg-rose-50 text-rose-700 ring-rose-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  const dotColor = {
    slate: "bg-slate-400", green: "bg-emerald-500", amber: "bg-amber-500",
    blue: "bg-blue-500", rose: "bg-rose-500", violet: "bg-violet-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ring-1 ring-inset ${map[color] || map.slate}`}>
      {dot ? <span className={`w-1.5 h-1.5 rounded-full ${dotColor[color] || dotColor.slate}`} /> : null}
      {children}
    </span>
  );
}

export function Btn({ children, onClick, disabled, variant = "primary", className = "" }) {
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-500/30",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-500/30",
    amber:   "bg-amber-500 text-white hover:bg-amber-400 shadow-sm shadow-amber-500/30",
    danger:  "bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/30",
    ghost:   "bg-slate-100 text-slate-600 hover:bg-slate-200",
    soft:    "bg-rose-50 text-rose-600 hover:bg-rose-100",
    dark:    "bg-slate-800 text-white hover:bg-slate-700",
  };
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      disabled={disabled}
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v[variant] || v.primary} ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="py-20 flex flex-col items-center justify-center gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-blue-500"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <span className="text-slate-400 text-sm font-semibold">{label}</span>
    </div>
  );
}

// Grid/list wrapper that staggers children in.
export function Reveal({ children, className = "" }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="py-14 text-center">
      {Icon ? <Icon className="mx-auto text-3xl text-slate-300 mb-3" /> : null}
      <div className="font-bold text-slate-600">{title}</div>
      {hint ? <div className="text-sm text-slate-400 mt-1">{hint}</div> : null}
    </div>
  );
}
