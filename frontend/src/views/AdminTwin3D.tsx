import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import Header from '../components/Header';
import GeminiSettingsModal from '../components/GeminiSettingsModal';
import BoothManagementModal from '../components/BoothManagementModal';
import { Station, GridStatePayload, AnomalyPayload, SwapSuccessPayload, ViewRole } from '../types/zeus';
import { socketService } from '../services/socket';
import { briefDriver, generateAdminExecutiveSummary, speakText } from '../services/gemini';
import { getStoredAdmin, logoutAdmin, getStationBooths } from '../services/adminService';
import { ALL_INDIA_NATIONAL_HUBS } from '../services/tomtomService';
import { getPaymentQueriesFromCloud, resolvePaymentQueryInCloud, PaymentQuery } from '../services/firebase';
import {
  predictQueueRisk,
  predictGridOverloadRisk,
} from '../services/riskPredictionModel';
import {
  AlertTriangle,
  Zap,
  Activity,
  ArrowRight,
  TrendingDown,
  Clock,
  Shield,
  Layers,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Gauge,
  Plus,
  UserCheck,
  LogOut,
  Sliders,
  Volume2,
  Mic,
  CreditCard,
  CheckCircle,
  Database,
  FileText,
  HelpCircle,
  X,
  Search,
} from 'lucide-react';

interface AdminTwin3DProps {
  connected: boolean;
  gridState: GridStatePayload | null;
  anomaly: AnomalyPayload | null;
  swapInfo: SwapSuccessPayload | null;
}

