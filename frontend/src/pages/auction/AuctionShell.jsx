import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiGrid, FiSettings, FiZap, FiMonitor, FiChevronLeft, FiLogOut, FiMenu, FiX, FiAward,
} from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";

// Standalone admin-dashboard frame for the auction system — desktop-first, with
// a fixed sidebar. Completely separate from the legacy scoring app chrome.
//   active      one of: 'list' | 'setup' | 'live'
//   auctionId   when inside a specific auction (adds its nav)
//   shareId     to open the big screen
export default function AuctionShell({ active, auctionId, auctionName, shareId, title, status, right, children }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [openMobile, setOpenMobile] = useState(false);

  const doLogout = () => { logout(); navigate("/"); };

  const NavItem = ({ to, icon: Icon, label, isActive, external }) => {
    const cls = `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
      isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
    }`;
    const inner = (<><Icon size={18} /><span className="flex-1">{label}</span>{external && <span className="text-xs opacity-60">↗</span>}</>);
    if (external) return <a href={to} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
    return <Link to={to} className={cls} onClick={() => setOpenMobile(false)}>{inner}</Link>;
  };

  const Sidebar = () => (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black text-white shadow-lg">C</div>
        <div className="leading-tight">
          <div className="text-sm font-black">CricZone</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Auctions</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        <NavItem to="/auctions" icon={FiGrid} label="My Auctions" isActive={active === "list"} />
        {auctionId && (
          <>
            <div className="mt-5 mb-1 truncate px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{auctionName || "Auction"}</div>
            <NavItem to={`/auctions/${auctionId}/setup`} icon={FiSettings} label="Setup" isActive={active === "setup"} />
            <NavItem to={`/auctions/${auctionId}/live`} icon={FiZap} label="Live Auction" isActive={active === "live"} />
            <NavItem to={`/auctions/${auctionId}/results`} icon={FiAward} label="Results" isActive={active === "results"} />
            {shareId && <NavItem to={`/auction/screen/${shareId}`} icon={FiMonitor} label="Big Screen" external />}
            <NavItem to="/auctions" icon={FiChevronLeft} label="All auctions" />
          </>
        )}
      </nav>

      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/5">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{user?.name || "Signed in"}</div>
            <div className="truncate text-[11px] text-slate-400">{user?.email || user?.phoneNumber || ""}</div>
          </div>
          <button onClick={doLogout} title="Log out" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><FiLogOut size={16} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl dark:bg-slate-900"><Sidebar /></aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/80 lg:px-8">
          <button onClick={() => setOpenMobile(true)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden"><FiMenu size={20} /></button>
          <h1 className="truncate text-lg font-black">{title}</h1>
          {status && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusStyle(status)}`}>{status}</span>}
          <div className="ml-auto flex items-center gap-2">{right}</div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function statusStyle(s) {
  return {
    draft: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    paused: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  }[s] || "bg-slate-100 text-slate-600";
}
