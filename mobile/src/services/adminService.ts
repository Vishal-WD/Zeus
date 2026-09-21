import { AdminUser, Booth, TimeSlot } from '../types/zeus';

const ADMIN_STORAGE_KEY = 'zeus_active_admin';
const ADMIN_ACCOUNTS_KEY = 'zeus_admin_accounts';
const BOOTHS_STORAGE_KEY = 'zeus_station_booths';

const DEFAULT_ADMIN: AdminUser = {
  id: 'ADM-001',
  name: 'Zeus Municipal Director',
  email: 'admin@zeus.ev',
  role: 'SUPER_ADMIN',
  created_at: new Date().toISOString(),
};

// Initialize default admin accounts in localStorage if missing
function getAdminAccounts(): Array<AdminUser & { password: string }> {
  try {
    const raw = localStorage.getItem(ADMIN_ACCOUNTS_KEY);
    if (!raw) {
      const initial = [{ ...DEFAULT_ADMIN, password: 'admin123' }];
      localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    return [{ ...DEFAULT_ADMIN, password: 'admin123' }];
  }
}

export function getStoredAdmin(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAdmin(admin: AdminUser | null): void {
  if (admin) {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
  } else {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }
}

export function loginAdmin(email: string, password: string): { success: boolean; admin?: AdminUser; error?: string } {
  const accounts = getAdminAccounts();
  const match = accounts.find((acc) => acc.email.toLowerCase() === email.trim().toLowerCase());
  if (!match) {
    return { success: false, error: 'No admin account registered with this email.' };
  }
  if (match.password !== password) {
    return { success: false, error: 'Incorrect password.' };
  }
  const { password: _, ...adminData } = match;
  setStoredAdmin(adminData);
  return { success: true, admin: adminData };
}

export function registerAdmin(data: {
  name: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'STATION_MANAGER';
  station_id?: string;
}): { success: boolean; admin?: AdminUser; error?: string } {
  const accounts = getAdminAccounts();
  const exists = accounts.some((acc) => acc.email.toLowerCase() === data.email.trim().toLowerCase());
  if (exists) {
    return { success: false, error: 'An admin account with this email already exists.' };
  }

  const newAdmin: AdminUser & { password: string } = {
    id: `ADM-${Date.now().toString().slice(-4)}`,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    role: data.role,
    station_id: data.station_id,
    created_at: new Date().toISOString(),
    password: data.password,
  };

  accounts.push(newAdmin);
  localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));

  const { password: _, ...adminData } = newAdmin;
  setStoredAdmin(adminData);
  return { success: true, admin: adminData };
}

