import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext.jsx";

// Animated sun/moon switch. The knob slides and the icon crossfades.
export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`relative flex h-9 w-16 items-center rounded-full p-1 transition-colors ${dark ? "bg-indigo-600/90" : "bg-slate-200"} ${className}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`grid h-7 w-7 place-items-center rounded-full bg-white shadow ${dark ? "ml-auto" : ""}`}
      >
        <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} className="text-sm">
          {dark ? "🌙" : "☀️"}
        </motion.span>
      </motion.span>
    </button>
  );
}
