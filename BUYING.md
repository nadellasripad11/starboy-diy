# STARBOY DIY — Buying List

Total: **~$35–45** depending on where you source. Every dimension here was
used to size the shell — buying a different variant of the same part is the
most likely way this goes wrong.

---

## The display — read this first

**Buy a ROUND-PCB GC9A01 module. Not Adafruit's.**

The "32.4mm" figure quoted in every listing is the **display glass**, not the
board. The actual PCB is **Φ37.5mm**. Sizing a pocket to 32.4mm does not fit —
that mistake was in this design until it got caught against Waveshare's spec
sheet, and the pocket is now stepped to hold the real board.

| | |
|---|---|
| **Buy** | Waveshare 1.28" Round LCD Module, 240×240, GC9A01 |
| **Link** | https://www.waveshare.com/1.28inch-lcd-module.htm |
| **Spec** | Φ37.5mm round PCB, Φ32.4mm glass, SPI |
| **~$** | $16 direct, ~$13 generic equivalent |

⚠️ **Do NOT buy [Adafruit #6178](https://www.adafruit.com/product/6178).** It's
the same GC9A01 driver and it's a nicer board, but it's a **42.4 × 36.2mm
rectangle** — it physically will not fit the round pocket. $17.50 wasted.

Generic AliExpress/Amazon "GC9A01 1.28 inch round display module" boards are
the same Φ37.5mm layout and work fine — just confirm the listing shows a
**round** PCB with a small tab at the bottom for the 8-pin header.

---

## Verified, good-quality sources

These two I'd buy from Adafruit — small parts, correct dimensions, real
documentation, and they won't arrive as counterfeits.

| Part | Link | Price | Note |
|------|------|-------|------|
| MAX4466 mic amp | [adafruit.com/product/1063](https://www.adafruit.com/product/1063) | $6.95 | Adjustable gain |
| DS18B20 + 4.7kΩ | [adafruit.com/product/374](https://www.adafruit.com/product/374) | $3.95 | **TO-92, pull-up resistor included** |

For the DS18B20, that product is the bare TO-92 and **includes the 4.7kΩ
pull-up** you need — don't buy the waterproof probe versions (#381, #642),
they're bulky and won't seat in the 4mm vent.

---

## Generic modules — cheaper, and what the shell is sized for

No single "trusted" vendor here; these are commodity boards. Amazon is
returnable, AliExpress is cheaper but slow. Search the exact terms:

| Part | Search term | Must match | ~$ |
|------|-------------|-----------|-----|
| ESP32-C3 SuperMini | "ESP32-C3 SuperMini" | 22.5 × 18.0 × 3.2mm | $3–6 |
| MPU6050 | "GY-521 MPU6050" | 21.2 × 16.4mm, **headers not soldered** | $2–4 |
| LiPo battery | "402030 LiPo 3.7V" | **max 30 × 20 × 4.0mm**, with protection PCB | $6–9 |

---

## ⚠️ Five things that will ruin the fit

**1. The display's pin header.** Modules ship with an 8-pin header on the
back that sticks ~8mm into the cavity — right where the ESP32 goes, and not
counted in the 5.4mm thickness. **Desolder it and solder wires flat.**

**2. MPU6050 headers.** A GY-521 with headers soldered is ~11mm tall. The
budget assumes the **bare 1.6mm board**. Desolder, or buy without.

**3. Battery thickness is a hard ceiling — 4.0mm.** There's 0.7mm of slack in
the entire stack. Adafruit's thinnest LiPos are 5–6mm and **will not fit**,
which is why they aren't recommended above. A 402030 cell is the right size.
**Buy one with a protection circuit** — it sits in your pocket, and cheap
unprotected cells are a genuine fire risk.

**4. Charging isn't guaranteed.** The USB-C cutout exposes the SuperMini's own
port. *Most* SuperMini boards carry a LiPo charge IC plus battery pads — **but
not all do.** Check your board's listing before relying on it. If it has none,
add a TP4056 module behind the same cutout.

**5. Don't scale the STL.** Every clearance is absolute.

---

## Also need

| Item | Note |
|------|------|
| Keyring / carabiner | Fits a 7.6mm hole |
| PLA or PETG filament | PETG for the bail if you'll carry it daily |
| Chrome spray | Rust-Oleum Mirror Effect, outside only |
| Thin silicone wire | 30AWG, for flat-soldering the display |

---

## Honest cost note

The original "~$12 total" figure was optimistic — it assumed the cheapest
AliExpress parts across the board. Realistically **$35–45** for good-quality
parts with a safe battery. You can get closer to $20 sourcing everything
from AliExpress and waiting a few weeks.
