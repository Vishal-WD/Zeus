/**
 * Zeus OS — Google Gemini AI Engine & In-Cabin / Admin Voice Assistant
 * 
 * Powered by Google Gemini:
 *   - Configured with official API Key: AIzaSyB_ItpQT3z-aUzIs2kZt_NWyGsEvFNHViU
 *   - Model: Gemini 1.5 Flash / Gemini 2.0 Flash
 * 
 * Capabilities:
 *   1. Driver Voice Copilot: Autonomous navigation, slot booking, filter adjustments, payment dispute queries.
 *   2. Admin Executive Copilot: Real-time fleet count, bunk usage ranking, grid bottlenecks, revenue reports.
 *   3. Integrated Web Speech Recognition & Natural Speech Synthesis (TTS).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Default Gemini API Key provided by user ──
export const DEFAULT_GEMINI_API_KEY = 'AIzaSyB_ItpQT3z-aUzIs2kZt_NWyGsEvFNHViU';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

const API_KEY_STORAGE = 'zeus_gemini_api_key';
const MODEL_STORAGE = 'zeus_gemini_model';

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_GEMINI_API_KEY;
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key || DEFAULT_GEMINI_API_KEY);
  initClient();
}

export function getStoredModel(): string {
  const m = localStorage.getItem(MODEL_STORAGE);
  if (!m || m.includes('1.5') || m.includes('2.0-flash-exp')) {
    return DEFAULT_GEMINI_MODEL;
  }
  return m;
}

export function setStoredModel(model: string): void {
  localStorage.setItem(MODEL_STORAGE, model);
}

let genAI: GoogleGenerativeAI | null = null;

function initClient() {
  const key = getStoredApiKey();
  if (key) {
    try {
      genAI = new GoogleGenerativeAI(key);
    } catch (err) {
      console.warn('[Zeus Gemini] Client init error:', err);
    }
  }
}

initClient();

/**
 * Robust Model Caller with Automatic Candidate Fallback
 */
export async function callGenerativeAI(prompt: string, preferModel?: string): Promise<string> {
  const key = getStoredApiKey();
  const client = genAI || new GoogleGenerativeAI(key);
  const preferred = preferModel || getStoredModel();
  const modelsToTry = [preferred, ...CANDIDATE_MODELS.filter(m => m !== preferred)];

  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text) return text.trim();
    } catch (err: any) {
      lastError = err;
      console.warn(`[Zeus Gemini] Model "${modelName}" notice:`, err.message || err);
    }
  }
  throw lastError || new Error('All Gemini model candidates exhausted.');
}

export interface AiVoiceAction {
  type: 'NAVIGATE_NEAREST' | 'NAVIGATE_STATION' | 'NAVIGATE_GOOGLE_MAPS' | 'BOOK_SLOT' | 'FILTER_FAST' | 'FILTER_AVAILABLE' | 'FILTER_5KM' | 'RAISE_PAYMENT_QUERY' | 'SUMMARIZE_GRID' | 'SEED_DEMO_DATA' | 'GENERAL_INFO';
  targetStationName?: string;
  stationId?: string;
  units?: number;
  utrNumber?: string;
  spokenResponse: string;
}

/**
 * Process Driver natural language voice / text commands with Gemini
 */
export async function processDriverVoiceCommand(
  userQuery: string,
  context: {
    driverName: string;
    vehicleModel: string;
    soc: number;
    currentLocation: [number, number];
    availableStations: Array<{ id: string; name: string; distanceKm: number; availablePlugs: number; powerKw: number; pricePerKwh: number }>;
    selectedStation?: string;
  }
): Promise<AiVoiceAction> {
  const stationsSummary = context.availableStations.slice(0, 10).map((s) => 
    `- ${s.name} (ID: ${s.id}, Dist: ${s.distanceKm}km, Free Plugs: ${s.availablePlugs}, Power: ${s.powerKw}kW, Tariff: ₹${s.pricePerKwh}/unit)`
  ).join('\n');

  const systemPrompt = `You are Zeus Voice Copilot, an intelligent in-cabin automotive AI for EV drivers across India.
The user is driving a ${context.vehicleModel} with ${context.soc}% battery.
Driver's current location: [${context.currentLocation[0].toFixed(4)}, ${context.currentLocation[1].toFixed(4)}].

Available nearby charging stations:
${stationsSummary}

The user said: "${userQuery}"

Your goal is to parse the intent and return ONLY a valid JSON object (no markdown quotes, no triple backticks, just raw JSON) matching this schema:
{
  "type": "NAVIGATE_NEAREST" | "NAVIGATE_STATION" | "NAVIGATE_GOOGLE_MAPS" | "BOOK_SLOT" | "FILTER_FAST" | "FILTER_AVAILABLE" | "FILTER_5KM" | "RAISE_PAYMENT_QUERY" | "GENERAL_INFO",
  "targetStationName": "Exact station name if user specified or nearest",
  "stationId": "Station ID if found or closest",
  "units": 5.0,
  "utrNumber": "12-digit UTR if mentioned for payment query",
  "spokenResponse": "Concise, natural, friendly speech response to read aloud to driver in 1-2 sentences."
}`;

  try {
    const rawText = await callGenerativeAI(systemPrompt);
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    return {
      type: parsed.type || 'GENERAL_INFO',
      targetStationName: parsed.targetStationName || (context.availableStations[0]?.name ?? 'Nearest EV Hub'),
      stationId: parsed.stationId || context.availableStations[0]?.id,
      units: parsed.units,
      utrNumber: parsed.utrNumber,
      spokenResponse: parsed.spokenResponse || `Navigating you to ${context.availableStations[0]?.name}.`,
    };
  } catch (err) {
    console.warn('[Zeus Gemini] Live model call fallback:', err);
    return _localDriverCommandFallback(userQuery, context);
  }
}

