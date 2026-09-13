# Bill of Materials — STARBOY DIY

Every part needed to build one unit, with exact buy links and prices verified **2026-09-13**.
Prices exclude shipping/tax and will drift over time — re-check before ordering.
All links open the exact product page, not a search page.

**Budget: $120.00 available**
**Total below: ~$43.37** — leaves ~$77 of headroom

---

## Electronics

| # | Part | Qty | Unit price | Line total | Buy link | Notes |
|---|------|-----|-----------|-----------|----------|-------|
| 1 | Seeed Studio XIAO ESP32C3 | 1 | $6.45 | $6.45 | [AliExpress](https://www.aliexpress.us/item/3256804536753775.html) | Select **"1pc"** variant. Must be genuine Seeed XIAO — has a built-in LiPo charger. Cheaper "SuperMini" clones have none |
| 2 | GC9A01 1.28" round TFT, 240×240 SPI | 1 | $1.09 | $1.09 | [AliExpress](https://www.aliexpress.us/item/3256804173733212.html) | Confirmed **round PCB** (diameter 37.5mm) — the shell pocket is stepped for this exact size |
| 3 | GY-521 MPU6050 accel/gyro | 1 | $2.68 | $2.68 | [AliExpress](https://www.aliexpress.us/item/2251832154634265.html) | Ships with header pins pre-soldered — desolder or clip them flush before assembly |
| 4 | GY-MAX4466 electret mic amp | 1 | $1.33 | $1.33 | [AliExpress](https://www.aliexpress.us/item/3256803608057399.html) | Adjustable gain via on-board trim pot |
| 5 | DS18B20 waterproof probe + adapter (100cm) | 1 | $0.77 | $0.77 | [AliExpress](https://www.aliexpress.us/item/3256801415671848.html) | Select "waterproof" colour variant. ⚠️ Does **not** include the pull-up resistor — that's line 6 |
| 6 | 1/4W metal film resistor kit, 30 values 10Ω–1MΩ (300pcs) | 1 | $1.09 | $1.09 | [AliExpress](https://www.aliexpress.us/item/2251832449705392.html) | Includes 4.7kΩ needed for DS18B20 pull-up. Select **"300pcs Kit no Box"** variant |
| 7 | LiPo battery 402530, 3.7V 300mAh (2-pack) | 1 | $8.99 | $8.99 | [Amazon](https://www.amazon.com/ZhanMazwj-Lithium-Polymer-Battery-Rechargeable/dp/B09QHTSPZC) | 4×25×30mm — fits the shell cavity. Keep the spare. Cut the JST plug, solder to XIAO's BAT+ / BAT− pads |
| | | | **Electronics subtotal** | **$22.40** | | |

## Build supplies

| # | Item | Qty | Unit price | Line total | Buy link | Notes |
|---|------|-----|-----------|-----------|----------|-------|
| 8 | Mini carabiner clips, aluminum D-ring (20-pack) | 1 | $1.09 | $1.09 | [AliExpress](https://www.aliexpress.us/item/3256805821292670.html) | Clip one to a belt loop/pants — 19 spares |
| 9 | Stainless steel split key rings, 25mm (20-pack) | 1 | $1.54 | $1.54 | [AliExpress](https://www.aliexpress.us/item/3256808292111279.html) | For the keychain loop on the shell. 4.4★, 106 sold |
| 10 | 30AWG silicone hook-up wire, 6 colours × 20m | 1 | $3.33 | $3.33 | [AliExpress](https://www.aliexpress.us/item/3256811467401195.html) | Select **"30AWG 6×20M"** option. Tinned copper, heat-resistant — ideal for tight wiring |
| 11 | Rust-Oleum Bright Coat Metallic Chrome spray, 11oz | 1 | $13.01 | $13.01 | [Amazon](https://www.amazon.com/Rust-Oleum-7718830-7718-830-Automotive-Accessories/dp/B000Z8DGXK) | **Chrome** finish — gives the shell its metallic look. Dries to touch in 60 min, works on plastic with primer |
| | | | **Supplies subtotal** | **$18.97** | | |

---

## Grand total: ~$41.37

Plus, not itemized (already on hand or negligible cost):
- PLA or PETG filament (~65 × 64mm body, 20.5mm thick — small fraction of a standard spool)
- USB-C cable for charging/programming
- Soldering iron, solder, wire strippers, multimeter

---

## Battery wiring note

The XIAO has **BAT+ / BAT−** solder pads on its underside, not a JST socket.
Cut the battery's plug off and solder the bare wires directly. **Check polarity with a multimeter first** — cheap LiPo leads don't always match the colour convention.
The XIAO fast-charges at 380mA (~1.3× this battery's C rating); charge where you can see it and unplug if it gets warm.

---

## Fit-critical substitution rules

Don't swap these without re-checking `hardware/starboy_star.scad`:

- **#2 Display** must be a **round**-PCB module (diameter 37.5mm). Rectangular-PCB GC9A01 boards (common on generic listings) will not fit the stepped pocket.
- **#1 MCU** must be the genuine Seeed XIAO. Cheaper ESP32-C3 "SuperMini" clones have no battery charger circuit.
- **#7 Battery** must be ≤4.0mm thick. The shell cavity has 0.5mm of clearance to spare — no more.
- **#3 / #5 Headers**: remove or clip flush the pre-soldered pins on the MPU6050 and DS18B20 adapter before fitting — populated headers break the stack height budget.

See [README.md](README.md) for the full wiring diagram and firmware setup.
