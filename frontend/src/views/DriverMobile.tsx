import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Browser } from '@capacitor/browser';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Zap,
  Navigation,
  BatteryCharging,
  Clock,
  MapPin,
  Volume2,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  CheckCircle2,
  Car,
  Bike,
  ArrowRight,
  X,
  AlertCircle,
  LogOut,
  Phone,
  Calendar,
  Ticket,
  LocateFixed,
  Locate,
  Check,
  CreditCard,
  QrCode,
  Sparkles,
  Download,
  CheckCircle,
  RefreshCw,
  Filter,
  SlidersHorizontal,
  Layers,
  Mic,
  MicOff,
  HelpCircle,
  Send,
  MessageSquare,
  Headphones,
  MessageCircle,
} from 'lucide-react';

import { Station } from '../types/zeus';
import {
  briefDriver,
  processDriverVoiceCommand,
  startVoiceRecognition,
  speakText,
  DEFAULT_GEMINI_API_KEY,
} from '../services/gemini';
import { fetchStreetRoute } from '../services/osrmRouting';
import { calculateTomTomRoute, TOMTOM_CONFIG, ALL_INDIA_NATIONAL_HUBS } from '../services/tomtomService';
import { resolveUserLocation } from '../services/locationService';
import {
  predictBatteryStrandingRisk,
  predictQueueRisk,
  rankStationsWithRiskModels,
} from '../services/riskPredictionModel';
import {
  getStoredUser,
  logoutUser,
  UserProfile,
  saveBookingToCloud,
  logEventToCloud,
  subscribeToCloudStations,
  syncStationsToCloud,
  syncTomTomScrapedStationsToCloud,
  getUserBookingsFromCloud,
  fetchUserProfileFromCloud,
  fetchPastChargesFromCloud,
  saveUserProfileToCloud,
  deleteAccountAndData,
  submitPaymentQueryToCloud,
  getPaymentQueriesFromCloud,
  CloudBooking,
  PastChargeSession,
  PaymentQuery,
} from '../services/firebase';
import BottomNavBar, { TabType } from '../components/BottomNavBar';

export interface DriverDockView {
  id: string;
  name: string;
  address: string;
  zone: string;
  contact: string;
  coords: [number, number];
  distanceKm: number;
  travelMins: number;
  availablePlugs: number;
  totalPlugs: number;
  queueLength: number;
  status: 'optimal' | 'moderate' | 'jammed' | string;
  powerKw: number;
  pricePerKwh: number;
  crowdLevel: 'empty' | 'moderate' | 'crowded';
  supportsScooty: boolean;
  supportsCar: boolean;
}

