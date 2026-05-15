// ============================================================
// SMART SCHOOL BAG TRACKER — v7 (Dual-Core FreeRTOS Edition)
// Firebase Database Structure Matched
// BAG ID: BAG001
// Student: K.N.G. Pathirana | Plymouth: 10953487
// ============================================================

#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <DHT.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include <MPU6050.h>
#include "Logo.h"
#include "WeightSensor.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// ============================================================
// PIN DEFINITIONS
// ============================================================
#define RFID_SS     21
#define RFID_RST    4
#define TFT_CS      10
#define TFT_DC      9
#define TFT_RST     8
#define TFT_BL      16
#define DHT_PIN     17 
#define DHT_TYPE    DHT22
#define GPS_RX      2
#define GPS_TX      1
#define SIM_RX      39
#define SIM_TX      40
#define SDA_PIN     36
#define SCL_PIN     37
#define VOLTAGE_PIN 3
#define VD_RATIO    5.0f
#define BATTERY_MAX 12.6f
#define BATTERY_MIN  9.9f
#define LOW_BAT_PCT  20
#define RGB_R       15
#define RGB_G       47
#define RGB_B       48
#define BUZZER_PIN  7
#define SOS_PIN     14
#define HX711_DT    5
#define HX711_SCK   6

#define MAX_WEIGHT_THRESHOLD 4.5f

// ============================================================
// FIREBASE CONFIG
// ============================================================
#define FIREBASE_HOST   "smart-school-bag-tracker-default-rtdb.firebaseio.com"
#define FIREBASE_SECRET "noaEMXFGKvOcpvCAUk8WF5CDzsZ49RNLniPa9GcX"
#define BAG_ID          "BAG001"

// ============================================================
// COLOURS
// ============================================================
#define BLACK    0x0000
#define WHITE    0xFFFF
#define RED      0xF800
#define GREEN    0x07E0
#define BLUE     0x001F
#define YELLOW   0xFFE0
#define CYAN     0x07FF
#define ORANGE   0xFD20
#define DARKGREY 0x7BEF

// ============================================================
// BOOK REGISTRY
// ============================================================
// Firebase-registered books cache (loaded by Core 0, read by Core 1)
struct FirebaseBook {
  String bookID;
  String bookName;
  String rfidTag;  // Raw UID entered in app (e.g. "DEADBEEF")
  String subject;
  String status;
};
#define MAX_FB_BOOKS 30
FirebaseBook fbBooks[MAX_FB_BOOKS];
int          fbBookCount = 0;
bool         fbBooksLoaded = false;

struct Book {
  const char* bookID;
  const char* rfidTag;
  const char* bookName;
  const char* subject;
};

// Hardcoded books removed — all books managed via Firebase
// App adds/removes books, ESP32 reads from fbBooks[] cache
Book knownBooks[] = {};  // Empty — not used
const int NUM_BOOKS = 0; // Always 0 — use fbBookCount instead

struct RFIDMap { const char* uid; const char* rfidTag; };
// rfidMapping removed — UIDs are matched directly against Firebase rfidTag field
RFIDMap rfidMapping[] = {};  // Empty — not used
const int NUM_RFID = 0;

// Parent contacts — loaded from Firebase at startup (fallback if Firebase unavailable)
#define MAX_PARENTS 5
// Parent numbers loaded from Firebase settings/parent_contacts
// Default empty — Firebase must load before SMS works
String parentNumbers[MAX_PARENTS] = { "", "", "", "", "" };
int    parentCount = 0;  // Updated from Firebase on boot + every 5min

// ============================================================
// OBJECTS
// ============================================================
SPIClass *spiTFT = &SPI;
MFRC522         rfid(RFID_SS, RFID_RST);
Adafruit_ST7735 tft = Adafruit_ST7735(spiTFT, TFT_CS, TFT_DC, TFT_RST);
DHT             dht(DHT_PIN, DHT_TYPE);
TinyGPSPlus     gps;
HardwareSerial  gpsSerial(1);
HardwareSerial  simSerial(2);
MPU6050         mpu(0x68);
WeightSensor    weightSensor(HX711_DT, HX711_SCK);

// ============================================================
// FREE RTOS SYNC (DUAL CORE)
// ============================================================
SemaphoreHandle_t dataMutex;
TaskHandle_t networkTaskHandle;

#define MAX_SMS_QUEUE 5
String smsQueue[MAX_SMS_QUEUE];
int smsHead = 0;
int smsTail = 0;

// ============================================================
// SHARED STATE (Protected by dataMutex)
// ============================================================
float    latitude       = 0.0f;
float    longitude      = 0.0f;
bool     gpsValid       = false;
bool     gpsFromGSM     = false;

float    temperature    = 0.0f;
float    humidity       = 0.0f;
float    batteryVoltage = 0.0f;
int      batteryPercent = 0;
float    tiltAngle      = 0.0f;
float    tiltX          = 0.0f;
float    tiltY          = 0.0f;
float    tiltZ          = 0.0f;
float    weightKG       = 0.0f;

bool     bookDetected[12];
bool     bookPendingUpload[12];
bool     bookInBag[12];        // true = in_bag, false = not_in_bag
bool     bookStatusPending[12]; // true = status changed, needs Firebase upload

bool     lowBatAlerted  = false;
bool     overweightAlerted = false;
String   unknownRFIDUID     = "";
bool     unknownRFIDPending = false;
// Firebase-cached book status upload (Core 1 sets, Core 0 uploads)
String   fbBookPendingID     = "";  // bookID from Firebase (e.g. "B1778705862299")
String   fbBookPendingStatus = "";  // "in_bag" or "not_in_bag"
bool     fbBookStatusPending = false;
bool     dropAlerted    = false;
bool     dropDetected   = false;
bool     buzzerMuted    = false;
bool     triggerSOSNetwork = false;
bool     mpuOK          = false;

unsigned long lastStatus   = 0;
unsigned long lastSMS      = 0;

// Static buffer for large HTTP reads — avoids heap fragmentation
#define HTTP_READ_BUF 4096
static char g_httpBuf[HTTP_READ_BUF];

const unsigned long STATUS_INTERVAL   = 1000UL;  // 1 Second UI/Hardware update
const unsigned long SMS_INTERVAL      = 60000UL; // 60 Second SMS cooldown
const unsigned long FIREBASE_INTERVAL = 5000UL;  // 5 Second Firebase upload
const unsigned long CMD_CHECK_INTERVAL= 5000UL;  // 5 Second Firebase command check

// ============================================================
// FORWARD DECLARATIONS
// ============================================================
void rgbOff();
void rgbColor(bool r, bool g, bool b);
void buzzerBeep(int times, int duration);
void drawSplashScreen();
void drawStaticDisplay();
void updateDisplay();
void updateStatusLED();
void printStatus();
void readGPS();
void readRFID();
void readDHT();
void readMPU();
void readVoltage();
void readWeight();
void checkSOS();
void checkMissingItems();
void queueSMS(String msg);
void networkTaskCode(void * pvParameters);
void initGSM();
void connectGPRS();
void sendSensorsToFirebase();
void sendSOSAlert(float lat, float lng);
void checkFirebaseCommands();
void showUnknownRFID(String uid);
void showKnownRFID(String bookName, String subject, String uid, bool isInBag);
bool saveGSMLoc(float lat, float lng);
void readSIM_GPS();
void sendSMSBoth(String message);
void loadParentContactsFromFirebase();
void loadFirebaseBooksCache();
int  findInFirebaseCache(String uid);
String parseJsonStringArray(String json, int index);
String httpReadData(int dataLen);
String firebaseGET(String path);
bool firebasePUT(String path, String jsonData);
bool firebasePATCH(String path, String jsonData);
bool firebasePOST(String path, String jsonData);
String sendAT(String cmd, int timeout);
String sendAT(String cmd, int timeout, bool print);