function _localDriverCommandFallback(userQuery: string, context: any): AiVoiceAction {
  const q = userQuery.toLowerCase();
  const nearest = context.availableStations[0] || { id: 'IN-HUB-MDU-01', name: 'Mattuthavani Integrated FastPort', distanceKm: 2.5 };

  if (q.includes('google map') || q.includes('google maps') || q.includes('external map') || q.includes('gmap')) {
    return {
      type: 'NAVIGATE_GOOGLE_MAPS',
      targetStationName: nearest.name,
      stationId: nearest.id,
      spokenResponse: `Opening Google Maps for turn-by-turn driving navigation to ${nearest.name}.`,
    };
  }

  if (q.includes('navigate') || q.includes('nearest') || q.includes('take me') || q.includes('find station') || q.includes('route') || q.includes('direction') || q.includes('drive')) {
    return {
      type: 'NAVIGATE_NEAREST',
      targetStationName: nearest.name,
      stationId: nearest.id,
      spokenResponse: `Navigating to ${nearest.name}, ${nearest.distanceKm} km away. Calculating fastest real road route now.`,
    };
  }

  if (q.includes('book') || q.includes('slot') || q.includes('appointment') || q.includes('reserve') || q.includes('charge')) {
    return {
      type: 'BOOK_SLOT',
      targetStationName: nearest.name,
      stationId: nearest.id,
      spokenResponse: `Opening instant prepaid slot booking for ${nearest.name}.`,
    };
  }

  if (q.includes('fast') || q.includes('100kw') || q.includes('super') || q.includes('ultra')) {
    return {
      type: 'FILTER_FAST',
      spokenResponse: 'Filtering high-power ultra-fast charging stations.',
    };
  }

  if (q.includes('available') || q.includes('free') || q.includes('empty') || q.includes('open')) {
    return {
      type: 'FILTER_AVAILABLE',
      spokenResponse: 'Filtering stations with currently available free plugs.',
    };
  }

  if (q.includes('5km') || q.includes('5 km') || q.includes('nearby') || q.includes('close')) {
    return {
      type: 'FILTER_5KM',
      spokenResponse: 'Filtering EV charging stations within 5 kilometers of your live location.',
    };
  }

  if (q.includes('payment') || q.includes('utr') || q.includes('failed') || q.includes('dispute') || q.includes('money') || q.includes('refund')) {
    return {
      type: 'RAISE_PAYMENT_QUERY',
      spokenResponse: 'Opening payment dispute center. You can enter your 12-digit UPI UTR for automated verification.',
    };
  }

  return {
    type: 'GENERAL_INFO',
    targetStationName: nearest.name,
    stationId: nearest.id,
    spokenResponse: `You have ${context.soc}% battery remaining in your ${context.vehicleModel}. The closest EV station is ${nearest.name}, ${nearest.distanceKm} kilometers away.`,
  };
}

/**
 * Generate Admin Executive Summary of EV Grid Telemetry & Bunk-wise Usage
 */
export async function generateAdminExecutiveSummary(gridData: {
  totalStations: number;
  totalPlugs: number;
  activeVehicles: number;
  totalKwhDispensed: number;
  topBunks: Array<{ name: string; utilizationPct: number; sessionsToday: number }>;
  activeAlerts: string[];
  resolvedDisputesCount: number;
}): Promise<string> {
  const prompt = `You are Zeus Enterprise AI, presenting an executive voice debrief for the Municipal EV Grid Administrator.
Live Grid Statistics:
- Total Stations Online: ${gridData.totalStations} across All-India National Grid
- Total Installed Plugs: ${gridData.totalPlugs}
- Current Active EV Vehicles in Network: ${gridData.activeVehicles}
- Energy Delivered Today: ${gridData.totalKwhDispensed} kWh
- Top Utilized Bunks / Hubs: ${gridData.topBunks.map(b => `${b.name} (${b.utilizationPct}% utilization, ${b.sessionsToday} charges today)`).join(', ')}
- Critical Alerts: ${gridData.activeAlerts.length > 0 ? gridData.activeAlerts.join('; ') : 'All substations optimal'}
- Payment Dispatches: ${gridData.resolvedDisputesCount} verified UPI bookings processed.

Summarize this into a professional, concise 3-4 sentence spoken executive debrief. Highlight fleet count, most frequently used bunks, and overall grid stability.`;

  try {
    return await callGenerativeAI(prompt);
  } catch (err) {
    console.warn('[Zeus Gemini] Admin summary fallback:', err);
    return `Grid Executive Briefing: Currently ${gridData.activeVehicles} electric vehicles are actively connected across ${gridData.totalStations} national superhubs. Primary demand is centered at ${gridData.topBunks[0]?.name || 'Mattuthavani Integrated FastPort'} with ${gridData.topBunks[0]?.utilizationPct || 85}% utilization, followed by ${gridData.topBunks[1]?.name || 'BKC MegaHub'}. Grid load is stable with zero critical bottlenecks.`;
  }
}

