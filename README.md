# ⭐ STARBOY DIY

A handbuilt replica of the [CREATURE STARBOY](https://lilguy.net) — a 5-point metallic star keychain with an animated round TFT eye that reacts to motion, temperature, and sound. Built around a **Seeed XIAO ESP32C3** (built-in LiPo charger) and a **1.28" GC9A01 round TFT display**.

**v2.0 firmware:** seed-generated eyes (every unit picks its own), 50 base expressions blended smoothly into 500+ animation states, plus 20 rare special effects. Renders at ~30fps via TFT_eSPI sprites (zero flicker).

---

## Buying list

Prices checked **2026-09-13** from AliExpress — they move, and shipping/tax aren't included.
Shipping to the US is free on most of these; expect 2–4 weeks from China.

> **Pants clip:** The carabiner listing below ships 20 pcs — keep one on your pants and stash the rest.

### Electronics

| Part | Price | Buy from | Notes |
|------|-------|----------|-------|
| Seeed XIAO ESP32C3 | ~$5.36 | [AliExpress search](https://www.aliexpress.com/w/wholesale-seeed-xiao-esp32c3.html) | **Must be the Seeed XIAO** — built-in LiPo charger. The cheaper SuperMini has none. 21 × 17.8mm |
| 1.28" Round TFT LCD (GC9A01, 240×240) | ~$2.92 | [AliExpress search](https://www.aliexpress.com/w/wholesale-gc9a01-1.28-round-tft-display.html) | Must be a **round PCB** (diameter 37.5mm). Listings labelled "1.28 round LCD SPI GC9A01" |
| GY-521 MPU6050 accelerometer/gyro | ~$1.29 | [AliExpress search](https://www.aliexpress.com/w/wholesale-gy-521-mpu6050.html) | Comes with pins pre-soldered — **leave them off** when you order or remove them before assembly |
| MAX4466 microphone amp module | ~$0.87 | [AliExpress search](https://www.aliexpress.com/w/wholesale-max4466-microphone-amplifier-module.html) | Adjustable gain via on-board pot |
| DS18B20 waterproof probe + adapter module | ~$1.09 | [AliExpress search](https://www.aliexpress.com/w/wholesale-ds18b20-waterproof-probe-adapter-module.html) | Get the one that says "100cm + adapter module". ⚠️ **AliExpress does NOT include the 4.7kΩ resistor** — order it separately |
| 4.7kΩ resistor (100pcs kit) | ~$0.50 | [AliExpress search](https://www.aliexpress.com/w/wholesale-4.7k-ohm-resistor-kit.html) | Pull-up for DS18B20 data line |
| LiPo 402530 3.7V 300mAh | ~$3.75 | [AliExpress](https://www.aliexpress.com/item/32798545712.html) | 4 × 25 × 30mm. **Verify listing says "protection circuit" or "PCM"** before buying |
| **Electronics subtotal** | **~$15.78** | | |

### Build supplies

| Item | Price | Buy from |
|------|-------|----------|
| Mini carabiner clips, 20-pack (aluminum D-ring) | ~$1.09 | [AliExpress](https://www.aliexpress.us/item/3256805821292670.html) — clip one to a belt loop, save the rest |
| Stainless split key rings, 25mm | ~$1.00 | [AliExpress search](https://www.aliexpress.com/w/wholesale-25mm-stainless-key-ring-split.html) |
| Chrome/silver spray paint | ~$8–12 | Local hardware store (Rust-Oleum Mirror Effect or similar) — hard to beat locally vs AliExpress shipping on aerosols |
| 30AWG silicone wire kit (6 colours) | ~$3.50 | [AliExpress search](https://www.aliexpress.com/w/wholesale-30awg-silicone-wire-kit-6-color.html) |
| **Supplies subtotal** | **~$14–18** | |

**Total: ~$30–34** plus shipping. You'll also need PLA or PETG filament and a USB-C cable.

### Don't swap these without re-checking the fit

- **Display** must be a round-PCB module. **Adafruit #6178 won't fit** — same chip, but it's a 42.4 × 36.2mm rectangle.
- **ESP32 board:** the ESP32-C3 SuperMini is cheaper but has **no battery charger**.
- **Battery:** 4.0mm thick maximum, and it must have a protection circuit. The shell only has 0.5mm of depth to spare.
- **Headers:** leave the pins off the display and the GY-521 and wire them flat, or the stack won't fit.

### Battery notes

- The battery comes with a JST 1.25 plug, but the XIAO has **solder pads** (BAT+ / BAT− on its underside). Cut the plug off and solder the wires. **Check polarity with a multimeter first** — cheap JST leads don't all use the same wire colours.
- The XIAO fast-charges at 380mA, about 1.3× this battery's capacity. Most LiPos tolerate that, but it's above the usual 1C limit, so charge it where you can see it and unplug it if it gets warm.
- Expect roughly 4 hours of active use per charge. The backlight dims when it falls asleep to stretch that.
- The XIAO ships with a Wi-Fi antenna. The firmware doesn't use the radio, so you can leave it off.

---

## Printing it

Ready-to-slice STLs are in [`stl/`](stl/): `starboy_front.stl`,
`starboy_back.stl` and `starboy_bezel.stl`. Orientation matters and both
halves need a little support — see the Printing section of [BUILD.md](BUILD.md).

Body is **~65 × 64mm (78mm including the keyring loop), 20.5mm thick**.

---

## Eye Behaviors

Modeled after the real CREATURE Starboy's documented behaviors:

| Trigger | What happens |
|---------|-------------|
| Shake device hard (1s+) | **Dizzy** spinning eyes → severe dizzy → recovering → **angry** rage |
| Temp drops below 10°C | **Chill → shiver → freeze** — progressively icier, blue tint, crystalline overlay |
| Loud sound | **Startled → anxious** darting eyes → overwhelmed |
| Tilt device | Eyes **follow gravity** naturally |
| 25 seconds idle | Eyes **start dozing** — half-closed, brows droop, backlight dims |
| 75 seconds idle | Eyes **sleep** — slow breathing, occasional dreaming, backlight nearly off |
| Shake or sound during sleep | **Wakes up** |
| Just sitting there | 50 idle micro-expressions cycle every 2.5–7s: content, curious, playful, wondering, shifty, cheerful... |
| Every ~90s (40% chance) | One of **20 rare specials**: rainbow eyes, hearts, stars, glitch, matrix rain, hypnotic spiral, "dead" eyes, fire pupils, galaxy swirl, and more |

Every unit's eye is unique — its colours and style are generated from a random seed on first boot and stored permanently.

---

## 3D Shell

`hardware/starboy_star.scad` — parametric OpenSCAD model of the star shell.

- Flat-faced star with chamfered edges, sized from the measured parts
- Stepped display pocket (narrow opening at the face, wider ledge that holds the board)
- Keyring loop, camera pocket (optional), temperature vent, mic port, USB-C charge cutout
- Back medallion with rim text and a centre star
- `assert()` checks that fail the build if a change would break the fit
- Parts: `front`, `back`, `bezel`, `preview`

**Finish:** Sand smooth → prime → Rust-Oleum Mirror Effect spray. Polish with 0000 steel wool for a metallic sheen.

---

## Firmware

`firmware/starboy_firmware/starboy_firmware.ino`

Arduino IDE setup:
- Board: **XIAO_ESP32C3** (Espressif ESP32 boards package)
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
GC9A01 TFT          XIAO ESP32C3
──────────          ────────────
VCC  ─────────────► 3V3
GND  ─────────────► GND
SCL  ─────────────► D8  (GPIO8)
SDA  ─────────────► D10 (GPIO10)
DC   ─────────────► D6  (GPIO21)
CS   ─────────────► D3  (GPIO5)
RST  ─────────────► 3V3
BL   ─────────────► D2  (GPIO4)   PWM — not 3.3V

MPU6050 (GY-521)    XIAO ESP32C3
────────────────    ────────────
VCC  ─────────────► 3V3
GND  ─────────────► GND
SDA  ─────────────► D4  (GPIO6)
SCL  ─────────────► D5  (GPIO7)

DS18B20             XIAO ESP32C3
───────             ────────────
VDD  ─────────────► 3V3
GND  ─────────────► GND
DATA ─────────────► D7  (GPIO20)   + 4.7kΩ from DATA to VDD

MAX4466             XIAO ESP32C3
───────             ────────────
VCC  ─────────────► 3V3
GND  ─────────────► GND
OUT  ─────────────► D1  (GPIO3)

LiPo 402530         XIAO ESP32C3
───────────         ────────────
+    ─────────────► BAT+ pad (underside)
−    ─────────────► BAT− pad (underside)
```

---

## Credits

Inspired by [CREATURE STARBOY](https://lilguy.net) by Daniel Kuntz.
DIY build by [@nadellasripad11](https://github.com/nadellasripad11) / SRIPADBUILDS.
