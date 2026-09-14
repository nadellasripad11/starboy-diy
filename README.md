# starboy diy

my handbuilt version of the [creature starboy](https://lilguy.net): a chrome 5-point star keychain with a round animated eye that reacts to how you move it, how cold it is, and how loud it gets around you. the eye looks different on every unit. built by sripadbuilds.

i made it because i wanted a starboy and wanted to know how one actually works inside. so i designed the shell from scratch in openscad, picked the smallest parts that could fit, and wrote the eye animation firmware myself.

<p align="center">
  <img src="images/render_front.png" width="48%" alt="front of the star shell with the round display opening and keyring bail">
  <img src="images/render_back.png" width="48%" alt="back of the star shell with the engraved sripadbuilds medallion">
</p>

**what's inside:** seeed XIAO ESP32C3, 1.28" round TFT (GC9A01), mpu6050, ds18b20, max4466 mic, 320mAh lipo. charges over usb-c and clips to your pants.

---

## what the eye does

| if you... | the eye... |
|-----------|-----------|
| shake it hard for 1s+ | goes dizzy → rage → calms down |
| drop below 10°c | chills → shivers → freezes, blue tint |
| make a loud sound | startles → gets anxious, darting eyes |
| tilt it | follows gravity |
| leave it alone for 25s | starts dozing, backlight dims |
| leave it alone for 75s | falls asleep, slow breathing, almost off |
| shake it or make noise while it's asleep | wakes up |
| just let it sit there | 50 different micro-expressions, cycling every few seconds |
| wait around (~every 90s, 40% chance) | one of 20 rare effects: rainbow, hearts, glitch, matrix rain, hypnotic spiral, fire pupils, galaxy swirl... |

on first boot every unit generates its own eye color, pupil color and highlight style, then keeps them forever. no two are the same.

---

## what's in this repo

| folder / file | what it is |
|---------------|-----------|
| [`CAD/starboy_assembly.step`](CAD/starboy_assembly.step) | full 3d assembly: front, back, bezel |
| [`CAD/starboy_star.scad`](CAD/starboy_star.scad) | parametric openscad source the step and stls come from |
| [`stl/`](stl/) | print-ready front, back and bezel |
| [`firmware/starboy_firmware/`](firmware/starboy_firmware/) | arduino firmware, TFT_eSPI config, pin-by-pin wiring |
| [`BOM.csv`](BOM.csv) | parts list with prices and buy links |
| [`BOM.md`](BOM.md) | same list, readable, plus the second-build list |
| [`BUILD.md`](BUILD.md) | printing, finishing and assembly order |

there's no custom PCB. everything is hand-wired to the XIAO with 30AWG wire so it all packs into a 20.5mm-thick shell.

---

## parts & cost

**$96.86 for one build**, all from amazon. full list → [BOM.csv](BOM.csv)

the display, mpu6050, mic, temp sensor, wire, carabiners and paint come in multi-packs, so a second star only costs **$53.62** more (another XIAO, another battery, and white + black PETG). that list is in [BOM.md](BOM.md#build-2).

---

## wiring

![wiring diagram](images/wiring.svg)

full pin-by-pin breakdown → [`firmware/starboy_firmware/WIRING.md`](firmware/starboy_firmware/WIRING.md)

---

## 3d printing

print the three stls in [`stl/`](stl/) in PETG: white for the shell, black for the bezel ring. the body is about **65×64mm and 20.5mm thick** (78mm with the keyring loop). print orientation and supports are in [BUILD.md](BUILD.md).

**finish:** sand 400 → 800 → 1500, plastic primer, bright coat chrome, then buff with 0000 steel wool.

---

## firmware setup

open `firmware/starboy_firmware/starboy_firmware.ino` in the arduino IDE.

board settings:
- board: **XIAO_ESP32C3** (espressif ESP32 package)
- usb cdc on boot: **enabled**

libraries (library manager):
- **TFT_eSPI** by bodmer. copy [`User_Setup.h`](firmware/starboy_firmware/User_Setup.h) into the TFT_eSPI library folder after installing, replacing the default one
- adafruit MPU6050
- adafruit unified sensor
- DallasTemperature
- OneWire

---

## battery

the XIAO has BAT+ / BAT− solder pads on its underside instead of a plug, so the battery's connector gets cut off and the wires solder straight to the pads. polarity gets checked with a multimeter first, since cheap lipo wire colors don't always follow the convention.

a charge lasts about 4 hours, and the backlight dims on its own when the eye goes idle.

---

made by [@nadellasripad11](https://github.com/nadellasripad11) · sripadbuilds · inspired by [creature](https://lilguy.net) by daniel kuntz
