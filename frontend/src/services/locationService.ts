/**
 * Zeus OS — Universal High-Precision Geolocation Service
 * 
 * Works seamlessly across:
 *  1. Native Android APK (Physical GPS & Network Cell Geolocation)
 *  2. Desktop Electron (.exe standalone application with IP Geolocation Fallback)
 *  3. Modern Web Browsers
 */

export interface UserLocationResult {
  coords: [number, number]; // [lng, lat]
  city: string;
  state: string;
  country: string;
  source: 'gps' | 'ip' | 'cache' | 'default';
  accuracyMeters?: number;
}

const DEFAULT_COMMAND_CENTER: UserLocationResult = {
  coords: [78.1198, 9.9195], // Madurai Smart Grid Operational Center
  city: 'Madurai',
  state: 'Tamil Nadu',
  country: 'India',
  source: 'default',
  accuracyMeters: 50,
};

/**
 * Fetch IP-based location as a fast, reliable fallback for desktop environments
 */
async function fetchIpGeolocation(): Promise<UserLocationResult | null> {
  try {
    // Primary IP Geolocation Provider
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          coords: [data.longitude, data.latitude],
          city: data.city || 'Regional Sector',
          state: data.region || data.region_code || 'India',
          country: data.country_name || 'India',
          source: 'ip',
          accuracyMeters: 2500,
        };
      }
    }
  } catch {}

  try {
    // Secondary IP Geolocation Provider
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
 * Get user location with guaranteed resolution:
 *  1. Real GPS / Browser Geolocation
 *  2. IP Geolocation Fallback (Desktop .exe & PCs)
 *  3. LocalStorage Cached Position
 *  4. Default Command Center
 */
export async function resolveUserLocation(forceFresh: boolean = false): Promise<UserLocationResult> {
  // Check cached if not forcing fresh
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

  // 1. Try Hardware GPS Geolocation
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const gpsResult = await new Promise<UserLocationResult>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            resolve({
              coords,
              city: 'Live GPS Pinpoint',
              state: 'Active Position',
              country: 'India',
              source: 'gps',
              accuracyMeters: Math.round(pos.coords.accuracy || 10),
            });
          },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });

      // Save to localStorage
      localStorage.setItem('zeus_live_gps', JSON.stringify(gpsResult.coords));
      localStorage.setItem('zeus_live_location_meta', JSON.stringify(gpsResult));
      return gpsResult;
    } catch {
      // GPS not available or timed out (standard in desktop electron without GPS chip)
    }
  }

  // 2. Try IP Geolocation Fallback
  const ipResult = await fetchIpGeolocation();
  if (ipResult) {
    localStorage.setItem('zeus_live_gps', JSON.stringify(ipResult.coords));
    localStorage.setItem('zeus_live_location_meta', JSON.stringify(ipResult));
    return ipResult;
  }

  // 3. Last fallback
  return DEFAULT_COMMAND_CENTER;
}
