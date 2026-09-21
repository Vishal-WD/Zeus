/**
 * Zeus OS — Firebase Authentication & Cloud Storage Service
 * 
 * Powered by Firebase Project: duohub-c4f39
 * Supports:
 *   - Google Sign-In with real profile extraction
 *   - User Profile management synced to Firestore & Realtime Database
 *   - Prebooked Charging Slots (Active reservations)
 *   - Past Charged Sessions & History (with kWh units, costs, and receipts)
 *   - Live Station Availability Sync
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  deleteUser,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Firestore
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  Database
} from 'firebase/database';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  vehicleType: 'scooty' | 'car';
  vehicleModel: string;
  batteryKwh: number;
  soc: number;
  favorites: string[];
}

export interface CloudBooking {
  bookingId: string;
  userId: string;
  userEmail: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  stationContact: string;
  timeSlot: string;
  bayNumber: string;
  portType: string;
  targetSoc: number;
  estimatedCost: number;
  status: 'confirmed' | 'active' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface PastChargeSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  unitsKwh: number;
  totalCost: number;
  date: string;
  paymentRef: string;
  status: 'completed';
}

export interface PaymentQuery {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  utr: string;
  amount: number;
  stationName: string;
  issueDescription: string;
  status: 'pending' | 'resolved' | 'investigating';
  adminNotes?: string;
  createdAt: string;
}

export interface CloudLog {
  id?: string;
  userId?: string;
  eventType: string;
  details: any;
  timestamp: string;
  platform: string;
}

const STORAGE_KEY = 'zeus_driver_user';
const BOOKINGS_KEY = 'zeus_cloud_bookings';
const HISTORY_KEY = 'zeus_charging_history';
const PAYMENT_QUERIES_KEY = 'zeus_payment_queries';

// Verified Firebase Project Credentials from google-services (1).json
export const defaultFirebaseConfig = {
  apiKey: "AIzaSyCRcKwsA5t0K5uJjcPyYPf-NalA84XfrvY",
  authDomain: "duohub-c4f39.firebaseapp.com",
  projectId: "duohub-c4f39",
  storageBucket: "duohub-c4f39.firebasestorage.app",
  messagingSenderId: "698698703501",
  appId: "1:698698703501:android:ef857b4f21eec7aeecf8c4",
  databaseURL: "https://duohub-c4f39-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore | null = null;
let rtdb: Database | null = null;

try {
  app = getApps().length === 0 ? initializeApp(defaultFirebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  console.log('[Zeus Firebase Cloud] Connected to Cloud Project:', app.options.projectId);
} catch (err) {
  console.warn('[Zeus Firebase Cloud] Init warning:', err);
}

/**
 * Save User Profile directly to Firebase Cloud (Firestore & Realtime Database)
 */