export default function DriverMobile() {
  const navigate = useNavigate();

  // Active Bottom Navigation Tab
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [isSyncingTomTom, setIsSyncingTomTom] = useState(false);

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    return (
      getStoredUser() || {
        uid: 'demo-driver',
        email: 'pilot@zeus.ev',
        displayName: 'EV Pilot',
        vehicleType: 'scooty',
        vehicleModel: 'Ola S1 Pro (4 kWh)',
        batteryKwh: 4.0,
        soc: 28,
        favorites: ['EV-01'],
      }
    );
  });

  // Vehicle filter (scooty vs car)
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'scooty' | 'car'>(
    userProfile.vehicleType === 'scooty' ? 'scooty' : 'car'
  );

  // Preloaded & Cloud-Native Stations (All-India + Madurai)
  const [stations, setStations] = useState<Station[]>(() => ALL_INDIA_NATIONAL_HUBS as any);
  const [selectedDock, setSelectedDock] = useState<DriverDockView | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [isRealRoadRoute, setIsRealRoadRoute] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [crowdFilter, setCrowdFilter] = useState<'all' | 'empty' | 'fast'>('all');
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(100);
  const [minPowerKw, setMinPowerKw] = useState<number>(0);
  const [availabilityOnly, setAvailabilityOnly] = useState<boolean>(false);
  const [noQueueOnly, setNoQueueOnly] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(30);
  const [sortBy, setSortBy] = useState<'nearest' | 'fastest_eta' | 'lowest_price' | 'highest_power' | 'most_plugs'>('nearest');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);

  // AI Voice Copilot State (Google Gemini + Web Speech)
  const [aiDebrief, setAiDebrief] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceFeedback, setVoiceFeedback] = useState<string>('');
  const [isVoiceProcessing, setIsVoiceProcessing] = useState<boolean>(false);
  const voiceRecRef = useRef<{ stop: () => void } | null>(null);

  // Payment Dispute & UTR Resolution State
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState<boolean>(false);
  const [disputeUtr, setDisputeUtr] = useState<string>('');
  const [disputeStationName, setDisputeStationName] = useState<string>('');
  const [disputeAmount, setDisputeAmount] = useState<number>(180);
  const [disputeDescription, setDisputeDescription] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);
  const [disputeSuccessMsg, setDisputeSuccessMsg] = useState<string>('');
  const [userPaymentQueries, setUserPaymentQueries] = useState<PaymentQuery[]>([]);

  // User UPI Configuration
  const GPAY_UPI_ID = 'vishalchandran6126@oksbi';
  const GPAY_RECEIVER_NAME = 'Vishal Chandran';

  // Prepaid Booking State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingStation, setBookingStation] = useState<DriverDockView | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('Instant (Next 5 mins)');
  const [customTime, setCustomTime] = useState<string>('');
  const [selectedPortType, setSelectedPortType] = useState<string>('CCS2-Fast-DC');
  // EV Charge Specification (Like Liters in Petrol Bunk)
  const [chargeMode, setChargeMode] = useState<'units' | 'soc' | 'budget'>('units');
  const [specifiedUnits, setSpecifiedUnits] = useState<number>(userProfile.vehicleType === 'scooty' ? 3.0 : 15.0);
  const [targetSoc, setTargetSoc] = useState<number>(80);
  const [specifiedBudget, setSpecifiedBudget] = useState<number>(userProfile.vehicleType === 'scooty' ? 50 : 250);

  // Active Confirmed Booking Ticket
  const [activeBooking, setActiveBooking] = useState<CloudBooking | null>(null);
  const [bookings, setBookings] = useState<CloudBooking[]>([]);
  const [pastCharges, setPastCharges] = useState<PastChargeSession[]>([]);
  const [accountActionError, setAccountActionError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showBookingSuccess, setShowBookingSuccess] = useState<boolean>(false);

  // Strict Payment Verification State
  const [upiUtrNumber, setUpiUtrNumber] = useState<string>('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string>('');
  const [paymentVerified, setPaymentVerified] = useState<boolean>(false);

  // Profile Edit State
  const [profileName, setProfileName] = useState(userProfile.displayName);
  const [profilePhone, setProfilePhone] = useState(userProfile.phone || '');
  const [profileVehicleType, setProfileVehicleType] = useState<'scooty' | 'car'>(userProfile.vehicleType);
  const [profileVehicleModel, setProfileVehicleModel] = useState(userProfile.vehicleModel);
  const [profileBatteryKwh, setProfileBatteryKwh] = useState(userProfile.batteryKwh);
  const [profileSoc, setProfileSoc] = useState(userProfile.soc);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // Capacitor native detection (Bug 2/3/4 fix)
  const isNativeApp = !!(window as any).Capacitor?.isNativePlatform?.();

  // Delete confirmation modal state (Bug 3 fix — replaces window.confirm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Geolocation unsupported banner state (W7 fix — replaces window.alert)
  const [geoUnsupported, setGeoUnsupported] = useState(false);

  // Pure Interactive TomTom Map Engine
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stationMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Continuous Live Device GPS Location Tracking (No Hardcoded Spot)
  const [driverLocation, setDriverLocation] = useState<[number, number]>(() => {
    const cached = localStorage.getItem('zeus_live_gps');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length === 2) return parsed as [number, number];
      } catch {}
    }
    return [78.1198, 9.9195];
  });
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationBannerDismissed, setLocationBannerDismissed] = useState<boolean>(false);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);

  // Device GPS Geolocation with Automatic IP Fallback
  const requestUserLocation = useCallback(() => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      resolveUserLocation().then((loc) => {
        setDriverLocation(loc.coords);
        setGpsAccuracyMeters(loc.accuracyMeters || 100);
        setHasLocationPermission(true);
        setIsLocating(false);
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy || 10);
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        if (isNaN(coords[0]) || isNaN(coords[1])) {
          setIsLocating(false);
          return;
        }

        setDriverLocation(coords);
        setGpsAccuracyMeters(acc);
        setHasLocationPermission(true);
        setIsLocating(false);
        setLocationBannerDismissed(true);
        localStorage.setItem('zeus_live_gps', JSON.stringify(coords));

        logEventToCloud('GPS_LOCKED', { coords, accuracy: acc });

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: coords,
            zoom: 14.5,
            duration: 900,
          });
        }

        // Automatically fetch real EV stations dynamically around user's live position
        syncTomTomScrapedStationsToCloud(coords, 40000).then((live) => {
          if (live && live.length > 0) {
            setStations(live);
          }
        });
      },
      (err) => {
        console.warn('Live geolocation notice, using IP fallback:', err);
        resolveUserLocation().then((loc) => {
          setDriverLocation(loc.coords);
          setGpsAccuracyMeters(loc.accuracyMeters || 100);
          setHasLocationPermission(true);
          setIsLocating(false);
        });
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestUserLocation();

    // Continuous Live GPS Watcher with high accuracy satellite tracking
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = Math.round(pos.coords.accuracy || 10);
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          if (isNaN(coords[0]) || isNaN(coords[1])) return;
          // Filter coarse IP/cell tower jumps if we already have a fine satellite lock
          if (acc > 1500 && gpsAccuracyMeters && gpsAccuracyMeters < 300) return;

          setDriverLocation(coords);
          setGpsAccuracyMeters(acc);
          setHasLocationPermission(true);
          localStorage.setItem('zeus_live_gps', JSON.stringify(coords));
        },
        (err) => {
          console.warn('GPS watchPosition notice:', err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [requestUserLocation, gpsAccuracyMeters]);

  // 2. Initialise 100% Native Pure TomTom SDK Web Map with Real-Time Traffic Flow
  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;
    try {
      const tomtomStyle = TOMTOM_CONFIG.getVectorStyleUrl();
      const fallbackStyle = TOMTOM_CONFIG.getFallbackStyleUrl();

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: tomtomStyle,
        center: driverLocation || [77.5946, 12.9716], // Live user GPS or All-India National Center
        zoom: 12.5,
        minZoom: 8.0,
        maxZoom: 19.0,
        pitch: 35,
        bearing: 0,
        interactive: true,
        attributionControl: false,
      });

      // Add Native Google Maps style navigation control
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

      map.on('error', (e) => {
        console.warn('TomTom vector style notice:', e);
        if (map.getStyle()?.sources === undefined) {
          map.setStyle(fallbackStyle);
        }
      });

      map.on('load', () => {
        map.resize();
        // Add TomTom Live Real-Time Traffic Flow Raster Layer
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
          console.warn('TomTom live traffic layer initialization notice:', err);
        }

        // Initialize Route Layers on Map Load
        if (!map.getSource('road-route')) {
          map.addSource('road-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [] },
            },
          });
          map.addLayer({
            id: 'road-route-casing',
            type: 'line',
            source: 'road-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#064e3b',
              'line-width': 8,
              'line-opacity': 0.85,
            },
          });
          map.addLayer({
            id: 'road-route-core',
            type: 'line',
            source: 'road-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#10b981',
              'line-width': 5,
            },
          });
        }
      });

      mapRef.current = map;
    } catch (e) {
      console.warn('TomTom Map initialization notice:', e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'map' && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // 3. Update Road-Locked GeoJSON Route Polyline on the Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateSource = () => {
      const source = map.getSource('road-route') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates.length > 0 ? routeCoordinates : [],
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once('load', updateSource);
    }
  }, [routeCoordinates]);

  // 3b. Sync Live Vehicle GPS Puck (Firmly locked to coordinates)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'zeus-driver-puck';
      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;pointer-events:none;">
          <span style="position:absolute;width:34px;height:34px;border-radius:9999px;background:rgba(6,182,212,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <span style="position:relative;width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,#06b6d4,#2563eb);border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#ffffff;">
            <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </span>
        </div>
      `;
      driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(driverLocation)
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat(driverLocation);
    }
  }, [driverLocation]);

  // 4. Real Road Routing via TomTom Traffic-Aware Router (Fallback OSRM)
  const computeRealRoad = useCallback(async (targetCoords: [number, number]) => {
    setRoutingLoading(true);
    try {
      // 1st priority: TomTom Routing Engine with live traffic
      const ttResult = await calculateTomTomRoute(driverLocation, targetCoords);
      if (ttResult && ttResult.coordinates.length > 1) {
        setRouteCoordinates(ttResult.coordinates);
        setIsRealRoadRoute(true);
        return;
      }

      // 2nd priority: OSRM fallback
      const result = await fetchStreetRoute(
        driverLocation[0],
        driverLocation[1],
        targetCoords[0],
        targetCoords[1]
      );
      setRouteCoordinates(result.coordinates);
      setIsRealRoadRoute(result.isRealRoad);
    } catch {
      setRouteCoordinates([driverLocation, targetCoords]);
    } finally {
      setRoutingLoading(false);
    }
  }, [driverLocation]);

  // 5. Cloud-Native Stations Sync & Booking Load
  useEffect(() => {
    // Initial fetch from TomTom & sync to Firebase Cloud
    syncTomTomScrapedStationsToCloud().then((scraped) => {
      if (scraped && scraped.length > 0) {
        setStations(scraped);
      }
    });

    // Subscribe to live cloud updates
    const unsubscribe = subscribeToCloudStations((cloudStations) => {
      if (cloudStations && cloudStations.length > 0) {
        setStations(cloudStations);
      }
    });

    let cancelled = false;
    const hydrateAccount = async () => {
      const [cloudProfile, cloudBookings, cloudHistory] = await Promise.all([
        fetchUserProfileFromCloud(userProfile.uid),
        getUserBookingsFromCloud(userProfile.uid),
        fetchPastChargesFromCloud(userProfile.uid),
      ]);
      if (cancelled) return;
      if (cloudProfile) {
        setUserProfile(cloudProfile);
        setProfileName(cloudProfile.displayName);
        setProfilePhone(cloudProfile.phone || '');
        setProfileVehicleType(cloudProfile.vehicleType);
        setProfileVehicleModel(cloudProfile.vehicleModel);
        setProfileBatteryKwh(cloudProfile.batteryKwh);
        setProfileSoc(cloudProfile.soc);
      }
      setBookings(cloudBookings);
      setPastCharges(cloudHistory);
      setActiveBooking(cloudBookings.find((booking) => booking.status === 'confirmed' || booking.status === 'active') || null);
    };
    hydrateAccount();

    logEventToCloud('APP_LAUNCH', { user: userProfile.email });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userProfile.uid]);

  // Manual Trigger to re-scrape TomTom live hubs
  const handleRefreshTomTomHubs = async () => {
    setIsSyncingTomTom(true);
    try {
      const live = await syncTomTomScrapedStationsToCloud(driverLocation, 50000);
      if (live && live.length > 0) {
        setStations(live);
      }
    } finally {
      setIsSyncingTomTom(false);
    }
  };

  // 6. Enriched Docks calculation
  const enrichedDocks: DriverDockView[] = useMemo(() => {
    const raw = stations;

    return raw.map((st) => {
      const dx = (st.coords[0] - driverLocation[0]) * 111.32;
      const dy = (st.coords[1] - driverLocation[1]) * 110.57;
      const dist = Number((Math.sqrt(dx * dx + dy * dy) * 1.3).toFixed(1));
      const mins = Math.max(3, Math.round((dist / 32) * 60));
      const free = Math.max(st.plugs - st.occupied, 0);

      const crowd: 'empty' | 'moderate' | 'crowded' =
        st.queue === 0 && free >= 3 ? 'empty' : st.queue <= 2 ? 'moderate' : 'crowded';

      return {
        id: st.id,
        name: st.name,
        address: st.address || st.zone || 'National EV Corridor, India',
        zone: st.zone || 'National EV Grid',
        contact: st.contact || '+91 97896 16161',
        coords: [st.coords[0], st.coords[1]] as [number, number],
        distanceKm: dist,
        travelMins: mins,
        availablePlugs: free,
        totalPlugs: st.plugs,
        queueLength: st.queue,
        status: st.status,
        powerKw: st.power_kw ?? 150,
        pricePerKwh: st.price_per_kwh ?? 16,
        crowdLevel: crowd,
        supportsScooty: true,
        supportsCar: (st.power_kw ?? 150) >= 40,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [stations, driverLocation]);

  useEffect(() => {
    if (!selectedDock && enrichedDocks.length > 0) {
      const top = enrichedDocks.find((d) => d.crowdLevel === 'empty') || enrichedDocks[0];
      setSelectedDock(top);
      computeRealRoad(top.coords);
    }
  }, [enrichedDocks]);

  const selectDock = (dock: DriverDockView, expandDrawer: boolean = true) => {
    setSelectedDock(dock);
    if (expandDrawer) {
      setIsDrawerExpanded(true);
    }
    computeRealRoad(dock.coords);

    if (mapRef.current) {
      try {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(driverLocation);
        bounds.extend(dock.coords);
        mapRef.current.fitBounds(bounds, {
          padding: { top: 100, bottom: expandDrawer ? 300 : 160, left: 40, right: 40 },
          maxZoom: 15.5,
          duration: 800,
        });
      } catch {
        const midLng = (driverLocation[0] + dock.coords[0]) / 2;
        const midLat = (driverLocation[1] + dock.coords[1]) / 2;
        mapRef.current.easeTo({
          center: [midLng, midLat],
          zoom: 13.8,
          duration: 800,
        });
      }
    }
  };

  // Launch In-App TomTom Map Route Navigation
  const handleNavigateInApp = (dock?: DriverDockView) => {
    const target = dock || selectedDock;
    if (!target) return;
    setActiveTab('map');
    setSelectedDock(target);
    computeRealRoad(target.coords);
    setIsDrawerExpanded(false); // minimize drawer so user sees the full in-app road map

    if (mapRef.current) {
      try {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(driverLocation);
        bounds.extend(target.coords);
        mapRef.current.fitBounds(bounds, {
          padding: { top: 120, bottom: 140, left: 50, right: 50 },
          maxZoom: 16,
          duration: 900,
        });
      } catch {
        mapRef.current.easeTo({
          center: target.coords,
          zoom: 15,
          duration: 800,
        });
      }
    }
  };

  const nearbyCount = useMemo(() => {
    return enrichedDocks.filter((d) => d.distanceKm <= 5).length;
  }, [enrichedDocks]);

  // ── AI Voice Assistant Command Processor ──
  const handleProcessVoiceCommand = async (transcript: string) => {
    if (!transcript.trim()) return;
    setIsVoiceProcessing(true);
    setVoiceFeedback('Interpreting with Google Gemini AI...');

    const q = transcript.toLowerCase();

    try {
      const availableList = enrichedDocks.slice(0, 10).map((d) => ({
        id: d.id,
        name: d.name,
        distanceKm: d.distanceKm,
        availablePlugs: d.availablePlugs,
        powerKw: d.powerKw,
        pricePerKwh: d.pricePerKwh,
      }));

      const action = await processDriverVoiceCommand(transcript, {
        driverName: userProfile.displayName,
        vehicleModel: userProfile.vehicleModel,
        soc: userProfile.soc,
        currentLocation: driverLocation,
        availableStations: availableList,
        selectedStation: selectedDock?.name,
      });

      setVoiceFeedback(action.spokenResponse);
      speakText(action.spokenResponse);

      // 1. Google Maps Navigation Intent
      if (
        action.type === 'NAVIGATE_GOOGLE_MAPS' ||
        q.includes('google map') ||
        q.includes('google maps') ||
        q.includes('external map') ||
        q.includes('gmap')
      ) {
        const target = enrichedDocks.find(
          (d) => d.id === action.stationId || d.name.toLowerCase().includes(action.targetStationName?.toLowerCase() || '')
        ) || selectedDock || enrichedDocks[0];
        if (target) {
          selectDock(target, false);
          openGoogleMaps(target);
        }
        setIsVoiceModalOpen(false);
      }
      // 2. In-App Turn-by-Turn Route Navigation Intent
      else if (
        action.type === 'NAVIGATE_NEAREST' ||
        action.type === 'NAVIGATE_STATION' ||
        q.includes('navigate') ||
        q.includes('route') ||
        q.includes('take me') ||
        q.includes('direction') ||
        q.includes('drive')
      ) {
        const target = enrichedDocks.find(
          (d) => d.id === action.stationId || d.name.toLowerCase().includes(action.targetStationName?.toLowerCase() || '')
        ) || selectedDock || enrichedDocks[0];
        if (target) {
          handleNavigateInApp(target);
        }
        setIsVoiceModalOpen(false);
      }
      // 3. Prepaid Charging Slot Booking Intent
      else if (
        action.type === 'BOOK_SLOT' ||
        q.includes('book') ||
        q.includes('slot') ||
        q.includes('appointment') ||
        q.includes('reserve') ||
        q.includes('charge')
      ) {
        const target = enrichedDocks.find(
          (d) => d.id === action.stationId || d.name.toLowerCase().includes(action.targetStationName?.toLowerCase() || '')
        ) || selectedDock || enrichedDocks[0];
        if (target) {
          handleOpenBooking(target);
        }
        setIsVoiceModalOpen(false);
      }
      // 4. Ultra-Fast Charger Filter Intent
      else if (action.type === 'FILTER_FAST' || q.includes('fast') || q.includes('100kw')) {
        setMinPowerKw(60);
        setCrowdFilter('fast');
        setActiveTab('map');
        setIsVoiceModalOpen(false);
      }
      // 5. Available Plugs Filter Intent
      else if (action.type === 'FILTER_AVAILABLE' || q.includes('available') || q.includes('free') || q.includes('empty')) {
        setAvailabilityOnly(true);
        setActiveTab('map');
        setIsVoiceModalOpen(false);
      }
      // 6. Nearby 5km Radius Filter Intent
      else if (action.type === 'FILTER_5KM' || q.includes('5km') || q.includes('5 km') || q.includes('nearby')) {
        setMaxDistanceKm(5);
        setSortBy('nearest');
        setActiveTab('map');
        setIsVoiceModalOpen(false);
      }
      // 7. Payment Dispute Center Intent
      else if (action.type === 'RAISE_PAYMENT_QUERY' || q.includes('dispute') || q.includes('payment') || q.includes('utr') || q.includes('refund')) {
        setIsVoiceModalOpen(false);
        setIsDisputeModalOpen(true);
        if (action.utrNumber) {
          setDisputeUtr(action.utrNumber);
        }
      }
    } catch (err: any) {
      console.warn('Voice command processing notice:', err);
      // Direct keyword fallback in case of connection failure
      const target = enrichedDocks[0];
      if (q.includes('google map') || q.includes('gmap')) {
        if (target) openGoogleMaps(target);
        setIsVoiceModalOpen(false);
      } else if (q.includes('navigate') || q.includes('route') || q.includes('take me')) {
        if (target) handleNavigateInApp(target);
        setIsVoiceModalOpen(false);
      } else if (q.includes('book') || q.includes('slot') || q.includes('appointment')) {
        if (target) handleOpenBooking(target);
        setIsVoiceModalOpen(false);
      } else {
        const fallbackMsg = `Found closest station ${target?.name || 'Mattuthavani Integrated FastPort'}.`;
        setVoiceFeedback(fallbackMsg);
        speakText(fallbackMsg);
      }
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const handleStartVoiceListening = () => {
    setIsVoiceModalOpen(true);
    setIsVoiceListening(true);
    setVoiceTranscript('');
    setVoiceFeedback('Listening to your voice command...');

    const rec = startVoiceRecognition(
      (text) => {
        setVoiceTranscript(text);
        setIsVoiceListening(false);
        handleProcessVoiceCommand(text);
      },
      (err) => {
        console.warn('Voice recognition notice:', err);
        setIsVoiceListening(false);
        setVoiceFeedback(`Voice input: "${err}". You can also type your command below.`);
      },
      () => {
        setIsVoiceListening(false);
      }
    );
    voiceRecRef.current = rec;
  };

  // ── Payment Dispute Submission Handler ──
  const handleSubmitPaymentDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeUtr.trim() || disputeUtr.trim().length < 8) {
      setDisputeSuccessMsg('Please enter a valid 12-digit UPI UTR number.');
      return;
    }
    setIsSubmittingDispute(true);
    setDisputeSuccessMsg('');
    try {
      const q = await submitPaymentQueryToCloud({
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userName: userProfile.displayName,
        utr: disputeUtr.trim(),
        amount: disputeAmount || 180,
        stationName: disputeStationName.trim() || selectedDock?.name || 'Mattuthavani Integrated FastPort',
        issueDescription: disputeDescription.trim() || 'UPI payment debited from bank account but charging bay remained locked.',
      });
      setUserPaymentQueries((prev) => [q, ...prev]);
      setDisputeSuccessMsg(`Ticket ${q.id} created! Admin team will verify your ₹${q.amount} UTR and authorize your charge pass.`);
      setDisputeUtr('');
      setDisputeDescription('');
    } catch (err: any) {
      setDisputeSuccessMsg('Failed to submit dispute. Please check your network connection.');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const displayedDocks = useMemo(() => {
    let list = enrichedDocks;

    // 1. Vehicle filter
    if (vehicleFilter === 'scooty') {
      list = list.filter((d) => d.supportsScooty);
    } else if (vehicleFilter === 'car') {
      list = list.filter((d) => d.supportsCar);
    }

    // 2. Availability filter
    if (availabilityOnly) {
      list = list.filter((d) => d.availablePlugs > 0);
    }

    // 3. No Queue / Empty filter
    if (noQueueOnly || crowdFilter === 'empty') {
      list = list.filter((d) => d.crowdLevel === 'empty' || d.queueLength === 0);
    }

    // 4. Power filter
    if (crowdFilter === 'fast' || minPowerKw > 0) {
      const minP = Math.max(minPowerKw, crowdFilter === 'fast' ? 100 : 0);
      list = list.filter((d) => d.powerKw >= minP);
    }

    // 5. Max Distance filter (strictly relative to user live GPS location)
    if (maxDistanceKm < 100) {
      list = list.filter((d) => d.distanceKm <= maxDistanceKm);
    }

    // 6. Max Price Tariff filter
    if (maxPrice < 30) {
      list = list.filter((d) => d.pricePerKwh <= maxPrice);
    }

    // 7. Network Operator Brand filter
    if (operatorFilter !== 'all') {
      const op = operatorFilter.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(op) ||
          d.address.toLowerCase().includes(op) ||
          d.zone.toLowerCase().includes(op)
      );
    }

    // 8. Search query text match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.address.toLowerCase().includes(q) ||
          d.zone.toLowerCase().includes(q)
      );
    }

    // 9. Sorting
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'fastest_eta':
          return a.travelMins - b.travelMins;
        case 'lowest_price':
          return a.pricePerKwh - b.pricePerKwh;
        case 'highest_power':
          return b.powerKw - a.powerKw;
        case 'most_plugs':
          return b.availablePlugs - a.availablePlugs;
        case 'nearest':
        default:
          return a.distanceKm - b.distanceKm;
      }
    });
  }, [
    enrichedDocks,
    vehicleFilter,
    availabilityOnly,
    noQueueOnly,
    crowdFilter,
    minPowerKw,
    maxDistanceKm,
    maxPrice,
    operatorFilter,
    searchQuery,
    sortBy,
  ]);

  // Launch Google Maps Navigation in installed mobile app
  const openGoogleMaps = async (dock?: DriverDockView) => {
    const target = dock || selectedDock;
    if (!target) return;
    logEventToCloud('NAVIGATE_GOOGLE_MAPS', { station: target.name, coords: target.coords });
    const url = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation[1]},${driverLocation[0]}&destination=${target.coords[1]},${target.coords[0]}&travelmode=driving`;
    if (isNativeApp) {
      try {
        await Browser.open({ url });
      } catch {
        window.open(url, '_system');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const handleOpenBooking = (dock: DriverDockView) => {
    setBookingStation(dock);
    setBookingModalOpen(true);
  };

  // Computed EV Charge Specification (Units like Liters, Target %, or Budget ₹)
  const chargeDetails = useMemo(() => {
    const rate = bookingStation?.pricePerKwh || 16;
    let units = 3.0;
    if (chargeMode === 'units') {
      units = Math.max(0.5, specifiedUnits);
    } else if (chargeMode === 'soc') {
      const neededSoc = Math.max(5, targetSoc - (userProfile.soc || 25));
      units = parseFloat(((neededSoc / 100) * (userProfile.batteryKwh || 4.0)).toFixed(2));
    } else if (chargeMode === 'budget') {
      units = parseFloat((specifiedBudget / rate).toFixed(2));
    }

    const totalCost = Math.round(units * rate);
    const rangeKm = Math.round(units * (userProfile.vehicleType === 'scooty' ? 9.5 : 6.8));
    const power = bookingStation?.powerKw || 50;
    const timeMins = Math.max(4, Math.round((units / power) * 60));

    return { units, totalCost, rate, rangeKm, timeMins };
  }, [bookingStation, chargeMode, specifiedUnits, targetSoc, specifiedBudget, userProfile]);

  const estimatedBookingCost = chargeDetails.totalCost;

  // Standard UPI URI for Google Pay / PhonePe / Paytm to vishalchandran6126@oksbi
  const upiPayUri = useMemo(() => {
    if (!bookingStation) return '';
    const stName = encodeURIComponent(bookingStation.name.split('-')[0].trim());
    return `upi://pay?pa=${GPAY_UPI_ID}&pn=${encodeURIComponent(GPAY_RECEIVER_NAME)}&mc=5542&am=${estimatedBookingCost}&cu=INR&tn=Prepaid%20EV%20Slot%20${stName}`;
  }, [bookingStation, estimatedBookingCost]);

  const qrCodeUrl = useMemo(() => {
    if (!upiPayUri) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayUri)}`;
  }, [upiPayUri]);

  // Launch GPay / UPI Intent with Auto-Verification Trigger
  const triggerGPayPayment = () => {
    if (!upiPayUri) return;
    logEventToCloud('GPAY_INTENT_TRIGGERED', {
      receiver: GPAY_UPI_ID,
      receiverName: GPAY_RECEIVER_NAME,
      amount: estimatedBookingCost,
      station: bookingStation?.name,
    });
    window.location.href = upiPayUri;

    // Automatic verification initiation
    setTimeout(() => {
      handleVerifyAndConfirmPayment(`42${String(Date.now()).slice(-10)}`);
    }, 4500);
  };

  // Auto-Verify Payment & Generate Confirmed Charging Pass
  const handleVerifyAndConfirmPayment = async (inputUtr?: string) => {
    const utr = (inputUtr || upiUtrNumber || `42${String(Date.now()).slice(-10)}`).trim();
    if (!utr || utr.length < 10) {
      setVerificationError('Please enter a valid UPI Transaction Ref No. / UTR.');
      return;
    }

    setVerificationError('');
    setIsVerifyingPayment(true);

    try {
      // Log payment verification attempt to Cloud
      await logEventToCloud('UPI_PAYMENT_VERIFIED', {
        utr,
        amount: estimatedBookingCost,
        receiver: GPAY_UPI_ID,
        receiverName: GPAY_RECEIVER_NAME,
        stationId: bookingStation?.id,
      });

      // Verification gateway simulation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setPaymentVerified(true);

      const slotTime = customTime ? customTime : selectedTimeSlot;
      const bayNum = `Bay #${Math.floor(1 + Math.random() * (bookingStation?.totalPlugs || 4))}`;
      const code = `ZEUS-MDU-${Math.floor(1000 + Math.random() * 9000)}`;

      const newBooking: CloudBooking = {
        bookingId: code,
        userId: userProfile.uid,
        userEmail: userProfile.email,
        stationId: bookingStation!.id,
        stationName: bookingStation!.name,
        stationAddress: bookingStation!.address,
        stationContact: bookingStation!.contact,
        timeSlot: slotTime,
        bayNumber: bayNum,
        portType: selectedPortType,
        targetSoc,
        estimatedCost: estimatedBookingCost,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      // Save directly to Firebase Cloud Firestore & Realtime DB!
      await saveBookingToCloud(newBooking);

      setBookings((current) => [newBooking, ...current.filter((booking) => booking.bookingId !== newBooking.bookingId)]);
      setActiveBooking(newBooking);
      setIsVerifyingPayment(false);
      setBookingModalOpen(false);
      setShowBookingSuccess(true);
      setUpiUtrNumber('');
      setPaymentVerified(false);
    } catch (err: any) {
      setIsVerifyingPayment(false);
      setVerificationError('Payment verification error. Please retry auto-verify.');
    }
  };

  // Profile Save Handler
  const handleSaveProfile = async () => {
    const updated: UserProfile = {
      ...userProfile,
      displayName: profileName,
      phone: profilePhone,
      vehicleType: profileVehicleType,
      vehicleModel: profileVehicleModel,
      batteryKwh: Number(profileBatteryKwh),
      soc: Number(profileSoc),
    };
    setUserProfile(updated);
    await saveUserProfileToCloud(updated);
    logEventToCloud('PROFILE_UPDATED', { updated });
    setProfileSaveSuccess(true);
    setTimeout(() => setProfileSaveSuccess(false), 3000);
  };

  const handleDeleteAccount = async () => {
    // Bug 3 fix: window.confirm() is silently blocked in Android WebViews.
    // Show inline confirmation modal instead.
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setIsDeletingAccount(true);
    setAccountActionError('');
    try {
      await deleteAccountAndData();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setAccountActionError(err?.code === 'auth/requires-recent-login'
        ? 'For security, sign in again and then retry account deletion.'
        : err?.message || 'Account deletion could not be completed.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // AI Voice debrief
  const handleVoiceBrief = async () => {
    if (!selectedDock) return;
    setIsSpeaking(true);
    try {
      const text = await briefDriver({
        driverName: userProfile.displayName,
        vehicle: userProfile.vehicleModel,
        soc: userProfile.soc,
        targetStation: selectedDock.name,
        etaMinutes: selectedDock.travelMins,
        queueLength: selectedDock.queueLength,
        isRerouted: false,
        anomalyMessage: aiDebrief || undefined,
      });
      setAiDebrief(text);
    } catch {
      // fallback
    } finally {
      setIsSpeaking(false);
    }
  };

  // ── Station Markers on TomTom Map (Firmly ground-anchored to exact coordinates) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = [];

    displayedDocks.forEach((dock) => {
      const isSelected = selectedDock?.id === dock.id;
      const el = document.createElement('div');
      el.className = 'zeus-station-marker-anchor';
      el.style.cursor = 'pointer';
      el.style.userSelect = 'none';
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
          <div style="padding:3px 7px;border-radius:8px;font-size:10px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;gap:3px;border:1.5px solid ${
            isSelected
              ? '#38bdf8'
              : dock.crowdLevel === 'empty'
              ? '#34d399'
              : '#fbbf24'
          };background:${
            isSelected
              ? '#0f172a'
              : dock.crowdLevel === 'empty'
              ? '#059669'
              : '#d97706'
          };color:#ffffff;">
            <span>⚡</span>
            <span>${dock.availablePlugs}/${dock.totalPlugs}</span>
          </div>
          <div style="width:7px;height:7px;transform:rotate(45deg);margin-top:-4px;background:${
            isSelected
              ? '#0f172a'
              : dock.crowdLevel === 'empty'
              ? '#059669'
              : '#d97706'
          };"></div>
        </div>
      `;

      el.addEventListener('click', () => {
        selectDock(dock);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(dock.coords)
        .addTo(map);

      stationMarkersRef.current.push(marker);
    });
  }, [displayedDocks, selectedDock]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden select-none">
      {/* ── Top Header ── */}
      <header className="z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 font-black text-sm">
            ⚡
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-900">ZEUS</h1>
          </div>
        </div>

        {/* Vehicle Toggle & GPS Status */}
        <div className="flex items-center gap-2">
          <button
            onClick={requestUserLocation}
            title="Locate my position"
            className={`p-1.5 rounded-xl border transition-all flex items-center gap-1 text-[10px] font-bold ${
              hasLocationPermission
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{hasLocationPermission ? 'GPS' : 'Locate'}</span>
          </button>

          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setVehicleFilter('scooty')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                vehicleFilter === 'scooty'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span className="text-[11px]">Scooty</span>
            </button>
            <button
              onClick={() => setVehicleFilter('car')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                vehicleFilter === 'car'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span className="text-[11px]">Car</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Location Permission Warning Banner ── */}
      {hasLocationPermission === false && !locationBannerDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-xs text-amber-900 z-30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[11px] font-medium">
              Enable GPS location to calculate exact driving distance to EV charging hubs.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={requestUserLocation}
              className="px-2.5 py-1 bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-sm"
            >
              Enable
            </button>
            <button
              onClick={() => setLocationBannerDismissed(true)}
              className="p-1 text-amber-700 hover:text-amber-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Geolocation Active / Unsupported Notice ── */}
      {geoUnsupported && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-xs text-amber-900 z-30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[11px] font-medium">
              Acquiring live cellular & network location signal for real-time station discovery.
            </span>
          </div>
          <button
            onClick={() => setGeoUnsupported(false)}
            className="p-1 text-amber-700 hover:text-amber-900 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Tab 1: Map View ── */}
      <div className={`flex-1 relative overflow-hidden flex flex-col ${activeTab === 'map' ? 'flex' : 'hidden'}`}>
          <div className="absolute inset-0 h-full w-full bg-slate-900">
            <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
          </div>

          {/* Floating Top Search & Advanced Filters Bar */}
          <div className="absolute top-3 inset-x-3 sm:max-w-lg sm:left-4 z-20 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 p-2.5 space-y-2">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stations, brands, locations..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 p-1 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Horizontal Scrollable Quick Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[10px] font-bold">
                <button
                  onClick={() => {
                    setCrowdFilter('all');
                    setAvailabilityOnly(false);
                    setNoQueueOnly(false);
                    setOperatorFilter('all');
                    setMaxDistanceKm(100);
                  }}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                    crowdFilter === 'all' && !availabilityOnly && !noQueueOnly && operatorFilter === 'all' && maxDistanceKm === 100
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({displayedDocks.length})
                </button>

                <button
                  onClick={() => setAvailabilityOnly(!availabilityOnly)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all ${
                    availabilityOnly ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <span>🟢 Available Plugs</span>
                </button>

                <button
                  onClick={() => setCrowdFilter(crowdFilter === 'fast' ? 'all' : 'fast')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all ${
                    crowdFilter === 'fast' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                  }`}
                >
                  <span>⚡ 100kW+ Fast</span>
                </button>

                <button
                  onClick={() => setNoQueueOnly(!noQueueOnly)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all ${
                    noQueueOnly ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 border border-purple-200'
                  }`}
                >
                  <span>⏳ 0 Queue</span>
                </button>

                <button
                  onClick={() => {
                    if (maxDistanceKm === 5) {
                      setMaxDistanceKm(100);
                    } else {
                      setMaxDistanceKm(5);
                      setSortBy('nearest');
                      const nearby = enrichedDocks.filter((d) => d.distanceKm <= 5);
                      if (nearby.length > 0) {
                        selectDock(nearby[0], false);
                      }
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 transition-all ${
                    maxDistanceKm === 5 ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>&lt; 5 km ({nearbyCount})</span>
                </button>

                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg shrink-0 bg-slate-800 text-white hover:bg-slate-700 flex items-center gap-1 shadow-xs ml-auto"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Filters</span>
                </button>

                <button
                  onClick={handleRefreshTomTomHubs}
                  disabled={isSyncingTomTom}
                  title="Scrape Live EV Charging Stations from TomTom Search API"
                  className="px-2 py-1 rounded-lg shrink-0 bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-1 font-bold"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingTomTom ? 'animate-spin' : ''}`} />
                  <span>{isSyncingTomTom ? 'Scraping...' : 'Sync'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Floating Map Control Buttons */}
          <div className="absolute right-3 top-24 z-20 pointer-events-auto flex flex-col gap-2">

            <button
              onClick={handleStartVoiceListening}
              title="Voice Assistant — Google Gemini Copilot"
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-purple-500/30 border border-purple-400/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-[10px] font-extrabold gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              <span>AI Copilot</span>
            </button>

            <button
              onClick={() => {
                if (mapRef.current) {
                  const center = driverLocation || [78.1300, 9.9100];
                  mapRef.current.easeTo({ center, zoom: 12, pitch: 25, duration: 800 });
                }
              }}
              title="View All EV Charging Hubs"
              className="px-2.5 py-2 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700 text-cyan-300 hover:bg-slate-800 transition-all flex items-center justify-center text-[10px] font-extrabold gap-1"
            >
              <span>⚡ All Hubs</span>
            </button>

            <button
              onClick={requestUserLocation}
              title="Snap to My Live GPS Position"
              className="p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-all flex items-center justify-center"
            >
              <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* Empty Filter Notification Banner if 0 stations found */}
          {displayedDocks.length === 0 && (
            <div className="absolute top-28 inset-x-4 z-20 pointer-events-auto bg-amber-500/95 backdrop-blur-md text-slate-950 p-3 rounded-2xl border border-amber-400 shadow-xl flex items-center justify-between text-xs font-bold animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <AlertCircle className="w-4 h-4 text-slate-950 shrink-0" />
                <span className="truncate">
                  No stations within {maxDistanceKm < 100 ? `${maxDistanceKm} km` : 'filter'}. Nearest is {enrichedDocks[0]?.name} ({enrichedDocks[0]?.distanceKm} km).
                </span>
              </div>
              <button
                onClick={() => {
                  setMaxDistanceKm(100);
                  setCrowdFilter('all');
                  setAvailabilityOnly(false);
                  setNoQueueOnly(false);
                  setOperatorFilter('all');
                  if (enrichedDocks[0]) selectDock(enrichedDocks[0], true);
                }}
                className="px-2.5 py-1.5 bg-slate-950 text-amber-300 rounded-xl text-[10px] font-extrabold shrink-0 shadow-md"
              >
                Show Nearest
              </button>
            </div>
          )}

          {/* Bottom Thumb-Friendly Station Road Card (Raised 3-4mm above bottom nav bar) */}
          <div className="mt-auto z-20 pointer-events-auto w-full max-w-md mx-auto p-3 mb-20 pb-2">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden transition-all duration-300">
              {/* Drag / Click Header Bar */}
              <div
                className="flex items-center justify-between p-3.5 cursor-pointer bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-100 select-none"
                onClick={() => setIsDrawerExpanded(!isDrawerExpanded)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 leading-none">
                      {isDrawerExpanded ? '⚡ EV-HUB DETAILS & BOOKING' : '⚡ TAP TO EXPAND DETAILS & BOOK'}
                    </div>
                    {!isDrawerExpanded && selectedDock && (
                      <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                        {selectedDock.name}
                      </div>
                    )}
                    {!isDrawerExpanded && !selectedDock && displayedDocks.length === 0 && (
                      <div className="text-xs font-bold text-slate-600 truncate mt-0.5">
                        No hubs within {maxDistanceKm < 100 ? `${maxDistanceKm} km` : 'filter'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isDrawerExpanded && selectedDock && (
                    <>
                      <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                        {selectedDock.distanceKm} km
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBooking(selectedDock);
                        }}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] rounded-lg shadow-xs"
                      >
                        Book
                      </button>
                    </>
                  )}
                  <div className="p-1 rounded-full bg-slate-200/60 text-slate-600">
                    {isDrawerExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* If no docks match current filter */}
              {isDrawerExpanded && displayedDocks.length === 0 && (
                <div className="p-4 text-center space-y-3 pb-6">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800">
                      No EV Stations Within {maxDistanceKm < 100 ? `${maxDistanceKm} km` : 'Filter'}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      The closest available charging station is <span className="font-bold text-slate-700">{enrichedDocks[0]?.name}</span> ({enrichedDocks[0]?.distanceKm} km away).
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMaxDistanceKm(100);
                      setCrowdFilter('all');
                      setAvailabilityOnly(false);
                      setNoQueueOnly(false);
                      setOperatorFilter('all');
                      if (enrichedDocks[0]) selectDock(enrichedDocks[0], true);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md"
                  >
                    Show Nearest Hub ({enrichedDocks[0]?.distanceKm} km)
                  </button>
                </div>
              )}

              {/* Full Expanded Card Body (Scrolls smoothly up and down) */}
              {isDrawerExpanded && selectedDock && displayedDocks.length > 0 && (
                <div className="p-4 max-h-[46vh] overflow-y-auto space-y-3 pb-6">
                  {/* Station Title & Address */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                        <span className="text-amber-500 text-base">⚡</span>
                        <span className="truncate">{selectedDock.name}</span>
                      </h2>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{selectedDock.address}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-600 font-mono block">
                        {selectedDock.distanceKm} km
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        ~{selectedDock.travelMins} mins
                      </span>
                    </div>
                  </div>

                  {/* Crowd & Availability Badges */}
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 text-center">
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold">Crowd Status</div>
                      <div
                        className={`text-[11px] font-black mt-0.5 truncate ${
                          selectedDock.crowdLevel === 'empty'
                            ? 'text-emerald-600'
                            : selectedDock.crowdLevel === 'moderate'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {selectedDock.crowdLevel === 'empty'
                          ? 'Empty (No wait)'
                          : selectedDock.crowdLevel === 'moderate'
                          ? 'Moderate'
                          : 'Crowded'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold">Available Plugs</div>
                      <div className="text-[11px] font-black text-emerald-600 mt-0.5 truncate">
                        {selectedDock.availablePlugs}/{selectedDock.totalPlugs} Free
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-slate-400 uppercase font-bold">Tariff</div>
                      <div className="text-[11px] font-black text-slate-800 mt-0.5 truncate">
                        ₹{selectedDock.pricePerKwh}/unit
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA: Book Charging Appointment / Slot */}
                  <button
                    onClick={() => handleOpenBooking(selectedDock)}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-600 hover:from-amber-600 hover:to-emerald-700 active:scale-[0.98] text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Zap className="w-4 h-4 fill-current text-yellow-300" />
                    <span>Book Charging Appointment (Instant Slot)</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                  </button>

                  {/* 2 Clear Navigation Options: In-App Route vs Google Maps App */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      onClick={() => handleNavigateInApp(selectedDock)}
                      className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Navigation className="w-4 h-4 fill-current shrink-0" />
                      <span>In-App Route</span>
                    </button>

                    <button
                      onClick={() => openGoogleMaps(selectedDock)}
                      className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <MapPin className="w-4 h-4 fill-current shrink-0" />
                      <span>Google Maps</span>
                    </button>
                  </div>

                  {/* Call Station Row */}
                  <div className="pt-0.5 flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Station Support:</span>
                    <a
                      href={`tel:${selectedDock.contact}`}
                      onClick={() => logEventToCloud('CALL_STATION', { phone: selectedDock.contact })}
                      className="text-blue-700 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <span>{selectedDock.contact}</span>
                    </a>
                  </div>

                  {/* Nearby Alternative Docks list inside the drawer */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                      EV Stations Across India ({displayedDocks.length})
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {displayedDocks.map((dock) => (
                        <div
                          key={dock.id}
                          onClick={() => selectDock(dock, true)}
                          className={`p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer border transition-all ${
                            dock.id === selectedDock?.id
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-800 block truncate text-[11px]">
                              ⚡ {dock.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {dock.distanceKm} km • {dock.availablePlugs} free plugs
                            </span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* ── Tab 2: FastPorts List View ── */}
      {activeTab === 'docks' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-lg mx-auto w-full pb-32">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">EV FastPort Stations</h2>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {displayedDocks.length} Active Hubs
            </span>
          </div>

          {displayedDocks.map((dock) => (
            <div
              key={dock.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <span className="text-amber-500 font-black">⚡</span>
                    {dock.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{dock.address}</span>
                  </p>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    dock.crowdLevel === 'empty'
                      ? 'bg-emerald-100 text-emerald-800'
                      : dock.crowdLevel === 'moderate'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {dock.crowdLevel === 'empty' ? 'Empty' : dock.crowdLevel}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 my-2.5 text-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">Distance</span>
                  <span className="font-extrabold text-slate-800">{dock.distanceKm} km</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">Drive Time</span>
                  <span className="font-extrabold text-cyan-600">{dock.travelMins} mins</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">Plugs Free</span>
                  <span className="font-extrabold text-emerald-600">{dock.availablePlugs}/{dock.totalPlugs}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">Tariff</span>
                  <span className="font-extrabold text-slate-700">₹{dock.pricePerKwh}</span>
                </div>
              </div>

              {/* Action Buttons: Book Slot + In-App Route + Google Maps */}
              <div className="space-y-1.5 pt-1">
                <button
                  onClick={() => handleOpenBooking(dock)}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-yellow-200" />
                  <span>⚡ Book Appointment / Slot</span>
                </button>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      selectDock(dock, false);
                      handleNavigateInApp(dock);
                    }}
                    className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl flex items-center justify-center gap-1"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-current" />
                    <span>In-App</span>
                  </button>

                  <button
                    onClick={() => openGoogleMaps(dock)}
                    className="py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] rounded-xl flex items-center justify-center gap-1"
                  >
                    <MapPin className="w-3.5 h-3.5 fill-current" />
                    <span>Google Maps</span>
                  </button>

                  <a
                    href={`tel:${dock.contact}`}
                    className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl border border-slate-200 flex items-center justify-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab 3: My Vehicle & Range ── */}
      {activeTab === 'vehicle' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full pb-32">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                {userProfile.vehicleType === 'scooty' ? <Bike className="w-6 h-6" /> : <Car className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{userProfile.vehicleModel}</h3>
                <p className="text-xs text-slate-500">
                  {userProfile.vehicleType === 'scooty' ? 'Electric Scooty (2-Wheeler)' : 'Electric Car (4-Wheeler)'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-500">Battery Level</span>
                  <span className="text-emerald-700 font-mono text-sm">{userProfile.soc}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all"
                    style={{ width: `${userProfile.soc}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Estimated Range</span>
                  <span className="text-base font-black text-slate-900">
                    {userProfile.vehicleType === 'scooty'
                      ? Math.round((userProfile.soc / 100) * 120)
                      : Math.round((userProfile.soc / 100) * 310)}{' '}
                    km
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold block">Pack Capacity</span>
                  <span className="text-base font-black text-slate-900">{userProfile.batteryKwh} kWh</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Cloud Reservation Pass */}
          {activeBooking && (
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-5 shadow-xl text-white relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-300" />
                  <span>PREPAID GPAY TICKET</span>
                </span>
                <span className="font-mono text-xs font-black">{activeBooking.bookingId}</span>
              </div>
              <h3 className="text-lg font-black">{activeBooking.stationName}</h3>
              <p className="text-xs text-emerald-100 mb-3">{activeBooking.stationAddress}</p>

              <div className="grid grid-cols-3 gap-2 bg-black/20 p-3 rounded-2xl text-center text-xs mb-3">
                <div>
                  <span className="text-[9px] text-emerald-200 block font-bold">Bay</span>
                  <span className="font-black text-sm">{activeBooking.bayNumber}</span>
                </div>
                <div>
                  <span className="text-[9px] text-emerald-200 block font-bold">Slot Time</span>
                  <span className="font-extrabold">{activeBooking.timeSlot}</span>
                </div>
                <div>
                  <span className="text-[9px] text-emerald-200 block font-bold">Paid via GPay</span>
                  <span className="font-black text-sm text-emerald-300">₹{activeBooking.estimatedCost}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (selectedDock) {
                        handleNavigateInApp(selectedDock);
                      } else {
                        setActiveTab('map');
                      }
                    }}
                    className="py-2.5 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 text-center"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-current" />
                    <span>In-App Route</span>
                  </button>

                  <button
                    onClick={() => openGoogleMaps()}
                    className="py-2.5 bg-white text-emerald-800 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 fill-current" />
                    <span>Google Maps</span>
                  </button>
                </div>

                <a
                  href={`tel:${activeBooking.stationContact}`}
                  className="w-full py-2 bg-black/20 hover:bg-black/30 text-emerald-100 font-bold text-xs rounded-xl flex items-center justify-center gap-1 text-center"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Station Operator ({activeBooking.stationContact})</span>
                </a>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">My prebooked slots</h3>
                <p className="text-[11px] text-slate-500">Reservations synced from Firebase</p>
              </div>
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{bookings.length}</span>
            </div>
            {bookings.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-3">No prebooked slots yet.</p>
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 8).map((booking) => (
                  <div key={booking.bookingId} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{booking.stationName}</p>
                      <p className="text-[10px] text-slate-500">{booking.timeSlot} · {booking.bayNumber}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase shrink-0 ${booking.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-700'}`}>{booking.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Charging history</h3>
                <p className="text-[11px] text-slate-500">Completed sessions from your account</p>
              </div>
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{pastCharges.length}</span>
            </div>
            {pastCharges.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-3">No completed charging sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {pastCharges.slice(0, 8).map((session) => (
                  <div key={session.sessionId} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{session.stationName}</p>
                      <p className="text-[10px] text-slate-500">{new Date(session.date).toLocaleDateString()} · {session.unitsKwh} kWh</p>
                    </div>
                    <span className="text-xs font-black text-emerald-700 shrink-0">₹{session.totalCost}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 4: Profile & Settings ── */}
      {activeTab === 'profile' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full pb-32">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            {/* Header / Avatar */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-500/20">
                {profileName ? profileName[0].toUpperCase() : 'Z'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 truncate">{profileName}</h3>
                <p className="text-xs text-slate-500 truncate">{userProfile.email}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Cloud Active Driver</span>
                </span>
              </div>
            </div>

            {/* Success Alert */}
            {profileSaveSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Profile details saved to Cloud & Local Storage!</span>
              </div>
            )}

            {/* Editable Profile Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveProfile();
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">DRIVER FULL NAME</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="K. Murugan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">MOBILE NUMBER (FOR GPAY NOTIFICATIONS)</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+91 98421 77610"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* Vehicle Category Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">VEHICLE CATEGORY</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileVehicleType('scooty');
                      if (!profileVehicleModel || profileVehicleModel.includes('Nexon')) {
                        setProfileVehicleModel('Ola S1 Pro (4 kWh)');
                        setProfileBatteryKwh(4.0);
                      }
                    }}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                      profileVehicleType === 'scooty'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>2-Wheeler (Scooty)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileVehicleType('car');
                      if (!profileVehicleModel || profileVehicleModel.includes('Ola')) {
                        setProfileVehicleModel('Tata Nexon EV Max');
                        setProfileBatteryKwh(40.5);
                      }
                    }}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                      profileVehicleType === 'car'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>4-Wheeler (Car)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">VEHICLE MODEL & TRIM</label>
                <input
                  type="text"
                  value={profileVehicleModel}
                  onChange={(e) => setProfileVehicleModel(e.target.value)}
                  placeholder="Ola S1 Pro / Ather 450X / Nexon EV"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">PACK SIZE (kWh)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={profileBatteryKwh}
                    onChange={(e) => setProfileBatteryKwh(parseFloat(e.target.value) || 4.0)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-600">CURRENT BATTERY %</label>
                    <span className="text-emerald-700 font-black font-mono">{profileSoc}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={profileSoc}
                    onChange={(e) => setProfileSoc(parseInt(e.target.value) || 28)}
                    className="w-full accent-emerald-600 mt-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </button>
            </form>

            {/* Cloud & GPay Diagnostics Info */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Firebase Cloud Sync</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>duohub-c4f39 (Active)</span>
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Prepaid UPI Receiver</span>
                <span className="font-black text-emerald-700 font-mono">{GPAY_UPI_ID}</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="text-slate-500 font-medium">Coverage Network</span>
                <span className="font-bold text-slate-800">All-India National Grid</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  logoutUser();
                  navigate('/login');
                }}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
            {accountActionError && (
              <p className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] font-semibold text-rose-700">
                {accountActionError}
              </p>
            )}
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="w-full mt-2 py-2.5 px-4 bg-white hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <span>{isDeletingAccount ? 'Deleting account…' : 'Delete account and all data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT CONFIRMATION MODAL (Bug 3 fix) ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">Delete Account?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                This will permanently delete your Zeus account, all prebooked slots, charging history, profile data, and logs.
                <span className="font-bold text-rose-700"> This cannot be undone.</span>
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAccount}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREPAID GPAY SLOT BOOKING MODAL ── */}
      {bookingModalOpen && bookingStation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Prepaid Slot Booking</h3>
                  <p className="text-[11px] text-slate-500">{bookingStation.name}</p>
                </div>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select Slot Arrival Time */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Select Arrival Time Slot</label>
              <div className="grid grid-cols-2 gap-2">
                {['Instant (Next 5 mins)', '+15 Mins', '+30 Mins', '+1 Hour'].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setSelectedTimeSlot(slot);
                      setCustomTime('');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedTimeSlot === slot && !customTime
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
                <span className="text-[11px] text-slate-400">Or pick custom exact timing</span>
              </div>
            </div>

            {/* Select Charger Port */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Select FastPort Charger</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPortType('CCS2-Fast-DC')}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                    selectedPortType === 'CCS2-Fast-DC'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="font-extrabold">CCS2 Fast DC</div>
                  <div className="text-[10px] text-slate-500">60kW - 150kW (Cars)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPortType('Ather-Ola-Fast')}
                  className={`p-2.5 rounded-xl text-xs font-bold border text-left transition-all ${
                    selectedPortType === 'Ather-Ola-Fast'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="font-extrabold">Ather / Ola Fast</div>
                  <div className="text-[10px] text-slate-500">25kW DC (Scooty)</div>
                </button>
              </div>
            </div>

            {/* ── EV Charge Specification (Like Liters in Petrol Bunk) ── */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <BatteryCharging className="w-4 h-4 text-emerald-600" />
                  <span>Specify EV Charge (Like Liters in Petrol Bunk)</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  ₹{bookingStation.pricePerKwh}/kWh
                </span>
              </div>

              {/* Charge Mode Selector */}
              <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-xl font-bold text-[11px]">
                <button
                  type="button"
                  onClick={() => setChargeMode('units')}
                  className={`py-1.5 rounded-lg transition-all ${
                    chargeMode === 'units'
                      ? 'bg-white text-emerald-800 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Units (kWh)
                </button>
                <button
                  type="button"
                  onClick={() => setChargeMode('soc')}
                  className={`py-1.5 rounded-lg transition-all ${
                    chargeMode === 'soc'
                      ? 'bg-white text-emerald-800 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Battery %
                </button>
                <button
                  type="button"
                  onClick={() => setChargeMode('budget')}
                  className={`py-1.5 rounded-lg transition-all ${
                    chargeMode === 'budget'
                      ? 'bg-white text-emerald-800 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Budget (₹)
                </button>
              </div>

              {/* Mode 1: By Units (Like Liters in Petrol Bunk) */}
              {chargeMode === 'units' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-semibold">Select Energy Units (1 Unit = 1 kWh):</span>
                    <span className="font-black text-emerald-700 font-mono text-xs">{specifiedUnits} Units</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2, 3.5, 8, 15].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setSpecifiedUnits(u)}
                        className={`py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                          specifiedUnits === u
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {u} Units
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={userProfile.vehicleType === 'scooty' ? 6 : 45}
                    step="0.5"
                    value={specifiedUnits}
                    onChange={(e) => setSpecifiedUnits(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              )}

              {/* Mode 2: By Battery % (Top-Up / Full Tank) */}
              {chargeMode === 'soc' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-semibold">Target Battery SOC:</span>
                    <span className="font-black text-emerald-700 font-mono text-xs">{targetSoc}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: '50% Quick', val: 50 },
                      { label: '80% (Best)', val: 80 },
                      { label: '100% Full', val: 100 },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setTargetSoc(item.val)}
                        className={`py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                          targetSoc === item.val
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode 3: By Budget (₹) */}
              {chargeMode === 'budget' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600 font-semibold">Budget Amount:</span>
                    <span className="font-black text-emerald-700 font-mono text-xs">₹{specifiedBudget}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSpecifiedBudget(amt)}
                        className={`py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                          specifiedBudget === amt
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculated Specification Summary Pill Card */}
              <div className="grid grid-cols-4 gap-1 bg-white p-2.5 rounded-xl border border-slate-200 text-center text-[10px]">
                <div>
                  <span className="text-slate-400 block font-bold">Units</span>
                  <span className="font-black text-slate-800 text-xs">{chargeDetails.units} kWh</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Total Cost</span>
                  <span className="font-black text-emerald-700 text-xs">₹{chargeDetails.totalCost}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Range Add</span>
                  <span className="font-black text-cyan-600 text-xs">+{chargeDetails.rangeKm} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Duration</span>
                  <span className="font-black text-amber-600 text-xs">~{chargeDetails.timeMins}m</span>
                </div>
              </div>
            </div>

            {/* ── Google Pay Prepaid Section ── */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 p-3.5 rounded-2xl border border-blue-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-blue-900 text-xs flex items-center gap-1">
                    <span>Google Pay Prepaid</span>
                  </span>
                  <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">
                    Direct Slot Booking
                  </span>
                </div>
                <span className="font-mono text-base font-black text-blue-900">
                  ₹{estimatedBookingCost}
                </span>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-blue-100 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receiver Name:</span>
                  <span className="font-black text-slate-900">{GPAY_RECEIVER_NAME}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Receiver UPI ID:</span>
                  <span className="font-bold text-emerald-700 font-mono">{GPAY_UPI_ID}</span>
                </div>
              </div>

              {/* QR Code + Pay button */}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-blue-100">
                <img
                  src={qrCodeUrl}
                  alt="UPI QR Code"
                  className="w-20 h-20 rounded-lg border border-slate-200 shrink-0"
                />
                <div className="flex-1 space-y-1.5">
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Pay ₹{estimatedBookingCost} to <span className="font-bold text-slate-900">{GPAY_UPI_ID}</span> via Google Pay, PhonePe, or Paytm.
                  </p>
                  <button
                    type="button"
                    onClick={triggerGPayPayment}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-extrabold text-[11px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>⚡ 1-Tap Pay & Auto-Book</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Auto & Manual Payment Verification Section ── */}
            <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  <span>UPI Payment Verification</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    handleVerifyAndConfirmPayment();
                  }}
                  className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md hover:bg-emerald-200"
                >
                  ⚡ Instant Auto-Verify
                </button>
              </div>

              <input
                type="text"
                value={upiUtrNumber}
                onChange={(e) => {
                  setUpiUtrNumber(e.target.value);
                  setVerificationError('');
                }}
                placeholder="Enter UPI Reference / UTR (Optional for Auto-Verify)"
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              {verificationError && (
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl text-[11px] font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{verificationError}</span>
                </div>
              )}

              <p className="text-[10px] text-amber-800 leading-tight">
                * Payment is verified directly against account {GPAY_UPI_ID} and synced immediately to cloud.
              </p>
            </div>

            {/* Strict Verify Payment & Issue Ticket Button */}
            <button
              onClick={() => handleVerifyAndConfirmPayment()}
              disabled={isVerifyingPayment}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isVerifyingPayment ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Auto-Verifying Payment with Cloud...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Auto-Verify Payment & Issue Pass (₹{estimatedBookingCost})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── OFFICIAL DIGITAL CHARGING TICKET / PASS ── */}
      {showBookingSuccess && activeBooking && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            {/* Header Ticket Badge */}
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Ticket className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PREPAID TICKET CONFIRMED</span>
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">Charging Slot Pass</h3>
              <p className="text-xs text-slate-500">Paid to {GPAY_UPI_ID}</p>
            </div>

            {/* Ticket Card Details */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2 text-xs shadow-inner">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-400 font-bold uppercase text-[9px]">TICKET ID</span>
                <span className="font-mono font-black text-slate-900">{activeBooking.bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Charging Hub</span>
                <span className="font-bold text-slate-900 text-right">{activeBooking.stationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reserved Bay</span>
                <span className="font-black text-emerald-700 text-sm">{activeBooking.bayNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timing Slot</span>
                <span className="font-bold text-slate-900">{activeBooking.timeSlot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Charger Port</span>
                <span className="font-bold text-slate-700">{activeBooking.portType}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-700 font-bold">Amount Paid</span>
                <span className="font-black text-emerald-600 text-sm">₹{activeBooking.estimatedCost}</span>
              </div>
            </div>

            {/* Ticket Actions: In-App Route + Google Maps */}
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowBookingSuccess(false);
                    if (bookingStation || selectedDock) {
                      handleNavigateInApp(bookingStation || selectedDock || undefined);
                    } else {
                      setActiveTab('map');
                    }
                  }}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                  <span>In-App Route</span>
                </button>

                <button
                  onClick={() => {
                    setShowBookingSuccess(false);
                    openGoogleMaps(bookingStation || selectedDock || undefined);
                  }}
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 fill-current" />
                  <span>Google Maps</span>
                </button>
              </div>

              <a
                href={`tel:${activeBooking.stationContact}`}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>Call Station ({activeBooking.stationContact})</span>
              </a>
            </div>

            <button
              onClick={() => setShowBookingSuccess(false)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 block mx-auto pt-1"
            >
              Close and View Map
            </button>
          </div>
        </div>
      )}

      {/* ── ADVANCED FILTER & SORT MODAL ── */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">EV Station Filters & Sort</h3>
                  <p className="text-[11px] text-slate-500">Showing {displayedDocks.length} of {enrichedDocks.length} Hubs</p>
                </div>
              </div>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Operator Brand Filter */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Charging Network Operator</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                {[
                  { id: 'all', label: 'All Brands' },
                  { id: 'zeon', label: 'Zeon' },
                  { id: 'tata', label: 'Tata Power' },
                  { id: 'chargezone', label: 'ChargeZone' },
                  { id: 'bpcl', label: 'BPCL' },
                  { id: 'jio', label: 'Jio-bp' },
                  { id: 'shell', label: 'Shell' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setOperatorFilter(item.id)}
                    className={`py-2 px-1 rounded-xl text-[11px] border transition-all ${
                      operatorFilter === item.id
                        ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Distance Filter Slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold mb-1">
                <span className="text-slate-700">Max Distance (from Live GPS)</span>
                <span className="text-emerald-700 font-mono font-black">{maxDistanceKm >= 100 ? 'Any distance' : `< ${maxDistanceKm} km`}</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1">
                <span>5 km</span>
                <span>25 km</span>
                <span>50 km</span>
                <span>All</span>
              </div>
            </div>

            {/* Power Rating Filter */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Minimum Charger Power</label>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                {[
                  { val: 0, label: 'Any' },
                  { val: 25, label: '25kW+' },
                  { val: 60, label: '60kW+' },
                  { val: 120, label: '120kW+' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => setMinPowerKw(item.val)}
                    className={`py-2 rounded-xl text-[11px] border transition-all ${
                      minPowerKw === item.val
                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort By Order */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Sort Stations By</label>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                {[
                  { id: 'nearest', label: '📍 Closest Distance' },
                  { id: 'fastest_eta', label: '⚡ Fastest Drive ETA' },
                  { id: 'lowest_price', label: '💰 Lowest Tariff (₹/unit)' },
                  { id: 'highest_power', label: '🚀 Highest Power (kW)' },
                  { id: 'most_plugs', label: '🟢 Most Free Plugs' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSortBy(item.id as any)}
                    className={`py-2 px-2 rounded-xl text-left text-[11px] border transition-all ${
                      sortBy === item.id
                        ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setOperatorFilter('all');
                  setMaxDistanceKm(100);
                  setMinPowerKw(0);
                  setAvailabilityOnly(false);
                  setNoQueueOnly(false);
                  setSortBy('nearest');
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Reset All
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all"
              >
                Apply Filters ({displayedDocks.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 🎙️ GOOGLE GEMINI IN-CABIN AI VOICE COPILOT MODAL ── */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-purple-500/30 text-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                    <span>Zeus Voice Copilot</span>
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-mono font-bold">Gemini AI</span>
                  </h3>
                  <p className="text-[10px] text-slate-400">Autonomous In-Cabin Automotive Voice Actions</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (voiceRecRef.current) voiceRecRef.current.stop();
                  setIsVoiceListening(false);
                  setIsVoiceModalOpen(false);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Glowing Microphone Visualizer */}
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                {isVoiceListening && (
                  <>
                    <div className="absolute -inset-3 rounded-full bg-purple-500/30 animate-ping" />
                    <div className="absolute -inset-1.5 rounded-full bg-indigo-500/40 animate-pulse" />
                  </>
                )}
                <button
                  onClick={() => {
                    if (isVoiceListening) {
                      if (voiceRecRef.current) voiceRecRef.current.stop();
                      setIsVoiceListening(false);
                    } else {
                      handleStartVoiceListening();
                    }
                  }}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                    isVoiceListening
                      ? 'bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-purple-500/50 scale-105'
                      : isVoiceProcessing
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isVoiceProcessing ? (
                    <span className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  ) : isVoiceListening ? (
                    <Mic className="w-8 h-8 text-white animate-bounce" />
                  ) : (
                    <Mic className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>

              <div className="space-y-1 max-w-xs">
                <div className="text-xs font-bold text-slate-200">
                  {isVoiceListening
                    ? 'Listening... Speak naturally'
                    : isVoiceProcessing
                    ? 'Interpreting intent with Gemini...'
                    : 'Tap microphone to speak'}
                </div>
                {voiceTranscript && (
                  <div className="text-xs italic text-cyan-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800 font-mono">
                    "{voiceTranscript}"
                  </div>
                )}
              </div>
            </div>

            {/* AI Spoken Response Card */}
            {voiceFeedback && (
              <div className="bg-purple-950/40 border border-purple-800/60 rounded-2xl p-3 flex items-start gap-2.5">
                <Volume2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-100 font-medium leading-relaxed">
                  {voiceFeedback}
                </div>
              </div>
            )}

            {/* Quick Voice Command Chips */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                Try Saying or Tapping:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '📍 Navigate me to nearby station', cmd: 'Navigate me to nearby station' },
                  { label: '⚡ Book an appointment for charging', cmd: 'Book an appointment for charging' },
                  { label: '🚀 Filter 100kW+ fast chargers', cmd: 'Filter 100kW fast chargers' },
                  { label: '🟢 Show stations with free plugs', cmd: 'Show stations with free plugs' },
                  { label: '💰 Raise payment dispute for my UTR', cmd: 'Raise payment dispute query for my UTR' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setVoiceTranscript(item.cmd);
                      handleProcessVoiceCommand(item.cmd);
                    }}
                    className="text-[11px] font-semibold bg-slate-800/90 hover:bg-purple-900/50 hover:border-purple-500/50 border border-slate-700/80 text-slate-200 px-2.5 py-1.5 rounded-xl transition-all text-left"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input Fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('cmd') as HTMLInputElement).value;
                if (input) {
                  setVoiceTranscript(input);
                  handleProcessVoiceCommand(input);
                  (e.currentTarget.elements.namedItem('cmd') as HTMLInputElement).value = '';
                }
              }}
              className="flex gap-2 pt-1 border-t border-slate-800"
            >
              <input
                name="cmd"
                type="text"
                placeholder="Or type a command (e.g. Navigate to nearest hub)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center shadow-md shadow-purple-600/30"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── 💳 UPI PAYMENT DISPUTE & UTR VERIFICATION MODAL ── */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Payment Dispute Desk</h3>
                  <p className="text-[10px] text-slate-500">Instant UTR Verification & Admin Resolution</p>
                </div>
              </div>
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <Shield className="w-3.5 h-3.5" />
                <span>UPI Payment Guarantee ({GPAY_UPI_ID})</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                If money was deducted from your bank or GPay/PhonePe but your charging session did not activate, submit your 12-digit UTR below. Our Admin Dispatch will cross-reference the bank gateway and manually clear your pass.
              </p>
            </div>

            {disputeSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 text-xs font-bold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{disputeSuccessMsg}</div>
              </div>
            )}

            {/* Dispute Form */}
            <form onSubmit={handleSubmitPaymentDispute} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  12-Digit UPI Transaction Reference (UTR) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="e.g. 428901234567"
                  value={disputeUtr}
                  onChange={(e) => setDisputeUtr(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={10}
                    max={5000}
                    value={disputeAmount}
                    onChange={(e) => setDisputeAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Target EV Station
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mattuthavani Hub"
                    value={disputeStationName || selectedDock?.name || ''}
                    onChange={(e) => setDisputeStationName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none truncate"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid ₹180 via GPay at Mattuthavani, but Bay #2 screen showed timeout error."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingDispute || !disputeUtr.trim()}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmittingDispute ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Dispatching Ticket to Admin...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Payment Query (Instant Review)</span>
                  </>
                )}
              </button>
            </form>

            {/* My Active Dispute Tickets */}
            {userPaymentQueries.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  My Recent Payment Queries:
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {userPaymentQueries.map((q) => (
                    <div key={q.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800">{q.id}</span>
                          <span className="text-slate-500">| UTR: {q.utr}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[200px]">
                          ₹{q.amount} • {q.stationName}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        q.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : q.status === 'investigating'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed Mobile Bottom Navigation Bar ── */}
      <BottomNavBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        batterySoc={userProfile.soc}
      />
    </div>
  );
}
