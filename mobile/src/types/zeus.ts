/* ── Zeus OS — TypeScript Domain Types ── */

export interface TimeSlot {
  id: string;
  time_range: string;
  status: 'FREE' | 'BOOKED' | 'CHARGING' | 'MAINTENANCE';
  driver_name?: string;
  vehicle?: string;
  utr_id?: string;
  payment_status?: 'SUCCESS' | 'PENDING' | 'REFUNDED';
}

export interface Booth {
  id: string;
  station_id: string;
  booth_number: string;
  name: string;
  connector_type: 'CCS2' | 'CHAdeMO' | 'Type-2 AC' | 'GB/T';
  power_kw: number;
  price_per_kwh: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  slots: TimeSlot[];
}

export interface Station {
  id: string;
  name: string;
  zone: string;
  coords: [number, number];
  plugs: number;
  occupied: number;
  queue: number;
  status: 'optimal' | 'moderate' | 'jammed' | string;
  power_kw?: number;
  price_per_kwh?: number;
  address?: string;
  contact?: string;
  booths?: Booth[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STATION_MANAGER';
  station_id?: string;
  created_at: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicle: string;
  battery_kwh: number;
  soc: number;
  target_station: string;
  reserved_slot: string;
  eta_minutes: number;
  is_rerouted: boolean;
  anomaly_flagged: boolean;
  current_location: [number, number];
  origin_name: string;
  queue?: number;
}

export interface GridMetrics {
  wait_time_cut: string;
  grid_utilization: string;
  dead_slots_prevented: number;
  total_energy_kwh: number;
  co2_saved_kg: number;
  active_hubs_count: number;
  active_evs_in_grid: number;
}

export interface AnomalyPayload {
  type: string;
  severity?: string;
  corridor?: string;
  speed_drop_percent?: number;
  message: string;
  driver?: Driver;
  stations?: Station[];
  optimization?: {
    ranked_recommendations: any[];
  };
}

export type AnomalyAlert = AnomalyPayload;

export interface SwapSuccessPayload {
  type: string;
  message: string;
  driver?: Driver;
  promoted_driver?: Driver;
  stations?: Station[];
  metrics?: GridMetrics;
}

export interface GridStatePayload {
  type: string;
  region?: string;
  stations: Station[];
  drivers: Driver[];
  metrics?: GridMetrics;
}

export type ViewRole = 'ADMIN' | 'DRIVER' | 'SPLIT_DEMO';

