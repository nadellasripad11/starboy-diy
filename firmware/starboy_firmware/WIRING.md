# STARBOY DIY — Wiring & Libraries (v2.0 firmware)

## 1. Install TFT_eSPI (requires one-time config)

1. Arduino IDE → Library Manager → search **TFT_eSPI** by **Bodmer** → Install
2. Find your Arduino libraries folder (usually `Documents/Arduino/libraries/TFT_eSPI`)
3. Copy [`User_Setup.h`](User_Setup.h) from this folder into that library folder,
   **replacing** the existing `User_Setup.h`
4. This tells TFT_eSPI: GC9A01 driver, 240×240, and your exact SPI pins

## 2. Install the rest (Library Manager)

| Library | Author |
|---------|--------|
| Adafruit MPU6050 | Adafruit |
| Adafruit Unified Sensor | Adafruit |
| DallasTemperature | Miles Burton |
| OneWire | Jim Studt |

Board: **ESP32 (by Espressif)** → pick **ESP32C3 Dev Module**
Also set: **USB CDC On Boot → Enabled** (so Serial.print debug works)

---

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
| RST     | 3.3V (tied high) |
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

### MAX4466 Mic (analog — buy this next)
| MAX4466 | ESP32-C3 |
|---------|----------|
| VCC     | 3.3V     |
| GND     | GND      |
| OUT     | GPIO 0 (A0) |

Once wired, set `#define HAS_MIC true` in the .ino (already the default).

---

## What it does — full behavior list

**Sensor-driven states:**

| Trigger | Behavior |
|---------|----------|
| Shake 1s+ | Dizzy spinning eyes → severe dizzy → recovering → angry |
| Keep shaking hard | Full rage state (deep red squint + heavy furrow) |
| Temp < 10°C | Chill → shiver → freeze (progressively icier, blue tint, crystalline overlay) |
| Loud sound | Startled → anxious darting eyes → overwhelmed |
| Tilt the device | Eyes track the direction of gravity |
| 25s no interaction | Doze — eyes half close, brows droop |
| 75s no interaction | Full sleep — slow breathing blink, occasional dream state (REM eye movement) |
| Shake or sound during sleep | Wakes up ("just woke" expression) |

**Idle personality (cycles automatically, ~2.5-7s):**
neutral · content · happy · curious · bored · wondering · playful · glancing ·
cheerful · relaxed · shifty · noticing-something — 50 base expressions, each
blended smoothly into the next.

**Rare special animations** (checked every ~90s, 40% chance):
rainbow eyes · heart pupils · star pupils · glitch · matrix rain · hypnotic
spiral · loading spinner · error/X eyes · derp/cross-eyed · smug · crying ·
laughing · shocked · "dead" eyes · galaxy swirl · heartbeat pulse · fire
pupils · starfield dream · scanline glitch — 20 total, ~5 seconds each.

**Eye design:** each unit generates a unique eye on first boot (seed stored
in flash) — 20 iris colors × 6 patterns × 6 pupil shapes × 4 sclera tints ×
4 highlight styles = **6,480 possible combinations**, with rarity tiers
(common → legendary) gating the rarer colors/patterns/pupils.

---

## Upload Settings (Arduino IDE)

- Board: ESP32C3 Dev Module
- Flash Mode: DIO
- Flash Frequency: 80MHz
- Upload Speed: 921600
- USB CDC On Boot: Enabled

## Tuning

All thresholds are `#define`s near the top of the .ino — adjust if your
unit is more/less sensitive:

```cpp
#define SHAKE_ON_G    16.0f   // how hard a shake must be
#define COLD_C        10.0f   // °C that triggers shiver
#define LOUD_ADC      650     // mic ADC level that triggers anxious
#define IDLE_DOZE_MS  25000UL // ms of stillness before dozing
#define IDLE_SLEEP_MS 75000UL // ms before full sleep
```
