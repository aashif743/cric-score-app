import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiUser, FiArrowRight, FiCheck } from 'react-icons/fi';
import { AuthContext } from '../context/AuthContext.jsx';
import authService from '../utils/authService.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import logo from '../assets/criczone_logo.png';
import icon from '../assets/criczone_icon.png';

// Professional desktop email auth (login + signup). No phone/OTP on the web.
export default function AuthPage() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const redirectTo = new URLSearchParams(window.location.search).get('redirect') || '/auctions';

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const register = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = register
        ? await authService.registerWithEmail(name.trim(), email.trim(), password)
        : await authService.loginWithEmail(email.trim(), password);
      login(data);
      navigate(redirectTo);
    } catch (err) {
      setError(err.response?.data?.message || err?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      {/* Brand panel (desktop only) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-8 h-72 w-72 animate-float rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 animate-float rounded-full bg-white/10 blur-3xl [animation-delay:-3s]" />
        </div>
        <div className="relative flex items-center gap-3">
          <img src={icon} alt="CricZone" className="h-11 w-11 rounded-2xl bg-white/10 p-1.5" />
          <span className="text-xl font-black tracking-tight">CricZone</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-black leading-[1.1] xl:text-5xl">Run professional cricket leagues &amp; live player auctions.</h1>
          <p className="mt-5 max-w-md text-lg text-white/80">Sign in to create and manage auctions — teams, purses, live bidding, and a cinematic big screen.</p>
          <ul className="mt-8 space-y-2.5">
            {['Set purses & base prices', 'Live bidding on a big screen', 'Auto purse calculation', 'Owners follow on their devices'].map((t) => (
              <li key={t} className="flex items-center gap-2.5 font-semibold text-white/90">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20"><FiCheck size={12} /></span>{t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-sm text-white/60">© {new Date().getFullYear()} CricZone. All rights reserved.</div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-5">
          <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-400 transition hover:text-slate-700 dark:hover:text-white">← Back to home</button>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-20">
          <div className="w-full max-w-md">
            <img src={logo} alt="CricZone" className="mb-8 h-11 w-auto object-contain lg:hidden" />

            <AnimatePresence mode="wait">
              <motion.form key={mode} onSubmit={submit}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <h2 className="text-3xl font-black tracking-tight">{register ? 'Create your account' : 'Welcome back'}</h2>
                <p className="mt-1.5 font-medium text-slate-500 dark:text-slate-400">
                  {register ? 'Get started with CricZone auctions.' : 'Sign in to your CricZone account.'}
                </p>

                {error && (
                  <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
                )}

                <div className="mt-6 space-y-3">
                  {register && <Field Icon={FiUser} type="text" value={name} onChange={setName} placeholder="Full name" autoFocus />}
                  <Field Icon={FiMail} type="email" value={email} onChange={setEmail} placeholder="Email address" autoFocus={!register} />
                  <Field Icon={FiLock} type="password" value={password} onChange={setPassword} placeholder="Password" />
                </div>

                <button type="submit" disabled={loading || !email || !password || (register && !name.trim())}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:opacity-60">
                  {loading ? 'Please wait…' : (register ? 'Create account' : 'Sign in')}{!loading && <FiArrowRight />}
                </button>

                <p className="mt-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {register ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button type="button" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); }}
                    className="font-black text-indigo-600 hover:underline dark:text-indigo-400">
                    {register ? 'Sign in' : 'Create one'}
                  </button>
                </p>
              </motion.form>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ Icon, value, onChange, ...rest }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 transition focus-within:border-indigo-500 dark:border-white/10 dark:bg-white/5">
      <Icon className="shrink-0 text-slate-400" />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full bg-transparent py-3.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
      />
    </div>
  );
}
