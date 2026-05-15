# SyncPack — ESP32-S3 Firmware

**IoT-Based Smart School Bag Tracker**
Smart. Connected. Secure.

---

## Overview

This repository contains the embedded C++ firmware for the SyncPack hardware prototype, developed using the Arduino IDE with ESP32-S3 board support. The firmware runs on the **ESP32-S3 DevKit C** microcontroller using a **FreeRTOS dual-core architecture**:

- **Core 1** — Non-blocking hardware and UI loop (RFID scanning, GPS parsing, sensor readings, TFT display rendering, SOS detection)
- **Core 0** — Background network task (Firebase REST API uploads, SMS queue, GPRS monitoring, GPS fallback)

A `dataMutex` (FreeRTOS SemaphoreHandle) protects all shared state between cores. A 5-slot SMS ring buffer decouples alert generation from transmission.

---

## Project Structure

```
Smart_Bag_v7/
├── Smart_Bag_v7.ino       # Main firmware — FreeRTOS dual-core entry point
├── WeightSensor.h         # HX711 load cell class header
├── WeightSensor.cpp       # HX711 load cell class implementation
├── Logo.h                 # SyncPack RGB565 bitmap splash screen
│
Weight_Test/
└── Weight_Test.ino        # Standalone HX711 calibration sketch
```

---

## Hardware

| Component | Model | Interface | GPIO |
|-----------|-------|-----------|------|
| Microcontroller | ESP32-S3 DevKit C | — | — |
| RFID Reader | RC522 | SPI | CS: 21, RST: 4, SCK: 12, MOSI: 11, MISO: 13 |
| TFT Display | ST7735 1.8" | SPI | CS: 10, DC: 9, RST: 8, BL: 16 |
| GPS Module | NEO-M8N | UART1 | RX: 2, TX: 1 |
| GSM/LTE Module | A7670C | UART2 | RX: 39, TX: 40 |
| Accelerometer | MPU-6050 | I2C | SDA: 36, SCL: 37 |
| Load Cell Amp | HX711 | GPIO | DT: 5, SCK: 6 |
| Temp/Humidity | DHT22 | GPIO | DATA: 17 (10kΩ pull-up) |
| Voltage Sensor | LM393 | ADC | S: 3 |
| RGB LED | Common cathode | GPIO | R: 15, G: 47, B: 48 |
| Buzzer | Active | GPIO | 7 |
| SOS Button | Momentary | GPIO | 14 |

**Power:** 3× 18650 Li-ion (3S, 11.1V) · BMS 10A 3S · Dual LM2596 buck converters

---

## Features

- **RFID Item Detection** — Firebase-managed book registry cached on ESP32 every 30 seconds. Unknown tags displayed on TFT for 20 seconds with registration instructions and uploaded to Firebase.
- **GPS 3-Method Location Fallback** — NEO-M8N direct fix → SIM GNSS (AT+CGNSSINFO) → CLBS tower location (AT+CLBS=4,1) → IP geolocation (ip-api.com)
- **SOS Emergency Alert** — Triple-press within 2 seconds triggers SMS with Google Maps link to all registered parent numbers via A7670C, plus Firebase write for Cloud Functions backup
- **HX711 Weight Monitoring** — 10 kg load cell, calibrated to ±50g accuracy. Overweight alert above 4.5 kg (SMS + buzzer + red LED)
- **MPU-6050 Drop & Balance Detection** — Freefall detection (g-force < 0.3) triggers drop alert. Tilt data used by web app for strap balance monitoring
- **DHT22 Environmental Monitoring** — Temperature alert above 40°C (protects laptop and lunch contents)
- **LM393 Battery Monitoring** — Low battery SMS alert below 20%, resets above 25%
- **TFT Dashboard** — SyncPack logo splash on boot, then live status: battery %, tilt angle, temperature, humidity, GPS coordinates (colour-coded by source), bag weight, item inventory pills

---

## Libraries Required

Install via Arduino Library Manager:

| Library | Author |
|---------|--------|
| MFRC522 | GithubCommunity |
| Adafruit ST7735 and ST7789 Library | Adafruit |
| Adafruit GFX Library | Adafruit |
| DHT sensor library | Adafruit |
| TinyGPS++ | Mikal Hart |
| MPU6050 | Electronic Cats |
| HX711 | bogde |

FreeRTOS is built into the ESP32 Arduino core — no separate installation required.

---

## Board Setup (Arduino IDE)

1. Open Arduino IDE → **File → Preferences**
2. Add to Additional Board Manager URLs:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board Manager** → Search `esp32` → Install **esp32 by Espressif Systems**
4. **Tools → Board** → Select **ESP32S3 Dev Module**
5. **Tools → Upload Speed** → 921600
6. **Tools → USB Mode** → Hardware CDC and JTAG

---

## Firebase Configuration

Update the following constants in `Smart_Bag_v7.ino` before uploading:

```cpp
const char* FIREBASE_HOST = "your-project-id-default-rtdb.firebaseio.com";
const char* FIREBASE_AUTH = "your-database-secret";
const char* BAG_ID = "BAG001";
```

Firebase Realtime Database path structure:
```
bags/BAG001/
├── sensors/          # Battery, temp, humidity, weight, tilt, GPS
├── books/            # RFID registry with detection status
├── settings/         # Parent contacts, SMS toggles
├── controls/         # Buzzer mute, remote SOS
├── sos_alerts/       # SOS activation records
└── unknown_rfid/     # Unregistered tags pending registration
```

---

## GSM / APN Configuration

Update the APN for your SIM card:

```cpp
const char* APN = "hutch3g";  // Change to your carrier APN
```

---

## HX711 Calibration

1. Open `Weight_Test/Weight_Test.ino` in Arduino IDE
2. Upload to ESP32-S3
3. Open Serial Monitor at 115200 baud
4. Follow on-screen instructions to calibrate with a known reference weight
5. Note the calibration factor and update in `WeightSensor.cpp`:
   ```cpp
   #define DEFAULT_CALIBRATION_FACTOR -7050.0
   ```

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

