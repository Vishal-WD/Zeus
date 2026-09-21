/**
 * Zeus OS — Universal High-Precision Geolocation Service
 * 
 * Works across:
 *  1. Native Android APK (Physical GPS Satellite Geolocation)
 *  2. Desktop Electron (.exe standalone app with OS & IP Geolocation)
 *  3. Modern Web Browsers
 */

export interface UserLocationResult {
  coords: [number, number]; // [lng, lat]
  city: string;
  state: string;
  country: string;
  source: 'gps' | 'ip' | 'manual' | 'cache' | 'default';
  accuracyMeters?: number;
}

export const POPULAR_MUNICIPAL_HUBS: { name: string; city: string; state: string; coords: [number, number] }[] = [
  { name: '🛕 Madurai Smart Grid Hub', city: 'Madurai', state: 'Tamil Nadu', coords: [78.1198, 9.9195] },
  { name: '⚡ Chennai OMR Hub', city: 'Chennai', state: 'Tamil Nadu', coords: [80.2337, 12.9348] },
  { name: '🌿 Coimbatore Tech Hub', city: 'Coimbatore', state: 'Tamil Nadu', coords: [77.0182, 11.0286] },
  { name: '🚀 Bengaluru Electronic City', city: 'Bengaluru', state: 'Karnataka', coords: [77.6648, 12.8452] },
  { name: '💎 Hyderabad Hitec City', city: 'Hyderabad', state: 'Telangana', coords: [78.3498, 17.4156] },
  { name: '🌊 Mumbai BKC Corridor', city: 'Mumbai', state: 'Maharashtra', coords: [72.8687, 19.0657] },
  { name: '🏛️ Delhi NCR Aerocity', city: 'New Delhi', state: 'Delhi', coords: [77.1215, 28.5501] },
  { name: '🕌 Kolkata Sector V', city: 'Kolkata', state: 'West Bengal', coords: [88.4328, 22.5804] },
  { name: '🌴 Kochi Infopark Hub', city: 'Kochi', state: 'Kerala', coords: [76.3572, 10.0124] },
];

const DEFAULT_COMMAND_CENTER: UserLocationResult = {
  coords: [78.1198, 9.9195], // Madurai Smart Grid Operational Center
  city: 'Madurai',
  state: 'Tamil Nadu',
  country: 'India',
  source: 'default',
  accuracyMeters: 10,
};

/**
 * Reverse-geocode coordinates to get exact locality & city name
 */
export async function reverseGeocodeCoords(lon: number, lat: number): Promise<{ city: string; state: string }> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || 'Regional Sector';
      const state = data.principalSubdivision || 'India';
      return { city, state };
    }
  } catch {}

  return { city: 'Regional Sector', state: 'India' };
}

/**
 * Fetch IP-based location as fallback for desktop
 */
async function fetchIpGeolocation(): Promise<UserLocationResult | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          coords: [data.longitude, data.latitude],
          city: data.city || 'Regional Sector',
          state: data.region || 'India',
          country: data.country_name || 'India',
          source: 'ip',
          accuracyMeters: 2500,
        };
      }
    }
  } catch {}

  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          coords: [data.longitude, data.latitude],
          city: data.city || 'Regional Sector',
          state: data.region || 'India',
          country: data.country || 'India',
          source: 'ip',
          accuracyMeters: 3000,
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Explicitly request GPS location with user permission prompt
 */
export async function requestExactGpsLocation(): Promise<UserLocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation not supported by device');
  }

  return new Promise<UserLocationResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const { city, state } = await reverseGeocodeCoords(coords[0], coords[1]);
        const result: UserLocationResult = {
          coords,
          city,
          state,
          country: 'India',
          source: 'gps',
          accuracyMeters: Math.round(pos.coords.accuracy || 10),
        };
        localStorage.setItem('zeus_live_gps', JSON.stringify(result.coords));
        localStorage.setItem('zeus_live_location_meta', JSON.stringify(result));
        resolve(result);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

/**
 * Manually set user location (e.g., chosen from city picker or address search)
 */
export function setUserManualLocation(
  coords: [number, number],
  city: string,
  state: string = 'Tamil Nadu'
): UserLocationResult {
  const result: UserLocationResult = {
    coords,
    city,
    state,
    country: 'India',
    source: 'manual',
    accuracyMeters: 5,
  };
  localStorage.setItem('zeus_live_gps', JSON.stringify(coords));
  localStorage.setItem('zeus_live_location_meta', JSON.stringify(result));
  return result;
}

/**
 * Universal resolver: Cached/Manual -> GPS -> IP -> Default
 */
export async function resolveUserLocation(forceFresh: boolean = false): Promise<UserLocationResult> {
  if (!forceFresh) {
    const cachedMeta = localStorage.getItem('zeus_live_location_meta');
    if (cachedMeta) {
      try {
        const parsed = JSON.parse(cachedMeta);
        if (parsed && Array.isArray(parsed.coords) && parsed.coords.length === 2) {
          return { ...parsed, source: 'cache' };
        }
      } catch {}
    }
  }

  // 1. Try Hardware GPS Geolocation first
  try {
    return await requestExactGpsLocation();
  } catch {
    // GPS timed out or denied
  }

  // 2. Try IP Geolocation Fallback
  const ipResult = await fetchIpGeolocation();
  if (ipResult) {
    localStorage.setItem('zeus_live_gps', JSON.stringify(ipResult.coords));
    localStorage.setItem('zeus_live_location_meta', JSON.stringify(ipResult));
    return ipResult;
  }

  // 3. Fallback to default
  return DEFAULT_COMMAND_CENTER;
}
