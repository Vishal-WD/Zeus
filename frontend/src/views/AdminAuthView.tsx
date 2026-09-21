import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin, registerAdmin } from '../services/adminService';
import { Shield, Zap, Lock, Mail, User, KeyRound, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminAuthView() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'STATION_MANAGER'>('SUPER_ADMIN');
  const [stationId, setStationId] = useState('HUB-01');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const res = loginAdmin(email, password);
      setLoading(false);
      if (res.success) {
        navigate('/admin');
      } else {
        setError(res.error || 'Authentication failed');
      }
    }, 400);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    setTimeout(() => {
      const res = registerAdmin({
        name,
        email,
        password,
        role,
        station_id: role === 'STATION_MANAGER' ? stationId : undefined,
      });
      setLoading(false);
      if (res.success) {
        navigate('/admin');
      } else {
        setError(res.error || 'Registration failed');
      }
    }, 400);
  };

  const quickDemoLogin = () => {
    setEmail('admin@zeus.ev');
    setPassword('admin123');
    setError(null);
    setLoading(true);
    setTimeout(() => {
      loginAdmin('admin@zeus.ev', 'admin123');
      setLoading(false);
      navigate('/admin');
    }, 300);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl shadow-cyan-950/40">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 mb-3">
            <Shield className="w-7 h-7 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>ZEUS OS</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold uppercase tracking-wider">
              Admin Gateway
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Municipal Command Center & EV Charging Network Portal
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-950/70 p-1 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              !isRegister
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isRegister
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register Admin
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/70 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Container */}
        {!isRegister ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@zeus.ev"
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all mt-6 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Access Command Center'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Commander S. Raman"
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@zeus.ev"
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Create Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Access Level
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="STATION_MANAGER">Station Manager</option>
                </select>
              </div>

              {role === 'STATION_MANAGER' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Assigned Hub
                  </label>
                  <select
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="IN-HUB-DEL-01">Delhi IGI Aerocity (IN-HUB-DEL-01)</option>
                    <option value="IN-HUB-BOM-01">Mumbai BKC Central (IN-HUB-BOM-01)</option>
                    <option value="IN-HUB-BLR-01">Bengaluru E-City (IN-HUB-BLR-01)</option>
                    <option value="IN-HUB-MAA-01">Chennai OMR (IN-HUB-MAA-01)</option>
                    <option value="IN-HUB-HYD-01">Hyderabad Hitec City (IN-HUB-HYD-01)</option>
                    <option value="IN-HUB-PUN-01">Pune Expressway (IN-HUB-PUN-01)</option>
                    <option value="IN-HUB-CCU-01">Kolkata Sector V (IN-HUB-CCU-01)</option>
                    <option value="IN-HUB-AMD-01">Ahmedabad SG Highway (IN-HUB-AMD-01)</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all mt-4 disabled:opacity-50"
            >
              <span>{loading ? 'Creating Account...' : 'Complete Admin Registration'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Quick Demo Access Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-500">
            <span className="bg-slate-900 px-2">Quick Evaluation</span>
          </div>
        </div>

        {/* Single Click Quick Demo Login */}
        <button
          type="button"
          onClick={quickDemoLogin}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all group"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Instant One-Click Demo Admin Login</span>
        </button>

        {/* Driver App Switch */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => navigate('/driver')}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center gap-1 font-medium"
          >
            <span>Switch to Driver In-Cabin Application</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
