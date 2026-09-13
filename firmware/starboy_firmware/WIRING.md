# STARBOY DIY — Wiring & Libraries

## Arduino Libraries to Install (Library Manager)

| Library | Author |
|---------|--------|
| Adafruit GFX Library | Adafruit |
| Adafruit GC9A01A | Adafruit |
| Adafruit MPU6050 | Adafruit |
| Adafruit Unified Sensor | Adafruit |
| DallasTemperature | Miles Burton |
| OneWire | Jim Studt |

Board: **ESP32 (by Espressif)** → pick **ESP32C3 Dev Module**

## Wiring

### GC9A01 1.28" Round TFT (SPI)
| TFT Pin | ESP32-C3 |
|---------|----------|
| VCC     | 3.3V     |
| GND     | GND      |
| SCL/SCK | GPIO 4   |
| SDA/MOSI| GPIO 6   |
| DC      | GPIO 2   |
| CS      | GPIO 3   |
| RST     | 3.3V (or GPIO if you want software reset) |
| BL      | 3.3V (always on) |

### MPU6050 (I2C)
| MPU6050 | ESP32-C3 |
|---------|----------|
| VCC     | 3.3V     |
| GND     | GND      |
| SDA     | GPIO 8   |
| SCL     | GPIO 9   |
| AD0     | GND (address 0x68) |

### DS18B20 (OneWire)
| DS18B20 | ESP32-C3 |
|---------|----------|
| VDD     | 3.3V     |
| GND     | GND      |
| DATA    | GPIO 5   |
| (4.7kΩ resistor between DATA and VDD) |

### MAX4466 Mic (optional, analog)
| MAX4466 | ESP32-C3 |
|---------|----------|
| VCC     | 3.3V     |
| GND     | GND      |
| OUT     | GPIO 0 (A0) |

---

## Behavior Summary

| What you do | What happens |
|-------------|--------------|
| Shake device hard for 1+ second | Eyes go dizzy (spinning iris) |
| Keep shaking | Eyes get ANGRY (red squint + furrow) |
| Temp drops below 10°C | Shiver animation (tremble + blue tint) |
| Loud noise (needs mic) | Anxious darting eyes |
| Tilt device | Eyes follow gravity |
| Leave alone 20s | Eyes start dozing (half-closed) |
| Leave alone 60s | Eyes close completely (sleep) |
| Shake/sound wakes it | Returns to idle |

---

## Upload Settings (Arduino IDE)

- Board: ESP32C3 Dev Module
- Flash Mode: DIO
- Flash Frequency: 80MHz
- Upload Speed: 921600
- USB CDC On Boot: Enabled (for Serial.println debug)
