/*
 * Load Cell Test Script (10KG)
 * ----------------------------
 * This script is used to calibrate and test your 10KG load cell.
 * 
 * Connections:
 * HX711 VCC -> ESP32 3.3V
 * HX711 GND -> ESP32 GND
 * HX711 DT  -> ESP32 GPIO 5
 * HX711 SCK -> ESP32 GPIO 6
 */

#include "WeightSensor.h"

// Pin definitions - 5 and 6 are safe on ESP32-S3
#define HX711_DT  5
#define HX711_SCK 6

// Create sensor instance
WeightSensor weightSensor(HX711_DT, HX711_SCK);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("--- Load Cell Test & Calibration ---");
  Serial.println("1. Remove all weight from the scale.");
  Serial.println("2. Waiting 2 seconds to tare...");
  
  delay(2000);
  
  // Initialize and tare
  weightSensor.begin();
  
  Serial.println("Tare complete.");
  Serial.println("Now place a known weight (e.g., 1kg) on the scale.");
  Serial.println("If the reading is incorrect, adjust the calibration factor in WeightSensor.h");
  Serial.println("------------------------------------");
}

void loop() {
  // Read weight (average of 10 readings)
  float weight = weightSensor.getWeight(10);
  
  if (weight != -1.0) {
    Serial.print("Weight: ");
    Serial.print(weight, 3); // Print with 3 decimal places
    Serial.println(" kg");
  } else {
    Serial.println("Error: Could not read from HX711. Check wiring!");
  }
  
  delay(500); // Wait 500ms before next reading
}