// ============================================================
// CORE 1: HARDWARE & UI SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  dataMutex = xSemaphoreCreateMutex();

  for (int i = 0; i < NUM_BOOKS; i++) {
    bookDetected[i]      = false;
    bookPendingUpload[i] = false;
    bookInBag[i]         = false; // Start as not_in_bag
    bookStatusPending[i] = false;
  }

  Serial.println("\n========================================");
  Serial.println("  Smart School Bag Tracker v7 - Dual Core");
  Serial.println("========================================\n");

  pinMode(SOS_PIN,    INPUT_PULLUP);
  pinMode(RGB_R,      OUTPUT);
  pinMode(RGB_G,      OUTPUT);
  pinMode(RGB_B,      OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TFT_BL,     OUTPUT);
  digitalWrite(TFT_BL, HIGH);

  pinMode(TFT_RST, OUTPUT);
  digitalWrite(TFT_RST, HIGH); delay(10);
  digitalWrite(TFT_RST, LOW);  delay(20);
  digitalWrite(TFT_RST, HIGH); delay(150);

  spiTFT->begin(12, 13, 11, -1);  // SCK=12, MISO=13, MOSI=11 — MISO needed for RFID!
  SPI.setFrequency(10000000);       // 10MHz — RFID max is 10MHz, 30MHz breaks it

  tft.initR(INITR_GREENTAB); 
  tft.setRotation(1);
  tft.fillScreen(BLACK);
  
  rgbColor(true, true, true);
  buzzerBeep(1, 200);
  delay(500);
  rgbOff();

  // RFID init — SPI must be started before this
  rfid.PCD_Reset();
  delay(50);
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(rfid.RxGain_max); // Max antenna gain for better detection
  dht.begin();
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Wire.begin(SDA_PIN, SCL_PIN);
  mpu.initialize();
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
  mpu.setDLPFMode(MPU6050_DLPF_BW_5);
  mpuOK = mpu.testConnection();
  
  weightSensor.begin();

  simSerial.begin(115200, SERIAL_8N1, SIM_RX, SIM_TX);

  drawSplashScreen();
  delay(2000); 
  drawStaticDisplay();

  // START BACKGROUND NETWORK TASK ON CORE 0
  xTaskCreatePinnedToCore(
    networkTaskCode,   /* Task function. */
    "NetworkTask",     /* name of task. */
    16384,             /* Stack size of task */
    NULL,              /* parameter of the task */
    1,                 /* priority of the task */
    &networkTaskHandle,/* Task handle */
    0                  /* pin task to core 0 */
  );

  rgbColor(false, true, false);
  buzzerBeep(2, 100);
  delay(500);
  rgbOff();
  Serial.println("[CORE 1] Local Hardware Loop Started");
}

// ============================================================
// CORE 1: FAST NON-BLOCKING HARDWARE LOOP
// ============================================================
void loop() {
  readGPS();
  readRFID();
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  bool isMpuOk = mpuOK;
  xSemaphoreGive(dataMutex);
  if (isMpuOk) readMPU();
  
  checkSOS();

  if (millis() - lastStatus > STATUS_INTERVAL) {
    lastStatus = millis();
    readDHT();
    readVoltage();
    readWeight();
    updateStatusLED();
    updateDisplay();
    printStatus();
  }

  if (millis() - lastSMS > SMS_INTERVAL) {
    lastSMS = millis();
    checkMissingItems();
  }
}

// ============================================================
// QUEUE SMS FOR CORE 0 TO SEND
// ============================================================
void queueSMS(String msg) {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  int nextTail = (smsTail + 1) % MAX_SMS_QUEUE;
  if (nextTail != smsHead) { 
    smsQueue[smsTail] = msg;
    smsTail = nextTail;
    Serial.println("[CORE 1] SMS Queued: " + msg);
  } else {
    Serial.println("[CORE 1] WARNING: SMS Queue Full!");
  }
  xSemaphoreGive(dataMutex);
}

// ============================================================
// LOCAL HARDWARE FUNCTIONS (CORE 1)
// ============================================================
void readRFID() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  // Read UID bytes
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  Serial.println("[RFID] Tag scanned: " + uid);

  // All books come from Firebase — check cache by UID directly
  // (App stores raw UID as rfidTag field)
  {
    String matchedRfidTag = "";  // Not used — kept for legacy compat
    (void)matchedRfidTag;
    int fbIdx = findInFirebaseCache(uid);
    if (fbIdx >= 0) {
      // Found in Firebase! Toggle in_bag / not_in_bag
      Serial.println("[RFID] Firebase book found: " + fbBooks[fbIdx].bookName);
      bool nowInBag = (fbBooks[fbIdx].status != "in_bag");
      String newStatus = nowInBag ? "in_bag" : "not_in_bag";
      fbBooks[fbIdx].status = newStatus; // Update local cache immediately

      // Tell Core 0 to upload the new status to Firebase
      xSemaphoreTake(dataMutex, portMAX_DELAY);
      fbBookPendingID     = fbBooks[fbIdx].bookID;
      fbBookPendingStatus = newStatus;
      fbBookStatusPending = true;
      xSemaphoreGive(dataMutex);

      Serial.println("[RFID] Status queued: " + fbBooks[fbIdx].bookID + " -> " + newStatus);
      showKnownRFID(fbBooks[fbIdx].bookName, fbBooks[fbIdx].subject, uid, nowInBag);
      return;
    }

    // Step 2b: Truly unknown — not in local list, not in Firebase
    Serial.println("[RFID] UNKNOWN tag UID: " + uid);
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    unknownRFIDUID = uid;
    unknownRFIDPending = true;
    xSemaphoreGive(dataMutex);
    showUnknownRFID(uid);  // Shows UID for 20s
    return;
  }

  // (Hardcoded book lookup removed — all via Firebase cache above)
  }

// ── Show KNOWN tag — Green for IN BAG, Orange for OUT OF BAG ──
void showKnownRFID(String bookName, String subject, String uid, bool isInBag) {
  uint16_t headerColor = isInBag ? GREEN : ORANGE;
  uint16_t textColor   = isInBag ? GREEN : ORANGE;

  if (isInBag) {
    rgbColor(false, true, false);  // Green LED
    buzzerBeep(1, 150);
  } else {
    rgbColor(true, false, false);  // Red LED = removed
    buzzerBeep(2, 80);
  }

  tft.fillScreen(BLACK);

  // Header bar
  tft.fillRect(0, 0, 160, 16, headerColor);
  tft.setTextColor(BLACK, headerColor);
  tft.setTextSize(1);
  tft.setCursor(8, 4);
  tft.print(isInBag ? "  Item Added to Bag!" : "  Item Removed!");

  // IN / OUT — large text
  tft.setTextSize(2);
  tft.setTextColor(textColor, BLACK);
  tft.setCursor(isInBag ? 58 : 50, 22);
  tft.print(isInBag ? "IN" : "OUT");

  // Book name
  tft.setTextSize(1);
  tft.setTextColor(WHITE, BLACK);
  tft.setCursor(6, 48);
  if (bookName.length() > 18) {
    tft.print(bookName.substring(0, 18));
    tft.setCursor(6, 60); tft.print(bookName.substring(18));
  } else {
    tft.print(bookName);
  }

  // Subject label
  tft.setTextColor(CYAN, BLACK);
  tft.setCursor(6, 74); tft.print("Subject: "); tft.print(subject);

  // UID — small at bottom
  tft.setTextColor(DARKGREY, BLACK);
  tft.setCursor(6, 90); tft.print("UID: "); tft.print(uid);

  // Status footer bar
  tft.fillRect(0, 110, 160, 18, headerColor);
  tft.setTextColor(BLACK, headerColor);
  tft.setCursor(isInBag ? 24 : 20, 115);
  tft.print(isInBag ? "  Packed! Saved." : "  Removed! Saved.");

  delay(3000);
  rgbOff();
  drawStaticDisplay();
  updateDisplay();
}

