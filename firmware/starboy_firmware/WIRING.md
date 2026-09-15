# STARBOY DIY — Wiring, Libraries & Physical Build

## Shell dimensions (final, print-ready)

| | |
|---|---|
| Body | ~65 × 64 mm (78 mm including the keyring loop) |
| Thickness | 20.5 mm |
| Board | Seeed XIAO ESP32C3 (built-in LiPo charger) |
| Display | GC9A01 1.28" round, centred in the front face |
| Charging | XIAO's USB-C, through a cutout in the valley opposite the keyring |

The 20.5mm thickness is not arbitrary — it's driven by the component stack.
See the COMPONENT FIT table at the top of `CAD/starboy_star.scad`.

## Component placement

Looking at the **front** (display facing you), with the keyring at the right
(0°), features sit on the arms at these angles:

| Angle | Feature |
|-------|---------|
| 0° | Keyring bail |
| 72° | Camera lens pocket (8mm) — optional |
| 144° | DS18B20 temperature vent (4mm, through-hole) |
| 180° (valley) | USB-C charging cutout (12.5 × 7.0mm) |
| 288° | MAX4466 mic sound port (2.5mm, through-hole) |

**The temperature vent is a through-hole on purpose.** If you seal the
DS18B20 inside, it reads the board's own waste heat and the cold/shiver
behaviour never triggers. It has to see outside air.

## Internal stack (front to back)

```
front face
  ├─ GC9A01 display        5.4mm   (inserted from inside, against the lip)
  ├─ XIAO ESP32C3          4.5mm   (USB-C flush against the 180° wall)
  ├─ GY-521 (no headers)  ~3.0mm
  └─ EEMB 402535 320mAh    4.3mm   (36 × 25.5mm, lies rotated 90° in the cavity)
back face
```
Total 11.8mm into 12.0mm available — only 0.2mm slack. The CAD was first
sized for a 4.0mm 402530 cell; the 402535 in the BOM is 0.3mm thicker. Its
footprint was checked against the real star outline (1.0mm to spare), but
the depth is now very tight and the GY-521's ~3.0mm is an estimate. Measure
the battery and the GY-521 when they arrive and dry-fit before gluing.

## Charging

The XIAO ESP32C3 has a LiPo charger built in (380mA fast / 40mA trickle).
Plug USB-C into the cutout and it charges the battery on its BAT pads. No
extra charger module is needed.

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

Board: **ESP32 (by Espressif)** → pick **XIAO_ESP32C3**
Also set: **USB CDC On Boot → Enabled** (so Serial.print debug works)

---

## Wiring

Pins are written as the XIAO's silkscreen label, with the GPIO number the
firmware uses in brackets. D0 (GPIO2) and D9 (GPIO9) are left free on
purpose — they're boot-mode strapping pins.

### GC9A01 1.28" Round TFT (SPI)
| TFT Pin | XIAO ESP32C3 |
|---------|--------------|
| VCC     | 3V3          |
| GND     | GND          |
| SCL/SCK | D8 (GPIO8)   |
| SDA/MOSI| D10 (GPIO10) |
| DC      | D6 (GPIO21)  |
| CS      | D3 (GPIO5)   |
| RST     | 3V3 (tied high) |
| BL      | D2 (GPIO4) — PWM, firmware dims it when asleep; do NOT tie to 3.3V |

### MPU6050 / GY-521 (I2C)
| GY-521  | XIAO ESP32C3 |
|---------|--------------|
| VCC     | 3V3          |
| GND     | GND          |
| SDA     | D4 (GPIO6)   |
| SCL     | D5 (GPIO7)   |
| AD0     | GND (address 0x68) |

### DS18B20 (OneWire)
| DS18B20 | XIAO ESP32C3 |
|---------|--------------|
| VDD     | 3V3          |
| GND     | GND          |
| DATA    | D7 (GPIO20)  |
| (4.7kΩ resistor between DATA and VDD — comes in the DS18B20 pack) |

### MAX4466 Mic (analog)
| MAX4466 | XIAO ESP32C3 |
|---------|--------------|
| VCC     | 3V3          |
| GND     | GND          |
| OUT     | D1 (GPIO3)   |

### LiPo battery
| Battery | XIAO ESP32C3 |
|---------|--------------|
| +       | BAT+ pad (underside) |
| −       | BAT− pad (underside) |

Cut the JST plug off and solder. **Check polarity with a multimeter first.**

---

## What it does — full behavior list

**Sensor-driven states:**

| Trigger | Behavior |
|---------|----------|
| Shake 1s+ | Dizzy spinning eyes → severe dizzy → recovering → angry |
| Keep shaking hard | Full rage state (deep red squint + heavy furrow) |
| Temp < 10°C | Chill → shiver → freeze (progressively icier, blue tint, crystalline overlay) |
| Loud sound | Startled → anxious darting eyes → overwhelmed |
| Tip it more than 25° from how it's been resting | Eyes look downhill, then settle within a few seconds as he gets used to the new angle (so hanging on a belt loop doesn't keep him tilted or awake) |
| 25s no interaction | Doze — eyes half close, brows droop, backlight dims |
| 75s no interaction | Full sleep — slow breathing blink, occasional dream state, backlight nearly off |
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

**Eye design:** each unit rolls its eyes on first boot (seed stored in
flash): one of 100 colorways and one of 4 shapes (dot 10%, circle 40%,
cat 30%, acorn 20%). Colorways are weighted, so the rarest ones come up
about 0.4% of the time.

---

## Test the parts first

Before soldering everything into the shell, flash
[`firmware/hardware_test/hardware_test.ino`](../hardware_test/hardware_test.ino).
It flashes the screen red/green/blue/white, fades the backlight, then checks
the MPU6050, DS18B20 and mic one by one and prints PASS/FAIL on the screen
and over Serial (115200). After that it goes live: shake it and the SHAKE bar
moves, clap and the SOUND bar moves. Every FAIL line says which wire to check.

## Upload Settings (Arduino IDE)

- Board: XIAO_ESP32C3
- USB CDC On Boot: Enabled
- If an upload won't start: hold the **BOOT** button, tap **RESET**, release BOOT, then upload.

## Tuning

No reflashing needed. Open the Serial Monitor at 115200 with newline line
endings and type commands:

```
status                 sensors, current mood, eyes and every threshold
hw                     which parts are detected, with the wire to check for anything missing
demo                   a ~77s tour for filming: loud room, cold, shaken, four rare effects,
                       falling asleep and waking up. `demo stop` ends it early
debug on               print shake / temp / sound once a second
set shake 12           shake needed to get dizzy (m/s² above gravity, default 16)
set cold 8             °C that starts the shiver (default 10)
set loud 900           mic swing that makes him anxious (default 600, depends on the gain trimmer)
set doze 25            seconds alone before dozing (default 25)
set sleep 75           seconds alone before full sleep (default 75)
set rare 90            seconds between rare effect chances (default 90)
set tempoffset -3      correct the temperature reading (default 0). the sensor sits next to
                       the board and battery, so compare `status` with a real thermometer once
save                   keep the values after a restart
defaults               back to factory values

mood shiver            jump to any mood (help lists them all)
fx fire                play any rare effect
fake temp 2            pretend it's cold, fake sound 2000 pretends it's loud, fake off
reroll                 roll new eyes, seed 1a2b3c4d sets exact ones
```

A good tuning loop: `debug on`, leave the star still for a minute to see
the quiet mic level, then set `loud` a few hundred above it.
