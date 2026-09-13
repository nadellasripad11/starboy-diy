# STARBOY DIY — Build & Buy Guide

Shell: **70mm point-to-point, 18mm thick.** Print `stl/starboy_front.stl`,
`stl/starboy_back.stl`, and `stl/starboy_bezel.stl`.

---

## Buy list — read the warnings, the variant matters

Every dimension below was used to size the shell. Buying a different
variant of the same part is the most likely way this goes wrong.

| Part | Spec to buy | ~Cost |
|------|-------------|-------|
| ESP32-C3 SuperMini | 22.5 × 18.0 × 3.2mm | $3 |
| GC9A01 1.28" round TFT | 240×240, **32.4mm** dia module | $4 |
| MPU6050 | GY-521 breakout | $2 |
| DS18B20 | **TO-92 through-hole**, not the probe | $1.50 |
| MAX4466 mic | electret + amp breakout | $2 |
| LiPo battery | 3.7V, **max 30 × 20 × 4.0mm** (e.g. 402030, 300mAh) | $4 |
| 4.7kΩ resistor | DS18B20 pull-up | ~$0 |
| Keyring / carabiner | fits a 7.6mm hole | $5/pack |

### ⚠️ Four things that will bite you

**1. The display's pin header.** GC9A01 modules ship with a 7-pin header
soldered to the back. That header sticks ~8mm into the cavity — straight
into the space the ESP32 needs, and it is *not* in the 4.8mm figure above.
**Desolder it and solder wires flat to the pads instead.** If you'd rather
not, you'll need to cut a relief pocket and the stack won't fit as designed.

**2. The MPU6050's headers.** A GY-521 with headers soldered is ~11mm tall.
The depth budget assumes the **bare 1.6mm board**. Desolder the headers, or
buy one with none fitted.

**3. Battery thickness is a hard ceiling.** 4.0mm max. A 5mm cell does not
fit — there is only 0.7mm of slack in the whole stack. Check the spec sheet,
not the listing photo.

**4. Charging depends on your specific SuperMini.** The USB-C cutout exposes
the board's own port. *Most* SuperMini boards carry a single-cell LiPo
charger plus battery pads — **but not all of them do.** Check yours before
you rely on it. If it has no charge IC, add a TP4056 module behind the same
cutout.

---

## Verified fit

Depth is the tight axis. These numbers are asserted at build time in the
SCAD file, so they cannot silently drift:

```
body 18.0  −  display pocket 5.5  −  back wall 3.0   =  9.5mm available
ESP32 3.2  +  MPU6050 1.6  +  battery 4.0            =  8.8mm used
                                                        0.7mm slack
```

Width, at the centre (bounded by the valleys):

```
usable central circle          = 39.6mm
battery diagonal (30×20)       = 36.1mm   fits
ESP32 diagonal (22.5×18)       = 28.8mm   fits
display module                 = 32.4mm   fits (33.5mm pocket)
```

**0.7mm of slack is not much. Dry-fit everything before gluing.**

---

## Feature placement

Front facing you, keyring to the right (0°):

| Angle | Feature | Size |
|-------|---------|------|
| 0° | Keyring bail | 7.6mm hole |
| 72° | Camera pocket (optional) | 8mm |
| 144° | DS18B20 vent | 4mm, through |
| 180° valley | USB-C charging cutout | 9.8 × 3.8mm |
| 288° | Mic sound port | 2.5mm, through |

The temp vent and mic port are **through-holes on purpose**. The DS18B20
must see outside air — sealed inside it just reads the board's own waste
heat and the cold/shiver behaviour never fires. Seat the sensor body in
the hole; that plugs it.

---

## Printing

- **Orientation:** each half flat-side-down on the bed. That puts the
  cavity opening upward, so no supports are needed.
- **Layer height:** 0.16mm or finer — the back engraving is only 0.5mm deep.
- **Walls:** 3+ perimeters. The shell is load-bearing at the bail.
- **Material:** PLA is fine for the shell. The bail takes the keyring load,
  so PETG is the safer call if you'll carry it daily.
- **Do not scale.** Every clearance here is absolute.

### Finishing
Sand 400 → 800 → 1500, prime, then Rust-Oleum Mirror Effect on the
**outside only**. Mask the mating lip — paint thickness there will stop the
halves seating. Polish with 0000 steel wool.

---

## Assembly order

1. Dry-fit the whole stack first. Confirm the lid closes before any glue.
2. Desolder display + MPU headers, wire flat.
3. Seat display in the front pocket, bezel ring over it.
4. ESP32 behind the display, **USB-C aligned to the 180° cutout.**
5. MPU6050 flat behind the ESP32 — orientation matters for shake/tilt;
   keep it parallel to the star's face.
6. DS18B20 into the 144° vent, mic into the 288° port.
7. Battery last, at the back.
8. Flash and test **before** closing the shell.
