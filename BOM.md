# bill of materials

everything ships from amazon and arrives by september 15–18. prices checked 2026-09-13.

- **build 1:** $96.86 → [BOM.csv](BOM.csv) (hack club format)
- **build 2:** $53.62 extra, because the multi-packs from build 1 already cover most of it

---

## build 1

| part | qty | price | link | why |
|------|-----|-------|------|-----|
| seeed studio XIAO ESP32C3 | 1 | $9.90 | [amazon](https://www.amazon.com/dp/B0B94JZ2YF) | main board, has a lipo charger built in |
| GC9A01 1.28" round TFT (3-pack) | 1 | $17.99 | [amazon](https://www.amazon.com/dp/B0B7TFRNN1) | the eye. round 38mm PCB, 240×240 |
| GY-521 MPU6050 (3-pack) | 1 | $9.59 | [amazon](https://www.amazon.com/dp/B0B3D6D1KD) | shake + tilt |
| MAX4466 mic amp (6-pack) | 1 | $9.99 | [amazon](https://www.amazon.com/dp/B08N4FNFTR) | loud sound detection |
| DS18B20 TO-92 + 4.7kΩ resistors (10-pack) | 1 | $6.99 | [amazon](https://www.amazon.com/dp/B0BTH1DRVJ) | cold detection, pull-up resistors included |
| EEMB 402535 3.7V 320mAh lipo | 1 | $9.99 | [amazon](https://www.amazon.com/dp/B08215N9R8) | 25.5×36×4.3mm, UL certified, protection circuit |
| 30AWG silicone wire, 6 colors × 10m | 1 | $13.99 | [amazon](https://www.amazon.com/dp/B073RDGTPB) | thin + flexible for a tight shell |
| mini carabiners + key rings (10 + 10) | 1 | $4.98 | [amazon](https://www.amazon.com/dp/B095NBHTTH) | keyring and pants clip |
| rust-oleum plastic primer 12oz | 1 | $6.97 | [amazon](https://www.amazon.com/dp/B003CT498U) | lets the chrome stick to the print |
| rust-oleum bright coat chrome 11oz | 1 | $6.47 | [amazon](https://www.amazon.com/dp/B000Z8DGXK) | chrome finish |
| | | **$96.86** | | |

## build 2

| part | qty | price | link |
|------|-----|-------|------|
| seeed studio XIAO ESP32C3 | 1 | $9.90 | [amazon](https://www.amazon.com/dp/B0B94JZ2YF) |
| EEMB 402535 3.7V 320mAh lipo | 1 | $9.99 | [amazon](https://www.amazon.com/dp/B08215N9R8) |
| polymaker PETG 1.75mm 1kg, white | 1 | $17.99 | [amazon](https://www.amazon.com/dp/B0FG3FHG29) |
| polymaker PETG 1.75mm 1kg, black | 1 | $15.74 | [amazon](https://www.amazon.com/dp/B0FG3HMCVY) |
| | | **$53.62** | |

already covered by build 1's leftovers:

| part | left over after build 1 |
|------|-------------------------|
| round TFT | 2 |
| GY-521 | 2 |
| MAX4466 | 5 |
| DS18B20 + 4.7kΩ | 9 |
| 30AWG wire | ~59m, one star uses under 1m |
| carabiners + key rings | 9 each |
| primer + chrome | one 65mm star uses a small fraction of each can |

---

## how the parts work together

- everything runs on the XIAO's 3.3V rail. the display, MPU6050, MAX4466 and DS18B20 are all rated for 3.3V
- the XIAO charges the lipo over usb-c, so there's no separate charger board
- the battery's protection circuit handles over-charge, over-discharge and shorts
- the DS18B20 needs one 4.7kΩ pull-up on its data line, and the pack includes them
- the TO-92 DS18B20 is small enough to sit in the 4mm temperature vent. the steel waterproof probe version isn't
- 30AWG silicone wire is flexible enough to fold into the shell without stressing solder joints

tools not listed: soldering iron, solder, flush cutters, multimeter, usb-c cable, 3d printer.
