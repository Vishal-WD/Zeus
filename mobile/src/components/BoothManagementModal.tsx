import React, { useState, useEffect } from 'react';
import { Station, Booth, TimeSlot } from '../types/zeus';
import {
  getStationBooths,
  addBoothToStation,
  updateBoothSlot,
  toggleBoothStatus
} from '../services/adminService';
import {
  X,
  Plus,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  User,
  CreditCard,
  Settings,
  BatteryCharging,
  Layers,
  ShieldCheck
} from 'lucide-react';

interface BoothManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: Station | null;
  onBoothsUpdated?: () => void;
}

export default function BoothManagementModal({
  isOpen,
  onClose,
  station,
  onBoothsUpdated,
}: BoothManagementModalProps) {
  if (!isOpen || !station) return null;

  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [activeTab, setActiveTab] = useState<'SLOTS' | 'ADD_BOOTH'>('SLOTS');

  // New Booth Form State
  const [boothName, setBoothName] = useState('');
  const [connectorType, setConnectorType] = useState<Booth['connector_type']>('CCS2');
  const [powerKw, setPowerKw] = useState(station.power_kw || 150);
  const [pricePerKwh, setPricePerKwh] = useState(station.price_per_kwh || 16);

  // Slot Edit Modal State
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [walkinName, setWalkinName] = useState('');
  const [walkinVehicle, setWalkinVehicle] = useState('');
  const [walkinUtr, setWalkinUtr] = useState('');
  const [slotStatus, setSlotStatus] = useState<TimeSlot['status']>('FREE');

  // Load booths for station
  useEffect(() => {
    const list = getStationBooths(
      station.id,
      station.plugs,
      station.power_kw || 150,
      station.price_per_kwh || 16
    );
    setBooths(list);
    if (list.length > 0) {
      setSelectedBooth(list[0]);
    }
  }, [station]);

  const refreshBooths = () => {
    const list = getStationBooths(station.id);
    setBooths(list);
    if (selectedBooth) {
      const updated = list.find((b) => b.id === selectedBooth.id);
      if (updated) setSelectedBooth(updated);
    }
    if (onBoothsUpdated) onBoothsUpdated();
  };

  const handleAddBooth = (e: React.FormEvent) => {
    e.preventDefault();
    const created = addBoothToStation(station.id, {
      name: boothName || `${connectorType} Charger Dock`,
      connector_type: connectorType,
      power_kw: Number(powerKw),
      price_per_kwh: Number(pricePerKwh),
    });
    setBoothName('');
    setActiveTab('SLOTS');
    refreshBooths();
    setSelectedBooth(created);
  };

  const handleToggleBoothMaintenance = (booth: Booth) => {
    const nextStatus = booth.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    toggleBoothStatus(station.id, booth.id, nextStatus);
    refreshBooths();
  };

  const openSlotEdit = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setSlotStatus(slot.status);
    setWalkinName(slot.driver_name || '');
    setWalkinVehicle(slot.vehicle || '');
    setWalkinUtr(slot.utr_id || '');
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooth || !editingSlot) return;

    let updates: Partial<TimeSlot> = {
      status: slotStatus,
    };

    if (slotStatus === 'BOOKED' || slotStatus === 'CHARGING') {
      updates.driver_name = walkinName.trim() || 'Walk-In Driver';
      updates.vehicle = walkinVehicle.trim() || 'EV Vehicle';
      updates.utr_id = walkinUtr.trim() || `DEMO-${Date.now().toString().slice(-6)}`;
      updates.payment_status = 'SUCCESS';
    } else if (slotStatus === 'FREE' || slotStatus === 'MAINTENANCE') {
      updates.driver_name = undefined;
      updates.vehicle = undefined;
      updates.utr_id = undefined;
      updates.payment_status = undefined;
    }

    updateBoothSlot(station.id, selectedBooth.id, editingSlot.id, updates);
    setEditingSlot(null);
    refreshBooths();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>{station.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {station.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Booth-Wise EV Charge Registration & 24-Hour Time-Slot Matrix Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('SLOTS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'SLOTS'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Booths & Time Matrix</span>
              </button>
              <button
                onClick={() => setActiveTab('ADD_BOOTH')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'ADD_BOOTH'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Booth</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'SLOTS' ? (
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Column: Registered Booth List */}
            <div className="w-72 border-r border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider">
                <span>Registered Booths ({booths.length})</span>
                <span className="text-[10px] text-cyan-400 font-mono">LIVE</span>
              </div>

              <div className="space-y-2">
                {booths.map((b) => {
                  const isSelected = selectedBooth?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBooth(b)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-white">{b.booth_number}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            b.status === 'AVAILABLE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : b.status === 'OCCUPIED'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 font-medium truncate mb-1.5">
                        {b.name}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{b.connector_type} • {b.power_kw}kW</span>
                        <span>₹{b.price_per_kwh}/kWh</span>
                      </div>

                      {/* Maintenance Toggle */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Mode:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBoothMaintenance(b);
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                            b.status === 'MAINTENANCE'
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 hover:text-rose-300 hover:bg-rose-950/60'
                          }`}
                        >
                          <Wrench className="w-3 h-3" />
                          <span>{b.status === 'MAINTENANCE' ? 'Set Active' : 'Set Service Mode'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: 24-Hour Time Slot Schedule Matrix */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
              {selectedBooth ? (
                <>
                  {/* Booth Header Details */}
                  <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Selected Charging Dock Telemetry
                      </div>
                      <div className="text-lg font-black text-white flex items-center gap-2">
                        <span>{selectedBooth.booth_number} — {selectedBooth.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                        <span>Plug Spec: <strong className="text-cyan-300">{selectedBooth.connector_type}</strong></span>
                        <span>Rating: <strong className="text-amber-300">{selectedBooth.power_kw} kW DC</strong></span>
                        <span>Tariff: <strong className="text-emerald-300">₹{selectedBooth.price_per_kwh}/kWh</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Slot Occupancy</div>
                      <div className="text-xl font-extrabold text-cyan-400 font-mono">
                        {selectedBooth.slots.filter((s) => s.status !== 'FREE').length} / {selectedBooth.slots.length}
                      </div>
                    </div>
                  </div>

                  {/* Schedule Legend */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-bold text-slate-300 uppercase tracking-wider">
                      24-Hour Slot Matrix & Live Bookings
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Free
                      </span>
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Booked
                      </span>
                      <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> Charging
                      </span>
                      <span className="flex items-center gap-1 text-rose-400 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Service
                      </span>
                    </div>
                  </div>

                  {/* Slot Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {selectedBooth.slots.map((slot) => {
                      const isFree = slot.status === 'FREE';
                      const isBooked = slot.status === 'BOOKED';
                      const isCharging = slot.status === 'CHARGING';
                      const isMaint = slot.status === 'MAINTENANCE';

                      return (
                        <div
                          key={slot.id}
                          onClick={() => openSlotEdit(slot)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] ${
                            isFree
                              ? 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/50'
                              : isBooked
                              ? 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
                              : isCharging
                              ? 'bg-cyan-950/40 border-cyan-500/50 hover:border-cyan-400'
                              : 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-extrabold text-white flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{slot.time_range}</span>
                            </span>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                isFree
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : isBooked
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : isCharging
                                  ? 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {slot.status}
                            </span>
                          </div>

                          {slot.driver_name ? (
                            <div className="space-y-1 text-xs">
                              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate">{slot.driver_name}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate pl-5">
                                {slot.vehicle}
                              </div>
                              {slot.utr_id && (
                                <div className="text-[10px] font-mono text-cyan-300/90 pl-5 truncate">
                                  UTR: {slot.utr_id}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 py-2 text-center font-medium">
                              {isMaint ? 'Blocked for Maintenance' : 'Slot Available for Booking'}
                            </div>
                          )}

                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-cyan-400 font-semibold flex items-center justify-between">
                            <span>Click to Manage Slot</span>
                            <span>→</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                  Select a booth on the left to inspect its 24-hour time slot schedule.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Add Booth Registration Form */
          <div className="flex-1 p-8 overflow-y-auto max-w-xl mx-auto w-full">
            <h3 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>Register New EV Charging Booth</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Add a new charging dock to <strong>{station.name}</strong> with custom power ratings and connector specifications.
            </p>

            <form onSubmit={handleAddBooth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1.5">
                  Booth Name / Identifier
                </label>
                <input
                  type="text"
                  required
                  value={boothName}
                  onChange={(e) => setBoothName(e.target.value)}
                  placeholder="e.g. CCS2 High-Power Dock #5"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1.5">
                  Connector Standard
                </label>
                <select
                  value={connectorType}
                  onChange={(e) => setConnectorType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="CCS2">CCS2 (Fast DC 150kW - 350kW)</option>
                  <option value="CHAdeMO">CHAdeMO (Ultra DC 50kW - 150kW)</option>
                  <option value="Type-2 AC">Type-2 AC (Standard 22kW)</option>
                  <option value="GB/T">GB/T (Commercial Fleet DC)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1.5">
                    Power Output (kW)
                  </label>
                  <input
                    type="number"
                    required
                    min={11}
                    max={500}
                    value={powerKw}
                    onChange={(e) => setPowerKw(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1.5">
                    Tariff Rate (₹/kWh)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.5"
                    min={5}
                    max={50}
                    value={pricePerKwh}
                    onChange={(e) => setPricePerKwh(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('SLOTS')}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Booth</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Edit Slot Sub-Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white">Manage Time Slot</h4>
                <p className="text-xs text-cyan-400 font-mono">{editingSlot.time_range}</p>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1">
                  Slot Status
                </label>
                <select
                  value={slotStatus}
                  onChange={(e) => setSlotStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="FREE">FREE (Available)</option>
                  <option value="BOOKED">BOOKED (Reserved Slot)</option>
                  <option value="CHARGING">CHARGING (Active Session)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Block Slot)</option>
                </select>
              </div>

              {(slotStatus === 'BOOKED' || slotStatus === 'CHARGING') && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1">
                      Driver Name
                    </label>
                    <input
                      type="text"
                      required
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      placeholder="e.g. V. Karthik"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1">
                      Vehicle Model / No.
                    </label>
                    <input
                      type="text"
                      required
                      value={walkinVehicle}
                      onChange={(e) => setWalkinVehicle(e.target.value)}
                      placeholder="e.g. TN-59-EV-8842 (Hyundai Ioniq 5)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 tracking-wider mb-1">
                      Payment UTR Transaction ID
                    </label>
                    <input
                      type="text"
                      value={walkinUtr}
                      onChange={(e) => setWalkinUtr(e.target.value)}
                      placeholder="12-digit transaction UTR"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl"
                >
                  Update Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
