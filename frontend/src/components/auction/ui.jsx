import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiCheckCircle, FiAlertTriangle, FiInfo, FiX, FiAlertCircle } from "react-icons/fi";

/* ==========================================================================
   CricZone Auction — shared UI kit
   Professional, theme-aware, animated primitives used across every auction
   page: form fields with inline validation, buttons, toasts and modals.
   ========================================================================== */

// ---------------------------------------------------------------- helpers ---
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
export const cx = (...a) => a.filter(Boolean).join(" ");

// Base control styling shared by inputs / selects / textareas so everything
// looks identical and works in light + dark.
const controlBase =
  "w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition " +
  "placeholder:font-medium placeholder:text-slate-400 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500";
const controlIdle = "border-slate-200 focus:border-indigo-500 dark:border-white/10 dark:focus:border-indigo-400";
const controlError = "border-red-400 focus:border-red-500 dark:border-red-500/60";

// --------------------------------------------------------------- Field ------
// Wraps any control with a label, required marker, hint and inline error.
export function Field({ label, required, error, hint, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.span
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-500"
          >
            <FiAlertCircle size={12} /> {error}
          </motion.span>
        ) : hint ? (
          <span className="mt-1 block text-xs font-medium text-slate-400 dark:text-slate-500">{hint}</span>
        ) : null}
      </AnimatePresence>
    </label>
  );
}

// --------------------------------------------------------------- Input ------
export const Input = React.forwardRef(function Input({ error, icon: Icon, className, ...rest }, ref) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input ref={ref} {...rest} className={cx(controlBase, "pl-10", error ? controlError : controlIdle, className)} />
      </div>
    );
  }
  return <input ref={ref} {...rest} className={cx(controlBase, error ? controlError : controlIdle, className)} />;
});

export function Textarea({ error, className, ...rest }) {
  return <textarea {...rest} className={cx(controlBase, "leading-relaxed", error ? controlError : controlIdle, className)} />;
}

export function Select({ error, className, children, ...rest }) {
  return (
    <select {...rest} className={cx(controlBase, "cursor-pointer appearance-none pr-9", error ? controlError : controlIdle, className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", backgroundSize: "1.1rem" }}>
      {children}
    </select>
  );
}

// -------------------------------------------------------------- Toggle ------
export function Toggle({ checked, onChange, label, desc }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-white/15")}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow", checked ? "left-[1.375rem]" : "left-0.5")} />
      </span>
      <span>
        {label && <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>}
        {desc && <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{desc}</span>}
      </span>
    </button>
  );
}

// -------------------------------------------------------------- Button ------
const VARIANTS = {
  primary: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700",
  success: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700",
  danger: "bg-red-600 text-white shadow-lg shadow-red-600/25 hover:bg-red-700",
  soft: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
  dark: "bg-slate-900 text-white hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
};
export function Button({ variant = "primary", icon: Icon, loading, children, className, disabled, ...rest }) {
  return (
    <button {...rest} disabled={disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant], className)}>
      {loading ? <Spinner size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ size = 20, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cx("animate-spin", className)}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ------------------------------------------------------------ EmptyState -----
export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 py-16 text-center dark:border-white/10 dark:bg-white/5">
      {Icon && <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300"><Icon size={26} /></div>}
      <p className="text-lg font-black text-slate-700 dark:text-slate-200">{title}</p>
      {desc && <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-slate-400">{desc}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* ==========================================================================
   Toasts — imperative API callable from anywhere (toast.success(...))
   ========================================================================== */
let _toasts = [];
let _id = 0;
const _subs = new Set();
const _emit = () => _subs.forEach((fn) => fn(_toasts));

function push(message, type) {
  const id = ++_id;
  _toasts = [..._toasts, { id, message, type }];
  _emit();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _emit();
  }, 3600);
}
export const toast = Object.assign((m) => push(m, "info"), {
  success: (m) => push(m, "success"),
  error: (m) => push(m, "error"),
  info: (m) => push(m, "info"),
  warning: (m) => push(m, "warning"),
});

const TOAST_STYLE = {
  success: { icon: FiCheckCircle, ring: "ring-emerald-200 dark:ring-emerald-500/30", dot: "text-emerald-500" },
  error: { icon: FiAlertTriangle, ring: "ring-red-200 dark:ring-red-500/30", dot: "text-red-500" },
  warning: { icon: FiAlertTriangle, ring: "ring-amber-200 dark:ring-amber-500/30", dot: "text-amber-500" },
  info: { icon: FiInfo, ring: "ring-indigo-200 dark:ring-indigo-500/30", dot: "text-indigo-500" },
};

export function Toaster() {
  const [list, setList] = useState(_toasts);
  useEffect(() => {
    _subs.add(setList);
    return () => _subs.delete(setList);
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {list.map((t) => {
          const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          const Icon = s.icon;
          return (
            <motion.div key={t.id} layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cx("pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 dark:bg-slate-900", s.ring)}>
              <Icon className={cx("shrink-0", s.dot)} size={20} />
              <span className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
}

/* ==========================================================================
   Modal + imperative confirm dialog
   ========================================================================== */
export function Modal({ open, onClose, title, subtitle, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9998] grid place-items-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={cx("relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900", maxWidth)}>
            {(title || onClose) && (
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-white/10">
                <div>
                  {title && <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>}
                  {subtitle && <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>}
                </div>
                {onClose && (
                  <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"><FiX size={18} /></button>
                )}
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

let _confirmSub = null;
export function confirmDialog(opts) {
  return new Promise((resolve) => {
    if (!_confirmSub) return resolve(window.confirm(opts?.message || "Are you sure?"));
    _confirmSub({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [state, setState] = useState(null);
  useEffect(() => {
    _confirmSub = (payload) => setState(payload);
    return () => { _confirmSub = null; };
  }, []);
  const close = (val) => { state?.resolve?.(val); setState(null); };
  const danger = state?.tone === "danger";
  return (
    <Modal open={!!state} onClose={() => close(false)} maxWidth="max-w-md" title={state?.title || "Please confirm"}>
      <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{state?.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="soft" onClick={() => close(false)}>{state?.cancelText || "Cancel"}</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => close(true)}>{state?.confirmText || "Confirm"}</Button>
      </div>
    </Modal>
  );
}