/**
 * Generate a concise, driver-friendly situation debrief.
 */
export async function generateDriverDebrief(context: {
  driverName: string;
  vehicle: string;
  soc: number;
  targetStation: string;
  etaMinutes: number;
  queueLength: number;
  isRerouted: boolean;
  anomalyMessage?: string;
}): Promise<string> {
  const prompt = `You are "Zeus", a calm and professional in-cabin AI assistant for an EV driver across India's charging network. Provide a brief 2-3 sentence audio debrief in natural English.

Current situation:
- Driver: ${context.driverName} driving a ${context.vehicle}
- Battery: ${context.soc}% State of Charge
- Destination: ${context.targetStation}
- ETA: ${context.etaMinutes} minutes
- Queue at destination: ${context.queueLength} vehicles waiting
- Rerouted: ${context.isRerouted ? 'Yes, Zeus has optimised the route.' : 'No'}
${context.anomalyMessage ? `- Alert: ${context.anomalyMessage}` : ''}

Give a calm, informative audio briefing. Mention key numbers. If there's an anomaly, reassure the driver that Zeus has the situation under control.`;

  try {
    const text = await callGenerativeAI(prompt);
    if (text) return text;
  } catch (err) {
    console.warn('[Zeus Gemini] API call failed — using local fallback.', err);
  }

  // Local Fallback Synthesis
  const base = `${context.driverName}, your ${context.vehicle} is at ${context.soc}% charge. `;
  if (context.anomalyMessage) {
    return (
      base +
      `An arterial anomaly has been detected. Zeus has rerouted you to ${context.targetStation}. ` +
      `Estimated arrival in ${context.etaMinutes} minutes with ${context.queueLength} vehicles ahead. Situation is under control.`
    );
  }
  if (context.isRerouted) {
    return (
      base +
      `You have been rerouted to ${context.targetStation} for faster charging. ` +
      `ETA is ${context.etaMinutes} minutes, ${context.queueLength} in queue.`
    );
  }
  return (
    base +
    `Heading to ${context.targetStation}. ETA ${context.etaMinutes} minutes, ` +
    `${context.queueLength} vehicle${context.queueLength !== 1 ? 's' : ''} in queue. All systems nominal.`
  );
}

// ── Web Speech TTS & Recognition ──

let isMuted = false;

export function setVoiceMuted(muted: boolean): void {
  isMuted = muted;
  if (muted) window.speechSynthesis?.cancel();
}

export function speakText(text: string, onEnd?: () => void): void {
  if (isMuted || !window.speechSynthesis) {
    if (onEnd) onEnd();
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Victoria'))
  ) || voices[0];
  if (preferred) utterance.voice = preferred;

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

export async function briefDriver(context: Parameters<typeof generateDriverDebrief>[0]): Promise<string> {
  const text = await generateDriverDebrief(context);
  speakText(text);
  return text;
}

/**
 * Request audio recording permission explicitly in mobile WebViews / Browsers
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    }
  } catch (err) {
    console.warn('[Zeus Mic] Permission request prompt error:', err);
    return false;
  }
  return true;
}

/**
 * Start Continuous Voice Speech Recognition from User Microphone
 */
export function startVoiceRecognition(
  onResult: (transcript: string) => void,
  onError: (error: string) => void,
  onEnd?: () => void
): { stop: () => void } {
  // Explicitly prompt user for microphone permission if needed
  requestMicrophonePermission().then((granted) => {
    if (!granted) {
      console.warn('[Zeus Voice] Microphone permission denied by user.');
    }
  });

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError('Speech recognition is not supported in this browser.');
    if (onEnd) onEnd();
    return { stop: () => {} };
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      onError(event.error || 'Voice input error');
      if (onEnd) onEnd();
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    recognition.start();
    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {}
      },
    };
  } catch (err: any) {
    onError(err.message || 'Microphone activation error');
    if (onEnd) onEnd();
    return { stop: () => {} };
  }
}

