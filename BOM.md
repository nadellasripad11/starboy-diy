# bill of materials

everything i need to build **two** stars, bought from the cheapest reliable place for each part. prices checked 2026-09-25.

**total: $87.63** in parts, down from $134.74 when everything came from amazon → [BOM.csv](BOM.csv)

| part | qty | price | where | what it's for |
|------|-----|-------|-------|---------------|
| seeed studio xiao esp32c3 | 2 | $9.98 | [seeed studio](https://www.seeedstudio.com/Seeed-XIAO-ESP32C3-p-5431.html) | main board with a built-in lipo charger, one per star |
| gc9a01 1.28" round tft | 2 | $8.96 | [aliexpress](https://www.aliexpress.us/item/3256808098235758.html) | the eye |
| gy-521 mpu6050 | 2 | $3.76 | [aliexpress](https://www.aliexpress.us/item/3256808332288788.html) | shake + tilt |
| max4466 mic amp | 2 | $3.48 | [aliexpress](https://www.aliexpress.us/item/3256805885526362.html) | loud sound detection (pick the max4466 option) |
| ds18b20 to-92 (umw) | 2 | $1.15 | [lcsc C376006](https://www.lcsc.com/product-detail/C376006.html) | cold detection |
| 4.7kΩ resistors (100) | 1 | $0.62 | [lcsc C120071](https://lcsc.com/product-detail/Carbon-Film-Resistors_4-7KR-472-5_C120071.html) | ds18b20 pull-up |
| eemb 402535 3.7v 320mah lipo | 2 | $19.98 | [amazon](https://www.amazon.com/dp/B08215N9R8) | 25.5×36×4.3mm with a protection circuit, one per star |
| 30awg silicone wire, 5 colors | 1 | $6.96 | [aliexpress](https://www.aliexpress.us/item/3256808281675998.html) | wiring inside the shell (pick 30awg) |
| spring carabiner keyrings (10) | 1 | $2.96 | [aliexpress](https://www.aliexpress.us/item/3256807751442375.html) | pants and bag clip |
| stainless split rings 25mm (10) | 1 | $1.53 | [aliexpress](https://www.aliexpress.us/item/3256805611374476.html) | through the keyring hole |
| rust-oleum plastic primer 12oz | 1 | $6.97 | [amazon](https://www.amazon.com/dp/B003CT498U) | lets the chrome stick to the print |
| rust-oleum bright coat chrome 11oz | 1 | $6.47 | [amazon](https://www.amazon.com/dp/B000Z8DGXK) | chrome finish |
| creality petg 1.75mm 1kg | 1 | $14.81 | [aliexpress](https://www.aliexpress.us/item/3256812523172305.html) | star shells and bezel rings |
| custom pcb | | tbd | jlcpcb | added once the board is designed |
| | | **$87.63** | | |

## what changed and why

- **aliexpress for the modules.** the display, mpu6050, mic amp, wire and keyrings cost a fraction of the amazon multi-packs. i went by listings with hundreds or thousands of sales and good ratings, not the cheapest one, and priced them at the normal price, not the one-time new-shopper deal.
- **seeed's own store for the xiao.** $4.99 instead of $9.90, and it's the genuine board. the cheap 3-packs on aliexpress don't say they're seeed, and this build depends on the xiao's battery charger.
- **lcsc for the temperature sensor and resistor.** lcsc sells real parts with datasheets. cheap ds18b20s on aliexpress are commonly clones. lcsc will also ship with the pcb order from jlcpcb.
- **the battery stays the eemb.** decent aliexpress cells were only about $1 cheaper, with no certification. it's a lithium cell worn on a belt loop, so it's not worth saving $2 on.
- **paint stays on amazon.** spray cans can't be shipped by air from china.

## shipping and fees

the total above is parts only. what gets added at checkout:

- **aliexpress:** shipping and any us import charges are shown in the cart. several of these listings advertise free shipping, and grouping them in one order helps
- **seeed studio:** shipping is shown at checkout
- **lcsc:** shipping plus us tariffs, shown in the cart. ordering these two parts together with the jlcpcb pcb means one shipment instead of two
- **amazon:** free shipping on the battery and paint with prime or over $35

## how the parts work together

- everything runs on the xiao's 3.3v rail, and the display, mpu6050, max4466 and ds18b20 are all rated for 3.3v
- the xiao charges the lipo over usb-c, so there's no separate charger board
- the battery's protection circuit handles over-charge, over-discharge and shorts
- the ds18b20 needs one 4.7kΩ pull-up on its data line
- the to-92 ds18b20 is small enough to sit in the 4mm temperature vent
- 30awg silicone wire folds into the shell without stressing the solder joints

tools not listed (already have them): soldering iron, solder, flush cutters, multimeter, usb-c cable, 3d printer.