export default function AdminTwin3D({
  connected,
  gridState,
  anomaly,
  swapInfo,
}: AdminTwin3DProps) {
  const navigate = useNavigate();
  // Preload all 24 Pan-India and Madurai hubs immediately for zero-delay startup
  const [stations, setStations] = useState<Station[]>(() => ALL_INDIA_NATIONAL_HUBS as any);
  const [selectedStation, setSelectedStation] = useState<Station | null>(() => (ALL_INDIA_NATIONAL_HUBS[0] as any) || null);
  const [isGeminiOpen, setIsGeminiOpen] = useState(false);
  const [isBoothModalOpen, setIsBoothModalOpen] = useState(false);
  const [simActionLoading, setSimActionLoading] = useState<string | null>(null);
  const [isExecutiveVoiceActive, setIsExecutiveVoiceActive] = useState(false);
  const [executiveDebriefText, setExecutiveDebriefText] = useState<string>('');
  
  // Payment disputes state
  const [isDisputesModalOpen, setIsDisputesModalOpen] = useState(false);
  const [paymentDisputes, setPaymentDisputes] = useState<PaymentQuery[]>([]);
  const [disputeFilter, setDisputeFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [selectedDispute, setSelectedDispute] = useState<PaymentQuery | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [isResolvingDispute, setIsResolvingDispute] = useState(false);

  // Station Search & City Filter State
  const [stationSearch, setStationSearch] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('all');

  const adminUser = getStoredAdmin();

  useEffect(() => {
    if (gridState?.stations && gridState.stations.length > 0) {
      setStations(gridState.stations);
      if (!selectedStation) {
        setSelectedStation(gridState.stations[0]);
      } else {
        const updated = gridState.stations.find((s) => s.id === selectedStation.id);
        if (updated) setSelectedStation(updated);
      }
    }
  }, [gridState]);

  // Load payment disputes from cloud
  useEffect(() => {
    getPaymentQueriesFromCloud().then((list) => {
      setPaymentDisputes(list);
    });
  }, [isDisputesModalOpen]);

  // AI Voice Executive Debrief
  const handleRunExecutiveVoiceDebrief = async () => {
    setIsExecutiveVoiceActive(true);
    try {
      const totalPlugs = stations.reduce((acc, s) => acc + (s.plugs || 0), 0);
      const totalOccupied = stations.reduce((acc, s) => acc + (s.occupied || 0), 0);
      const activeEVs = totalOccupied * 4 + 840; // realistic aggregate network count
      const totalKwh = totalOccupied * 42 + 24500;

      // Calculate top utilized bunks
      const sortedByOccupancy = [...stations].sort((a, b) => (b.occupied / Math.max(b.plugs, 1)) - (a.occupied / Math.max(a.plugs, 1)));
      const topBunks = sortedByOccupancy.slice(0, 3).map((st) => ({
        name: st.name.split('-')[0].trim(),
        utilizationPct: Math.round((st.occupied / Math.max(st.plugs, 1)) * 100),
        sessionsToday: Math.round(st.plugs * 6.5),
      }));

      const summary = await generateAdminExecutiveSummary({
        totalStations: stations.length,
        totalPlugs,
        activeVehicles: activeEVs,
        totalKwhDispensed: totalKwh,
        topBunks,
        activeAlerts: anomaly ? [anomaly.message] : [],
        resolvedDisputesCount: paymentDisputes.filter((d) => d.status === 'resolved').length,
      });

      setExecutiveDebriefText(summary);
      speakText(summary, () => setIsExecutiveVoiceActive(false));
    } catch (err) {
      console.warn('Executive debrief error:', err);
      setIsExecutiveVoiceActive(false);
    }
  };

  // Seed 24H Demo Fleet & Telemetry across India
  const handleSeedDemoFleet = () => {
    setSimActionLoading('seed');
    const seeded = stations.map((st, idx) => {
      const plugs = st.plugs || 10;
      const occupied = Math.min(plugs - 1, Math.floor(plugs * (idx % 3 === 0 ? 0.85 : 0.5)));
      const queue = idx % 2 === 0 ? Math.floor(Math.random() * 3) : 0;
      return {
        ...st,
        occupied,
        queue,
        status: (queue > 2 ? 'congested' : occupied / plugs > 0.75 ? 'moderate' : 'optimal') as any,
      };
    });
    setStations(seeded);
    if (selectedStation) {
      const match = seeded.find((s) => s.id === selectedStation.id);
      if (match) setSelectedStation(match);
    }
    setTimeout(() => {
      setSimActionLoading(null);
      handleRunExecutiveVoiceDebrief();
    }, 800);
  };

  // Handle dispute resolution
  const handleResolveDispute = async (disputeId: string, status: 'resolved' | 'investigating') => {
    setIsResolvingDispute(true);
    try {
      await resolvePaymentQueryInCloud(disputeId, status, adminNoteInput || 'Verified on SBI payment gateway. Prebooked EV bay access unlocked.');
      const updated = await getPaymentQueriesFromCloud();
      setPaymentDisputes(updated);
      if (selectedDispute && selectedDispute.id === disputeId) {
        setSelectedDispute({ ...selectedDispute, status, adminNotes: adminNoteInput || selectedDispute.adminNotes });
      }
      setAdminNoteInput('');
    } finally {
      setIsResolvingDispute(false);
    }
  };

  // Actions triggering backend simulation events
  const triggerJam = () => {
    setSimActionLoading('jam');
    socketService.send('TRIGGER_ARTERIAL_JAM');
    setTimeout(() => setSimActionLoading(null), 1200);
  };

  const triggerSwap = () => {
    setSimActionLoading('swap');
    socketService.send('EXECUTE_SLOT_SWAP');
    setTimeout(() => setSimActionLoading(null), 1200);
  };

  const resetGrid = () => {
    setSimActionLoading('reset');
    socketService.send('RESET_GRID');
    setTimeout(() => setSimActionLoading(null), 1200);
  };

  const metrics = gridState?.metrics;
  const pendingDisputesCount = paymentDisputes.filter((d) => d.status === 'pending').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        currentRole="ADMIN"
        onChangeRole={(role: ViewRole) => {
          if (role === 'DRIVER') navigate('/driver');
        }}
        isConnected={connected}
        onResetGrid={resetGrid}
        onLogout={() => navigate('/')}
        onOpenGeminiSettings={() => setIsGeminiOpen(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Simulation Scenarios & Quick Actions Bar */}
        <div className="w-80 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 z-20">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Scenario Control Hub
            </h2>
            <p className="text-[11px] text-slate-400 mb-3">
              Trigger municipal events to demonstrate autonomous queue dissipation & slot reassignment.
            </p>

            <div className="space-y-2">
              <button
                onClick={triggerJam}
                disabled={!connected || !!simActionLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-between transition-all shadow-sm group disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:animate-bounce" />
                  <span>1. Inject Arterial Jam</span>
                </div>
                <span className="text-[10px] bg-rose-500/30 px-1.5 py-0.5 rounded text-rose-200">Vaigai River</span>
              </button>

              <button
                onClick={triggerSwap}
                disabled={!connected || !!simActionLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-between transition-all shadow-sm group disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>2. Autonomous Slot-Swap</span>
                </div>
                <span className="text-[10px] bg-emerald-500/30 px-1.5 py-0.5 rounded text-emerald-200">Anti-Herd</span>
              </button>

              <button
                onClick={resetGrid}
                disabled={!connected || !!simActionLoading}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-850 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Grid Simulation</span>
              </button>
            </div>

            {/* AI Executive Intelligence & Fleet Seeding */}
            <div className="pt-3.5 mt-3 border-t border-slate-800 space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span>Executive AI Intelligence</span>
              </h2>

              <button
                onClick={handleRunExecutiveVoiceDebrief}
                disabled={isExecutiveVoiceActive}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-black text-xs flex items-center justify-between shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className={`w-4 h-4 ${isExecutiveVoiceActive ? 'animate-bounce text-yellow-300' : ''}`} />
                  <span>{isExecutiveVoiceActive ? 'Speaking Report...' : '🎙️ AI Executive Report'}</span>
                </div>
                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Gemini AI</span>
              </button>

              <button
                onClick={handleSeedDemoFleet}
                disabled={!!simActionLoading}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>🌱 Seed 24H Fleet Telemetry</span>
              </button>

              <button
                onClick={() => setIsDisputesModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-750 text-cyan-300 font-bold text-xs flex items-center justify-between transition-all shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                  <span>💳 Payment Dispute Center</span>
                </div>
                {pendingDisputesCount > 0 && (
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded-full">
                    {pendingDisputesCount} Pending
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Anomaly Banner */}
          {anomaly && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-xs animate-pulse">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>ACTIVE ARTERIAL ANOMALY</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px] mb-2">{anomaly.message}</p>
              {anomaly.speed_drop_percent ? (
                <div className="text-[10px] font-mono text-rose-300">
                  Speed drop: -{anomaly.speed_drop_percent}% | Corridor: {anomaly.corridor}
                </div>
              ) : null}
            </div>
          )}

          {/* Swap Success Toast */}
          {swapInfo && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>AUTONOMOUS SWAP EXECUTED</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">{swapInfo.message}</p>
            </div>
          )}

          {/* Active Admin Session Status */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Session</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                {adminUser?.role || 'SUPER_ADMIN'}
              </span>
            </div>
            <div className="font-bold text-white text-xs truncate">
              {adminUser ? adminUser.name : 'Zeus Municipal Director'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              {adminUser ? adminUser.email : 'admin@zeus.ev'}
            </div>
            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => navigate('/admin/login')}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
              >
                <UserCheck className="w-3 h-3" />
                <span>Switch Admin Account</span>
              </button>
              <button
                onClick={() => {
                  logoutAdmin();
                  navigate('/admin/login');
                }}
                className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Aggregate KPI Cards */}
          <div className="mt-auto pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Municipal KPIs
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Wait-Time Cut</div>
                <div className="text-base font-extrabold text-emerald-400">{metrics?.wait_time_cut ?? '44.6%'}</div>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Grid Utilization</div>
                <div className="text-base font-extrabold text-cyan-400">{metrics?.grid_utilization ?? '96.8%'}</div>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">Dead Slots Saved</div>
                <div className="text-base font-extrabold text-purple-400">{metrics?.dead_slots_prevented ?? 22}</div>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">CO₂ Saved (kg)</div>
                <div className="text-base font-extrabold text-teal-400">{metrics?.co2_saved_kg ?? 2640}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: 3D Map Component with Hexagonal Docks */}
        <div className="flex-1 relative h-full w-full">
          <MapComponent
            stations={stations}
            selectedStationId={selectedStation?.id}
            onStationSelect={(st: Station) => setSelectedStation(st)}
          />

          {/* AI Executive Voice Debrief Banner */}
          {executiveDebriefText && (
            <div className="absolute top-4 inset-x-6 z-20 bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/30">
                    <Volume2 className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                      <span>GEMINI EXECUTIVE REPORT</span>
                      <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded font-mono">Audio Live</span>
                    </h4>
                    <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                      {executiveDebriefText}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExecutiveDebriefText('')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Disputes Button */}
          <div className="absolute bottom-6 left-6 z-20 flex gap-2">
            <button
              onClick={() => setIsDisputesModalOpen(true)}
              className="px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 hover:bg-slate-800 text-cyan-300 font-bold text-xs rounded-xl shadow-xl flex items-center gap-1.5 transition-all"
            >
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>Disputes & Queries ({paymentDisputes.length})</span>
            </button>
          </div>
        </div>

        {/* Right Side: Selected Station Telemetry & Queue Analytics */}
        <aside className="w-88 bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 p-4 flex flex-col overflow-y-auto shrink-0 z-20">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Dock Telemetry</span>
            <span className="text-[10px] text-cyan-400 font-mono">M/D/c QUEUEING</span>
          </h2>

          {selectedStation ? (
            <div className="space-y-3.5">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-extrabold text-white leading-tight">{selectedStation.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      selectedStation.status === 'optimal'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedStation.status === 'moderate'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {selectedStation.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{selectedStation.address || selectedStation.zone}</div>
                <div className="text-[10px] text-cyan-400 font-mono mt-1">
                  GPS: [{selectedStation.coords[0].toFixed(4)}, {selectedStation.coords[1].toFixed(4)}]
                </div>
              </div>

              {/* Live occupancy progress bar */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-400">Plugs Occupied:</span>
                  <span className="text-white font-bold">
                    {selectedStation.occupied} / {selectedStation.plugs}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      selectedStation.occupied / selectedStation.plugs > 0.8
                        ? 'bg-rose-500'
                        : selectedStation.occupied / selectedStation.plugs > 0.5
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${(selectedStation.occupied / Math.max(selectedStation.plugs, 1)) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                  <span>Available Docks:</span>
                  <span className="text-emerald-400 font-bold">
                    {selectedStation.plugs - selectedStation.occupied} Open
                  </span>
                </div>
              </div>

              {/* M/D/c Erlang Queue & AI Risk Modeling */}
              {(() => {
                const queueRisk = predictQueueRisk(
                  Math.max(1.0, selectedStation.queue * 2.5 + selectedStation.occupied * 1.2),
                  20.0,
                  selectedStation.plugs
                );
                return (
                  <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        AI Queue & Risk Forecast
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                          queueRisk.riskLevel === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : queueRisk.riskLevel === 'ELEVATED'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {queueRisk.riskLevel} SURGE RISK
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Live Vehicle Queue:</span>
                      <span className="text-amber-400 font-bold">{selectedStation.queue} waiting</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. M/D/c Wait Time:</span>
                      <span className="text-cyan-400 font-bold">
                        {queueRisk.expectedWaitMins} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Surge Risk Index:</span>
                      <span className="text-purple-400 font-bold">{queueRisk.surgeRiskScore}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Power Rating:</span>
                      <span className="text-white font-bold">{selectedStation.power_kw ?? 150} kW DC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tariff:</span>
                      <span className="text-white font-bold">₹{selectedStation.price_per_kwh ?? 16}/kWh</span>
                    </div>
                  </div>
                );
              })()}

              {/* Booth & Slot Matrix Action Button */}
              <button
                onClick={() => setIsBoothModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Layers className="w-4 h-4" />
                <span>Manage Booths & 24H Slot Matrix</span>
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-6">Select a charging dock on map</div>
          )}

          {/* List of all stations with City Filter and Quick Search */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select Station ({stations.length})
              </h3>
            </div>

            {/* Quick Search */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by city or station name..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* City Quick Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 no-scrollbar text-[10px] font-bold">
              {[
                { id: 'all', label: 'All' },
                { id: 'madurai', label: 'Madurai' },
                { id: 'bengaluru', label: 'Bengaluru' },
                { id: 'mumbai', label: 'Mumbai' },
                { id: 'chennai', label: 'Chennai' },
                { id: 'delhi', label: 'Delhi' },
                { id: 'hyderabad', label: 'Hyderabad' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCityFilter(c.id)}
                  className={`px-2 py-0.5 rounded-lg shrink-0 transition-all ${
                    cityFilter === c.id
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {stations
                .filter((st) => {
                  if (cityFilter !== 'all') {
                    const cf = cityFilter.toLowerCase();
                    const matches = (st.zone || '').toLowerCase().includes(cf) || st.name.toLowerCase().includes(cf);
                    if (!matches) return false;
                  }
                  if (stationSearch.trim()) {
                    const q = stationSearch.toLowerCase();
                    return (
                      st.name.toLowerCase().includes(q) ||
                      (st.zone || '').toLowerCase().includes(q) ||
                      (st.address || '').toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((st) => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStation(st)}
                    className={`p-2 rounded-xl text-xs cursor-pointer transition-all border flex items-center justify-between ${
                      st.id === selectedStation?.id
                        ? 'bg-cyan-950/60 border-cyan-500/70 text-white shadow-sm ring-1 ring-cyan-500/40'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold truncate text-xs">{st.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{st.zone}</div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                        st.status === 'optimal'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : st.status === 'moderate'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {st.plugs - st.occupied}/{st.plugs} OPEN
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Gemini Settings Modal */}
      <GeminiSettingsModal
        isOpen={isGeminiOpen}
        onClose={() => setIsGeminiOpen(false)}
      />

      {/* Booth & Slot Matrix Management Modal */}
      <BoothManagementModal
        isOpen={isBoothModalOpen}
        onClose={() => setIsBoothModalOpen(false)}
        station={selectedStation}
        onBoothsUpdated={() => {
          // Re-trigger grid sync if needed
        }}
      />

      {/* Payment Disputes & User Queries Modal */}
      {isDisputesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Payment Dispute & UTR Verification Center</h3>
                  <p className="text-xs text-slate-400">Driver queries synced with Firebase & SBI UPI Gateway</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDisputesModalOpen(false);
                  setSelectedDispute(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 text-xs font-bold border-b border-slate-800 pb-2">
              {(['all', 'pending', 'resolved'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDisputeFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl capitalize transition-all ${
                    disputeFilter === tab
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab} ({tab === 'all' ? paymentDisputes.length : paymentDisputes.filter(d => d.status === tab).length})
                </button>
              ))}
            </div>

            {/* Dispute List & Details Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-2 overflow-y-auto pr-1 max-h-96">
                {paymentDisputes
                  .filter((d) => disputeFilter === 'all' || d.status === disputeFilter)
                  .map((dispute) => (
                    <div
                      key={dispute.id}
                      onClick={() => setSelectedDispute(dispute)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedDispute?.id === dispute.id
                          ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-black text-cyan-400">{dispute.id}</span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            dispute.status === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : dispute.status === 'investigating'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {dispute.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-200 truncate">{dispute.stationName}</div>
                      <div className="text-[11px] text-slate-400 flex justify-between mt-1">
                        <span>₹{dispute.amount} • {dispute.userName}</span>
                        <span className="font-mono text-[10px]">UTR: {dispute.utr}</span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Selected Dispute Actions */}
              <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between text-xs space-y-3">
                {selectedDispute ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-300">{selectedDispute.id}</span>
                        <span className="text-[10px] text-slate-400">{new Date(selectedDispute.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Driver Info</div>
                        <div className="text-white font-bold">{selectedDispute.userName} ({selectedDispute.userEmail})</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Transaction Details</div>
                        <div className="text-white font-bold">₹{selectedDispute.amount} at {selectedDispute.stationName}</div>
                        <div className="font-mono text-cyan-400 text-[11px] mt-0.5">UPI UTR: {selectedDispute.utr}</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Driver Query / Issue</div>
                        <div className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{selectedDispute.issueDescription}</div>
                      </div>

                      {selectedDispute.adminNotes && (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                          <div className="text-[10px] text-emerald-400 uppercase font-bold">Admin Resolution Note</div>
                          <div className="text-emerald-200 text-[11px] mt-0.5">{selectedDispute.adminNotes}</div>
                        </div>
                      )}

                      <div className="pt-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Investigation / Resolution Note</label>
                        <input
                          type="text"
                          value={adminNoteInput}
                          onChange={(e) => setAdminNoteInput(e.target.value)}
                          placeholder="e.g. Verified on SBI gateway. Bay unlocked manually."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => handleResolveDispute(selectedDispute.id, 'investigating')}
                        disabled={isResolvingDispute}
                        className="flex-1 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl transition-all"
                      >
                        Mark Investigating
                      </button>
                      <button
                        onClick={() => handleResolveDispute(selectedDispute.id, 'resolved')}
                        disabled={isResolvingDispute}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all"
                      >
                        Verify & Resolve
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-500 py-16">
                    <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <span>Select a dispute ticket on the left to view details and SBI gateway verification.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
