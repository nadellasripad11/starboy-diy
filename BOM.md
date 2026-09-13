# Bill of Materials — STARBOY DIY

Every part needed to build one unit, with exact buy links and prices as checked **2026-09-13**.
Prices exclude shipping/tax and will drift over time — re-check before ordering.

**Budget: $120.00 available**
**Total below: ~$45.94** — leaves ~$74 of headroom (spare display, backup battery, extra filament, etc.)

---

## Electronics

| # | Part | Qty | Unit price | Line total | Buy link | Notes |
|---|------|-----|-----------|-----------|----------|-------|
| 1 | Seeed Studio XIAO ESP32C3 | 1 | $6.45 | $6.45 | [AliExpress](https://www.aliexpress.com/item/1005004723068527.html) | Select the **"1pc"** variant. Must be genuine Seeed XIAO — built-in LiPo charger, the cheaper "SuperMini" has none |
| 2 | GC9A01 1.28" round TFT, 240×240 SPI | 1 | $2.92 | $2.92 | [AliExpress](https://www.aliexpress.com/item/1005004360047964.html) | Confirmed **round PCB** (diameter 37.5mm) — the shell pocket is stepped for this exact size |
| 3 | GY-521 MPU6050 accel/gyro | 1 | $1.14 | $1.14 | [AliExpress](https://www.aliexpress.com/item/32340949017.html) | Ships with header pins pre-soldered — desolder or clip them flush before assembly |
| 4 | MAX4466 electret mic amp | 1 | $0.79 | $0.79 | [AliExpress](https://www.aliexpress.com/item/32786459312.html) | Adjustable gain via on-board trim pot |
| 5 | DS18B20 waterproof probe + adapter (100cm) | 1 | $1.09 | $1.09 | [AliExpress](https://www.aliexpress.com/item/32839776524.html) | ⚠️ Does **not** include the pull-up resistor — that's line 6 |
| 6 | 1/4W resistor kit, 30 values incl. 4.7kΩ (600pcs) | 1 | $2.86 | $2.86 | [AliExpress](https://www.aliexpress.com/item/32636020144.html) | Only need one 4.7kΩ for the DS18B20 pull-up — rest are spares for future projects |
| 7 | LiPo battery 402530, 3.7V 300mAh | 1 | $3.75 | $3.75 | [AliExpress](https://www.aliexpress.com/item/32798545712.html) | ⚠️ Confirm the listing states **"protection circuit"/"PCM"** before ordering — required, not optional |
| | | | **Electronics subtotal** | **$19.00** | | |

## Build supplies

| # | Item | Qty | Unit price | Line total | Buy link | Notes |
|---|------|-----|-----------|-----------|----------|-------|
| 8 | Mini carabiner clips, aluminum D-ring (20-pack) | 1 | $1.09 | $1.09 | [AliExpress](https://www.aliexpress.us/item/3256805821292670.html) | Clip one to a belt loop/pants — 19 spares |
| 9 | Stainless split key rings, 25mm (10-pack) | 1 | $1.21 | $1.21 | [AliExpress](https://www.aliexpress.com/item/32836106718.html) | For the keychain loop on the shell |
| 10 | 30AWG silicone hook-up wire kit, 6 colours | 1 | $12.05 | $12.05 | [AliExpress](https://www.aliexpress.com/item/32822222596.html) | CBAZY brand — same as the Amazon version, cheaper here |
| 11 | Rust-Oleum Mirror Effect spray paint, silver, 6oz | 1 | $12.59 | $12.59 | [Amazon](https://www.amazon.com/Rust-Oleum-267727-Specialty-Mirror-6-Ounce/dp/B00FMRXJW2) | Sourced from Amazon, not AliExpress — aerosols ship poorly/slowly from China and this is a US-made can |
| | | | **Supplies subtotal** | **$26.94** | | |

---

## Grand total: $45.94

Plus, not itemized here (already on hand or negligible cost):
- PLA or PETG filament for the 3D-printed shell (~65 × 64mm, 20.5mm thick — a small fraction of a standard spool)
- USB-C cable for charging/programming
- Soldering iron, solder, wire strippers, multimeter

---

## Fit-critical substitution rules

Don't swap these without re-checking `hardware/starboy_star.scad`:

- **#2 Display** must be a round-PCB module (diameter 37.5mm). A rectangular-PCB GC9A01 board (common on generic listings) will not fit the stepped pocket.
- **#1 MCU** must be the genuine Seeed XIAO. Cheaper ESP32-C3 "SuperMini" clones have no battery charger circuit.
- **#7 Battery** must be ≤4.0mm thick with a protection circuit (PCM). The shell cavity has 0.5mm of clearance to spare — no more.
- **#3 / #5 Headers**: leave pins off (or remove them) on the MPU6050 and DS18B20 adapter, and wire flat — populated headers break the stack height budget.

See [README.md](README.md) for the full wiring diagram and firmware setup.
