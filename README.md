# ⚡ ZEUS OS — Autonomous EV Navigation & Municipal Digital Twin

<div align="center">

```
███████╗███████╗██╗   ██╗███████╗     ██████╗ ███████╗
╚══███╔╝██╔════╝██║   ██║██╔════╝    ██╔═══██╗██╔════╝
  ███╔╝ █████╗  ██║   ██║███████╗    ██║   ██║███████╗
 ███╔╝  ██╔══╝  ██║   ██║╚════██║    ██║   ██║╚════██║
███████╗███████╗╚██████╔╝███████║    ╚██████╔╝███████║
╚══════╝╚══════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚══════╝
```

**Next-Generation Real-Time EV Navigation, Autonomous Voice Copilot & Municipal 3D Digital Twin**

[![Android APK](https://img.shields.io/badge/📱_Download-ZEUS.apk_(Android)-10b981?style=for-the-badge&logo=android)](./ZEUS.apk)
[![Windows Portable Exe](https://img.shields.io/badge/💻_Download-Zeus_Admin_Portable_(.exe)-3b82f6?style=for-the-badge&logo=windows)](./Zeus-Admin-Portable.exe)
[![Google Gemini](https://img.shields.io/badge/AI_Copilot-Gemini_1.5_Flash-8E75B2.svg?style=for-the-badge&logo=google)](https://ai.google.dev)
[![TomTom Maps](https://img.shields.io/badge/Maps-TomTom_Traffic_SDK_v6-df2020.svg?style=for-the-badge)](https://developer.tomtom.com)
[![Deck.gl](https://img.shields.io/badge/Geospatial-Deck.gl_v9-00B4D8.svg?style=for-the-badge)](https://deck.gl)
[![Firebase](https://img.shields.io/badge/Cloud-Firebase_Firestore_%26_RTDB-FFCA28.svg?style=for-the-badge&logo=firebase)](https://firebase.google.com)

</div>

---

## 🚀 1. Quick Download Links & Binaries

Get the production-ready standalone builds for mobile and desktop:

| Platform | Download Link | Target Audience | Description |
|---|---|---|---|
| **Android Mobile** | [📥 **Download `ZEUS.apk`**](./ZEUS.apk) *(5.75 MB)* | EV Drivers, Scooter Pilots & Fleets | In-cabin navigation with live GPS, TomTom real-time traffic, Gemini voice copilot, and prepaid UPI charging reservations. |
| **Windows Desktop** | [📥 **Download `Zeus-Admin-Portable.exe`**](./Zeus-Admin-Portable.exe) *(93.5 MB)* | Municipal Grid Authorities & Operators | Standalone, zero-install portable command center featuring 3D hexagonal twin, voice debriefs, fleet telemetry seeding, and payment dispute management. |

---

## 🌟 2. Key Features

### 🚗 A. For EV Drivers & Fleet Pilots (`DriverMobile.tsx` / `ZEUS.apk`)

* 🎙️ **Google Gemini AI Voice Copilot**: 
  - Natural speech recognition and voice actions powered by **Google Gemini 1.5 Flash**.
  - **In-Cabin Autonomous Voice Actions**:
    - *"Navigate me to nearby station"* ➡️ Computes fastest real-road route and starts in-app navigation.
    - *"Book an appointment for charging"* ➡️ Opens prepaid bay booking at the closest or requested hub.
    - *"Filter 100kW fast chargers"* ➡️ Adjusts live map filters for high-speed DC fast ports.
    - *"Show stations with free plugs"* ➡️ Filters stations with zero queue and available plugs.
    - *"Raise payment dispute query for my UTR"* ➡️ Opens the automated UPI Payment Dispute Center.
* 🗺️ **Official TomTom Web SDK & Real-Time Arterial Traffic**:
  - Automotive-grade vector map tiles rendered with TomTom clean-tech styling.
  - **Live Traffic Flow Layer (`relative0` flow)**: Color-coded arterial speeds (green, amber, crimson) on road vectors.
  - **Turn-by-Turn Navigation Options**: In-App TomTom Real Road Route calculation + 1-Tap Handover to Native Google Maps app.
* ⚡ **Precision Charging Reservations (Petrol Bunk Style)**:
  - Select charge mode by **Units (kWh)**, **Target SOC (%)**, or **Budget (₹)**.
  - Instant dynamic UPI QR generation configured with merchant ID `vishalchandran6126@oksbi` (*Vishal Chandran*).
  - Automated 12-digit UTR verification and digital prepaid pass generation.
* 🛡️ **Payment Dispute & UTR Resolution Desk**:
  - Submit bank UTR numbers if charging bays fail to unlock due to network timeouts.
  - Real-time cloud sync with the Municipal Admin Command Center.

---

### 🏢 B. For Municipal Grid Operators & Admins (`AdminTwin3D.tsx` / `Zeus-Admin-Portable.exe`)

* 🌐 **3D Hexagonal Macro Digital Twin (MapLibre + DeckGL v9)**:
  - 3D volumetric extrusion of grid load, substation stress, and queue density across All-India corridors and regional hubs.
  - Interactive camera tilt, pan, and real-time station diagnostics.
* 🎙️ **Executive AI Voice Debrief (Google Gemini)**:
  - Spoken executive briefings summarizing total fleet count, bunk-wise usage ranking, high-traffic bottlenecks, and revenue metrics.
  - Natural speech debriefing generated and spoken with integrated audio visualizer.
* 🌱 **24-Hour Fleet Telemetry Seeding Engine**:
  - One-click simulation (`🌱 Seed 24H Fleet Telemetry`) to distribute realistic multi-bunk usage data, charge cycles, and queue dwell times across national superhubs.
* 💳 **Admin Payment Dispute & UTR Verification Center**:
  - Real-time desk to inspect user-submitted UTR disputes, cross-reference bank transactions, and mark tickets as `investigating` or `resolved`.

---

## 🧠 3. AI Integrations, Scraping & Predictive Methodologies

```mermaid
graph TD
    A[Live Device GPS / Geofence] --> B[TomTom POI EV Station Scraper]
    B --> C[Cloud Station Registry - Firebase]
    C --> D[Erlang M/D/c Queue Modeling Engine]
    C --> E[Predictive Battery Stranding Model]
    D & E --> F[Dynamic Anti-Herd Cost Scoring]
    F --> G[Driver In-Cabin UI]
    G <--> H[Google Gemini 1.5 Flash AI Engine]
    H --> I[Autonomous Voice Actions & TTS]
    C --> J[3D DeckGL Digital Twin]
    J <--> K[Admin Executive Summary Generator]
```

### 1. Real-Time POI Web Scraping & Dynamic Geofence Search
* **Automated Scraper (`tomtomService.ts`)**: Scrapes live EV charging infrastructure across India using TomTom POI Search APIs (`categorySet=7309`).
* Preloaded coverage across **Madurai**, **Bengaluru**, **Mumbai BKC**, **Chennai**, **Delhi NCR**, **Hyderabad**, and National Expressways.

### 2. Google Gemini 1.5 Flash Automotive Copilot
* Integrated default API key: `AIzaSyB_ItpQT3z-aUzIs2kZt_NWyGsEvFNHViU`.
* Natural language intent parsing into structured actions (`NAVIGATE_NEAREST`, `BOOK_SLOT`, `FILTER_FAST`, `RAISE_PAYMENT_QUERY`).
* Context-aware prompt engineering incorporating vehicle model, battery SOC, live coordinates, and nearby hub availability.

### 3. Mathematical Baselines & Queue Optimization
* **$M/D/c$ Multi-Server Deterministic Queuing Model**:
  $$\rho = \frac{\lambda}{c \cdot \mu}, \quad W_q(M/D/c) \approx \frac{\rho}{1 - \rho} \cdot \frac{1}{2 c \mu} \cdot (1 + \rho)$$
* **Anti-Herd Combinatorial Allocation Cost Function**:
  $$C_{i, j} = \alpha \cdot \text{Time}(i, j) + \beta \cdot W_q(j) + \gamma \cdot \left(\frac{Q_j}{C_j}\right) + \delta \cdot \text{GridStress}(j)$$
* **Predictive Battery Stranding Risk Assessment**:
  - Continuously compares vehicle remaining range against distance to charging hubs.
  - Flags high-risk routes ($SOC < 20\%$ or distance exceeding safe threshold) and triggers proactive rerouting.

---

## 🛠️ 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **In-Cabin Client (Mobile)** | React 18, TypeScript, Tailwind CSS | High-performance mobile UI for drivers |
| **Desktop Digital Twin** | Electron 30, Portable 7z Packager | Zero-install standalone desktop executable |
| **Mobile Runtime** | Capacitor 6, Android Studio Gradle | Native Android APK packaging |
| **Maps & Traffic** | TomTom Web SDK v6, MapLibre GL | Vector tiles, road routing, and live traffic flow |
| **3D Geospatial Engine** | DeckGL v9 (HexagonLayer, ColumnLayer) | 3D volumetric extrusion of grid capacity & queues |
| **Generative AI** | Google Gemini 1.5 Flash (`@google/generative-ai`) | Automotive voice assistant & executive reports |
| **Voice & Speech** | Web Speech API (Recognition + Synthesis) | Speech-to-text (STT) and voice responses (TTS) |
| **Cloud & Realtime** | Firebase Firestore & Realtime Database | Real-time booking sync, telemetry, and disputes |

---

## 💻 5. Local Development & Build Commands

### Prerequisites
* Node.js 18+ and npm
* Android SDK (if compiling APK from source)
* Python 3.10+ (for optional Python backend microservices)

### 1. Run Web Development Server
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** to access the web application.

### 2. Build Android Debug APK
```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew.bat assembleDebug
```
Output APK is located at: `frontend/android/app/build/outputs/apk/debug/app-debug.apk` and copied to `ZEUS.apk`.

### 3. Build Windows Portable Executable (`.exe`)
```bash
cd frontend
npm run electron:portable
```
Output Portable Executable is located at: `frontend/dist-electron/Zeus OS-Portable-2.0.0.exe` and copied to `Zeus-Admin-Portable.exe`.

---

## 🔒 6. Payment & Security Architecture

* **Merchant UPI Identifier**: `vishalchandran6126@oksbi` (*Vishal Chandran*)
* **Strict Verification**: User-entered 12-digit UTRs are cross-referenced with cloud records before prepaid pass issuance.
* **Dispute Resolution Flow**:
  1. Driver encounters issue ➡️ Voice assistant or UI launches Dispute Desk.
  2. Driver submits UTR and details ➡️ Stored to Firebase Realtime Database & Firestore.
  3. Municipal Admin inspects query ➡️ Marks as `investigating` or `resolved` with notes.
  4. Driver gets live status update on their device pass.

---

<div align="center">
<b>Developed with ⚡ by the ZEUS Engineering Team</b>
</div>
