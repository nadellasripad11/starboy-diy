# STARBOY DIY — Build Guide

Shell: **body ~65 × 64mm (78mm including the keyring loop), 20.5mm thick.**
Print `stl/starboy_front.stl`, `stl/starboy_back.stl`, and `stl/starboy_bezel.stl`.

Parts, prices and links: **[BOM.csv](BOM.csv)** · **[BOM.md](BOM.md)**

---

## ⚠️ Things that will bite you

**0. The display's "32.4mm" is the GLASS, not the board.** The PCB is
**Φ37.5mm**. Every listing quotes the glass size. The pocket is stepped to
hold the real board — but it also means **Adafruit #6178 will not fit**
(it's a 42.4 × 36.2mm rectangle). Buy a round-PCB module.

**1. The display's pin header.** GC9A01 modules ship with an 8-pin header
soldered to the back. That header sticks ~8mm into the cavity — straight
into the space the XIAO needs. **Desolder it and solder wires flat to the
pads instead.**

**2. The GY-521's headers.** With headers soldered it's ~11mm tall. The
depth budget assumes the board without them (~3.0mm). Leave them off.

**3. Battery thickness is a hard ceiling.** The depth budget is 12.0mm. The
EEMB 402535 in the BOM is 4.3mm thick, which brings the stack to 11.8mm and
leaves just 0.2mm of slack (the CAD was first sized for a 4.0mm cell). Its
36 × 25.5mm footprint fits the cavity rotated 90°. Measure the battery and
the GY-521 before closing up; if they're thicker than listed, the shell's
depth will need adjusting.

**4. Battery wiring.** The XIAO has BAT+ / BAT− **solder pads** on its
underside, not a plug. Cut the battery's JST plug off and solder the wires.
**Check polarity with a multimeter** — cheap leads don't follow one colour
standard, and reversing it can destroy the board.

**5. Charge rate.** The XIAO fast-charges at 380mA — about 1.2× the 320mAh
battery's capacity, above the usual 1C limit. Charge it where you can see
it and unplug it if it gets warm.

---

## Verified fit

Depth is the tight axis. These numbers are asserted at build time in the
SCAD file, so they cannot silently drift:

```
body 20.5  −  display pocket 5.5  −  back wall 3.0    =  12.0mm available
XIAO 4.5   +  GY-521 ~3.0  +  battery 4.0             =  11.5mm used
                                                         0.5mm slack
```

The XIAO's 4.5mm is its height over the USB-C socket. The GY-521's ~3.0mm is
an estimate — nobody publishes it. **Measure both before the final print.**

Width, at the centre (bounded by the valleys):

```
usable central circle          = 41.6mm
battery diagonal (30×25)       = 39.1mm   fits
display PCB                    = 37.5mm   fits (38.6mm ledge)
```

**0.5mm of slack is not much. Dry-fit everything before gluing.**

---

## Feature placement

Front facing you, keyring to the right (0°):

| Angle | Feature | Size |
|-------|---------|------|
| 0° | Keyring bail | 7.6mm hole |
| 72° | Camera pocket (optional) | 8mm |
| 144° | DS18B20 vent | 4mm, through |
| 180° valley | USB-C charging cutout | 12.5 × 7.0mm |
| 288° | Mic sound port | 2.5mm, through |

The charging cutout is sized for a cable's **plastic grip**, not just the
metal plug — with a tight hole, the grip hits the wall before the plug seats.

The temp vent and mic port are **through-holes on purpose**. The DS18B20
must see outside air — sealed inside it just reads the board's own waste
heat and the cold/shiver behaviour never fires. Seat the sensor body in
the hole; that plugs it.

---

## Printing

- **Front half:** outer face **down** on the bed. Add a small support
  (build plate only) under the keyring loop — it overhangs 2–4mm off the
  bed. Nothing else needs support.
- **Back half:** flat mating side **down**, engraving facing up. Supports
  (build plate only; tree supports come out easiest) inside the hollow —
  its roof is an unsupported span. Don't print it face-down: the 36mm
  medallion dish would print as a sagging bridge and wreck the text.
- **Bezel ring:** flat, no supports. It glues **on top of** the front face
  around the opening.
- **Layer height:** 0.16mm or finer — the back engraving is only 0.5mm deep.
- **Walls:** 3+ perimeters. The shell is load-bearing at the bail.
- **Material:** PETG. The bail takes the keyring load every day, and PETG
  handles that (and a hot car) far better than PLA. White for everything,
  since it all gets chromed.
- **Do not scale.** Every clearance here is absolute.

### Finishing
Sand 400 → 800 → 1500, Rust-Oleum plastic primer, then Rust-Oleum Bright
Coat chrome on the **outside only**. Keep paint off the flat faces where the two halves meet —
paint thickness there will stop them seating. Polish with 0000 steel wool.

---

## Assembly order

1. Dry-fit the whole stack first. Confirm the halves close before any glue.
2. Leave the headers off the display and GY-521; wire them flat.
3. Drop the display into the front half **from the inside** — the board
   (Φ37.5mm) is wider than the 33.5mm face opening, so it seats against the
   lip from behind. Then glue the bezel ring onto the outside of the face.
4. XIAO behind the display, pushed toward the 180° valley so its USB-C sits
   **flush against the inside of the wall**. Plug a cable in and make sure it
   seats fully before gluing.
5. GY-521 flat behind the XIAO — keep it parallel to the star's face, since
   shake and tilt depend on its orientation.
6. DS18B20 into the 144° vent, mic into the 288° port.
7. Battery last, at the back: solder to the XIAO's BAT+ / BAT− pads,
   polarity checked.
8. Flash and test **before** closing the shell.