// ── Show UNKNOWN tag scanned — display UID for 20s so user can register it ──
void showUnknownRFID(String uid) {
  rgbColor(true, true, false); // Yellow = unknown
  buzzerBeep(2, 100);

  tft.fillScreen(BLACK);

  // Header bar — yellow
  tft.fillRect(0, 0, 160, 16, YELLOW);
  tft.setTextColor(BLACK, YELLOW);
  tft.setTextSize(1);
  tft.setCursor(18, 4); tft.print("Unknown RFID Tag!");

  tft.setTextColor(WHITE, BLACK);
  tft.setCursor(6, 22); tft.print("Unregistered tag scanned");

  // UID — prominent display
  tft.setTextColor(CYAN, BLACK);
  tft.setCursor(6, 36); tft.print("UID:");
  tft.setTextSize(1);
  if (uid.length() > 8) {
    tft.setCursor(6, 48); tft.print(uid.substring(0, 8));
    tft.setCursor(6, 60); tft.print(uid.substring(8));
  } else {
    tft.setCursor(6, 48); tft.print(uid);
  }

  // Instructions
  tft.setTextColor(YELLOW, BLACK);
  tft.setCursor(6, 76); tft.print("To register:");
  tft.setTextColor(WHITE, BLACK);
  tft.setCursor(6, 88); tft.print("App > Items > Add Item");
  tft.setCursor(6, 100); tft.print("Enter above UID");

  // Countdown 20s
  for (int i = 20; i > 0; i--) {
    tft.fillRect(0, 112, 160, 16, BLACK);
    tft.setTextColor(DARKGREY, BLACK);
    tft.setCursor(38, 115); tft.print("Closing in "); tft.print(i); tft.print("s");
    delay(1000);
  }
  rgbOff();
  drawStaticDisplay();
  updateDisplay();
}

void readDHT() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) { 
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    humidity = h; temperature = t; 
    xSemaphoreGive(dataMutex);
  }
  if (t > 40) {
    queueSMS("TEMP ALERT: Bag is " + String(t,1) + "C!");
  }
}

void readGPS() {
  int bytesRead = 0;
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
    bytesRead++;
  }

  // Debug every 30s — shows if GPS module is sending data at all
  static unsigned long lastGpsDebug = 0;
  if (millis() - lastGpsDebug > 30000) {
    lastGpsDebug = millis();
    Serial.println("[GPS] Chars recv: " + String(gps.charsProcessed()) +
                   " | Sats: " + String(gps.satellites.value()) +
                   " | Fix: " + String(gps.location.isValid() ? "YES" : "NO") +
                   " | HDOP: " + String(gps.hdop.value()));
  }

  if (gps.location.isValid() && gps.location.isUpdated()) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    gpsValid = true;
    gpsFromGSM = false;
    xSemaphoreGive(dataMutex);
    Serial.println("[GPS] Fix! lat=" + String(gps.location.lat(),6) +
                   " lng=" + String(gps.location.lng(),6) +
                   " sats=" + String(gps.satellites.value()));
  }
}

void readMPU() {
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  float axG = ax/16384.0f, ayG = ay/16384.0f, azG = az/16384.0f;
  float tAng = atan2(ayG, azG) * 180.0f / PI;
  float totalG = sqrt(axG*axG + ayG*ayG + azG*azG);
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  tiltAngle = tAng;
  tiltX = axG * 90.0f;  // Convert g-force to degrees approx
  tiltY = ayG * 90.0f;
  tiltZ = azG * 90.0f;
  bool isAlerted = dropAlerted;
  bool isMuted = buzzerMuted;
  float lat = latitude;
  float lng = longitude;
  bool gVal = gpsValid;
  xSemaphoreGive(dataMutex);

  if (totalG < 0.3f && !isAlerted) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    dropDetected = true; 
    dropAlerted = true;
    xSemaphoreGive(dataMutex);
    
    if (!isMuted) buzzerBeep(3, 200);
    String msg = "BAG DROP ALERT!\nLocation: ";
    if (gVal) msg += "https://maps.google.com/?q=" + String(lat,6) + "," + String(lng,6);
    else msg += "Unavailable";
    queueSMS(msg);
  }
  
  if (totalG > 0.5f) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    dropAlerted = false;
    xSemaphoreGive(dataMutex);
  }
}

void readVoltage() {
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(VOLTAGE_PIN); delay(1); }
  float adcV = ((sum/20)/4095.0f)*3.3f;
  float batV = constrain(adcV * VD_RATIO, 0.0f, BATTERY_MAX);
  int batP = constrain((int)(((batV-BATTERY_MIN)/(BATTERY_MAX-BATTERY_MIN))*100.0f), 0, 100);
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  batteryVoltage = batV;
  batteryPercent = batP;
  bool isAlerted = lowBatAlerted;
  xSemaphoreGive(dataMutex);

  if (batP <= LOW_BAT_PCT && !isAlerted) {
    queueSMS("BATTERY LOW: " + String(batP) + "% (" + String(batV,1) + "V)!");
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    lowBatAlerted = true;
    xSemaphoreGive(dataMutex);
  }
  if (batP > LOW_BAT_PCT + 5) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    lowBatAlerted = false;
    xSemaphoreGive(dataMutex);
  }
}

void readWeight() {
  float w = weightSensor.getWeight(5);
  if (w != -1.0f) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    weightKG = w;
    bool isAlerted = overweightAlerted;
    bool isMuted = buzzerMuted;
    xSemaphoreGive(dataMutex);

    if (w > MAX_WEIGHT_THRESHOLD && !isAlerted) {
      xSemaphoreTake(dataMutex, portMAX_DELAY);
      overweightAlerted = true;
      xSemaphoreGive(dataMutex);
      
      if (!isMuted) buzzerBeep(4, 250); 
      queueSMS("OVERWEIGHT ALERT: Bag is " + String(w, 1) + "kg!");
    } else if (w <= MAX_WEIGHT_THRESHOLD) {
      xSemaphoreTake(dataMutex, portMAX_DELAY);
      overweightAlerted = false;
      xSemaphoreGive(dataMutex);
    }
  }
}

// SOS requires 3 presses within 2 seconds to prevent accidental triggers
void checkSOS() {
  static int     sosCount      = 0;
  static unsigned long firstPressMs = 0;
  static bool    btnWasDown    = false;

  bool btnDown = (digitalRead(SOS_PIN) == LOW);

  // Detect new press (falling edge)
  if (btnDown && !btnWasDown) {
    unsigned long now = millis();

    if (sosCount == 0) {
      // First press — start window
      firstPressMs = now;
      sosCount = 1;
      buzzerBeep(1, 80); // Short beep feedback
    } else if (now - firstPressMs <= 2000) {
      sosCount++;
      buzzerBeep(1, 80);
    } else {
      // Window expired — restart
      sosCount = 1;
      firstPressMs = now;
      buzzerBeep(1, 80);
    }
  }
  btnWasDown = btnDown;

  // Reset count if 2s window passed without reaching 3
  if (sosCount > 0 && sosCount < 3 && (millis() - firstPressMs > 2000)) {
    Serial.println("[SOS] " + String(sosCount) + " press(es) — need 3. Resetting.");
    sosCount = 0;
  }

  // ── TRIGGER on 3rd press ──
  if (sosCount >= 3) {
    sosCount = 0;

    xSemaphoreTake(dataMutex, portMAX_DELAY);
    bool isMuted = buzzerMuted;
    float lat = latitude;
    float lng = longitude;
    bool gVal = gpsValid;
    triggerSOSNetwork = true;
    xSemaphoreGive(dataMutex);

    Serial.println("[SOS] 3-press triggered!");

    // Full screen SOS alert
    tft.fillScreen(RED);
    tft.setTextColor(WHITE, RED);
    tft.setTextSize(3);
    tft.setCursor(45, 20); tft.print("SOS!");
    tft.setTextSize(1);
    tft.setCursor(22, 60); tft.print("Emergency alert");
    tft.setCursor(28, 72); tft.print("being sent...");
    rgbColor(true, false, true);
    if (!isMuted) buzzerBeep(5, 300);
    rgbOff();

    String msg = "SOS EMERGENCY!\nStudent needs help!\nLocation: ";
    if (gVal) msg += "https://maps.google.com/?q=" + String(lat,6) + "," + String(lng,6);
    else msg += "Unavailable";
    queueSMS(msg);

    tft.setCursor(35, 90); tft.print("Alert sent!");
    delay(3000);
    drawStaticDisplay();
    updateDisplay();
  }
}

