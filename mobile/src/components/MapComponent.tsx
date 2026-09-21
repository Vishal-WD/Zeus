import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Station } from '../types/zeus';
import { resolveUserLocation, UserLocationResult } from '../services/locationService';

interface MapComponentProps {
  stations: Station[];
  selectedStationId?: string | null;
  onStationSelect?: (station: Station) => void;
  hoveredStationId?: string | null;
}

const METRO_HUBS = [
  { name: '🇮🇳 Pan-India', coords: [78.9629, 20.5937] as [number, number], zoom: 4.6, pitch: 0 },
  { name: '🛕 Madurai (10)', coords: [78.1198, 9.9195] as [number, number], zoom: 12.8, pitch: 35 },
  { name: '🏛️ Delhi NCR', coords: [77.1215, 28.5501] as [number, number], zoom: 12.5, pitch: 30 },
  { name: '🌊 Mumbai', coords: [72.8687, 19.0657] as [number, number], zoom: 12.5, pitch: 30 },
  { name: '🌿 Bengaluru', coords: [77.6648, 12.8452] as [number, number], zoom: 12.5, pitch: 30 },
  { name: '⚡ Chennai', coords: [80.2337, 12.9348] as [number, number], zoom: 12.5, pitch: 30 },
  { name: '💎 Hyderabad', coords: [78.3498, 17.4156] as [number, number], zoom: 12.5, pitch: 30 },
  { name: '🕌 Kolkata', coords: [88.4328, 22.5804] as [number, number], zoom: 12.5, pitch: 30 },
];

export default function MapComponent({
  stations,
  selectedStationId,
  onStationSelect,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationResult | null>(null);
  const [activeCityTab, setActiveCityTab] = useState<string>('🇮🇳 Pan-India');

  // 1. Resolve User Location on Mount
  useEffect(() => {
    resolveUserLocation().then((loc) => {
      setUserLocation(loc);
    });
  }, []);

  // 2. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const darkMatterStyleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    const fallbackTomTomStyle = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/styles/basic-night.json';

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: darkMatterStyleUrl,
      center: [78.9629, 20.5937],
      zoom: 4.6,
      pitch: 0,
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
              'https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=KaK6bJ7gLxgEZPvWSMvmlAAp8tI6rwgG'
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

  // 3. Render and Synchronize Grounded Pinpoint EV Station Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing station markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stations.forEach((st) => {
      if (!st.coords || isNaN(st.coords[0]) || isNaN(st.coords[1])) return;

      const isSelected = st.id === selectedStationId;
      const freePlugs = Math.max(0, st.plugs - st.occupied);
      const isOptimal = st.status === 'optimal';
      const isModerate = st.status === 'moderate';

      const mainColor = isSelected ? '#38bdf8' : isOptimal ? '#10b981' : isModerate ? '#f59e0b' : '#f43f5e';
      const darkBg = isSelected ? '#0369a1' : '#0f172a';

      // Clean, precision SVG Grounded Pin Marker with exact (16, 38) anchor at bottom needle tip
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
        setHoveredStation(st);
        const rect = el.getBoundingClientRect();
        setHoverPos({ x: rect.left + 16, y: rect.top });
      });

      el.addEventListener('mouseleave', () => {
        setHoveredStation(null);
        setHoverPos(null);
      });

      // Anchor at exact bottom needle point (tip of pin)
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([st.coords[0], st.coords[1]])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [stations, selectedStationId, onStationSelect]);

  // 4. Render Live User / Operator Command Location Beacon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !userLocation.coords) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const userEl = document.createElement('div');
    userEl.className = 'zeus-user-location-marker pointer-events-none select-none';
    userEl.style.width = '36px';
    userEl.style.height = '36px';
    userEl.style.position = 'relative';

    userEl.innerHTML = `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing Radar Wave -->
        <div style="
          position: absolute;
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          background: rgba(56, 189, 248, 0.35);
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <!-- Outer Glow Ring -->
        <div style="
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: #0284c7;
          border: 2px solid #ffffff;
          box-shadow: 0 0 12px #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Inner Core Dot -->
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

  // 5. Smooth Camera Fly-To when Station is selected
  useEffect(() => {
    if (selectedStationId && stations.length > 0) {
      const selected = stations.find((s) => s.id === selectedStationId);
      if (selected && selected.coords && mapRef.current) {
        mapRef.current.flyTo({
          center: [selected.coords[0], selected.coords[1]],
          zoom: 13.8,
          pitch: 35,
          duration: 900,
        });
      }
    }
  }, [selectedStationId, stations]);

  // Fly to user location
  const handleFlyToUserLocation = () => {
    if (userLocation && mapRef.current) {
      setActiveCityTab('📍 My Location');
      mapRef.current.flyTo({
        center: userLocation.coords,
        zoom: 13.5,
        pitch: 35,
        duration: 900,
      });
    }
  };

  // Quick jump to major metro hub
  const handleJumpToHub = (hub: typeof METRO_HUBS[0]) => {
    setActiveCityTab(hub.name);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: hub.coords,
        zoom: hub.zoom,
        pitch: hub.pitch,
        bearing: 0,
        duration: 900,
      });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Interactive MapLibre 3D Container */}
      <div ref={mapContainer} className="absolute inset-0 h-full w-full" />

      {/* Top Floating Multi-City Quick Navigation Bar */}
      <div className="absolute top-3 inset-x-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Quick Metro Jump Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl pointer-events-auto">
          {METRO_HUBS.map((hub) => (
            <button
              key={hub.name}
              onClick={() => handleJumpToHub(hub)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                activeCityTab === hub.name
                  ? 'bg-cyan-500 text-slate-950 shadow-md scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {hub.name}
            </button>
          ))}
        </div>

        {/* Right: User Location Status Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {userLocation && (
            <button
              onClick={handleFlyToUserLocation}
              title={`Center on your location (${userLocation.city}, ${userLocation.state})`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-lg backdrop-blur-xl transition-all active:scale-95 ${
                activeCityTab === '📍 My Location'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40 hover:bg-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>📍 {userLocation.city || 'Command HQ'}</span>
              <span className="text-[10px] font-mono opacity-80">
                [{userLocation.coords[0].toFixed(2)}, {userLocation.coords[1].toFixed(2)}]
              </span>
            </button>
          )}

          <div className="bg-slate-900/90 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{stations.length} Grid Hubs</span>
          </div>
        </div>
      </div>

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
          <p className="text-[10px] text-slate-400 mb-1.5 truncate">
            {hoveredStation.address || hoveredStation.zone}
          </p>
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
