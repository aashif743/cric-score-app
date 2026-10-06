import React from "react";

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-slate-500 mt-1 text-sm">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "blue" }) {
  const accents = {
    blue: "text-blue-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    slate: "text-slate-700",
    violet: "text-violet-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-3xl font-extrabold mt-2 ${accents[accent] || accents.blue}`}>{value}</div>
      {sub ? <div className="text-xs font-semibold text-slate-500 mt-1">{sub}</div> : null}
    </div>
  );
}

export function Card({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      {(title || right) && (
        <div className="flex items-center justify-between mb-4">
          {title ? <h2 className="font-bold text-slate-900">{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// Dependency-free bar chart for a [{date, count}] series.
export function MiniBars({ data = [], height = 120, color = "#2563eb" }) {
  if (!data.length) return <div className="text-sm text-slate-400 py-8 text-center">No data yet.</div>;
  const max = Math.max(1, ...data.map((d) => d.count));
  const barW = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.count / max) * (height - 8);
          return (
            <rect
              key={i}
              x={i * barW + barW * 0.15}
              y={height - h}
              width={barW * 0.7}
              height={h}
              rx={0.8}
              fill={color}
              opacity={0.85}
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export function Badge({ children, color = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading…" }) {
  return <div className="py-16 text-center text-slate-400 text-sm font-semibold animate-pulse">{label}</div>;
}