void checkMissingItems() {
  // Use Firebase books cache — books managed via app
  String missing = "";
  bool anyMiss = false;

  xSemaphoreTake(dataMutex, portMAX_DELAY);
  int count = fbBookCount;
  bool isMuted = buzzerMuted;
  for (int i = 0; i < count; i++) {
    if (fbBooks[i].status != "in_bag") {
      missing += fbBooks[i].bookName + ", ";
      anyMiss = true;
    }
  }
  xSemaphoreGive(dataMutex);

  if (anyMiss && count > 0) {
    missing = missing.substring(0, missing.length() - 2);
    queueSMS("MISSING from bag: " + missing);
    if (!isMuted) { rgbColor(true,false,false); buzzerBeep(3,200); rgbOff(); }
    Serial.println("[CORE 1] Missing: " + missing);
  }
}

// ============================================================
// TFT DISPLAY RENDERING
// ============================================================
void drawSplashScreen() {
  tft.fillScreen(BLACK);
  tft.drawRGBBitmap(0, 0, syncPackLogo, 160, 128);
}

void drawStaticDisplay() {
  tft.fillScreen(BLACK);
  
  tft.fillRect(0, 0, 160, 16, BLUE);
  tft.setTextColor(WHITE, BLUE);
  tft.setTextSize(1);
  tft.setCursor(55, 4); 
  tft.print("SyncPack");

  tft.drawRoundRect(2, 20, 76, 28, 3, DARKGREY); 
  tft.drawRoundRect(82, 20, 76, 28, 3, DARKGREY);
  tft.drawRoundRect(2, 52, 156, 18, 3, DARKGREY); 
  tft.drawFastHLine(6, 85, 148, DARKGREY);
}

void updateDisplay() {
  // Take local snapshot to release mutex instantly
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  int bPct = batteryPercent;
  float tAng = tiltAngle;
  float tmp = temperature;
  float humi = humidity;
  bool gVal = gpsValid;
  bool gGSM = gpsFromGSM;
  float lat = latitude;
  float lng = longitude;
  float wKG = weightKG;
  // fbBooks[] cache used directly for display (no local copy needed)
  xSemaphoreGive(dataMutex);

  tft.setTextSize(1);

  // --- CARD 1: Power & Motion ---
  tft.fillRect(4, 22, 72, 24, BLACK);
  tft.setTextColor(YELLOW, BLACK); tft.setCursor(6, 25); tft.print("Bat:");
  tft.setTextColor(WHITE, BLACK); tft.print(bPct); tft.print("%");
  tft.setTextColor(ORANGE, BLACK); tft.setCursor(6, 37); tft.print("Tlt:");
  tft.setTextColor(WHITE, BLACK); tft.print((int)tAng); tft.print("d");

  // --- CARD 2: Environment ---
  tft.fillRect(84, 22, 72, 24, BLACK);
  tft.setTextColor(CYAN, BLACK); tft.setCursor(86, 25); tft.print("Tmp:");
  tft.setTextColor(WHITE, BLACK); tft.print(tmp, 1); tft.print("C");
  tft.setTextColor(CYAN, BLACK); tft.setCursor(86, 37); tft.print("Hum:");
  tft.setTextColor(WHITE, BLACK); tft.print(humi, 1); tft.print("%");

  // --- CARD 3: Location ---
  tft.fillRect(4, 54, 152, 14, BLACK);
  tft.setCursor(6, 57);
  if (gVal && !gGSM) {
    tft.setTextColor(GREEN, BLACK); tft.print("GPS "); tft.print(lat, 4); tft.print(" "); tft.print(lng, 4);
  } else if (gVal && gGSM) {
    tft.setTextColor(ORANGE, BLACK); tft.print("GSM "); tft.print(lat, 4); tft.print(" "); tft.print(lng, 4);
  } else {
    static int locTick = 0; locTick++;
    if (locTick % 4 < 2) {
      tft.setTextColor(DARKGREY, BLACK); tft.print("GPS: No fix yet...");
    } else {
      tft.setTextColor(CYAN, BLACK); tft.print("GSM: Getting loc...");
    }
  }

  // --- WEIGHT HEADER ---
  tft.fillRect(0, 75, 160, 10, BLACK);
  tft.setCursor(6, 75);
  tft.setTextColor(CYAN, BLACK); tft.print("WEIGHT: ");
  if (wKG > MAX_WEIGHT_THRESHOLD) tft.setTextColor(RED, BLACK);
  else tft.setTextColor(GREEN, BLACK);
  tft.print(wKG, 2); tft.print(" KG");

  // --- CARD 4: Inventory Pills (from Firebase cache) ---
  tft.fillRect(0, 88, 160, 40, BLACK);
  int pillCount = min(fbBookCount, 6);
  if (pillCount == 0) {
    tft.setTextColor(DARKGREY, BLACK);
    tft.setCursor(8, 96); tft.print("No items registered");
  }
  for (int i = 0; i < pillCount; i++) {
    int col = (i % 2) * 78;
    int row = 89 + ((i / 2) * 13);
    // Show book name (first 10 chars)
    String shortName = fbBooks[i].bookName;
    if (shortName.length() > 10) shortName = shortName.substring(0, 10);
    bool inBag = (fbBooks[i].status == "in_bag");
    if (inBag) {
      tft.fillRoundRect(4 + col, row, 74, 11, 2, GREEN);
      tft.setTextColor(BLACK, GREEN); tft.setCursor(8 + col, row + 2); tft.print(shortName);
    } else {
      tft.drawRoundRect(4 + col, row, 74, 11, 2, RED);
      tft.setTextColor(WHITE, BLACK); tft.setCursor(8 + col, row + 2); tft.print(shortName);
    }
  }
}

// ============================================================
// STATUS HELPERS
// ============================================================
void updateStatusLED() {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  bool owA = overweightAlerted;
  bool bLow = batteryPercent <= LOW_BAT_PCT;
  bool gVal = gpsValid;
  bool gGSM = gpsFromGSM;
  bool dDrop = dropDetected;
  if(dropDetected) dropDetected = false; // clear flag
  xSemaphoreGive(dataMutex);

  if (dDrop)                      { rgbColor(true,false,false); }
  else if (owA)                   { rgbColor(true,false,false); }
  else if (bLow)                  { rgbColor(true,true,false); }
  else if (gVal && !gGSM)         { rgbColor(false,false,true); }
  else if (gVal && gGSM)          { rgbColor(false,true,true); }
  else                            { rgbColor(false,true,false); }
}

void rgbOff() { digitalWrite(RGB_R, LOW); digitalWrite(RGB_G, LOW); digitalWrite(RGB_B, LOW); }
void rgbColor(bool r, bool g, bool b) { digitalWrite(RGB_R, r?HIGH:LOW); digitalWrite(RGB_G, g?HIGH:LOW); digitalWrite(RGB_B, b?HIGH:LOW); }
void buzzerBeep(int times, int duration) { for (int i=0; i<times; i++) { digitalWrite(BUZZER_PIN, HIGH); delay(duration); digitalWrite(BUZZER_PIN, LOW); delay(duration); } }

void printStatus() {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  float tmp = temperature; float humi = humidity; float wKG = weightKG;
  float batV = batteryVoltage; int bPct = batteryPercent;
  xSemaphoreGive(dataMutex);
  
  Serial.print("[CORE 1] Temp: " + String(tmp,1) + "C | Hum: " + String(humi,1) + "% | Wgt: " + String(wKG,2) + "kg | Bat: " + String(bPct) + "%\n");
}