export function logoutAdmin(): void {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

// ── Booth & Time-Slot Management ──────────────────────────────────────────

const HOURLY_TIME_RANGES = [
  '00:00 - 02:00', '02:00 - 04:00', '04:00 - 06:00', '06:00 - 08:00',
  '08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00', '14:00 - 16:00',
  '16:00 - 18:00', '18:00 - 20:00', '20:00 - 22:00', '22:00 - 24:00'
];

export function generateDefaultSlots(boothId: string): TimeSlot[] {
  const demoDrivers = [
    { name: 'K. Murugan', vehicle: 'Tata Nexon EV', utr: '329184729104' },
    { name: 'Selvi Priya', vehicle: 'MG ZS EV', utr: '883719204918' },
    { name: 'R. Anandhan', vehicle: 'Mahindra XUV400', utr: '918237465019' },
  ];

  return HOURLY_TIME_RANGES.map((range, index) => {
    let status: TimeSlot['status'] = 'FREE';
    let driver_name: string | undefined;
    let vehicle: string | undefined;
    let utr_id: string | undefined;
    let payment_status: TimeSlot['payment_status'];

    if (index === 4) { // 08:00 - 10:00
      status = 'BOOKED';
      const d = demoDrivers[index % demoDrivers.length];
      driver_name = d.name;
      vehicle = d.vehicle;
      utr_id = d.utr;
      payment_status = 'SUCCESS';
    } else if (index === 8) { // 16:00 - 18:00 peak
      status = 'CHARGING';
      const d = demoDrivers[1];
      driver_name = d.name;
      vehicle = d.vehicle;
      utr_id = d.utr;
      payment_status = 'SUCCESS';
    } else if (index === 9) { // 18:00 - 20:00
      status = 'BOOKED';
      const d = demoDrivers[2];
      driver_name = d.name;
      vehicle = d.vehicle;
      utr_id = d.utr;
      payment_status = 'SUCCESS';
    }

    return {
      id: `${boothId}-SLOT-${index + 1}`,
      time_range: range,
      status,
      driver_name,
      vehicle,
      utr_id,
      payment_status,
    };
  });
}

export function generateInitialBoothsForStation(
  stationId: string,
  plugCount: number = 6,
  powerKw: number = 150,
  pricePerKwh: number = 16
): Booth[] {
  const connectors: Booth['connector_type'][] = ['CCS2', 'CHAdeMO', 'Type-2 AC', 'CCS2', 'GB/T', 'CCS2'];
  const count = Math.max(2, plugCount);
  const booths: Booth[] = [];

  for (let i = 1; i <= count; i++) {
    const bId = `${stationId}-B${i.toString().padStart(2, '0')}`;
    const connType = connectors[(i - 1) % connectors.length];
    const isOccupied = i <= Math.ceil(count * 0.4);
    
    booths.push({
      id: bId,
      station_id: stationId,
      booth_number: `Booth ${i.toString().padStart(2, '0')}`,
      name: `${connType} Charger Dock #${i}`,
      connector_type: connType,
      power_kw: connType === 'Type-2 AC' ? 22 : powerKw,
      price_per_kwh: pricePerKwh,
      status: isOccupied ? 'OCCUPIED' : 'AVAILABLE',
      slots: generateDefaultSlots(bId),
    });
  }

  return booths;
}

export function getAllStoredBooths(): Record<string, Booth[]> {
  try {
    const raw = localStorage.getItem(BOOTHS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getStationBooths(
  stationId: string,
  plugCount: number = 6,
  powerKw: number = 150,
  pricePerKwh: number = 16
): Booth[] {
  const allBooths = getAllStoredBooths();
  if (allBooths[stationId] && allBooths[stationId].length > 0) {
    return allBooths[stationId];
  }
  const generated = generateInitialBoothsForStation(stationId, plugCount, powerKw, pricePerKwh);
  allBooths[stationId] = generated;
  localStorage.setItem(BOOTHS_STORAGE_KEY, JSON.stringify(allBooths));
  return generated;
}

export function saveStationBooths(stationId: string, booths: Booth[]): void {
  const allBooths = getAllStoredBooths();
  allBooths[stationId] = booths;
  localStorage.setItem(BOOTHS_STORAGE_KEY, JSON.stringify(allBooths));
}

export function addBoothToStation(
  stationId: string,
  data: {
    name: string;
    connector_type: Booth['connector_type'];
    power_kw: number;
    price_per_kwh: number;
  }
): Booth {
  const currentBooths = getStationBooths(stationId);
  const nextNum = currentBooths.length + 1;
  const bId = `${stationId}-B${nextNum.toString().padStart(2, '0')}`;

  const newBooth: Booth = {
    id: bId,
    station_id: stationId,
    booth_number: `Booth ${nextNum.toString().padStart(2, '0')}`,
    name: data.name || `${data.connector_type} Dock #${nextNum}`,
    connector_type: data.connector_type,
    power_kw: data.power_kw,
    price_per_kwh: data.price_per_kwh,
    status: 'AVAILABLE',
    slots: generateDefaultSlots(bId),
  };

  currentBooths.push(newBooth);
  saveStationBooths(stationId, currentBooths);
  return newBooth;
}

export function updateBoothSlot(
  stationId: string,
  boothId: string,
  slotId: string,
  updates: Partial<TimeSlot>
): Booth[] {
  const currentBooths = getStationBooths(stationId);
  const boothIndex = currentBooths.findIndex((b) => b.id === boothId);
  if (boothIndex === -1) return currentBooths;

  const booth = currentBooths[boothIndex];
  const slotIndex = booth.slots.findIndex((s) => s.id === slotId);
  if (slotIndex !== -1) {
    booth.slots[slotIndex] = { ...booth.slots[slotIndex], ...updates };
  }

  currentBooths[boothIndex] = booth;
  saveStationBooths(stationId, currentBooths);
  return currentBooths;
}

export function toggleBoothStatus(
  stationId: string,
  boothId: string,
  status: 'AVAILABLE' | 'MAINTENANCE' | 'OCCUPIED'
): Booth[] {
  const currentBooths = getStationBooths(stationId);
  const boothIndex = currentBooths.findIndex((b) => b.id === boothId);
  if (boothIndex !== -1) {
    currentBooths[boothIndex].status = status;
  }
  saveStationBooths(stationId, currentBooths);
  return currentBooths;
}
