# SyncPack — Android Application

**IoT-Based Smart School Bag Tracker**
Smart. Connected. Secure.

---

## Overview

This repository contains the parent monitoring application for SyncPack, built as a **React + TypeScript** single-page web application and packaged as a native **Android APK** using **Ionic Capacitor**.

The application connects to **Firebase Realtime Database** via real-time `onValue` listeners, reflecting sensor changes within approximately one to two seconds. It is available as:

- **Android APK** (`android/app/build/outputs/apk/debug/app-debug.apk`) — install directly on any Android device
- **Web browser** — run locally with `npm run dev` and access from any browser

**Package ID:** `com.kavindu.syncpack`
**App Name:** SyncPack
**Version:** 1.0

---

## Project Structure

```
SmartSchoolBagCapacitor/
├── src/
│   ├── app/
│   │   ├── components/        # All screen components
│   │   │   ├── Dashboard.tsx  # Main dashboard — sensors, map, items
│   │   │   ├── Items.tsx      # RFID item management
│   │   │   ├── Timetable.tsx  # Weekly subject schedule
│   │   │   ├── SensorDetails.tsx  # Historical analytics charts
│   │   │   ├── Alerts.tsx     # Alert history
│   │   │   └── Settings.tsx   # Contacts, SMS, profile
│   │   └── hooks/
│   │       └── useIoTData.ts  # Central Firebase data hook
│   ├── lib/
│   │   └── firebase.ts        # Firebase configuration
│   └── styles/
│       ├── tailwind.css
│       └── theme.css
├── android/                   # Ionic Capacitor Android project
├── functions/                 # Firebase Cloud Functions (SOS SMS backup)
├── capacitor.config.json
├── firebase-database-rules.json
├── package.json
└── vite.config.ts
```

---

## Application Screens

| Screen | Description |
|--------|-------------|
| **Dashboard** | Battery, temperature, humidity, bag weight, strap balance card (MPU-6050 live tilt), Google Maps location, item presence summary pills |
| **Items** | Firebase RFID book registry — add, delete, scan tags. Unknown tag registration prompt when ESP32 detects an unregistered tag |
| **Timetable** | Weekly subject schedule — shows which required items are in/out of bag for each school day |
| **Sensor Analytics** | Historical line and area charts (Recharts) for temperature, humidity, weight, and tilt over time |
| **Alerts** | Chronological event history — Item Missing, Overweight, Drop Detected, SOS Activated, Temp High, Battery Low, Strap Imbalance |
| **Settings** | Parent contacts with per-contact SMS toggle, global SMS on/off, buzzer mute, remote SOS trigger, dark/light theme, user profile with photo upload |

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript | Type-safe app logic |
| Vite | Build tool |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | UI component library |
| Recharts | Historical sensor data charts |
| motion/react | UI animations |
| Ionic Capacitor | Android APK wrapper |
| Firebase Realtime Database | Real-time data sync |
| Firebase Authentication | Email/password user management |
| Firebase Cloud Functions | Server-side SOS SMS backup |
| Firebase Storage | User profile photo upload |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

---

## Firebase Setup

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database**, **Authentication** (Email/Password), **Cloud Functions**, and **Storage**
3. Copy your Firebase config and update `src/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

4. Apply the database security rules:

```bash
firebase deploy --only database
```

The rules file is at `firebase-database-rules.json`.

---

## Firebase Database Schema

```
bags/BAG001/
├── sensors/
│   ├── battery          # Battery percentage (0-100)
│   ├── temperature      # DHT22 temperature (°C)
│   ├── humidity         # DHT22 humidity (%)
│   ├── weight           # HX711 weight (kg)
│   ├── tilt_x           # MPU-6050 X-axis tilt
│   ├── tilt_y           # MPU-6050 Y-axis tilt
│   ├── latitude         # GPS latitude
│   ├── longitude        # GPS longitude
│   └── gps_source       # "gps" / "gsm" / "ip"
├── books/
│   └── {bookId}/
│       ├── name         # Item name
│       ├── subject      # Associated subject
│       ├── tag_uid      # RFID tag UID
│       └── status       # "in_bag" / "not_in_bag"
├── timetable/
│   └── {day}/{subjectId}
├── subjects/
│   └── {subjectId}/
│       ├── name
│       └── items[]
├── settings/
│   └── parent_contacts/
│       └── {contactId}/
│           ├── name
│           ├── phone
│           └── sms_enabled
├── controls/
│   ├── buzzer_mute      # true/false
│   └── remote_sos       # true/false
├── sos_alerts/
│   └── {alertId}/
│       ├── timestamp
│       ├── latitude
│       ├── longitude
│       └── source
└── unknown_rfid/
    └── tag_uid
```

---

## Building the Android APK

### Prerequisites
- Android Studio installed
- Android SDK (API level 21+)

### Steps

```bash
# Build the web app
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

The debug APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Install on Android Device

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK to the device and install manually (**Settings → Security → Unknown Sources → ON**).

---

## Firebase Cloud Functions (SOS SMS Backup)

The `functions/` directory contains a Node.js Cloud Function that listens for SOS alert writes to Firebase and sends a backup SMS via a third-party SMS API if the hardware GSM transmission fails.

```bash
cd functions
npm install
firebase deploy --only functions
```

---

## User Guide (Quick Start)

1. Install the APK on your Android device
2. Open SyncPack and tap **Register** — enter your name, email, and password
3. Enter bag identifier **BAG001** when prompted
4. Go to **Settings → Parent Contacts** → Add your phone number
5. Go to **Items** → Add items and scan their RFID tags
6. Go to **Timetable** → Configure which items are needed each day
7. Power on the bag — the TFT display will show the SyncPack splash logo, then the live dashboard
8. The app Dashboard will begin showing live data within 30–60 seconds

---

## Student Information

| | |
|---|---|
| **Name** | K.N.G. Pathirana |
| **Plymouth Index** | 10953487 |
| **Degree** | BSc (Hons) Computer Science |
| **Supervisor** | Mr. Isuru Sri Bandara |
| **Module** | PUSL3190 Computing Individual Project |
| **Institution** | NSBM Green University / University of Plymouth |