// =====================================================================
// =====================================================================
// CORE 0: BACKGROUND NETWORK TASK
// This completely isolates freezing AT commands from the UI and sensors
// =====================================================================
// =====================================================================
void networkTaskCode(void * pvParameters) {
  Serial.println("[CORE 0] Initializing GSM Modems...");
  for(int i=0; i<5; i++) { simSerial.println("AT"); delay(500); if(simSerial.available()) break; }
  initGSM();
  connectGPRS();
  Serial.println("[CORE 0] Network Ready. Entering Background Loop.");
  loadParentContactsFromFirebase(); // Load contacts from Firebase

  unsigned long lastFirebaseUpload = 0;
  unsigned long lastCommandCheck = 0;
  unsigned long lastGsmGpsCheck = 0;

  for(;;) {
    // Check GPRS still connected — reconnect if dropped
    static unsigned long lastGPRSCheck = 0;
    if (millis() - lastGPRSCheck > 30000) {
      lastGPRSCheck = millis();
      String reg = sendAT("AT+CGATT?", 2000, false);
      if (reg.indexOf("+CGATT: 1") < 0) {
        Serial.println("[CORE 0] GPRS dropped! Reconnecting...");
        connectGPRS();
      }
    }

    // 1. Process SMS Queue
    String msgToSend = "";
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    if (smsHead != smsTail) {
      msgToSend = smsQueue[smsHead];
      smsHead = (smsHead + 1) % MAX_SMS_QUEUE;
    }
    xSemaphoreGive(dataMutex);
    
    if (msgToSend.length() > 0) {
      sendSMSBoth(msgToSend);
    }

    // 2. Process Hardware SOS Trigger
    bool doSOS = false;
    float sosLat = 0.0, sosLng = 0.0;
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    if (triggerSOSNetwork) {
      doSOS = true;
      triggerSOSNetwork = false;
      sosLat = latitude; sosLng = longitude;
    }
    xSemaphoreGive(dataMutex);

    if (doSOS) {
      sendSOSAlert(sosLat, sosLng);
    }

    // 3. Hardcoded book upload removed — handled by 3c (fbBookStatusPending)

    // 3b. Upload unknown RFID to Firebase
    String uidToUpload = "";
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    if (unknownRFIDPending) {
      uidToUpload = unknownRFIDUID;
      unknownRFIDPending = false;
    }
    xSemaphoreGive(dataMutex);
    if (uidToUpload.length() > 0) {
      String json = "{\"uid\":\"" + uidToUpload + "\",\"timestamp\":{\".sv\":\"timestamp\"}}";
      firebasePUT("/bags/" + String(BAG_ID) + "/unknown_rfid", json);
      Serial.println("[CORE 0] Unknown RFID uploaded: " + uidToUpload);
    }

    // 3c. Upload Firebase-cached book status change (in_bag / not_in_bag)
    String pendingBookID = "";
    String pendingStatus = "";
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    if (fbBookStatusPending) {
      pendingBookID       = fbBookPendingID;
      pendingStatus       = fbBookPendingStatus;
      fbBookStatusPending = false;
    }
    xSemaphoreGive(dataMutex);
    if (pendingBookID.length() > 0) {
      String path = "/bags/" + String(BAG_ID) + "/books/" + pendingBookID + "/status";
      bool ok = firebasePUT(path, "\"" + pendingStatus + "\"");
      Serial.println("[CORE 0] FB book " + pendingBookID + " -> " + pendingStatus + (ok ? " OK" : " FAIL"));
    }

    // 4. Periodic Firebase Sensors Sync
    if (millis() - lastFirebaseUpload > FIREBASE_INTERVAL) {
      lastFirebaseUpload = millis();
      sendSensorsToFirebase();
    }

    // 5. Periodic Commands Download
    if (millis() - lastCommandCheck > CMD_CHECK_INTERVAL) {
      lastCommandCheck = millis();
      checkFirebaseCommands();
    }

    // 5b. Refresh parent SMS contacts from Firebase every 30 seconds
    //     (near-realtime: app changes picked up within 30s)
    static unsigned long lastContactRefresh = 0;
    if (millis() - lastContactRefresh > 30000UL) {
      lastContactRefresh = millis();
      loadParentContactsFromFirebase();
    }

    // 5c. Refresh Firebase books cache every 30 seconds
    //     This ensures newly added books from the app are detected
    static unsigned long lastBooksRefresh = 0;
    if (millis() - lastBooksRefresh > 30000UL) {
      lastBooksRefresh = millis();
      loadFirebaseBooksCache();
    }

    // 6. GPS / GSM Location Fallback
    // Try GPS every 10s. If no GPS fix after 30s, use GSM tower location.
    if (millis() - lastGsmGpsCheck > 10000) {
      lastGsmGpsCheck = millis();

      xSemaphoreTake(dataMutex, portMAX_DELAY);
      bool hasGpsFix = gpsValid && !gpsFromGSM;
      xSemaphoreGive(dataMutex);

      if (!hasGpsFix) {
        Serial.println("[CORE 0] No GPS fix — trying GSM tower location...");
        readSIM_GPS();

        xSemaphoreTake(dataMutex, portMAX_DELAY);
        bool gotGSM = gpsValid && gpsFromGSM;
        float gsmLat = latitude; float gsmLng = longitude;
        xSemaphoreGive(dataMutex);

        if (gotGSM) {
          Serial.println("[CORE 0] GSM location OK: " + String(gsmLat,6) + "," + String(gsmLng,6));
        } else {
          Serial.println("[CORE 0] GSM location also failed.");
        }
      }
    }

    delay(50); // Yield to watchdog
  }
}

// ============================================================
// NETWORK FUNCTIONS (RUNNING SAFELY ON CORE 0)
// ============================================================
void sendSensorsToFirebase() {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  float t = temperature; float h = humidity; 
  float bV = batteryVoltage; int bP = batteryPercent;
  float tA = tiltAngle;
  float tX = tiltX; float tY = tiltY; float tZ = tiltZ;
  float wKG = weightKG;
  float lat = latitude; float lng = longitude;
  bool gV = gpsValid; bool gG = gpsFromGSM;
  xSemaphoreGive(dataMutex);

  String json = "{";
  json += "\"temperature\":" + String(t,1) + ",";
  json += "\"humidity\":" + String(h,1) + ",";
  json += "\"battery_voltage\":" + String(bV,2) + ",";
  json += "\"battery_percent\":" + String(bP) + ",";
  // App expects tilt as object {x, y, z}
  json += "\"tilt\":{";  
  json += "\"x\":";  json += String(tX,1); json += ",";
  json += "\"y\":";  json += String(tY,1); json += ",";
  json += "\"z\":";  json += String(tZ,1); json += ",";
  json += "\"isTilted\":"; json += (abs(tX)>15||abs(tY)>15) ? "true" : "false";
  json += "},";
  json += "\"weight\":" + String(wKG,2) + ",";

  if (gV) {
    json += "\"location\":{\"lat\":" + String(lat,6) + ",\"lng\":" + String(lng,6) + ",";
    json += "\"source\":\"" + String(gG ? "GSM" : "GPS") + "\",";
    json += "\"maps_link\":\"https://maps.google.com/?q=" + String(lat,6) + "," + String(lng,6) + "\"},";
  } else {
    json += "\"location\":{\"lat\":0,\"lng\":0,\"source\":\"none\"},";
  }
  json += "\"updated_at\":{\".sv\":\"timestamp\"}}";

  bool ok = firebasePUT("/bags/" + String(BAG_ID) + "/sensors", json);
  String locInfo = gV ? (String(lat,4)+","+String(lng,4)+"["+String(gG?"GSM":"GPS")+"]") : "no-fix";
  Serial.println("[CORE 0] Firebase upload: " + String(ok?"OK":"FAIL") + " | Loc: " + locInfo + " | Bat:" + String(bP) + "% T:" + String(t,1) + "C");
}

