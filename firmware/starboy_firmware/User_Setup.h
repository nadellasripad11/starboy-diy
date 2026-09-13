// ============================================================
// TFT_eSPI User_Setup.h for STARBOY DIY
// Copy this file to: Arduino/libraries/TFT_eSPI/User_Setup.h
// (Replace the existing one)
// ============================================================

// GC9A01 1.28" Round TFT driver
#define GC9A01_DRIVER

// Display size
#define TFT_WIDTH  240
#define TFT_HEIGHT 240

// Seeed XIAO ESP32C3 SPI pins
#define TFT_MOSI  10  // D10 — "SDA"/DIN on the TFT module
#define TFT_SCLK  8   // D8  — "SCL"/CLK on the TFT module
#define TFT_CS    5   // D3
#define TFT_DC    21  // D6
#define TFT_RST  -1   // Tie TFT RST to 3.3V, or set to a GPIO if needed
// TFT_BL deliberately NOT defined: the backlight is on GPIO 4 (D2) and the
// firmware drives it with PWM so it can dim in sleep. Defining it here would
// let TFT_eSPI grab the pin and force it fully on.

// SPI clock speeds
#define SPI_FREQUENCY       40000000  // 40MHz
#define SPI_READ_FREQUENCY  20000000

// Load default font
#define LOAD_GLCD
#define LOAD_FONT2
