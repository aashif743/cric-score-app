import React, { useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../../context/AuthContext.jsx";
import adminService from "../../services/adminService";
import {
  FiGrid, FiCheckSquare, FiUsers, FiTrash2, FiLogOut, FiShield,
} from "react-icons/fi";

const NAV = [
  { to: "/admin", label: "Overview", icon: FiGrid, end: true },
  { to: "/admin/approvals", label: "Approvals", icon: FiCheckSquare },
  { to: "/admin/users", label: "Users", icon: FiUsers },
  { to: "/admin/content", label: "Content", icon: FiTrash2 },
];

export default function AdminLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState("checking"); // checking | ok | denied

  useEffect(() => {
    let cancelled = false;
    if (!user?.token) { setState("denied"); return; }
    adminService.me(user.token)
      .then((me) => { if (!cancelled) setState(me?.role === "admin" ? "ok" : "denied"); })
      .catch(() => { if (!cancelled) setState("denied"); });
    return () => { cancelled = true; };
  }, [user?.token]);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <motion.div
          className="flex items-center gap-3 text-slate-300"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent"
            animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-sm font-semibold tracking-wide">Verifying admin access…</span>
        </motion.div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 text-center px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="w-16 h-16 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/30 flex items-center justify-center mb-5"
        >
          <FiShield className="text-3xl text-rose-400" />
        </motion.div>
        <h1 className="text-xl font-bold text-white">Admin access only</h1>
        <p className="text-slate-400 mt-2 max-w-sm text-sm">
          This account doesn't have permission to view the CricZone admin panel.
        </p>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/")}
          className="mt-7 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 shadow-lg shadow-blue-500/30"
        >
          Go home
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 sticky top-0 h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-300 flex flex-col border-r border-slate-800/60">
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <FiShield className="text-white text-xl" />
          </div>
          <div>
            <div className="text-white font-black tracking-tight leading-none text-[15px]">CricZone</div>
            <div className="text-[10px] text-blue-400/80 font-bold mt-1 tracking-widest">ADMIN PANEL</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="block">
              {({ isActive }) => (
                <div className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                  {isActive && (
                    <motion.div
                      layoutId="admin-nav-active"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/30"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className={`relative z-10 text-lg ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className={`relative z-10 ${isActive ? "text-white" : "text-slate-400"}`}>{label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800/60">
          <div className="px-3.5 pb-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 font-bold text-sm">
              {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-300 truncate">{user?.name || "Admin"}</div>
              <div className="text-[10px] text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <motion.button
            whileHover={{ x: 2 }}
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors"
          >
            <FiLogOut className="text-lg" /> Sign out
          </motion.button>
        </div>
      </aside>

      {/* Content with page transitions */}
      <main className="flex-1 min-w-0 overflow-x-hidden relative">
        {/* soft decorative glow */}
        <div className="pointer-events-none absolute top-0 right-0 w-[520px] h-[520px] bg-indigo-400/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-6 lg:px-10 py-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