void checkFirebaseCommands() {
  String resp = firebaseGET("/bags/" + String(BAG_ID) + "/controls/buzzerMuted");
  if (resp.indexOf("true") >= 0) {
    xSemaphoreTake(dataMutex, portMAX_DELAY); buzzerMuted = true; xSemaphoreGive(dataMutex);
  } else if (resp.indexOf("false") >= 0) {
    xSemaphoreTake(dataMutex, portMAX_DELAY); buzzerMuted = false; xSemaphoreGive(dataMutex);
  }

  resp = firebaseGET("/bags/" + String(BAG_ID) + "/commands/sos");
  if (resp.indexOf("true") >= 0) {
    Serial.println("[CORE 0] Remote SOS command received!");
    
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    float lat = latitude; float lng = longitude; bool gVal = gpsValid;
    xSemaphoreGive(dataMutex);
    
    sendSOSAlert(lat, lng);
    String msg = "REMOTE SOS!\nLocation: ";
    if (gVal) msg += "https://maps.google.com/?q=" + String(lat,6) + "," + String(lng,6);
    else msg += "Unavailable";
    sendSMSBoth(msg);
    
    firebasePUT("/bags/" + String(BAG_ID) + "/commands/sos", "false");
  }
}

void sendSOSAlert(float lat, float lng) {
  // Build contacts JSON array from dynamic parentNumbers
  String contacts = "[";
  for (int i = 0; i < parentCount; i++) {
    if (parentNumbers[i].length() >= 8) {
      if (contacts.length() > 1) contacts += ",";
      contacts += "\"" + parentNumbers[i] + "\"";
    }
  }
  contacts += "]";

  String json = "{\"bagID\":\"" + String(BAG_ID) + "\",\"contacts\":" + contacts + ",";
  json += "\"location\":{\"lat\":" + String(lat, 6) + ",\"lng\":" + String(lng, 6) + "},";
  json += "\"message\":\"SOS Emergency from Smart School Bag!\",\"status\":\"pending_sms\"}";
  firebasePOST("/bags/" + String(BAG_ID) + "/sos_alerts", json);
  firebasePUT("/bags/" + String(BAG_ID) + "/commands/sos", "true");
}

// ── Find a UID in the Firebase books cache ──
// Returns index in fbBooks[], or -1 if not found
int findInFirebaseCache(String uid) {
  for (int i = 0; i < fbBookCount; i++) {
    // rfidTag in Firebase stores the raw UID entered by user in app
    if (fbBooks[i].rfidTag.equalsIgnoreCase(uid)) return i;
  }
  return -1;
}

// ── Download all books from Firebase and cache locally ──
// Called by Core 0 every 30s and on startup
void loadFirebaseBooksCache() {
  String resp = firebaseGET("/bags/" + String(BAG_ID) + "/books");

  // Print first 120 chars of raw response for debugging
  Serial.println("[CORE 0] Books raw[0..120]: " + resp.substring(0, min((int)resp.length(), 120)));

  if (resp.length() < 10 || resp.indexOf("{") < 0) {
    Serial.println("[CORE 0] Books cache: empty/failed response");
    return;
  }

  // Trim everything before first { (in case of HTTPREAD header remnants)
  int jsonStart = resp.indexOf("{");
  if (jsonStart > 0) resp = resp.substring(jsonStart);

  Serial.println("[CORE 0] Books cache: parsing " + String(resp.length()) + " bytes");

  // Simple JSON parser — extract each book object
  int newCount = 0;
  FirebaseBook newBooks[MAX_FB_BOOKS];

  int pos = 0;
  while (newCount < MAX_FB_BOOKS) {
    // Anchor on "rfidTag":"  — present in every book
    int anchor = resp.indexOf("\"rfidTag\":\"", pos);
    if (anchor < 0) break;

    // rfidTag value — read forward from anchor
    int rtq1 = anchor + 11; // length of "rfidTag":"
    int rtq2 = resp.indexOf('"', rtq1);
    String rfidTagVal = (rtq2 > rtq1) ? resp.substring(rtq1, rtq2) : "";

    // Fields BEFORE rfidTag (bookID, bookName) — use lastIndexOf to get
    // the one CLOSEST before anchor (same book object, not a previous book)
    auto fieldBefore = [&](const char* key) -> String {
      String k = String("\"") + key + "\":\"";
      int ki = resp.lastIndexOf(k, anchor); // last occurrence BEFORE anchor
      if (ki < 0 || ki < anchor - 300) return ""; // too far = different book
      int vs = ki + k.length();
      int ve = resp.indexOf('"', vs);
      return (ve > vs) ? resp.substring(vs, ve) : "";
    };

    // Fields AFTER rfidTag (status, subject) — use indexOf forward from anchor
    auto fieldAfter = [&](const char* key) -> String {
      String k = String("\"") + key + "\":\"";
      int ki = resp.indexOf(k, anchor);
      if (ki < 0 || ki > anchor + 200) return ""; // too far = different book
      int vs = ki + k.length();
      int ve = resp.indexOf('"', vs);
      return (ve > vs) ? resp.substring(vs, ve) : "";
    };

    String bookIDVal   = fieldBefore("bookID");
    String bookNameVal = fieldBefore("bookName");
    String statusVal   = fieldAfter("status");
    String subjectVal  = fieldAfter("subject");

    if (rfidTagVal.length() > 0 && bookNameVal.length() > 0) {
      newBooks[newCount].bookID   = bookIDVal;
      newBooks[newCount].bookName = bookNameVal;
      newBooks[newCount].rfidTag  = rfidTagVal;
      newBooks[newCount].subject  = subjectVal;
      newBooks[newCount].status   = statusVal;
      newCount++;
      Serial.println("  Book[" + String(newCount-1) + "]: " + bookNameVal + " | " + rfidTagVal);
    }
    pos = rtq2 + 1;
  }

  // Copy to shared cache
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  fbBookCount = newCount;
  fbBooksLoaded = true;
  for (int i = 0; i < newCount; i++) fbBooks[i] = newBooks[i];
  xSemaphoreGive(dataMutex);

  Serial.println("[CORE 0] Books cache: " + String(newCount) + " books loaded");
  for (int i = 0; i < newCount; i++) {
    Serial.println("  [" + fbBooks[i].bookID + "] " + fbBooks[i].bookName + " | rfidTag: " + fbBooks[i].rfidTag);
  }
}

// Save GSM-derived location to shared state
bool saveGSMLoc(float lat, float lng) {
  if (lat != 0.0f && lng != 0.0f && abs(lat) <= 90.0f && abs(lng) <= 180.0f) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    latitude = lat; longitude = lng;
    gpsValid = true; gpsFromGSM = true;
    xSemaphoreGive(dataMutex);
    Serial.println("[GSM GPS] Saved: " + String(lat,6) + "," + String(lng,6));
    return true;
  }
  return false;
}

