# STARBOY DIY — Wiring, Libraries & Physical Build

## Shell dimensions (final, print-ready)

| | |
|---|---|
| Body | ~65 × 64 mm (78 mm including the keyring loop) |
| Thickness | 18 mm |
| Display | GC9A01 1.28" round, centred in the front face |
| Charging | USB-C cutout in the valley opposite the keyring |

The 18mm thickness is not arbitrary — it's driven by the component stack.
See the COMPONENT FIT table at the top of `hardware/starboy_star.scad`.

## Component placement

Looking at the **front** (display facing you), with the keyring at the right
(0°), features sit on the arms at these angles:

| Angle | Feature |
|-------|---------|
| 0° | Keyring bail |
| 72° | Camera lens pocket (8mm) — optional |
| 144° | DS18B20 temperature vent (4mm, through-hole) |
| 180° (valley) | USB-C charging cutout |
| 288° | MAX4466 mic sound port (2.5mm, through-hole) |

**The temperature vent is a through-hole on purpose.** If you seal the
DS18B20 inside, it reads the board's own waste heat and the cold/shiver
behaviour never triggers. It has to see outside air.

## Internal stack (front to back)

```
front face
  ├─ GC9A01 display        5.4mm   (inserted from inside, against the lip)
  ├─ ESP32-C3 SuperMini    3.2mm   (USB-C facing the 180° valley)
  ├─ MPU6050 (no headers)  1.6mm
  └─ LiPo 402030 300mAh    4.0mm
back face
```
Total 8.8mm into 9.5mm available — 0.7mm slack. That assumes a 3.2mm-thick
SuperMini, which no source actually confirms; measure yours. Snug, so dry-fit before
gluing anything.

## Charging

The cutout exposes the **ESP32-C3 SuperMini's own USB-C**. Most SuperMini
boards carry a single-cell LiPo charge IC on that same port plus a pair of
battery pads — check yours before you rely on it. If your board doesn't
have charging, add a TP4056 module and line it up with the same cutout
instead.

---

# Wiring & Libraries (v2.0 firmware)

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
| BL      | GPIO 7 (PWM — firmware dims it when asleep; do NOT tie to 3.3V) |

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
#define LOUD_P2P      600     // mic peak-to-peak swing that triggers anxious
                              // (depends on the mic board's gain trimmer —
                              // set DEBUG_SENSORS 1 and watch Serial to tune)
#define IDLE_DOZE_MS  25000UL // ms of stillness before dozing
#define IDLE_SLEEP_MS 75000UL // ms before full sleep
```
