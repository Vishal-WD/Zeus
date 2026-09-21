import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Station } from '../types/zeus';
import {
  resolveUserLocation,
  requestExactGpsLocation,
  setUserManualLocation,
  POPULAR_MUNICIPAL_HUBS,
  UserLocationResult,
} from '../services/locationService';
import { scrapeLiveTomTomEVStations } from '../services/tomtomService';

interface MapComponentProps {
  stations: Station[];
  selectedStationId?: string | null;
  onStationSelect?: (station: Station) => void;
  hoveredStationId?: string | null;
}

type ProximityRadius = '10' | '25' | '50' | 'all';

// Calculate Haversine distance in km
function calculateDistanceKm(coord1: [number, number], coord2: [number, number]): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapComponent({
  stations: initialStations,
  selectedStationId,
  onStationSelect,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [userLocation, setUserLocation] = useState<UserLocationResult | null>(null);
  const [activeRadius, setActiveRadius] = useState<ProximityRadius>('25');
  const [nearbyStations, setNearbyStations] = useState<Station[]>(initialStations);
  const [hoveredStation, setHoveredStation] = useState<(Station & { distanceKm?: number }) | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Resolve User Live Location on Mount
  useEffect(() => {
    resolveUserLocation().then(async (loc) => {
      setUserLocation(loc);

      try {
        const liveScraped = await scrapeLiveTomTomEVStations(loc.coords, 35000);
        if (liveScraped && liveScraped.length > 0) {
          setNearbyStations(liveScraped as any);
        }
      } catch (err) {
        console.warn('Nearby station scrape notice:', err);
      }
    });
  }, []);

  // Update nearby stations if parent passes new grid state
  useEffect(() => {
    if (initialStations && initialStations.length > 0) {
      setNearbyStations((prev) => {
        const map = new Map();
        initialStations.forEach((s) => map.set(s.id, s));
        prev.forEach((s) => {
          if (!map.has(s.id)) map.set(s.id, s);
        });
        return Array.from(map.values());
      });
    }
  }, [initialStations]);

  // 2. Filter Stations by Proximity Radius to User Location
  const filteredStations = useMemo(() => {
    if (!userLocation || !userLocation.coords) return nearbyStations;
    if (activeRadius === 'all') return nearbyStations;

    const maxKm = parseInt(activeRadius, 10);
    const withDistance = nearbyStations
      .map((st) => {
        if (!st.coords || isNaN(st.coords[0]) || isNaN(st.coords[1])) return null;
        const dist = calculateDistanceKm(userLocation.coords, st.coords);
        return { ...st, distanceKm: Math.round(dist * 10) / 10 };
      })
      .filter((st): st is Station & { distanceKm: number } => st !== null);

    const withinRadius = withDistance.filter((st) => st.distanceKm <= maxKm);

    if (withinRadius.length === 0) {
      return withDistance.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
    }

    return withinRadius.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [nearbyStations, userLocation, activeRadius]);

  // 3. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const darkMatterStyleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    const fallbackTomTomStyle = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/styles/basic-night.json';

    const startCenter: [number, number] = userLocation?.coords || [78.1198, 9.9195];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: darkMatterStyleUrl,
      center: startCenter,
      zoom: 13.5,
      pitch: 20,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('error', (e) => {
      console.warn('[Zeus Map] Style warning, trying fallback:', e);
      if (!map.getStyle() || !map.getStyle().sources) {
        try {
          map.setStyle(fallbackTomTomStyle);
        } catch {}
      }
    });

    map.on('load', () => {
      map.resize();
      try {
        if (!map.getSource('tomtom-traffic-flow')) {
          map.addSource('tomtom-traffic-flow', {
            type: 'raster',
            tiles: [
              'https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=KaK6bJ7gLxgEZPvWSMvmlAAp8tI6rwgG',
            ],
            tileSize: 256,
          });
          map.addLayer({
            id: 'tomtom-traffic-flow-layer',
            type: 'raster',
            source: 'tomtom-traffic-flow',
            paint: { 'raster-opacity': 0.75 },
          });
        }
      } catch (err) {
        console.warn('[Zeus Map] Traffic flow layer notice:', err);
      }
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 4. Center Camera on User Location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !userLocation.coords) return;

    if (filteredStations.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend(userLocation.coords);
      filteredStations.forEach((st) => {
        if (st.coords && !isNaN(st.coords[0]) && !isNaN(st.coords[1])) {
          bounds.extend(st.coords);
        }
      });

      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 90, left: 70, right: 70 },
        maxZoom: 14.5,
        duration: 900,
      });
    } else {
      map.flyTo({
        center: userLocation.coords,
        zoom: 13.8,
        duration: 900,
      });
    }
  }, [userLocation]);

  // 5. Render Grounded EV Station Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredStations.forEach((st) => {
      if (!st.coords || isNaN(st.coords[0]) || isNaN(st.coords[1])) return;

      const isSelected = st.id === selectedStationId;
      const freePlugs = Math.max(0, st.plugs - st.occupied);
      const isOptimal = st.status === 'optimal';
      const isModerate = st.status === 'moderate';

      const mainColor = isSelected ? '#38bdf8' : isOptimal ? '#10b981' : isModerate ? '#f59e0b' : '#f43f5e';
      const darkBg = isSelected ? '#0369a1' : '#0f172a';

      const el = document.createElement('div');
      el.className = 'zeus-pin-marker cursor-pointer select-none';
      el.style.width = '32px';
      el.style.height = '38px';
      el.style.position = 'relative';
      el.style.display = 'block';
      el.style.cursor = 'pointer';

      el.innerHTML = `
        <div style="
          width: 32px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'};
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          <!-- Precise SVG Teardrop Pin Grounded at Bottom Tip (16, 38) -->
          <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
            <path d="M16 38C16 38 29 23.5 29 14.5C29 6.49 23.18 0 16 0C8.82 0 3 6.49 3 14.5C3 23.5 16 38 16 38Z" fill="${darkBg}" stroke="${mainColor}" stroke-width="2"/>
            <!-- Inner Glowing Core Circle -->
            <circle cx="16" cy="14.5" r="9" fill="${mainColor}" fill-opacity="0.25"/>
            <!-- Lightning Bolt Icon -->
            <path d="M16.8 8.5L12.5 14H16L15.2 20.5L19.5 15H16L16.8 8.5Z" fill="${mainColor}"/>
          </svg>
          <!-- Plug count mini-badge on top-right -->
          <div style="
            position: absolute;
            top: -4px;
            right: -6px;
            background: ${mainColor};
            color: #0f172a;
            font-size: 8px;
            font-weight: 900;
            font-family: system-ui, sans-serif;
            padding: 1px 4px;
            border-radius: 9999px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.8);
            border: 1px solid #ffffff;
            white-space: nowrap;
          ">
            ${freePlugs}
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onStationSelect) {
          onStationSelect(st);
        }
      });

      el.addEventListener('mouseenter', () => {
        const dist = userLocation?.coords ? calculateDistanceKm(userLocation.coords, st.coords) : undefined;
        setHoveredStation({ ...st, distanceKm: dist ? Math.round(dist * 10) / 10 : undefined });
        const rect = el.getBoundingClientRect();
        setHoverPos({ x: rect.left + 16, y: rect.top });
      });

      el.addEventListener('mouseleave', () => {
        setHoveredStation(null);
        setHoverPos(null);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([st.coords[0], st.coords[1]])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [filteredStations, selectedStationId, onStationSelect, userLocation]);

  // 6. Render Live User / Operator Location Beacon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !userLocation.coords) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const userEl = document.createElement('div');
    userEl.className = 'zeus-user-location-marker pointer-events-none select-none';
    userEl.style.width = '40px';
    userEl.style.height = '40px';
    userEl.style.position = 'relative';

    userEl.innerHTML = `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 9999px;
          background: rgba(14, 165, 233, 0.35);
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          border: 2.5px solid #ffffff;
          box-shadow: 0 0 14px #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 8px;
            height: 8px;
            border-radius: 9999px;
            background: #ffffff;
          "></div>
        </div>
      </div>
    `;

    userMarkerRef.current = new maplibregl.Marker({ element: userEl, anchor: 'center' })
      .setLngLat(userLocation.coords)
      .addTo(map);
  }, [userLocation]);

  // Handle explicit GPS Permission Request
  const handleRequestExactGps = async () => {
    setIsGpsLoading(true);
    setGpsErrorMsg(null);
    try {
      const loc = await requestExactGpsLocation();
      setUserLocation(loc);
      setIsLocationModalOpen(false);

      // Scrape live TomTom stations around newly acquired exact GPS coordinates
      scrapeLiveTomTomEVStations(loc.coords, 35000).then((live) => {
        if (live && live.length > 0) setNearbyStations(live as any);
      });
    } catch (err: any) {
      setGpsErrorMsg(err?.message || 'Location permission denied or GPS unavailable');
    } finally {
      setIsGpsLoading(false);
    }
  };

  // Handle manual hub / city selection
  const handleSelectMunicipalHub = (hub: typeof POPULAR_MUNICIPAL_HUBS[0]) => {
    const loc = setUserManualLocation(hub.coords, hub.city, hub.state);
    setUserLocation(loc);
    setIsLocationModalOpen(false);

    // Scrape live stations around selected hub
    scrapeLiveTomTomEVStations(hub.coords, 35000).then((live) => {
      if (live && live.length > 0) setNearbyStations(live as any);
    });
  };

  const handleCenterOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: userLocation.coords,
        zoom: 14.5,
        pitch: 30,
        duration: 900,
      });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Interactive MapLibre 3D Container */}
      <div ref={mapContainer} className="absolute inset-0 h-full w-full" />

      {/* Top Floating Proximity & Location Command Bar */}
      <div className="absolute top-3 inset-x-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Proximity Radius Filters */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl pointer-events-auto">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1">
            <span>🎯</span> Nearby:
          </span>
          <button
            onClick={() => setActiveRadius('10')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeRadius === '10'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            10 km
          </button>
          <button
            onClick={() => setActiveRadius('25')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeRadius === '25'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            25 km (Default)
          </button>
          <button
            onClick={() => setActiveRadius('50')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeRadius === '50'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            50 km
          </button>
          <button
            onClick={() => setActiveRadius('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              activeRadius === 'all'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Regional
          </button>
        </div>

        {/* Right: User Live Location Indicator & Change Location Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {userLocation ? (
            <button
              onClick={() => setIsLocationModalOpen(true)}
              title="Click to set exact city / trigger GPS permission"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-slate-900/95 text-cyan-300 border border-cyan-500/50 hover:bg-slate-800 shadow-xl backdrop-blur-xl transition-all active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>📍 {userLocation.city || 'Your Location'}</span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-200 px-1.5 py-0.5 rounded font-mono">
                {userLocation.source === 'gps' ? '🛰️ High-Accuracy GPS' : 'Change City ▾'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-400 hover:text-white"
            >
              Set Location ▾
            </button>
          )}

          <div className="bg-slate-900/90 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{filteredStations.length} Nearby Hubs</span>
          </div>
        </div>
      </div>

      {/* Interactive Location Precision & Permission Selector Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <h3 className="text-base font-black text-white">Set Your Exact Location</h3>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Ensure high-precision EV station proximity matching by granting live GPS access or picking your active municipal region.
            </p>

            {/* Request Live Device GPS Button */}
            <button
              onClick={handleRequestExactGps}
              disabled={isGpsLoading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-98 disabled:opacity-50"
            >
              <span>{isGpsLoading ? '🛰️ Requesting Satellite GPS...' : '🛰️ Request Live Device GPS Lock'}</span>
            </button>

            {gpsErrorMsg && (
              <div className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl">
                ⚠️ {gpsErrorMsg}. Please select a city below:
              </div>
            )}

            {/* Quick Pick Municipal Regions */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Quick Select Active Hub
              </h4>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {POPULAR_MUNICIPAL_HUBS.map((hub) => (
                  <button
                    key={hub.name}
                    onClick={() => handleSelectMunicipalHub(hub)}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-left transition-all active:scale-98 group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                      {hub.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {hub.city}, {hub.state}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Glassmorphic Hover Telemetry Tooltip */}
      {hoveredStation && hoverPos && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-3 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/50 shadow-2xl text-slate-100 max-w-xs animate-in fade-in zoom-in-95 duration-150"
          style={{ left: hoverPos.x, top: hoverPos.y }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-extrabold text-xs text-white truncate max-w-[180px]">
              {hoveredStation.name}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                hoveredStation.status === 'optimal'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : hoveredStation.status === 'moderate'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {hoveredStation.status}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-1 truncate">
            {hoveredStation.address || hoveredStation.zone}
          </p>
          {hoveredStation.distanceKm !== undefined && (
            <div className="text-[10px] font-extrabold text-cyan-300 mb-1.5 flex items-center gap-1">
              <span>📍</span>
              <span>{hoveredStation.distanceKm} km from your location</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-1.5 border-t border-slate-800">
            <div>
              <span className="text-slate-500 block text-[8px] uppercase">Available</span>
              <span className="font-bold text-emerald-400">
                {hoveredStation.plugs - hoveredStation.occupied} / {hoveredStation.plugs}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8px] uppercase">Power</span>
              <span className="font-bold text-cyan-400">{hoveredStation.power_kw || 150} kW</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8px] uppercase">Rate</span>
              <span className="font-bold text-amber-300">₹{hoveredStation.price_per_kwh || 16}/u</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