// SIM7670C Location — Multiple methods
void readSIM_GPS() {
  Serial.println("[GSM GPS] Trying location methods...");

  // ── Method 1: SIM7670C internal GNSS (if GNSS antenna connected to SIM module) ──
  sendAT("AT+CGNSSPWR=1", 2000, false);
  delay(500);
  String resp = sendAT("AT+CGNSSINFO", 3000, false);
  if (resp.indexOf("+CGNSSINFO:") >= 0) {
    int idx = resp.indexOf("+CGNSSINFO:");
    String d = resp.substring(idx + 11); d.trim();
    int c1=d.indexOf(","); int c2=d.indexOf(",",c1+1); int c3=d.indexOf(",",c2+1);
    int c4=d.indexOf(",",c3+1); int c5=d.indexOf(",",c4+1); int c6=d.indexOf(",",c5+1);
    if (c3>0 && c4>0) {
      String fixStr = d.substring(c2+1, c3); fixStr.trim();
      if (fixStr == "1" || fixStr == "2" || fixStr == "3") {
        float newLat = d.substring(c3+1, c4).toFloat();
        String ns = d.substring(c4+1, c5); ns.trim();
        float newLng = d.substring(c5+1, c6).toFloat();
        String ew = d.substring(c6+1, d.indexOf(",",c6+1)); ew.trim();
        if (ns == "S") newLat = -newLat;
        if (ew == "W") newLng = -newLng;
        if (saveGSMLoc(newLat, newLng)) { Serial.println("[GPS] SIM7670C GNSS fix!"); return; }
      }
    }
  }

  // ── Method 2: AT+CLBS=4,1 (SIM7670C LBS — needs Hutch LBS service enabled) ──
  resp = sendAT("AT+CLBS=4,1", 10000, false);
  Serial.println("[GSM GPS] CLBS=4,1: " + resp.substring(0, min((int)resp.length(), 60)));
  if (resp.indexOf("+CLBS:") >= 0) {
    int idx = resp.indexOf("+CLBS:");
    String d = resp.substring(idx + 6); d.trim();
    d.replace('"', ' ');
    int c1=d.indexOf(","); int c2=d.indexOf(",",c1+1); int c3=d.indexOf(",",c2+1);
    if (c1>0 && c2>0) {
      int err = d.substring(0, c1).toInt();
      if (err == 0) {
        String latS = d.substring(c1+1,c2); latS.trim();
        String lngS = d.substring(c2+1,c3>0?c3:d.length()); lngS.trim();
        if (saveGSMLoc(latS.toFloat(), lngS.toFloat())) { Serial.println("[GPS] CLBS4 fix!"); return; }
      }
    }
  }

  // ── Method 3: IP Geolocation via ip-api.com (works on any data connection) ──
  // Accuracy ~1-10km but always works if internet connected
  Serial.println("[GSM GPS] Trying IP geolocation...");
  sendAT("AT+HTTPTERM", 500, false); delay(300);
  sendAT("AT+HTTPINIT", 2000, false);
  if (sendAT("AT+HTTPPARA=\"CID\",1", 1000, false).indexOf("ERROR") >= 0)
    sendAT("AT+HTTPPARA=\"CID\",0", 1000, false);
  sendAT("AT+HTTPPARA=\"URL\",\"http://ip-api.com/json/?fields=lat,lon,status\"", 1000, false);
  sendAT("AT+HTTPPARA=\"SSLCFG\",0", 500, false);

  simSerial.println("AT+HTTPACTION=0");
  unsigned long t = millis(); String actResp = "";
  while (millis() - t < 12000) {
    while (simSerial.available()) actResp += (char)simSerial.read();
    if (actResp.indexOf("+HTTPACTION:") >= 0) { delay(400); while(simSerial.available()) actResp+=(char)simSerial.read(); break; }
    delay(10);
  }
  Serial.println("[GSM GPS] IP-API action: " + actResp.substring(0, min((int)actResp.length(), 60)));

  if (actResp.indexOf(",200,") >= 0) {
    // Get dataLen
    int haIdx = actResp.indexOf("+HTTPACTION:");
    int lineEnd = actResp.indexOf("\n", haIdx);
    String haLine = actResp.substring(haIdx, lineEnd > 0 ? lineEnd : actResp.length()); haLine.trim();
    int dataLen = haLine.substring(haLine.lastIndexOf(",") + 1).toInt();

    if (dataLen > 0) {
      String ipResp = httpReadData(dataLen);
      Serial.println("[GSM GPS] IP-API: " + ipResp.substring(0, min((int)ipResp.length(), 80)));
      // Response: {"status":"success","lat":6.9271,"lon":79.8612}
      if (ipResp.indexOf("\"success\"") >= 0) {
        int latIdx = ipResp.indexOf("\"lat\":");
        int lonIdx = ipResp.indexOf("\"lon\":");
        if (latIdx >= 0 && lonIdx >= 0) {
          int latEnd = ipResp.indexOf(",", latIdx + 6);
          int lonEnd = ipResp.indexOf("}", lonIdx + 6);
          float newLat = ipResp.substring(latIdx + 6, latEnd > 0 ? latEnd : ipResp.length()).toFloat();
          float newLng = ipResp.substring(lonIdx + 6, lonEnd > 0 ? lonEnd : ipResp.length()).toFloat();
          if (saveGSMLoc(newLat, newLng)) {
            Serial.println("[GPS] IP Geolocation OK: " + String(newLat,4) + "," + String(newLng,4));
            sendAT("AT+HTTPTERM", 500, false);
            return;
          }
        }
      }
    }
  }
  sendAT("AT+HTTPTERM", 500, false);
  Serial.println("[GSM GPS] All methods failed.");
}

void sendSMSBoth(String message) {
  sendAT("AT+HTTPTERM", 500, false); delay(500);
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  int count = parentCount;
  String numbers[MAX_PARENTS];
  for (int i = 0; i < count; i++) numbers[i] = parentNumbers[i];
  xSemaphoreGive(dataMutex);

  for (int i = 0; i < count; i++) {
    if (numbers[i].length() < 8) continue; // Skip empty slots
    Serial.println("[CORE 0] Sending SMS to: " + numbers[i]);
    simSerial.print("AT+CMGS=\""); simSerial.print(numbers[i]); simSerial.println("\"");
    delay(1000);
    simSerial.print(message); delay(100); simSerial.write(26); delay(5000);
  }
}

// Parse index-th string from a JSON array like ["val1","val2"]
String parseJsonStringArray(String json, int index) {
  int count = 0;
  int pos = 0;
  while (pos < (int)json.length()) {
    int q1 = json.indexOf('"', pos);
    if (q1 < 0) break;
    int q2 = json.indexOf('"', q1 + 1);
    if (q2 < 0) break;
    if (count == index) return json.substring(q1 + 1, q2);
    count++;
    pos = q2 + 1;
  }
  return "";
}

// Load parent contacts from Firebase settings/parent_contacts
// Only loads contacts where smsEnabled = true
// Also reads global sms_enabled flag
void loadParentContactsFromFirebase() {
  // Load parent_contacts from Firebase settings
  String resp = firebaseGET("/bags/" + String(BAG_ID) + "/settings/parent_contacts");
  Serial.println("[CORE 0] parent_contacts (" + String(resp.length()) + " bytes): " +
                 resp.substring(0, min((int)resp.length(), 120)));

  if (resp.length() < 10 || resp.indexOf("{") < 0) {
    Serial.println("[CORE 0] parent_contacts: empty response");
    return;
  }

  // Parse each parent contact
  // Firebase returns alphabetically: id, name, phone, smsEnabled
  // So smsEnabled always comes AFTER phone in the JSON
  int newCount = 0;
  String newNumbers[MAX_PARENTS];

  int pos = 0;
  while (newCount < MAX_PARENTS) {
    // Find "phone":"..."
    int phoneIdx = resp.indexOf("\"phone\":\"", pos);
    if (phoneIdx < 0) break;

    int pStart = phoneIdx + 9; // skip "phone":"
    int pEnd   = resp.indexOf('"', pStart);
    if (pEnd < 0) break;
    String phone = resp.substring(pStart, pEnd);

    // Find smsEnabled for this parent (must be within 150 chars after phone)
    int smsIdx = resp.indexOf("\"smsEnabled\":", pEnd);
    bool smsOn = false;
    if (smsIdx >= 0 && smsIdx < pEnd + 150) {
      // Value is true or false (boolean, no quotes)
      String smsVal = resp.substring(smsIdx + 13, smsIdx + 18);
      smsVal.trim();
      smsOn = smsVal.startsWith("true");
    }

    Serial.println("[CORE 0] Found: " + phone + " | smsEnabled=" + String(smsOn ? "true" : "false"));

    if (phone.length() >= 8 && smsOn) {
      newNumbers[newCount++] = phone;
    }
    pos = pEnd + 1;
  }

  // Update shared state
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  parentCount = newCount;
  for (int i = 0; i < newCount; i++) parentNumbers[i] = newNumbers[i];
  xSemaphoreGive(dataMutex);

  Serial.println("[CORE 0] SMS will send to " + String(newCount) + " number(s):");
  for (int i = 0; i < newCount; i++) {
    Serial.println("  -> " + newNumbers[i]);
  }
}

