import React from 'react';
import { Zap, Activity, RefreshCw, LayoutTemplate, User, Shield, Sparkles, MapPin } from 'lucide-react';
import { ViewRole } from '../types/zeus';

interface HeaderProps {
  currentRole: ViewRole;
  onChangeRole: (role: ViewRole) => void;
  isConnected: boolean;
  onResetGrid: () => void;
  onLogout: () => void;
  onOpenGeminiSettings: () => void;
}

export default function Header({
  currentRole,
  onChangeRole,
  isConnected,
  onResetGrid,
  onLogout,
  onOpenGeminiSettings
}: HeaderProps) {
  return (
    <header className="h-16 px-6 bg-slate-900/90 backdrop-blur-2xl border-b border-slate-800 flex items-center justify-between z-30 select-none">
      {/* Brand & All-India Region Tag */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25 font-black">
          <Zap className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-white">ZEUS OS</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 rounded-full tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-400" />
              ALL-INDIA 3D TWIN
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Dynamic EV Queue Orchestration & Anti-Herd Combinatorial Reallocation
          </p>
        </div>
      </div>

      {/* Digital Twin Command Badge */}
      <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-bold text-cyan-400">
        <Shield className="w-4 h-4 text-cyan-400" />
        <span>Municipal Command Console</span>
      </div>

      {/* Connection Status, Gemini Config & Controls */}
      <div className="flex items-center gap-3">
        {/* Gemini API Key Trigger */}
        <button
          onClick={onOpenGeminiSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all shadow-sm"
          title="Configure Google Gemini 1.5 Flash API Key"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>Gemini Copilot</span>
        </button>

        <div className="flex items-center gap-2 text-xs bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/80 animate-pulse'
                : 'bg-rose-500 shadow-sm shadow-rose-500/80'
            }`}
          />
          <span className="font-mono text-slate-300 text-[11px]">
            {isConnected ? 'NATIONAL CORE WS' : 'OFFLINE SIM'}
          </span>
        </div>

        <button
          onClick={onResetGrid}
          className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700"
          title="Reset Simulation State"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          onClick={onLogout}
          className="text-xs font-semibold text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-xl border border-slate-800 hover:border-rose-500/30 transition-all"
        >
          Exit
        </button>
      </div>
    </header>
  );
}