export async function saveUserProfileToCloud(profile: UserProfile): Promise<void> {
  // 1. Cache in LocalStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

  // 2. Write to Firebase Firestore
  try {
    if (db) {
      const userDoc = doc(db, 'users', profile.uid);
      await setDoc(userDoc, profile, { merge: true });
      console.log('[Firebase Cloud] User profile saved to Firestore:', profile.uid);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Firestore profile save warning:', err);
  }

  // 3. Write to Firebase Realtime Database
  try {
    if (rtdb) {
      const userRef = ref(rtdb, `users/${profile.uid}`);
      await set(userRef, profile);
      console.log('[Firebase Cloud] User profile saved to RTDB:', profile.uid);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] RTDB profile save warning:', err);
  }
}

/**
 * Fetch User Profile directly from Firebase Cloud (Firestore & Realtime Database)
 */
export async function fetchUserProfileFromCloud(uid: string): Promise<UserProfile | null> {
  // 1. Try Firestore
  try {
    if (db) {
      const userDoc = doc(db, 'users', uid);
      const snap = await getDoc(userDoc);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Firestore fetch user warning:', err);
  }

  // 2. Try Realtime Database
  try {
    if (rtdb) {
      const userRef = ref(rtdb, `users/${uid}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const data = snap.val() as UserProfile;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('[Firebase Cloud] RTDB fetch user warning:', err);
  }

  const stored = getStoredUser();
  return stored?.uid === uid ? stored : null;
}

/**
 * Sign in using Google Auth Popup (Fetches real account details from Google)
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  if (!auth) throw new Error('Firebase Auth not available');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const res = await signInWithPopup(auth, provider);
  const user = res.user;

  // Fetch existing profile or create new one with REAL Google details
  const existingCloud = await fetchUserProfileFromCloud(user.uid);
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || 'ev.driver@gmail.com',
    displayName: user.displayName || user.email?.split('@')[0] || 'EV Driver',
    photoURL: user.photoURL || undefined,
    vehicleType: existingCloud?.vehicleType || 'scooty',
    vehicleModel: existingCloud?.vehicleModel || 'Ola S1 Pro (4 kWh)',
    batteryKwh: existingCloud?.batteryKwh || 4.0,
    soc: existingCloud?.soc ?? 28,
    favorites: existingCloud?.favorites || ['EV-01', 'EV-02'],
    phone: existingCloud?.phone,
  };

  await saveUserProfileToCloud(profile);
  console.log('[Zeus Firebase] Google Sign-In verified for real user:', profile.displayName, profile.email);
  return profile;
}

/**
 * Sign in with User's specific Google Account (Email & Name)
 * Critical for mobile WebViews where Google blocks in-app popup dialogs
 */
export async function loginWithGoogleAccount(googleEmail: string, googleName: string): Promise<UserProfile> {
  if (!auth?.currentUser) throw new Error('Please complete Google sign-in first.');
  const user = auth.currentUser;
  const existingCloud = await fetchUserProfileFromCloud(user.uid);
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || googleEmail.trim().toLowerCase(),
    displayName: user.displayName || googleName.trim() || user.email?.split('@')[0] || 'EV Driver',
    photoURL: user.photoURL || undefined,
    vehicleType: existingCloud?.vehicleType || 'scooty',
    vehicleModel: existingCloud?.vehicleModel || 'Ola S1 Pro (4 kWh)',
    batteryKwh: existingCloud?.batteryKwh || 4.0,
    soc: existingCloud?.soc ?? 28,
    favorites: existingCloud?.favorites || ['EV-01', 'EV-02'],
  };

  await saveUserProfileToCloud(profile);
  console.log('[Zeus Firebase] Google Account synced to Firebase Cloud:', profile.displayName, profile.email);
  return profile;
}

/**
 * Register a new EV Driver with Email/Password and Vehicle profile
 */
export async function registerUser(
  email: string,
  pass: string,
  displayName: string,
  vehicleType: 'scooty' | 'car',
  vehicleModel: string
): Promise<UserProfile> {
  const profile: UserProfile = {
    uid: `drv-${Date.now()}`,
    email,
    displayName: displayName || (vehicleType === 'scooty' ? 'Scooty Rider' : 'Car Pilot'),
    vehicleType,
    vehicleModel: vehicleModel || (vehicleType === 'scooty' ? 'Ola S1 Pro' : 'Tata Nexon EV Max'),
    batteryKwh: vehicleType === 'scooty' ? 4.0 : 40.5,
    soc: 24,
    favorites: ['HUB-02'],
  };

  if (auth) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      profile.uid = cred.user.uid;
    } catch (err: any) {
      console.warn('[Zeus Firebase] Auth create notice:', err);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered. Please sign in.');
      } else if (err.code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters long.');
      } else {
        // Bug 9 fix: re-throw unknown errors instead of silently creating a ghost profile
        throw new Error(err.message || 'Registration failed. Please check your connection and try again.');
      }
    }
  }

  // Persist directly to Firebase Cloud (Firestore & Realtime DB)!
  await saveUserProfileToCloud(profile);
  return profile;
}

/**
 * Login existing driver with Email and Password
 */
export async function loginUser(email: string, pass: string): Promise<UserProfile> {
  let uid = '';
  if (auth) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      uid = cred.user.uid;
    } catch (err: any) {
      console.warn('[Zeus Firebase] Sign-in notice:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        const local = getStoredUser();
        if (!local || local.email.toLowerCase() !== email.toLowerCase()) {
          throw new Error('Invalid email or password. Please verify or register.');
        }
      }
    }
  }

  if (uid) {
    const cloudUser = await fetchUserProfileFromCloud(uid);
    if (cloudUser) return cloudUser;
  }

  const existing = getStoredUser();
  if (existing && existing.email.toLowerCase() === email.toLowerCase()) {
    await saveUserProfileToCloud(existing);
    return existing;
  }

  const demoProfile: UserProfile = {
    uid: uid || `user-${Date.now()}`,
    email,
    displayName: email.split('@')[0] || 'EV Pilot',
    vehicleType: 'scooty',
    vehicleModel: 'Ola S1 Pro',
    batteryKwh: 4.0,
    soc: 28,
    favorites: ['HUB-02'],
  };

  await saveUserProfileToCloud(demoProfile);
  return demoProfile;
}

/**
 * Instant 1-Tap Guest Access
 */
export function loginAsDemoGuest(type: 'scooty' | 'car' = 'scooty'): UserProfile {
  const guest: UserProfile = {
    uid: 'guest-india-rider',
    email: type === 'scooty' ? 'rider@scooty.zeus' : 'pilot@nexon.zeus',
    displayName: type === 'scooty' ? 'A. Sharma (Ola S1)' : 'R. Verma (Tata Nexon EV)',
    vehicleType: type,
    vehicleModel: type === 'scooty' ? 'Ola S1 Pro (4 kWh)' : 'Tata Nexon EV Max (40.5 kWh)',
    batteryKwh: type === 'scooty' ? 4.0 : 40.5,
    soc: 24,
    favorites: ['IN-HUB-DEL-01', 'IN-HUB-BLR-01'],
  };
  saveUserProfileToCloud(guest);
  return guest;
}

export function logoutUser(): void {
  if (auth) {
    signOut(auth).catch(() => {});
  }
  // Bug 8 fix: clear ALL Zeus localStorage keys so stale data does not bleed into the next session
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BOOKINGS_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem('zeus_driver_profile');
  localStorage.removeItem('zeus_gemini_api_key');
}

export function getStoredUser(): UserProfile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save Slot Reservation to Firebase Cloud Firestore & Realtime Database
 */
export async function saveBookingToCloud(booking: CloudBooking): Promise<boolean> {
  // 1. Always cache locally
  try {
    const existing = getStoredBookings();
    existing.unshift(booking);
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(existing));
  } catch {}

  // 2. Sync to Firebase Cloud Firestore
  try {
    if (db) {
      const docRef = doc(db, 'bookings', booking.bookingId);
      await setDoc(docRef, booking);
      console.log('[Firebase Cloud] Booking saved to Firestore:', booking.bookingId);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Firestore booking sync warning:', err);
  }

  // 3. Sync to Firebase Realtime Database
  try {
    if (rtdb) {
      const rRef = ref(rtdb, `bookings/${booking.bookingId}`);
      await set(rRef, booking);
      const userBookingRef = ref(rtdb, `user_bookings/${booking.userId}/${booking.bookingId}`);
      await set(userBookingRef, booking);
      console.log('[Firebase Cloud] Booking saved to RTDB:', booking.bookingId);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] RTDB booking sync warning:', err);
  }

  // 4. Log event to cloud
  logEventToCloud('SLOT_BOOKED', {
    bookingId: booking.bookingId,
    station: booking.stationName,
    bay: booking.bayNumber,
    time: booking.timeSlot,
  });

  return true;
}

/**
 * Retrieve User Bookings from Firebase Cloud (Firestore & Realtime Database)
 */
export async function getUserBookingsFromCloud(userId: string): Promise<CloudBooking[]> {
  const list: CloudBooking[] = [];

  // 1. Try RTDB
  try {
    if (rtdb) {
      const userBookingsRef = ref(rtdb, `user_bookings/${userId}`);
      const snap = await get(userBookingsRef);
      if (snap.exists()) {
        const val = snap.val();
        if (typeof val === 'object') {
          const bookings = Object.values(val) as CloudBooking[];
          bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          if (bookings.length > 0) {
            localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
            return bookings;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Firebase Cloud] RTDB fetch bookings warning:', err);
  }

  // 2. Try Firestore
  try {
    if (db) {
      const q = query(
        collection(db, 'bookings'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => list.push(d.data() as CloudBooking));
      if (list.length > 0) {
        localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
        return list;
      }
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Firestore fetch bookings warning:', err);
  }

  return getStoredBookings(userId);
}

export function getStoredBookings(userId?: string): CloudBooking[] {
  const raw = localStorage.getItem(BOOKINGS_KEY);
  if (!raw) return [];
  try {
    const bookings = JSON.parse(raw) as CloudBooking[];
    return userId ? bookings.filter((booking) => booking.userId === userId) : bookings;
  } catch {
    return [];
  }
}

/**
 * Save Past Charging Session / Completed Charge to Firebase Cloud
 */
export async function saveChargingSessionToCloud(session: PastChargeSession): Promise<void> {
  // 1. Cache locally
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const existing: PastChargeSession[] = raw ? JSON.parse(raw) : [];
    existing.unshift(session);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
  } catch {}

  // 2. Firestore
  try {
    if (db) {
      const sessionDoc = doc(db, 'charging_history', session.sessionId);
      await setDoc(sessionDoc, session);
      console.log('[Firebase Cloud] Charging session saved to Firestore:', session.sessionId);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Firestore charging session notice:', err);
  }

  // 3. RTDB
  try {
    if (rtdb) {
      const sessionRef = ref(rtdb, `charging_history/${session.userId}/${session.sessionId}`);
      await set(sessionRef, session);
      console.log('[Firebase Cloud] Charging session saved to RTDB:', session.sessionId);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] RTDB charging session notice:', err);
  }
}

/**
 * Fetch Past Charged History directly from Firebase Cloud
 */
export async function fetchPastChargesFromCloud(userId: string): Promise<PastChargeSession[]> {
  const list: PastChargeSession[] = [];

  // 1. Try RTDB
  try {
    if (rtdb) {
      const historyRef = ref(rtdb, `charging_history/${userId}`);
      const snap = await get(historyRef);
      if (snap.exists()) {
        const val = snap.val();
        if (typeof val === 'object') {
          const sessions = Object.values(val) as PastChargeSession[];
          sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          if (sessions.length > 0) {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
            return sessions;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Firebase Cloud] RTDB fetch charging history warning:', err);
  }

  // 2. Try Firestore
  try {
    if (db) {
      const q = query(
        collection(db, 'charging_history'),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => list.push(d.data() as PastChargeSession));
      if (list.length > 0) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        return list;
      }
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Firestore fetch charging history warning:', err);
  }

  // 3. Fallback to LocalStorage. Never invent a charge record for a new user.
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw) {
    try {
      const sessions = JSON.parse(raw) as PastChargeSession[];
      return sessions.filter((session) => session.userId === userId);
    } catch {}
  }
  return [];
}

/** Delete the authenticated user and every Zeus record owned by that user. */
export async function deleteAccountAndData(): Promise<void> {
  const user = auth?.currentUser;
  const profile = getStoredUser();
  const uid = user?.uid || profile?.uid;
  if (!uid) throw new Error('No signed-in user found.');

  const deleteQueryDocs = async (source: 'bookings' | 'charging_history' | 'logs') => {
    if (!db) return;
    try {
      const snap = await getDocs(query(collection(db, source), where('userId', '==', uid)));
      await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
    } catch (err) {
      console.warn(`[Firebase Cloud] Could not remove ${source}:`, err);
    }
  };

  await Promise.all([
    deleteQueryDocs('bookings'),
    deleteQueryDocs('charging_history'),
    deleteQueryDocs('logs'),
  ]);

  try {
    if (db) await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('[Firebase Cloud] Could not remove user profile:', err);
  }

  try {
    if (rtdb) {
      await Promise.all([
        set(ref(rtdb, `users/${uid}`), null),
        set(ref(rtdb, `user_bookings/${uid}`), null),
        set(ref(rtdb, `charging_history/${uid}`), null),
      ]);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Could not remove realtime user data:', err);
  }

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BOOKINGS_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem('zeus_driver_profile');
  if (user) await deleteUser(user);
}

/**
 * Log Any Driver Action / Telemetry Event to Firebase Cloud
 */
export async function logEventToCloud(eventType: string, details: any): Promise<void> {
  const user = getStoredUser();
  const log: CloudLog = {
    userId: user?.uid || 'anonymous',
    eventType,
    details,
    timestamp: new Date().toISOString(),
    platform: window.navigator.userAgent.includes('Android') ? 'android' : 'web',
  };

  try {
    if (db) {
      await addDoc(collection(db, 'logs'), log);
      console.log('[Firebase Cloud Log]', eventType);
    } else if (rtdb) {
      const logRef = ref(rtdb, `logs/${Date.now()}`);
      await set(logRef, log);
    }
  } catch (err) {
    // Silent fail for logs
  }
}

/**
 * Sync Real EV Stations to Firebase Cloud Realtime Database / Firestore
 */
export async function syncStationsToCloud(stations: any[]): Promise<void> {
  try {
    if (rtdb) {
      const stationsRef = ref(rtdb, 'stations');
      await set(stationsRef, stations);
      console.log(`[Firebase Cloud] Synced ${stations.length} stations to Cloud Realtime DB`);
    } else if (db) {
      for (const st of stations) {
        await setDoc(doc(db, 'stations', st.id), st);
      }
      console.log(`[Firebase Cloud] Synced ${stations.length} stations to Cloud Firestore`);
    }
  } catch (err) {
    console.warn('[Firebase Cloud] Station cloud sync notice:', err);
  }
}

/**
 * Scrape live TomTom EV charging stations and persist them to Firebase
 */
export async function syncTomTomScrapedStationsToCloud(
  center?: [number, number],
  radiusMeters?: number
): Promise<any[]> {
  try {
    const { scrapeLiveTomTomEVStations } = await import('./tomtomService');
    const liveStations = await scrapeLiveTomTomEVStations(center, radiusMeters);
    if (liveStations && liveStations.length > 0) {
      await syncStationsToCloud(liveStations);
      return liveStations;
    }
  } catch (err) {
    console.warn('[Firebase Cloud] TomTom live scrape sync notice:', err);
  }
  return [];
}

/**
 * Real-Time Listener for Stations in Firebase Cloud
 */
export function subscribeToCloudStations(
  callback: (stations: any[]) => void
): () => void {
  if (rtdb) {
    try {
      const stationsRef = ref(rtdb, 'stations');
      const unsubscribe = onValue(stationsRef, (snapshot) => {
        const val = snapshot.val();
        if (val && Array.isArray(val) && val.length > 0) {
          callback(val);
        } else if (val && typeof val === 'object') {
          callback(Object.values(val));
        } else {
          // If empty in cloud, automatically scrape from TomTom and sync
          syncTomTomScrapedStationsToCloud().then((scraped) => {
            if (scraped.length > 0) callback(scraped);
          });
        }
      });
      return () => unsubscribe();
    } catch {
      return () => {};
    }
  }
  return () => {};
}

/**
 * Submit a Payment Query / UTR Dispute to Firebase Cloud
 */
export async function submitPaymentQueryToCloud(queryData: {
  userId: string;
  userEmail: string;
  userName: string;
  utr: string;
  amount: number;
  stationName: string;
  issueDescription: string;
}): Promise<PaymentQuery> {
  const code = `DISP-${Math.floor(1000 + Math.random() * 9000)}`;
  const newQuery: PaymentQuery = {
    id: code,
    ...queryData,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // 1. Save to Local Storage Cache
  const cached = localStorage.getItem(PAYMENT_QUERIES_KEY);
  let list: PaymentQuery[] = [];
  if (cached) {
    try {
      list = JSON.parse(cached);
    } catch {}
  }
  list = [newQuery, ...list];
  localStorage.setItem(PAYMENT_QUERIES_KEY, JSON.stringify(list));

  // 2. Save to Firestore
  if (db) {
    try {
      await setDoc(doc(db, 'payment_queries', newQuery.id), newQuery);
    } catch (e) {
      console.warn('Firestore payment query save notice:', e);
    }
  }

  // 3. Save to Realtime Database
  if (rtdb) {
    try {
      await set(ref(rtdb, `payment_queries/${newQuery.id}`), newQuery);
    } catch (e) {
      console.warn('RTDB payment query save notice:', e);
    }
  }

  return newQuery;
}

/**
 * Fetch all payment queries for Admin and Driver
 */
export async function getPaymentQueriesFromCloud(userId?: string): Promise<PaymentQuery[]> {
  // 1. Try RTDB
  if (rtdb) {
    try {
      const snap = await get(ref(rtdb, 'payment_queries'));
      if (snap.exists()) {
        const val = snap.val();
        const arr = Array.isArray(val) ? val : Object.values(val);
        if (arr.length > 0) {
          localStorage.setItem(PAYMENT_QUERIES_KEY, JSON.stringify(arr));
          return userId ? (arr as PaymentQuery[]).filter(q => q.userId === userId) : (arr as PaymentQuery[]);
        }
      }
    } catch (e) {
      console.warn('RTDB payment queries fetch notice:', e);
    }
  }

  // 2. Fallback to LocalStorage
  const cached = localStorage.getItem(PAYMENT_QUERIES_KEY);
  if (cached) {
    try {
      const list: PaymentQuery[] = JSON.parse(cached);
      return userId ? list.filter(q => q.userId === userId) : list;
    } catch {}
  }

  // 3. Seed initial demo payment queries if none exist
  const demoQueries: PaymentQuery[] = [
    {
      id: 'DISP-8921',
      userId: 'driver-demo-01',
      userEmail: 'k.murugan@gmail.com',
      userName: 'K. Murugan',
      utr: '428901234567',
      amount: 180,
      stationName: 'Mattuthavani Integrated FastPort',
      issueDescription: 'Paid via GPay but bay #2 charger display took 3 minutes to unlock.',
      status: 'resolved',
      adminNotes: 'Verified UTR on SBI gateway. Pass authorized manually.',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'DISP-9104',
      userId: 'driver-demo-02',
      userEmail: 'arun.kumar@gmail.com',
      userName: 'Arun Kumar',
      utr: '429812345678',
      amount: 450,
      stationName: 'Jio-bp pulse MegaHub - BKC',
      issueDescription: 'Amount debited twice during high network latency.',
      status: 'investigating',
      adminNotes: 'Gateway checking reverse refund with bank.',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ];
  localStorage.setItem(PAYMENT_QUERIES_KEY, JSON.stringify(demoQueries));
  return userId ? demoQueries.filter(q => q.userId === userId) : demoQueries;
}

/**
 * Resolve or update payment query status (For Admin)
 */
export async function resolvePaymentQueryInCloud(
  id: string,
  status: 'resolved' | 'investigating',
  adminNotes?: string
): Promise<void> {
  const list = await getPaymentQueriesFromCloud();
  const updated = list.map(q => q.id === id ? { ...q, status, adminNotes: adminNotes || q.adminNotes } : q);
  localStorage.setItem(PAYMENT_QUERIES_KEY, JSON.stringify(updated));

  if (rtdb) {
    try {
      await set(ref(rtdb, `payment_queries/${id}/status`), status);
      if (adminNotes) await set(ref(rtdb, `payment_queries/${id}/adminNotes`), adminNotes);
    } catch {}
  }
}