// ============================================================
// FIREBASE HTTP ENGINE (CORE 0)
// ============================================================
bool firebaseHTTP(String method, String path, String body) {
  String url = "https://" + String(FIREBASE_HOST) + path + ".json?auth=" + String(FIREBASE_SECRET);
  sendAT("AT+HTTPTERM", 500, false); delay(300);
  sendAT("AT+HTTPINIT", 2000, false);
  if (sendAT("AT+HTTPPARA=\"CID\",1", 1000, false).indexOf("ERROR") >= 0) sendAT("AT+HTTPPARA=\"CID\",0", 1000, false);
  sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 1000, false);
  sendAT("AT+HTTPPARA=\"SSLCFG\",0", 500, false);

  // SIM7600 HTTP action codes: 0=GET, 1=POST, 2=HEAD, 3=DELETE, 4=PUT, 5=PATCH
  // NOTE: code 2 = HEAD not PATCH! PATCH needs code 5 (newer firmware only)
  // Using PUT(4) for both PUT and PATCH — Firebase accepts PUT to overwrite
  int actionCode = (method == "GET") ? 0 : ((method == "POST") ? 1 : 4);

  if (method != "GET" && body.length() > 0) {
    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 500, false);
    // Wait for DOWNLOAD prompt before sending body
    simSerial.println("AT+HTTPDATA=" + String(body.length()) + ",10000");
    unsigned long tw = millis(); String wresp = "";
    while (millis() - tw < 5000) {
      while (simSerial.available()) wresp += (char)simSerial.read();
      if (wresp.indexOf("DOWNLOAD") >= 0 || wresp.indexOf("OK") >= 0) break;
      delay(10);
    }
    simSerial.print(body);
    delay(1000); // Wait for data to be accepted
  }

  simSerial.println("AT+HTTPACTION=" + String(actionCode));
  unsigned long t = millis(); String actionResp = "";
  while (millis() - t < 15000) { 
    while (simSerial.available()) actionResp += (char)simSerial.read();
    if (actionResp.indexOf("+HTTPACTION:") >= 0) break; delay(10);
  }
  sendAT("AT+HTTPTERM", 500, false);
  return (actionResp.indexOf(",200,") >= 0 || actionResp.indexOf(",204,") >= 0);
}

// ── Read HTTP response body directly from serial (bypasses sendAT "OK" stop issue) ──
// SIM7670C sends OK first (ACK), then +HTTPREAD: N, then N bytes of data, then OK
// sendAT() stops on first OK, missing the actual data. This function handles it properly.
String httpReadData(int dataLen) {
  // Use static char buffer — avoids String heap fragmentation
  int maxRead = min(dataLen, HTTP_READ_BUF - 1);
  memset(g_httpBuf, 0, maxRead + 1);

  // Flush any stale serial data
  delay(50);
  while (simSerial.available()) simSerial.read();

  // Send HTTPREAD command
  simSerial.println("AT+HTTPREAD=0," + String(dataLen));

  unsigned long t = millis();
  bool dataPhase = false;
  int bytesRead = 0;
  int headerIdx = 0;
  char headerBuf[64] = {0}; // Small fixed buffer for header

  while (millis() - t < 15000 && bytesRead < maxRead) {
    if (!simSerial.available()) { delayMicroseconds(100); continue; }
    char c = simSerial.read();

    if (!dataPhase) {
      // Accumulate header in small fixed buffer
      if (headerIdx < 63) headerBuf[headerIdx++] = c;
      headerBuf[headerIdx] = 0;
      // +HTTPREAD: N\n marks start of actual data
      if (strstr(headerBuf, "+HTTPREAD:") && c == '\n') {
        dataPhase = true;
      }
    } else {
      g_httpBuf[bytesRead++] = c;
    }
  }
  g_httpBuf[bytesRead] = '\0';
  Serial.println("[GET] httpReadData: got " + String(bytesRead) + "/" + String(dataLen) + " bytes");
  return String(g_httpBuf);
}

String firebaseGET(String path) {
  String url = "https://" + String(FIREBASE_HOST) + path + ".json?auth=" + String(FIREBASE_SECRET);
  sendAT("AT+HTTPTERM", 500, false); delay(300);
  sendAT("AT+HTTPINIT", 2000, false);
  if (sendAT("AT+HTTPPARA=\"CID\",1", 1000, false).indexOf("ERROR") >= 0) sendAT("AT+HTTPPARA=\"CID\",0", 1000, false);
  sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 1000, false);
  sendAT("AT+HTTPPARA=\"SSLCFG\",0", 500, false);

  simSerial.println("AT+HTTPACTION=0");
  unsigned long t = millis(); String actionResp = "";

  // Wait for complete +HTTPACTION: line (wait for newline after it)
  while (millis() - t < 15000) {
    while (simSerial.available()) actionResp += (char)simSerial.read();
    if (actionResp.indexOf("+HTTPACTION:") >= 0) {
      unsigned long waitEnd = millis() + 600;
      while (millis() < waitEnd) {
        while (simSerial.available()) actionResp += (char)simSerial.read();
        int haIdx = actionResp.indexOf("+HTTPACTION:");
        if (actionResp.indexOf("\n", haIdx) >= 0) break;
        delay(10);
      }
      break;
    }
    delay(10);
  }

  String resp = "";
  if (actionResp.indexOf(",200,") >= 0) {
    int haIdx   = actionResp.indexOf("+HTTPACTION:");
    int lineEnd = actionResp.indexOf("\n", haIdx);
    String haLine = actionResp.substring(haIdx, lineEnd > 0 ? lineEnd : actionResp.length());
    haLine.trim();
    int lastComma = haLine.lastIndexOf(",");
    String dataLenStr = haLine.substring(lastComma + 1);
    dataLenStr.trim();
    int dataLen = dataLenStr.toInt();
    Serial.println("[GET] path=" + path + " dataLen=" + String(dataLen));

    if (dataLen > 0) {
      // Use dedicated reader — avoids sendAT "OK" early-stop bug
      resp = httpReadData(dataLen);
    }
  }
  sendAT("AT+HTTPTERM", 500, false);
  return resp;
}

bool firebasePUT(String path, String data) { return firebaseHTTP("PUT", path, data); }
bool firebasePATCH(String path, String data) { return firebaseHTTP("PATCH", path, data); }
bool firebasePOST(String path, String data) { return firebaseHTTP("POST", path, data); }

void initGSM() { sendAT("AT", 2000); sendAT("ATE0", 500); sendAT("AT+CMGF=1", 500); }
void connectGPRS() {
  sendAT("AT+CGACT=0,1", 2000, false); delay(1000);
  sendAT("AT+CGDCONT=1,\"IP\",\"hutch3g\"", 2000); sendAT("AT+CGACT=1,1", 8000);
  sendAT("AT+CSSLCFG=\"sslversion\",0,3", 1000); sendAT("AT+CSSLCFG=\"authmode\",0,0", 1000);
}

String sendAT(String cmd, int timeout) { return sendAT(cmd, timeout, true); }
String sendAT(String cmd, int timeout, bool print) {
  while (simSerial.available()) simSerial.read();
  simSerial.println(cmd);
  unsigned long t = millis(); String resp = "";
  while (millis() - t < (unsigned long)timeout) {
    while (simSerial.available()) { resp += (char)simSerial.read(); }
    if (resp.indexOf("OK") >= 0 || resp.indexOf("ERROR") >= 0) break;
  }
  if (print) {
    String cleanResp = resp; cleanResp.replace("\r", " "); cleanResp.replace("\n", " ");
    Serial.println("[AT] " + cmd + " -> " + cleanResp);
  }
  return resp;
}