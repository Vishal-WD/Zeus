import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Station } from '../types/zeus';

interface MapComponentProps {
  stations: Station[];
  selectedStationId?: string | null;
  onStationSelect?: (station: Station) => void;
  hoveredStationId?: string | null;
}

export default function MapComponent({
  stations,
  selectedStationId,
  onStationSelect,
}: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [hoveredStation, setHoveredStation] = useState<Station | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // All-India Geographical Center: [lng, lat]
  const allIndiaCenter: [number, number] = [78.9629, 20.5937];

  // 1. Initialize MapLibre GL Interactive Map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    // Carto Dark Matter style with 100% reliability
    const darkMatterStyleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    const fallbackTomTomStyle = 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/styles/basic-night.json';

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: darkMatterStyleUrl,
      center: allIndiaCenter,
      zoom: 4.6,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    // Add Navigation Controls (Zoom, Compass, Pitch)
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
      // Add TomTom Real-Time Traffic Flow Layer
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

    // Handle container resize
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

  // 2. Render and Sync High-Tech Grounded Station Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stations.forEach((st) => {
      if (!st.coords || isNaN(st.coords[0]) || isNaN(st.coords[1])) return;

      const isSelected = st.id === selectedStationId;
      const freePlugs = Math.max(0, st.plugs - st.occupied);
      const isOptimal = st.status === 'optimal';
      const isModerate = st.status === 'moderate';

      const statusBg = isOptimal ? '#10b981' : isModerate ? '#f59e0b' : '#f43f5e';
      const statusBorder = isOptimal ? '#34d399' : isModerate ? '#fbbf24' : '#fb7185';
      const glowColor = isOptimal
        ? 'rgba(16,185,129,0.6)'
        : isModerate
        ? 'rgba(245,158,11,0.6)'
        : 'rgba(244,63,94,0.6)';

      const el = document.createElement('div');
      el.className = 'zeus-grounded-station-marker cursor-pointer group';
      el.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: auto; user-select: none;';

      el.innerHTML = `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 7px;
          border-radius: 9999px;
          background: ${isSelected ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#0f172a'};
          border: 1.5px solid ${isSelected ? '#38bdf8' : statusBorder};
          box-shadow: 0 3px 12px ${isSelected ? 'rgba(56,189,248,0.8)' : glowColor};
          font-family: system-ui, -apple-system, sans-serif;
          white-space: nowrap;
          transform: ${isSelected ? 'scale(1.18)' : 'scale(1)'};
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        ">
          <span style="font-size: 11px; line-height: 1;">⚡</span>
          <span style="font-size: 10px; font-weight: 800; color: #ffffff; letter-spacing: 0.02em;">
            ${freePlugs}/${st.plugs}
          </span>
          <span style="
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 9999px;
            background: ${statusBg};
            box-shadow: 0 0 5px ${statusBg};
          "></span>
        </div>
        <!-- Grounded Needle Pin -->
        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid ${isSelected ? '#38bdf8' : statusBorder};
          margin-top: -1px;
        "></div>
        <!-- Pinpoint Ground Spot -->
        <div style="
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: ${isSelected ? '#38bdf8' : statusBg};
          box-shadow: 0 0 6px ${isSelected ? '#38bdf8' : statusBg};
          margin-top: -1px;
        "></div>
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
        setHoverPos({ x: rect.left + rect.width / 2, y: rect.top });
      });

      el.addEventListener('mouseleave', () => {
        setHoveredStation(null);
        setHoverPos(null);
      });

      // Anchor at bottom needle tip directly on the GPS coordinates
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([st.coords[0], st.coords[1]])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [stations, selectedStationId, onStationSelect]);

  // 3. Smooth Camera Fly-To when Station is selected
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

  const handleResetToAllIndia = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: allIndiaCenter,
        zoom: 4.6,
        pitch: 0,
        bearing: 0,
        duration: 900,
      });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Interactive MapLibre 3D Container */}
      <div ref={mapContainer} className="absolute inset-0 h-full w-full" />

      {/* Map Viewport Controls Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <button
          onClick={handleResetToAllIndia}
          title="Reset View to Full India Grid"
          className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg flex items-center gap-2 text-xs font-bold text-slate-200 transition-all active:scale-95"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>India EV Grid</span>
          <span className="text-[10px] text-cyan-300 font-mono">({stations.length} Hubs)</span>
        </button>
      </div>

      {/* Glassmorphic Hover Telemetry Tooltip */}
      {hoveredStation && hoverPos && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mb-2"
          style={{ left: hoverPos.x, top: hoverPos.y }}
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 p-3 rounded-2xl shadow-2xl shadow-cyan-950/60 min-w-[220px] text-xs text-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-extrabold text-xs text-cyan-300 truncate max-w-[150px]">
                {hoveredStation.name}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
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

            <div className="space-y-1 font-medium text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Available Plugs:</span>
                <span className="text-white font-bold">
                  {hoveredStation.plugs - hoveredStation.occupied} / {hoveredStation.plugs}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Waiting Queue:</span>
                <span className="text-amber-400 font-bold">{hoveredStation.queue} EVs</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Power Capacity:</span>
                <span className="text-cyan-400 font-bold">{hoveredStation.power_kw ?? 150} kW</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tariff:</span>
                <span className="text-emerald-400 font-bold">₹{hoveredStation.price_per_kwh ?? 16}/unit</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Zone:</span>
                <span className="text-slate-300 text-[10px] truncate max-w-[130px]">{hoveredStation.zone}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


