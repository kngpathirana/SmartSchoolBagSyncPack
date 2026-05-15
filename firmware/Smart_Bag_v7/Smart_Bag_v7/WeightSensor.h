#ifndef WEIGHT_SENSOR_H
#define WEIGHT_SENSOR_H

#include <Arduino.h>
#include "HX711.h"

class WeightSensor {
public:
    WeightSensor(int dout, int sck);
    void begin();
    float getWeight(int readings = 10);
    void tare();
    void setCalibrationFactor(float factor);

private:
    HX711 scale;
    int _dout;
    int _sck;
    float _calibrationFactor = -7050.0; // Default value, needs manual calibration
};

#endif
