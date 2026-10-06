import React, { useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="animate-pulse text-sm font-semibold tracking-wide">Checking admin access…</div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-center px-6">
        <FiShield className="text-4xl text-rose-400 mb-4" />
        <h1 className="text-xl font-bold text-white">Admin access only</h1>
        <p className="text-slate-400 mt-2 max-w-sm">
          You don't have permission to view the CricZone admin panel.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500"
        >
          Go home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-2">
          <FiShield className="text-blue-400 text-xl" />
          <div>
            <div className="text-white font-extrabold tracking-wide leading-none">CricZone</div>
            <div className="text-[11px] text-slate-500 font-semibold mt-0.5">ADMIN PANEL</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon className="text-lg" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3.5 pb-3 text-xs text-slate-500 truncate">{user?.email || user?.name}</div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <FiLogOut className="text-lg" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
