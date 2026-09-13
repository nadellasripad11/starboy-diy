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

// ESP32-C3 SuperMini SPI pins
#define TFT_MOSI  6   // SDA on TFT module
#define TFT_SCLK  4   // SCL on TFT module
#define TFT_CS    3
#define TFT_DC    2
#define TFT_RST  -1   // Tie TFT RST to 3.3V, or set to a GPIO if needed
#define TFT_BL   -1   // Tie TFT BL to 3.3V (always on)

// SPI clock speeds
#define SPI_FREQUENCY       40000000  // 40MHz
#define SPI_READ_FREQUENCY  20000000

// Load default font
#define LOAD_GLCD
#define LOAD_FONT2
