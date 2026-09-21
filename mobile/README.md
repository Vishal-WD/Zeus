# ZEUS Mobile Application (Cloud-Native Android)

**ZEUS** is an in-cabin electric vehicle smart navigation and charging reservation platform for Madurai, Tamil Nadu.

## Features
- **100% Cloud-Native**: Runs completely on Google Firebase Realtime Database & Firestore (`duohub-c4f39`). **No local backend required.**
- **Instant Google & Cloud Authentication**: 0ms delay, no blocking popups or delays.
- **EV Charge Specification (Like Petrol Bunk Liters)**:
  - By Units (kWh) — e.g. 2 Units, 4 Units (Full scooty), 15 Units (Car).
  - By Battery % — 50%, 80% (recommended), 100% (full tank).
  - By Budget (₹) — ₹50, ₹100, ₹200, ₹500.
  - Live calculation of kWh units, cost, added range (+km), and charge duration.
- **Prepaid GPay Slot Booking & Strict UTR Verification**:
  - Receiver: `+91 8590556670` (`8590556670@okaxis`).
  - QR Code & Direct GPay app intent.
  - Digital slot pass ticket is issued only after 12-digit UPI UTR verification.
- **City-Specific Madurai Navigation**:
  - Map view constrained to Madurai boundaries (`[78.0000, 9.8000]` to `[78.2600, 10.0500]`).
  - Real-time Carto Voyager map tiles with 3D lightning emoji markers (`⚡`).
  - OSRM street route snapping with caching and 1.2s instant fallback.
- **Bottom Drawer Interaction**:
  - Smooth 1-line peek bar when collapsed.
  - Scrollable expanded details card (`max-h-[48vh] overflow-y-auto`) with no boundary overflow.
- **Profile Management**:
  - Tab 4 allows editing Driver Name, Mobile Number, Vehicle Type (Scooty vs Car), Vehicle Model, Battery Pack kWh, and SOC %.

## Installation & Build
- Built Android APK: `ZEUS.apk` (in this folder or root `d:\Zeus\ZEUS.apk`)
- Install on connected phone:
  ```bash
  adb install -r ZEUS.apk
  ```
- Build from source:
  ```bash
  npm run build
  npx cap copy android
  cd android && gradlew.bat assembleDebug
  ```
