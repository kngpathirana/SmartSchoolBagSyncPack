#include "WeightSensor.h"

WeightSensor::WeightSensor(int dout, int sck) : _dout(dout), _sck(sck) {}

void WeightSensor::begin() {
    scale.begin(_dout, _sck);
    scale.set_scale(_calibrationFactor);
    scale.tare(); // Reset the scale to 0
}

float WeightSensor::getWeight(int readings) {
    if (scale.is_ready()) {
        float weight = scale.get_units(readings);
        if (weight < 0) weight = 0.0; // Prevent negative readings due to noise
        return weight;
    } else {
        Serial.println("HX711 not found.");
        return -1.0;
    }
}

void WeightSensor::tare() {
    scale.tare();
}

void WeightSensor::setCalibrationFactor(float factor) {
    _calibrationFactor = factor;
    scale.set_scale(_calibrationFactor);
}
