import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Mail,
  Lock,
  User,
  ArrowRight,
  Bike,
  Car,
  AlertCircle
} from 'lucide-react';
import {
  loginUser,
  registerUser,
  loginWithGoogle,
  loginAsDemoGuest
} from '../services/firebase';

export default function DriverAuthView() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [vehicleType, setVehicleType] = useState<'scooty' | 'car'>('scooty');
  const [vehicleModel, setVehicleModel] = useState('Ola S1 Pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Bug 2 fix: Google Sign-In popup is blocked inside Android WebViews (Capacitor).
  // Detect native context and hide the button to prevent a guaranteed error.
  const isNativeApp = !!(window as any).Capacitor?.isNativePlatform?.();

  const scootyModels = [
    'Ola S1 Pro (4 kWh)',
    'Ather 450X Gen 3 (3.7 kWh)',
    'TVS iQube ST (5.1 kWh)',
    'Bajaj Chetak (3.2 kWh)',
    'Hero Vida V1 Pro (3.9 kWh)'
  ];

  const carModels = [
    'Tata Nexon EV Max (40.5 kWh)',
    'Tata Tiago EV (24 kWh)',
    'Tata Punch EV (35 kWh)',
    'MG ZS EV (50.3 kWh)',
    'Hyundai Ioniq 5 (72.6 kWh)'
  ];

  // Email & Password submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await registerUser(email, password, displayName, vehicleType, vehicleModel);
      } else {
        await loginUser(email, password);
      }
      navigate('/driver');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In (Login only)
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/driver');
    } catch (err: any) {
      setError(err.message || 'Google sign-in could not be completed');
    } finally {
      setLoading(false);
    }
  };

  // 1-Tap Guest Access
  const handleDemoGuest = (type: 'scooty' | 'car') => {
    loginAsDemoGuest(type);
    navigate('/driver');
  };

  return (
    <div className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-slate-800 select-none">
      {/* Brand Hero */}
      <div className="w-full max-w-sm text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/25 mb-3 font-black">
          <Zap className="w-9 h-9 fill-current" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ZEUS</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Real-Time 3D Road Navigation & Empty Charging Docks
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/90 relative overflow-hidden">
        {/* Tab Switcher: Sign In vs Register */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              !isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            New Driver
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Google Sign-In (LOGIN ONLY, NEVER SHOWN ON REGISTRATION OR IN NATIVE APP) ── */}
        {!isRegister && !isNativeApp && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-300 text-slate-700 font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
            >
              {/* Google G Logo SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400">
                or with email
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>
          </div>
        )}

        {/* ── Form: Email & Password (and Vehicle Profile when registering) ── */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">YOUR FULL NAME</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="K. Murugan"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">EMAIL ADDRESS</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pilot@zeus.ev"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">PASSWORD</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Vehicle Selection (Required during Registration) */}
          {isRegister && (
            <div className="pt-1">
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                SELECT YOUR EV VEHICLE
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType('scooty');
                    setVehicleModel(scootyModels[0]);
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    vehicleType === 'scooty'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Bike className="w-5 h-5 text-emerald-600" />
                  <span>Electric Scooty</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVehicleType('car');
                    setVehicleModel(carModels[0]);
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    vehicleType === 'car'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Car className="w-5 h-5 text-emerald-600" />
                  <span>Electric Car</span>
                </button>
              </div>

              <select
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {(vehicleType === 'scooty' ? scootyModels : carModels).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <span>
              {loading
                ? 'Connecting to Firebase...'
                : isRegister
                ? 'Create Driver Account'
                : 'Sign In to App'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Tap Guest Access */}
        <div className="mt-4 pt-3.5 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center mb-2">
            1-Tap Demo Rider
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoGuest('scooty')}
              className="py-2 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200"
            >
              <Bike className="w-3.5 h-3.5 text-emerald-600" />
              <span>Scooty</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoGuest('car')}
              className="py-2 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200"
            >
              <Car className="w-3.5 h-3.5 text-cyan-600" />
              <span>EV Car</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
