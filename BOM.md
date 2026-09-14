# bill of materials

everything i need to build **two** stars, all from amazon. prices checked 2026-09-13.

**total: $134.74** → [BOM.csv](BOM.csv)

| part | qty | price | link | what it's for |
|------|-----|-------|------|---------------|
| seeed studio xiao esp32c3 | 2 | $19.80 | [amazon](https://www.amazon.com/dp/B0B94JZ2YF) | main board with a built-in lipo charger, one per star |
| gc9a01 1.28" round tft (3-pack) | 1 | $17.99 | [amazon](https://www.amazon.com/dp/B0B7TFRNN1) | the eye, round 38mm pcb |
| gy-521 mpu6050 (3-pack) | 1 | $9.59 | [amazon](https://www.amazon.com/dp/B0B3D6D1KD) | shake + tilt |
| max4466 mic amp (6-pack) | 1 | $9.99 | [amazon](https://www.amazon.com/dp/B08N4FNFTR) | loud sound detection |
| ds18b20 to-92 + 4.7kΩ resistors (10-pack) | 1 | $6.99 | [amazon](https://www.amazon.com/dp/B0BTH1DRVJ) | cold detection, resistors included |
| eemb 402535 3.7v 320mah lipo | 2 | $19.98 | [amazon](https://www.amazon.com/dp/B08215N9R8) | 25.5×36×4.3mm with a protection circuit, one per star |
| 30awg silicone wire, 6 colors × 10m | 1 | $13.99 | [amazon](https://www.amazon.com/dp/B073RDGTPB) | thin flexible wire for inside the shell |
| mini carabiners + key rings (10 + 10) | 1 | $4.98 | [amazon](https://www.amazon.com/dp/B095NBHTTH) | keyring and pants clip |
| rust-oleum plastic primer 12oz | 1 | $6.97 | [amazon](https://www.amazon.com/dp/B003CT498U) | lets the chrome stick to the print |
| rust-oleum bright coat chrome 11oz | 1 | $6.47 | [amazon](https://www.amazon.com/dp/B000Z8DGXK) | chrome finish |
| polymaker petg 1.75mm 1kg, white | 1 | $17.99 | [amazon](https://www.amazon.com/dp/B0FG3FHG29) | star shells and bezel rings |
| | | **$134.74** | | |

only the xiao and the battery need to be bought twice. everything else comes in packs big enough for both stars.

---

## how the parts work together

- everything runs on the xiao's 3.3v rail, and the display, mpu6050, max4466 and ds18b20 are all rated for 3.3v
- the xiao charges the lipo over usb-c, so there's no separate charger board
- the battery's protection circuit handles over-charge, over-discharge and shorts
- the ds18b20 needs one 4.7kΩ pull-up on its data line, and the pack includes them
- the to-92 ds18b20 is small enough to sit in the 4mm temperature vent
- 30awg silicone wire folds into the shell without stressing the solder joints

tools not listed (already have them): soldering iron, solder, flush cutters, multimeter, usb-c cable, 3d printer.
