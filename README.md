# ⭐ STARBOY DIY

A handbuilt replica of the [CREATURE STARBOY](https://lilguy.net) — a 5-point metallic star keychain with an animated round TFT eye that reacts to motion, temperature, and sound. Built around an **ESP32-C3 SuperMini** and a **1.28" GC9A01 round TFT display** for under $15 in parts.

**v2.0 firmware:** 6,480 unique eye designs (seed-generated per unit, like the real Starboy's 5,000+ variants), 50 base expressions blended smoothly into 500+ animation states, plus 20 rare special effects. Renders at ~30fps via TFT_eSPI sprites (zero flicker).

---

## Printing it

Ready-to-slice STLs are in [`stl/`](stl/): `starboy_front.stl`,
`starboy_back.stl` and `starboy_bezel.stl`. Orientation matters and both
halves need a little support — see the Printing section of [BUILD.md](BUILD.md).

**Read [BUILD.md](BUILD.md) before ordering parts** — several components have
variants that won't fit (display pin headers, MPU6050 headers, battery
thickness). The depth budget has only 0.7mm of slack.

Body is **~65 × 64mm (78mm including the keyring loop), 18mm thick**.

---

## Hardware (~$35–45 for good parts — details in [BUYING.md](BUYING.md))

| Part | Price |
|------|-------|
| ESP32-C3 SuperMini | ~$3 |
| GC9A01 1.28" Round TFT (240×240, **round Φ37.5mm PCB**) | ~$13 |
| MPU6050 Accelerometer/Gyro | ~$2 |
| DS18B20 Temperature Sensor | ~$1.50 |
| MAX4466 Mic (optional, for sound) | ~$2 |
| 4.7kΩ resistor (DS18B20 pull-up) | ~$0.10 |
| 3D printed star shell (PLA) | filament cost |
| Chrome mirror spray paint | ~$8 (Rust-Oleum Mirror Effect) |
| Metal carabiner/keyring clip | ~$5/pack |

---

## Eye Behaviors

Modeled after the real CREATURE Starboy's documented behaviors:

| Trigger | What happens |
|---------|-------------|
| Shake device hard (1s+) | **Dizzy** spinning eyes → severe dizzy → recovering → **angry** rage |
| Temp drops below 10°C | **Chill → shiver → freeze** — progressively icier, blue tint, crystalline overlay |
| Loud sound (needs mic) | **Startled → anxious** darting eyes → overwhelmed |
| Tilt device | Eyes **follow gravity** naturally |
| 25 seconds idle | Eyes **start dozing** — half-closed, brows droop |
| 75 seconds idle | Eyes **sleep** — slow breathing, occasional dreaming (REM eye movement) |
| Shake or sound during sleep | **Wakes up** |
| Just sitting there | 50 idle micro-expressions cycle every 2.5–7s: content, curious, playful, wondering, shifty, cheerful... |
| Every ~90s (40% chance) | One of **20 rare specials**: rainbow eyes, hearts, stars, glitch, matrix rain, hypnotic spiral, "dead" eyes, fire pupils, galaxy swirl, and more |

Every unit's eye is unique — 6,480 possible iris color/pattern/pupil/sclera combinations, generated from a random seed on first boot and stored permanently.

---

## 3D Shell

`hardware/starboy_star.scad` — parametric OpenSCAD model of the star shell.

- 5-point puffy metallic star (hull-of-ellipsoids geometry, fast render)
- Keyring boss + hole at top point
- Screen pocket for GC9A01 module
- Back face with engraved medallion: sunburst, "SRIPADBUILDS" arc text, mini star badge
- Parts: `front`, `back`, `bezel`, `ring`, `clip`, `preview`

Set `part = "preview"` and open in OpenSCAD to see the assembled result. Export `front` and `back` separately as STL for printing.

**Finish:** Sand smooth → prime → Rust-Oleum Mirror Effect spray. Polish with 0000 steel wool for a metallic sheen.

---

## Firmware

`firmware/starboy_firmware/starboy_firmware.ino`

Arduino IDE setup:
- Board: **ESP32C3 Dev Module** (Espressif ESP32 boards package)
- USB CDC On Boot: **Enabled**

Libraries (install via Library Manager):
- **TFT_eSPI** by Bodmer — ⚠️ also copy [`User_Setup.h`](firmware/starboy_firmware/User_Setup.h) into the TFT_eSPI library folder (one-time setup)
- Adafruit MPU6050
- Adafruit Unified Sensor
- DallasTemperature
- OneWire

See [`firmware/starboy_firmware/WIRING.md`](firmware/starboy_firmware/WIRING.md) for full pin-by-pin wiring and setup steps.

---

## Wiring (quick reference)

```
GC9A01 TFT          ESP32-C3
──────────          ────────
VCC  ─────────────► 3.3V
GND  ─────────────► GND
SCL  ─────────────► GPIO4
MOSI ─────────────► GPIO6
DC   ─────────────► GPIO2
CS   ─────────────► GPIO3

MPU6050             ESP32-C3
───────             ────────
VCC  ─────────────► 3.3V
GND  ─────────────► GND
SDA  ─────────────► GPIO8
SCL  ─────────────► GPIO9

DS18B20             ESP32-C3
───────             ────────
VDD  ─────────────► 3.3V
GND  ─────────────► GND
DATA ──[4.7kΩ]───► GPIO5

MAX4466 (optional)  ESP32-C3
──────────────────  ────────
VCC  ─────────────► 3.3V
GND  ─────────────► GND
OUT  ─────────────► GPIO0
```

---

## Credits

Inspired by [CREATURE STARBOY](https://lilguy.net) by Daniel Kuntz.
DIY build by [@nadellasripad11](https://github.com/nadellasripad11) / SRIPADBUILDS.
