// ============================================================
// STARBOY DIY — Complete Eye Firmware  v2.0
// ============================================================
// 500+ animations | 100 colorways × 4 eye shapes (matched to creature.company/eyes)
// Behaviors: idle · blink · curious · happy · bored · alert
//   suspicious · dizzy · angry · cold/shiver · loud/anxious
//   tilt-tracking · doze · sleep · 20 rare special effects
//
// Hardware:
//   Seeed XIAO ESP32C3 (built-in LiPo charger; EEMB 402535 320mAh on BAT pads)
//   GC9A01 1.28" Round TFT (240×240) — SPI: SCK D8, MOSI D10, CS D3, DC D6
//   Backlight — PWM on D2 (GPIO4)
//   MPU6050 Accelerometer/Gyro — I2C (SDA=D4/GPIO6, SCL=D5/GPIO7)
//   DS18B20 Temperature — OneWire (D7/GPIO20, 4.7kΩ to 3.3V)
//   MAX4466 Mic — Analog (D1/GPIO3)
//
// Libraries (Arduino Library Manager):
//   TFT_eSPI by Bodmer        ← ALSO copy User_Setup.h to library folder!
//   Adafruit MPU6050
//   Adafruit Unified Sensor
//   DallasTemperature
//   OneWire
//
// Board settings: XIAO_ESP32C3 · USB CDC On Boot: Enabled
// ============================================================

#include <TFT_eSPI.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Preferences.h>
#include <math.h>

// ─── Pins ────────────────────────────────────────────────
// TFT pins defined in User_Setup.h
// Pins are for the Seeed XIAO ESP32C3 (built-in LiPo charger). Inputs are
// kept off the strapping pins GPIO2/8/9; GPIO8 is only used as SPI clock,
// which is what the XIAO routes it for.
#define ONE_WIRE_BUS  20      // D7  — DS18B20 data
#define MIC_PIN       3       // D1  — ADC1_CH3, MAX4466 OUT
#define HAS_MIC       true    // set false to disable mic checks

// Display backlight on a PWM pin so sleep can actually dim it. Wire the
// module's BL pin HERE, not to 3.3V — tied to 3.3V it's full brightness
// forever, even with the eyes shut, and the battery lasts a few hours.
#define BL_PIN        4       // D2
#define BL_PWM_FREQ   5000
#define BL_PWM_BITS   8
#define BL_CH         0       // only used on ESP32 Arduino core 2.x
#define BL_AWAKE      255
#define BL_DOZE       70
#define BL_SLEEP      10
#define DEBUG_SENSORS 0       // 1 = print shake / temp / sound once a second for tuning

// ─── Display ─────────────────────────────────────────────
TFT_eSPI    tft;
TFT_eSprite spr(&tft);        // off-screen sprite — zero flicker
bool        sprOK = false;

#define W  240
#define H  240
#define CX 120
#define CY 120

// ─── Sensors ─────────────────────────────────────────────
Adafruit_MPU6050  mpu;
bool              mpuOK = false;
OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
Preferences       prefs;

// ─── Eye design: 100 colorways × 4 shapes ────────────────
// Matched to creature.company/eyes: each eye is a flat block of colour on
// black with a pupil in a second colour. The rarest colorways give the two
// eyes different pupils. weight = how often a colorway gets rolled.
struct Colorway { const char *name; uint32_t body, pupL, pupR; uint8_t weight; };
const Colorway COLORWAYS[100] = {
  { "marmalade",    0xF99F05, 0x6E6123, 0x6E6123, 10 },
  { "matcha",       0xC7FBA6, 0x5E6E06, 0x5E6E06, 10 },
  { "houseplant",   0x039442, 0x71FF6F, 0x71FF6F, 10 },
  { "terrarium",    0x6FF5D0, 0x106E54, 0x106E54, 10 },
  { "whale",        0x0059A3, 0x0095FF, 0x0095FF, 10 },
  { "frog",         0x42DE86, 0x436A16, 0x436A16, 10 },
  { "denim",        0x6C92F8, 0x102A6E, 0x102A6E, 10 },
  { "petunia",      0xF8AFFB, 0xF006B4, 0xF006B4, 10 },
  { "lipgloss",     0xA10180, 0xFC609C, 0xFC609C, 10 },
  { "jawbreaker",   0xF6759F, 0x56031F, 0x56031F, 10 },
  { "cherry",       0xAE0002, 0xFF5252, 0xFF5252, 10 },
  { "pebble",       0x645252, 0xA4A4A4, 0xA4A4A4, 10 },
  { "valentine",    0xDD06CB, 0x7B1612, 0x7B1612, 10 },
  { "plum",         0x7260E6, 0x622058, 0x622058, 10 },
  { "gumball",      0xF20F07, 0xFFFFFF, 0xFFFFFF,  8 },
  { "sprinkler",    0x59BF05, 0xFFFFFF, 0xFFFFFF,  8 },
  { "pool",         0x05A8F9, 0xFCEEEE, 0xFCEEEE,  8 },
  { "moon",         0x4028FF, 0xEBFFFC, 0xEBFFFC,  8 },
  { "bubblegum",    0xF442E7, 0xFFFFFF, 0xFFFFFF,  8 },
  { "seaglass",     0xFBFBFB, 0x167B61, 0x167B61,  9 },
  { "laser",        0xFFFFFF, 0xFF0000, 0xFF0000,  9 },
  { "snowball",     0xFFFFFF, 0x5A79F3, 0x5A79F3,  9 },
  { "smoothie",     0xFFECE0, 0xCE0959, 0xCE0959,  9 },
  { "peach",        0xFDFBE2, 0xF76E5D, 0xF76E5D,  9 },
  { "goldfish",     0xE0F4FB, 0xDE9109, 0xDE9109,  9 },
  { "seashell",     0xFCD9CF, 0x070571, 0x070571,  9 },
  { "hydrangea",    0xE1BFE1, 0x2722DB, 0x2722DB,  9 },
  { "cupcake",      0xF9FFB2, 0xCA00CA, 0xCA00CA,  9 },
  { "limeade",      0xEAFCC5, 0x09B6CE, 0x09B6CE,  9 },
  { "teacup",       0xF6E5A5, 0x0D73F7, 0x0D73F7,  9 },
  { "candycane",    0x9CFBD5, 0x790C05, 0x790C05,  9 },
  { "ladybug",      0xC3110E, 0x000000, 0x000000,  7 },
  { "avocado",      0x8BD67C, 0x230606, 0x230606,  7 },
  { "submarine",    0x0F7BA9, 0x000000, 0x000000,  7 },
  { "eggplant",     0xE202E8, 0x0A0A0A, 0x0A0A0A,  7 },
  { "og",           0xFFFFFF, 0x000000, 0x000000,  7 },
  { "lobster",      0xF95320, 0x044A5F, 0x044A5F,  3 },
  { "pumpkin",      0xE87102, 0x55FC6E, 0x55FC6E,  3 },
  { "beachball",    0xF6FD21, 0x1C9DE3, 0x1C9DE3,  3 },
  { "glowstick",    0xE9F905, 0x360342, 0x360342,  3 },
  { "cactus",       0xC4F41D, 0x530AEC, 0x530AEC,  3 },
  { "highlighter",  0x95F124, 0xF50DCF, 0xF50DCF,  3 },
  { "kiwi",         0x55F927, 0x9F7717, 0x9F7717,  3 },
  { "flytrap",      0x15F817, 0x5E045E, 0x5E045E,  3 },
  { "junebug",      0x14DA70, 0x3516AF, 0x3516AF,  3 },
  { "sunset",       0xAE2400, 0xF855FC, 0xF855FC,  3 },
  { "robin",        0x15ABF8, 0x5E2304, 0x5E2304,  3 },
  { "jukebox",      0x024BDE, 0xFB4CC3, 0xFB4CC3,  3 },
  { "starboy",      0x7B43F5, 0xF6BD49, 0xF6BD49,  3 },
  { "sonar",        0x126487, 0x2EE605, 0x2EE605,  3 },
  { "guava",        0x84FB8E, 0xF64982, 0xF64982,  3 },
  { "blacklight",   0x6922F0, 0xA3F410, 0xA3F410,  3 },
  { "taffy",        0xF474DC, 0xE8FCA6, 0xE8FCA6,  3 },
  { "lilac",        0x7202FC, 0xFDB0CE, 0xFDB0CE,  3 },
  { "nightlight",   0x7768FE, 0x55FC87, 0x55FC87,  3 },
  { "crocus",       0xD602E8, 0xFBF823, 0xFBF823,  3 },
  { "rosebush",     0x1E6935, 0xFC7AC0, 0xFC7AC0,  3 },
  { "parakeet",     0x018335, 0x23FAFB, 0x23FAFB,  3 },
  { "glowworm",     0xF40DF8, 0x19F515, 0x19F515,  3 },
  { "spearmint",    0x9CFBCE, 0x790572, 0x790572,  3 },
  { "motel",        0xFA486F, 0x92FABE, 0x92FABE,  3 },
  { "buoy",         0x14ABD6, 0xEEFA24, 0xEEFA24,  3 },
  { "slushie",      0xC206AD, 0x49F6D9, 0x49F6D9,  3 },
  { "siren",        0xFD0C0D, 0x2905E6, 0x2905E6,  3 },
  { "ember",        0x994400, 0x00EEFF, 0x00EEFF,  3 },
  { "jelly",        0xB60080, 0x429EFB, 0x429EFB,  3 },
  { "popsicle",     0x71FEAE, 0x5598FC, 0x5598FC,  3 },
  { "dragonfruit",  0xB60053, 0xCFFA0F, 0xCFFA0F,  3 },
  { "hibiscus",     0xB6003C, 0x05E605, 0x05E605,  3 },
  { "jam",          0xC5013C, 0x09CE93, 0x09CE93,  3 },
  { "candle",       0x973849, 0xF7FBBC, 0xF7FBBC,  3 },
  { "calculator",   0x737373, 0x09E151, 0x09E151,  3 },
  { "doorbell",     0xBEBEBE, 0xE42D06, 0xE42D06,  3 },
  { "postcard",     0xBE6A6A, 0x76D8EB, 0x76D8EB,  5 },
  { "flowerpot",    0xCC6262, 0x3E4002, 0x3E4002,  5 },
  { "juicebox",     0xF6826C, 0x95059B, 0x95059B,  5 },
  { "mallard",      0x7B8401, 0x0737A7, 0x0737A7,  5 },
  { "tomato",       0x60A611, 0xB4040F, 0xB4040F,  5 },
  { "chamomile",    0x509156, 0xF4C524, 0xF4C524,  5 },
  { "peacock",      0x02B0B6, 0x7923FB, 0x7923FB,  5 },
  { "sandbox",      0xB8804A, 0xF7F574, 0xF7F574,  5 },
  { "kite",         0x7DB5F4, 0xC10787, 0xC10787,  5 },
  { "puddle",       0xA7AFF6, 0x837605, 0x837605,  5 },
  { "moth",         0xEC75F6, 0x564803, 0x564803,  5 },
  { "strawberry",   0xFCB7F2, 0x069A1E, 0x069A1E,  5 },
  { "flamingo",     0xFCB7C3, 0x068F9A, 0x068F9A,  5 },
  { "static",       0x666666, 0x000000, 0xFFFFFF,  2 },
  { "eraser",       0x666666, 0xFFEDED, 0x000000,  2 },
  { "pinball",      0xB60207, 0xD2F9F9, 0x60D105,  2 },
  { "socks",        0xB865A8, 0x76D8EB, 0x8F1716,  2 },
  { "koi",          0xFE6873, 0x0A0A0A, 0xD0F910,  2 },
  { "marble",       0xD1D9FA, 0xC11207, 0xD20ADF,  2 },
  { "stoplight",    0x34F7FD, 0x038C03, 0xF91024,  2 },
  { "bumblebee",    0xFDCB21, 0x0A0A0A, 0xD10566,  2 },
  { "lilypad",      0xD1F63B, 0x10812B, 0x0F91F4,  2 },
  { "popcorn",      0xEAF66E, 0xBB240A, 0x0964E7,  2 },
  { "spumoni",      0xF6EAB9, 0x177E39, 0x2722DB,  2 },
  { "umbrella",     0xE7E3E9, 0xF65F28, 0x4F6BF8,  2 },
  { "sherbet",      0xE4F4E2, 0x4A0A99, 0xDB8405,  2 },
  { "neapolitan",   0x87493B, 0xEB76DD, 0xB7ABF3,  2 },
};

enum EyeShape : uint8_t { SHAPE_DOT = 0, SHAPE_CIRCLE, SHAPE_CAT, SHAPE_ACORN };
const char   *SHAPE_NAMES[4]  = { "dot", "circle", "cat", "acorn" };
const uint8_t SHAPE_WEIGHT[4] = { 10, 40, 30, 20 };   // percent

inline uint16_t rgb565(uint32_t c) {
  return ((c >> 16 & 0xF8) << 8) | ((c >> 8 & 0xFC) << 3) | ((c & 0xFF) >> 3);
}

// ─── Eye design (seed-based, unique per unit) ────────────
uint32_t eyeSeed;
uint8_t  d_colorway;
uint8_t  d_shape;
uint16_t d_irisC;     // eye body
uint16_t d_pupilC;    // left pupil
uint16_t d_pupilC2;   // right pupil

// ─── Eye geometry ────────────────────────────────────────
// Two big ovals almost touching, filling most of the round display.
#define EYE_L_X   (CX - 52)
#define EYE_R_X   (CX + 52)
#define EYE_Y     CY
#define IRIS_RX   48
#define IRIS_RY   56
#define EYE_TILT  0.10f   // radians; the top of each eye leans outward

// ─── Animation expression table (50 base targets) ───────
// Each entry: gazeX, gazeY, blinkT, pupilR%, irisRx%, irisRy%,
//             browInnerL, browInnerR, browY
// 500+ total animations = these 50 × 8 parametric variants each
//   + 20 rare specials + ~70 named transition sequences
struct ExprDef { int8_t gx,gy; uint8_t bl,pr,ix,iy; int8_t bwl,bwr,bwy; };
const ExprDef EXPR[50] PROGMEM = {
// gx  gy  bl  pr  ix  iy  bwL  bwR bwY
 {  0,  0,  0,100,100,100,   0,   0,  0 }, // 00 neutral
 {  0, -2,  8,110,100, 90,  -3,  -3, -2 }, // 01 happy
 {  2, -3,  0,115,100,100,   2,   2, -4 }, // 02 curious
 {  0,  3, 30, 90,100, 85,   0,   0,  3 }, // 03 bored
 {  0,  0,  0,125,105,105,   5,   5, -3 }, // 04 startled/alert
 { -4,  0, 15, 85,100, 90,  -2,   2,  1 }, // 05 suspicious
 {  0,  0, 50, 85,100, 85,   8,   8,  2 }, // 06 annoyed
 {  0,  0, 60, 75,100, 80,  14,  14,  4 }, // 07 angry
 {  0,  0, 70, 65,100, 75,  20,  20,  6 }, // 08 rage
 {  0,  0, 40, 90,110, 80,   4,   4,  0 }, // 09 squinting
 {  0, -1, 20,100,100, 95,  -1,  -1, -1 }, // 10 content/peaceful
 {  3,  2,  0,100,100,100,   0,   0,  0 }, // 11 glance right
 { -3,  2,  0,100,100,100,   0,   0,  0 }, // 12 glance left
 {  0, -4,  0,100,100,100,   0,   0,  0 }, // 13 look up
 {  0,  4,  5, 95,100, 97,   0,   0,  0 }, // 14 look down
 {  0,  0, 90, 90,100, 90,   0,   0,  3 }, // 15 nearly closed
 {  0,  0,100, 90,100, 90,   0,   0,  3 }, // 16 fully closed
 {  2, -2,  0,120,110,100,   3,   0, -2 }, // 17 smug R
 { -2, -2,  0,120,110,100,   0,   3, -2 }, // 18 smug L
 {  0,  0, 35, 70, 90,120,   6,   6,  2 }, // 19 tired squint
 {  0, -1, 10,130,105, 90,  -2,  -2, -3 }, // 20 excited
 { -3, -1,  0, 70, 85,110,   3,  -1,  0 }, // 21 shifty L
 {  3, -1,  0, 70, 85,110,  -1,   3,  0 }, // 22 shifty R
 {  0,  0, 45, 60,100,120,  12,  12,  5 }, // 23 squint hard
 {  0,  2, 55, 95,100, 80,   0,   0,  4 }, // 24 drowsy
 {  0,  3, 70, 90,100, 75,   0,   0,  5 }, // 25 very drowsy
 {  0,  0, 15, 95, 95, 95,  -2,  -2, -1 }, // 26 gentle/soft
 {  0, -3,  5,105,100,105,  -1,  -1, -4 }, // 27 wondering
 {  0,  0, 30, 80, 90, 90,  10,  10,  3 }, // 28 unamused
 {  1, -1, 10,110,100,100,   2,  -2, -2 }, // 29 playful
 {  0,  0,  0,140,110,100,  -3,  -3, -5 }, // 30 shocked wide
 {  0,  0, 10, 60, 85,115,   5,   5,  0 }, // 31 narrow suspicious
 {  0, -1, 25,105,100, 92,  -1,  -1,  0 }, // 32 relaxed happy
 {  0,  1, 40, 85,100, 88,   7,   7,  2 }, // 33 mildly irritated
 {  0,  0,  0,100,115,115,   0,   0, -1 }, // 34 round cute
 {  5,  0,  0,100, 70,120,   0,   0,  0 }, // 35 extreme look R
 { -5,  0,  0,100, 70,120,   0,   0,  0 }, // 36 extreme look L
 {  0,  0, 50, 50, 80,130,  10,  10,  4 }, // 37 slit/cat eyes
 {  0, -2, 20,115,105, 95,   0,   0, -3 }, // 38 warm happy
 {  0,  0, 65, 70, 95, 90,  15,  15,  6 }, // 39 seething
 {  2,  2, 20, 90,100, 95,   1,   0,  1 }, // 40 glance relax R
 { -2,  2, 20, 90,100, 95,   0,   1,  1 }, // 41 glance relax L
 {  0,  0, 10,125,110,105,  -4,  -4, -4 }, // 42 wide surprised
 {  0,  0, 80, 85,100, 82,   0,   0,  6 }, // 43 barely open
 {  0,  0,100, 90,100, 85,   0,   0,  4 }, // 44 dreaming sleep
 {  0, -1,  5,100,105,105,   0,   0, -2 }, // 45 just woke
 {  0, -2,  0,100,110, 95,  -1,  -1, -2 }, // 46 bright cheerful
 {  4, -4,  0,110,100,100,   0,   0, -1 }, // 47 noticing R
 { -4, -4,  0,110,100,100,   0,   0, -1 }, // 48 noticing L
 {  0,  0, 55, 55, 70,150,  12,  12,  6 }, // 49 horizontal slit angry
};

// ─── Eye rendering state ─────────────────────────────────
struct EyeState {
  float gx, gy;          // gaze offset
  float blinkT;          // top lid (0=open 1=closed)
  float blinkB;          // bottom lid
  float pupR;            // pupil scale (1.0=normal)
  float irX, irY;        // iris x/y scale
  float bwL, bwR;        // brow inner end offset px
  float bwY;             // brow height offset
  float smile;           // bottom lid pushed up in a curve (0-1)
  float colMix;          // 0=design 1=override
  uint16_t colOvr;       // color override
  uint8_t  fx;           // special effect 0=none
  float    fxP;          // effect phase/param
};
EyeState eye, eyeT;      // current + target
float    baseGx = 0, baseGy = 0;            // gaze of the current expression; glances start here
uint32_t lastSaccade = 0, nextSaccade = 2000;

// Helper — load expression into target
void setTarget(uint8_t idx) {
  ExprDef e;
  memcpy_P(&e, &EXPR[idx], sizeof(ExprDef));
  eyeT.gx   = e.gx;  eyeT.gy   = e.gy;
  eyeT.blinkT = e.bl / 100.0f;  eyeT.blinkB = eyeT.blinkT * 0.45f;
  eyeT.pupR  = e.pr / 100.0f;
  eyeT.irX   = e.ix / 100.0f;   eyeT.irY   = e.iy / 100.0f;
  eyeT.bwL   = e.bwl; eyeT.bwR  = e.bwr; eyeT.bwY  = e.bwy;
  eyeT.colMix = 0; eyeT.fx = 0;
  baseGx = eyeT.gx; baseGy = eyeT.gy;
  switch (idx) {   // happy faces squint up from below
    case 1: case 38: eyeT.smile = 0.8f; break;
    case 20: case 46: eyeT.smile = 0.6f; break;
    case 32:         eyeT.smile = 0.5f; break;
    case 10:         eyeT.smile = 0.3f; break;
    default:         eyeT.smile = 0.0f; break;
  }
}

// ─── State machine ───────────────────────────────────────
enum StarState : uint8_t {
  S_IDLE=0, S_CURIOUS, S_HAPPY, S_BORED, S_ALERT,
  S_SUSPICIOUS, S_BLINK,
  S_DIZZY_MILD, S_DIZZY_SEVERE, S_RECOVERING,
  S_ANGRY, S_SEETHING,
  S_CHILL, S_SHIVER, S_FREEZE,
  S_STARTLED, S_ANXIOUS, S_OVERWHELMED,
  S_TILT,
  S_DOZE, S_MICROSLEEP, S_SLEEP, S_DREAMING,
  // Rare specials
  S_RARE_RAINBOW, S_RARE_HEARTS, S_RARE_STARS,
  S_RARE_GLITCH, S_RARE_MATRIX, S_RARE_SPIRAL,
  S_RARE_LOADING, S_RARE_ERROR, S_RARE_DERP,
  S_RARE_SMUG, S_RARE_CRY, S_RARE_LAUGH,
  S_RARE_SHOCKED, S_RARE_DEAD, S_RARE_GALAXY,
  S_RARE_HEARTBEAT, S_RARE_FIRE, S_RARE_HYPNO,
  S_RARE_STARFIELD, S_RARE_GLITCH2,
  S_COUNT
};

StarState  curState = S_IDLE;
uint32_t   stateMs  = 0;
uint32_t   lastInteract = 0;
uint32_t   lastBlink = 0;
uint32_t   nextBlink = 0;
uint32_t   lastGazeShift = 0;
uint32_t   nextGazeShift = 0;
uint32_t   lastTempRead = 0;
uint32_t   lastRareCheck = 0;
uint32_t   lastSpecialIdle = 0;
uint8_t    blinkPhase = 0;   // 0=open 1=closing 2=open
uint32_t   blinkPhaseMs = 0;

// ─── Sensor values ───────────────────────────────────────
float  accelX=0, accelY=0, accelZ=9.8f;
float  shakeE=0;               // smoothed shake energy
float  ambientTemp=20.0f;
int    soundPeak=0;
uint32_t shakeStart=0;
float  tiltAngleX=0, tiltAngleY=0;

// Thresholds (tune for your unit)
#define SHAKE_ON_G    16.0f    // m/s² above gravity to count as shake
#define SHAKE_MS      1000     // must shake this long to trigger
#define COLD_C        10.0f    // °C below this → cold state
#define HOT_C         32.0f    // °C above → warm/cozy (future)
#define LOUD_P2P      600      // mic peak-to-peak swing (0-4095) → anxious.
                               // The MAX4466 idles at mid-rail (~2048), so a raw
                               // reading means nothing on its own — only the swing
                               // matters. Depends on the board's gain trimmer:
                               // tune with DEBUG_SENSORS 1.
#define IDLE_DOZE_MS  25000UL
#define IDLE_SLEEP_MS 75000UL
#define RARE_PERIOD_MS 90000UL // check every 90s for a rare animation

// ─── Procedural animation variables ──────────────────────
float dizzyAngle = 0;
float shiverPhase = 0;
float rarePhase = 0;
float dozeLevel = 0;
uint8_t idleSubState = 0;
uint32_t idleSubMs = 0;

// ─── Forward declarations ────────────────────────────────
void initEyeDesign();
void readSensors();
void updateState();
void updateInterp();
void drawFrame();
void drawEye(int cx, int cy, bool isLeft);
void drawSpecialFX(int cx, int cy);
void drawFXMatrix();
void drawFXStarfield();
void checkRare();
void setupRareTarget(StarState s);
void setState(StarState s);
void sprFillEllipse(int cx, int cy, int rx, int ry, uint16_t c);
void sprDrawEllipse(int cx, int cy, int rx, int ry, uint16_t c);
float lerpF(float a, float b, float t);
float easeInOut(float t);
uint16_t blend565(uint16_t a, uint16_t b, float t);

// ════════════════════════════════════════════════════════
// SETUP
// ════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);

  // Display
  tft.init();
  tft.setRotation(0);
  tft.fillScreen(TFT_BLACK);

  // Sprite (off-screen buffer)
  sprOK = (spr.createSprite(W, H) != nullptr);
  if (!sprOK) {
    // Try smaller sprite if OOM
    sprOK = (spr.createSprite(200, 200) != nullptr);
  }

  // MPU6050
  Wire.begin(6, 7);  // XIAO ESP32C3 default I2C: SDA=D4 (GPIO6), SCL=D5 (GPIO7)
  if (mpu.begin()) {
    mpuOK = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  }

  // Temperature
  ds18b20.begin();
  ds18b20.setResolution(10);
  ds18b20.setWaitForConversion(false);   // non-blocking, see readSensors()

  // Mic
  analogReadResolution(12);

  // Backlight PWM (see BL_PIN). The ledc API changed in ESP32 Arduino core 3.
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(BL_PIN, BL_PWM_FREQ, BL_PWM_BITS);
#else
  ledcSetup(BL_CH, BL_PWM_FREQ, BL_PWM_BITS);
  ledcAttachPin(BL_PIN, BL_CH);
#endif
  setBacklight(BL_AWAKE);

  // Eye design (load or generate)
  initEyeDesign();

  // Initial eye state
  memset(&eye, 0, sizeof(eye));
  eye.pupR=1; eye.irX=1; eye.irY=1;
  eyeT = eye;
  setTarget(45);  // "just woke up" expression to start

  lastInteract = millis();
  lastBlink    = millis();
  nextBlink    = random(2000, 4500);
  lastGazeShift = millis();
  nextGazeShift = random(3000, 7000);
  lastRareCheck = millis();
}

// ════════════════════════════════════════════════════════
// LOOP
// ════════════════════════════════════════════════════════
void loop() {
  uint32_t now = millis();

  readSensors();
  updateState();
  updateInterp();
  updateBacklight();
  drawFrame();

  // Target ~33ms per frame (30fps)
  uint32_t elapsed = millis() - now;
  if (elapsed < 33) delay(33 - elapsed);
}

// ════════════════════════════════════════════════════════
// EYE DESIGN INIT
// ════════════════════════════════════════════════════════
void initEyeDesign() {
  prefs.begin("starboy", false);
  eyeSeed = prefs.getUInt("seed", 0);
  if (eyeSeed == 0) {
    eyeSeed = (uint32_t)esp_random();
    if (eyeSeed == 0) eyeSeed = 0xDEADBEEF;
    prefs.putUInt("seed", eyeSeed);
  }
  prefs.end();

  uint32_t s = eyeSeed;
  auto rnd = [&](uint16_t n) -> uint16_t {
    s = s * 1664525u + 1013904223u;
    return (uint16_t)((s >> 8) % n);
  };

  uint16_t total = 0;
  for (int i = 0; i < 100; i++) total += COLORWAYS[i].weight;
  uint16_t pick = rnd(total);
  d_colorway = 99;
  for (int i = 0; i < 100; i++) {
    if (pick < COLORWAYS[i].weight) { d_colorway = i; break; }
    pick -= COLORWAYS[i].weight;
  }

  pick = rnd(100);
  d_shape = SHAPE_ACORN;
  for (int i = 0; i < 4; i++) {
    if (pick < SHAPE_WEIGHT[i]) { d_shape = i; break; }
    pick -= SHAPE_WEIGHT[i];
  }

  const Colorway &cw = COLORWAYS[d_colorway];
  d_irisC   = rgb565(cw.body);
  d_pupilC  = rgb565(cw.pupL);
  d_pupilC2 = rgb565(cw.pupR);

  Serial.printf("Eye seed: 0x%08X | %s %s | colorway %.1f%% | shape %u%%\n",
                eyeSeed, SHAPE_NAMES[d_shape], cw.name,
                100.0f * cw.weight / total, SHAPE_WEIGHT[d_shape]);
}

// ════════════════════════════════════════════════════════
// SENSOR READING
// ════════════════════════════════════════════════════════
void readSensors() {
  uint32_t now = millis();

  // MPU6050
  if (mpuOK) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    accelX = a.acceleration.x;
    accelY = a.acceleration.y;
    accelZ = a.acceleration.z;

    float mag = sqrtf(accelX*accelX + accelY*accelY + accelZ*accelZ);
    float instant = fabsf(mag - 9.81f);
    shakeE = shakeE * 0.85f + instant * 0.15f;  // smooth

    tiltAngleX = atan2f(accelY, accelZ) * 180.0f / PI;
    tiltAngleY = atan2f(-accelX, accelZ) * 180.0f / PI;

    if (shakeE > SHAKE_ON_G) {
      if (shakeStart == 0) shakeStart = now;
    } else {
      shakeStart = 0;
    }
  }

  // Temperature — non-blocking. The old blocking requestTemperatures() froze
  // the animation for ~190ms every 5s. Now: request, keep animating, read
  // once the conversion has had time to finish.
  static bool     tempPending = false;
  static uint32_t tempReqMs   = 0;
  if (!tempPending && now - lastTempRead > 5000) {
    ds18b20.requestTemperatures();
    tempPending = true;
    tempReqMs   = now;
  } else if (tempPending && now - tempReqMs >= 200) {   // 10-bit conversion ≈ 188ms
    tempPending  = false;
    lastTempRead = now;
    float t = ds18b20.getTempCByIndex(0);
    // 85.0 is the sensor's power-on value — it means no conversion happened
    if (t != DEVICE_DISCONNECTED_C && t != 85.0f && t > -50 && t < 100)
      ambientTemp = t;
  }

  // Mic — peak-to-peak over a short burst. The MAX4466 output sits at
  // mid-rail (~2048) in silence, so the raw value made every room look loud
  // and the eye got stuck in "anxious". Max minus min over the burst is the
  // real sound level regardless of that offset. 32 samples ≈ a few ms.
  if (HAS_MIC) {
    int lo = 4095, hi = 0;
    for (int i = 0; i < 32; i++) {
      int raw = analogRead(MIC_PIN);
      if (raw < lo) lo = raw;
      if (raw > hi) hi = raw;
    }
    int p2p = hi - lo;
    if (p2p > soundPeak) soundPeak = p2p;                 // fast attack
    else soundPeak = (int)(soundPeak * 0.93f);            // slow decay
  }

#if DEBUG_SENSORS
  static uint32_t lastDbg = 0;
  if (now - lastDbg > 1000) {
    lastDbg = now;
    Serial.printf("shake %.1f  temp %.1fC  sound %d\n", shakeE, ambientTemp, soundPeak);
  }
#endif
}

// ════════════════════════════════════════════════════════
// STATE MACHINE
// ════════════════════════════════════════════════════════
void setState(StarState s) {
  if (curState == s) return;
  curState = s;
  stateMs  = millis();
  rarePhase = 0;
}

void updateState() {
  uint32_t now   = millis();
  uint32_t age   = now - stateMs;
  uint32_t idle  = now - lastInteract;

  // ── Interruptions (always checked, high priority) ──
  bool shaking = mpuOK && shakeStart > 0 && (now - shakeStart) > SHAKE_MS;
  bool isCold  = ambientTemp < COLD_C;
  bool isLoud  = HAS_MIC && soundPeak > LOUD_P2P;

  // Rare specials can't be interrupted mid-play
  if (curState >= S_RARE_RAINBOW && age < 5000) return;

  // ── SHAKE ──
  if (shaking && curState != S_DIZZY_SEVERE && curState != S_RECOVERING &&
      curState != S_ANGRY && curState != S_SEETHING) {
    setState(shakeE > 30 ? S_DIZZY_SEVERE : S_DIZZY_MILD);
    lastInteract = now;
    return;
  }

  // ── STATE-SPECIFIC TRANSITIONS ──
  switch (curState) {

    case S_DIZZY_MILD:
      dizzyAngle += 0.08f;
      if (age > 2000) setState(S_DIZZY_SEVERE);
      break;

    case S_DIZZY_SEVERE:
      dizzyAngle += 0.14f;
      if (!shaking && age > 3500) setState(S_RECOVERING);
      break;

    case S_RECOVERING:
      if (age > 2000) {
        setState(S_ANGRY);
        setTarget(7);
      }
      break;

    case S_ANGRY:
      if (age > 3500) setState(isCold ? S_CHILL : S_IDLE);
      break;

    case S_SEETHING:
      if (age > 5000) setState(S_ANGRY);
      break;

    case S_CHILL:
      shiverPhase += 0.08f;
      if (!isCold) setState(S_IDLE);
      if (age > 4000 && ambientTemp < COLD_C - 5) setState(S_SHIVER);
      break;

    case S_SHIVER:
      shiverPhase += 0.18f;
      if (!isCold) setState(S_IDLE);
      if (age > 8000 && ambientTemp < COLD_C - 8) setState(S_FREEZE);
      break;

    case S_FREEZE:
      shiverPhase += 0.12f;
      if (ambientTemp >= COLD_C + 2) setState(S_IDLE);
      break;

    case S_STARTLED:
      if (age > 800) setState(isLoud ? S_ANXIOUS : S_IDLE);
      break;

    case S_ANXIOUS:
      if (!isLoud && age > 2500) setState(S_IDLE);
      if (isLoud && age > 4000) setState(S_OVERWHELMED);
      break;

    case S_OVERWHELMED:
      if (!isLoud && age > 3000) setState(S_IDLE);
      break;

    case S_DOZE:
      dozeLevel = min(1.0f, dozeLevel + 0.002f);
      if (idle > IDLE_SLEEP_MS) setState(S_SLEEP);
      if (shakeE > 3 || isLoud) { setState(S_IDLE); dozeLevel=0; lastInteract=now; }
      break;

    case S_MICROSLEEP:
      if (age > 1500) setState(S_DOZE);
      break;

    case S_SLEEP:
      if (shakeE > 5 || isLoud || (HAS_MIC && soundPeak > LOUD_P2P * 0.5f)) {
        setState(S_IDLE); dozeLevel=0; lastInteract=now;
        setTarget(45); // just woke up
      }
      break;

    case S_DREAMING:
      if (age > 6000) setState(S_SLEEP);
      break;

    case S_TILT: {
      float lean = sqrtf(tiltAngleX*tiltAngleX + tiltAngleY*tiltAngleY);
      if (lean < 15.0f) setState(S_IDLE);
      else lastInteract = now;
      break;
    }

    default: break; // handled below
  }

  // ── IDLE-GROUP TRANSITIONS ──
  if (curState == S_IDLE || curState == S_CURIOUS || curState == S_HAPPY ||
      curState == S_BORED || curState == S_ALERT || curState == S_SUSPICIOUS) {

    // Cold interrupt
    if (isCold) { setState(S_CHILL); return; }
    // Loud interrupt
    if (isLoud) { setState(S_STARTLED); lastInteract=now; return; }
    // Shake already handled above

    // Tilt
    float lean = sqrtf(tiltAngleX*tiltAngleX + tiltAngleY*tiltAngleY);
    if (lean > 20.0f) { setState(S_TILT); lastInteract=now; return; }

    // Idle timeouts
    if (idle > IDLE_SLEEP_MS && curState != S_SLEEP) setState(S_DOZE);
    else if (idle > IDLE_DOZE_MS && curState == S_IDLE) setState(S_DOZE);

    // Rare check
    checkRare();

    // Idle sub-state cycling (personality micro-expressions)
    if (curState == S_IDLE && now - idleSubMs > nextGazeShift) {
      idleSubMs = now;
      nextGazeShift = random(2500, 7000);
      // Weighted random idle micro-expressions
      uint8_t r = random(100);
      if      (r < 25) { setTarget(0);  idleSubState = 0; }  // neutral
      else if (r < 40) { setTarget(10); idleSubState = 1; }  // content
      else if (r < 50) { setTarget(1);  idleSubState = 2; }  // happy
      else if (r < 58) { setTarget(2);  idleSubState = 3; }  // curious
      else if (r < 64) { setTarget(3);  idleSubState = 4; }  // bored
      else if (r < 70) { setTarget(27); idleSubState = 5; }  // wondering
      else if (r < 75) { setTarget(29); idleSubState = 6; }  // playful
      else if (r < 80) { setTarget(random(11,13)); idleSubState=7; }// glance
      else if (r < 85) { setTarget(46); idleSubState = 8; }  // cheerful
      else if (r < 90) { setTarget(random(40,42)); idleSubState=9; }// relax
      else if (r < 95) { setTarget(random(21,23)); idleSubState=10;}// shifty
      else             { setTarget(random(47,49)); idleSubState=11;}// notice
    }

    // Quick glances between expressions, like a real eye darting around
    if (curState == S_IDLE && now - lastSaccade > nextSaccade) {
      lastSaccade = now;
      nextSaccade = random(900, 3200);
      if (random(3) == 0) {
        eyeT.gx = baseGx; eyeT.gy = baseGy;
      } else {
        eyeT.gx = constrain(baseGx + random(-14, 15), -22.0f, 22.0f);
        eyeT.gy = constrain(baseGy + random(-6, 7), -12.0f, 12.0f);
      }
    }

    // Natural blink
    if (now - lastBlink > nextBlink && curState != S_SLEEP && curState != S_DOZE) {
      blinkPhase = 1;
      blinkPhaseMs = now;
      lastBlink = now;
      nextBlink = random(2200, 6500);
      // Occasional double blink
      if (random(10) == 0) nextBlink = 200;
    }
  }

  // ── BLINK STATE MACHINE ──
  if (blinkPhase > 0) {
    uint32_t bp = now - blinkPhaseMs;
    if (blinkPhase == 1) {       // closing
      float t = min(1.0f, bp / 80.0f);
      eyeT.blinkT = easeInOut(t) * 0.95f;
      eyeT.blinkB = eyeT.blinkT * 0.45f;
      if (bp > 80) blinkPhase = 2;
    } else if (blinkPhase == 2) { // opening
      float t = min(1.0f, (bp - 80) / 120.0f);
      eyeT.blinkT = (1.0f - easeInOut(t)) * 0.95f;
      eyeT.blinkB = eyeT.blinkT * 0.45f;
      if (bp > 200) { blinkPhase = 0; eyeT.blinkT = 0; eyeT.blinkB = 0; }
    }
  }

  // ── TARGET UPDATES per state ──
  uint32_t t = now; // used for oscillators below
  switch (curState) {

    case S_DIZZY_MILD:
    case S_DIZZY_SEVERE: {
      float speed = (curState == S_DIZZY_SEVERE) ? 2.8f : 1.6f;
      float r = 18.0f + (curState == S_DIZZY_SEVERE ? 8.0f : 0);
      eyeT.gx = cosf(dizzyAngle) * r;
      eyeT.gy = sinf(dizzyAngle) * r;
      eyeT.blinkT = 0.2f + 0.2f * sinf(t * 0.005f);
      eyeT.blinkB = eyeT.blinkT * 0.4f;
      eyeT.irX = 1.0f; eyeT.irY = 1.0f;
      eyeT.pupR = 0.8f;
      break;
    }

    case S_RECOVERING:
      eyeT.gx = sinf(t * 0.003f) * (8.0f - age * 0.003f);
      eyeT.gy = cosf(t * 0.004f) * 4.0f;
      eyeT.blinkT = 0.3f;
      break;

    case S_ANGRY:
      setTarget(7);
      eyeT.colMix = 0.5f;
      eyeT.colOvr = 0xF800;  // red tint
      // Subtle tremor
      eyeT.gx = sinf(t * 0.02f) * 1.5f;
      break;

    case S_SEETHING:
      setTarget(39);
      eyeT.colMix = 0.75f;
      eyeT.colOvr = 0xF800;
      eyeT.gx = (random(100) < 15) ? random(-3,3) : eyeT.gx;
      break;

    case S_CHILL:
      setTarget(9);
      eyeT.colMix = 0.3f * fabsf(sinf(shiverPhase * 0.3f));
      eyeT.colOvr = 0x001F; // blue tint
      eyeT.gx = sinf(shiverPhase) * 3.0f;
      break;

    case S_SHIVER: {
      float sv = sinf(shiverPhase) * 7.0f + sinf(shiverPhase * 2.7f) * 4.0f;
      setTarget(23);  // squint
      eyeT.gx = sv;
      eyeT.blinkT = 0.25f + 0.1f * sinf(shiverPhase * 0.4f);
      eyeT.blinkB = eyeT.blinkT * 0.4f;
      eyeT.colMix = 0.5f; eyeT.colOvr = 0x001F;
      // Icicle pupil: override shape via fxP
      eyeT.fx = 10; eyeT.fxP = shiverPhase;
      break;
    }

    case S_FREEZE:
      setTarget(37);  // cat-slit eyes
      eyeT.gx = sinf(shiverPhase * 0.7f) * 3.0f;
      eyeT.colMix = 0.8f; eyeT.colOvr = 0x07FF;  // ice blue
      eyeT.fx = 10; eyeT.fxP = shiverPhase;
      break;

    case S_STARTLED:
      setTarget(4); // alert/wide
      eyeT.gx = (age < 300) ? sinf(age * 0.1f) * 8 : 0;
      break;

    case S_ANXIOUS: {
      setTarget(9); // squint
      // Rapid darting eyes
      static uint32_t dartMs = 0;
      if (now - dartMs > 300) {
        dartMs = now;
        eyeT.gx = random(-18, 18);
        eyeT.gy = random(-12, 12);
      }
      eyeT.blinkT = 0.3f + 0.2f * sinf(t * 0.008f);
      eyeT.blinkB = eyeT.blinkT * 0.4f;
      break;
    }

    case S_OVERWHELMED:
      setTarget(23); // hard squint
      eyeT.colMix = 0.3f; eyeT.colOvr = 0xFFE0; // yellow-ish overwhelm
      eyeT.gx = sinf(t * 0.015f) * 10.0f;
      break;

    case S_TILT: {
      // Gaze follows gravity
      float tx = constrain(-accelY * 3.5f, -22.0f, 22.0f);
      float ty = constrain( accelX * 2.5f, -16.0f, 16.0f);
      eyeT.gx = tx; eyeT.gy = ty;
      eyeT.blinkT = 0; eyeT.irX = 1; eyeT.irY = 1;
      break;
    }

    case S_DOZE: {
      float dl = min(1.0f, dozeLevel);
      eyeT.blinkT = 0.45f + dl * 0.35f;
      eyeT.blinkB = eyeT.blinkT * 0.55f;
      eyeT.gy = 6.0f * dl;
      eyeT.gx *= 0.95f;
      eyeT.bwY = 5.0f * dl;
      eyeT.pupR = 0.85f;
      eyeT.smile = 0;
      break;
    }

    case S_MICROSLEEP:
      eyeT.blinkT = 0.9f; eyeT.blinkB = 0.4f;
      break;

    case S_SLEEP:
      // Gentle breathing oscillation
      eyeT.blinkT = 1.0f - 0.03f * (0.5f + 0.5f * sinf(now * 0.0015f));
      eyeT.blinkB = 0.45f;
      eyeT.pupR = 0.7f;
      eyeT.smile = 0;
      // Occasional dream flicker
      if (random(500) == 0) setState(S_DREAMING);
      break;

    case S_DREAMING: {
      // REM-like rapid eye movement
      float dp = rarePhase;
      rarePhase += 0.12f;
      eyeT.blinkT = 0.8f + 0.15f * sinf(dp);
      eyeT.blinkB = 0.35f;
      eyeT.gx = sinf(dp * 1.7f) * 14.0f;
      eyeT.gy = cosf(dp * 2.3f) * 8.0f;
      eyeT.fx = 11; eyeT.fxP = dp;  // dreamy shimmer
      break;
    }

    default: break;
  }
}

// ─── Rare animation check ────────────────────────────────
void checkRare() {
  uint32_t now = millis();
  if (now - lastRareCheck < RARE_PERIOD_MS) return;
  lastRareCheck = now;

  uint8_t r = random(100);
  // 40% chance something rare happens
  if (r >= 40) return;

  // Pick a rare animation (20 types)
  uint8_t pick = random(20);
  StarState s = (StarState)(S_RARE_RAINBOW + pick);
  setState(s);
}

// ─── Rare animation target setups ────────────────────────
// Called from updateInterp() — these set targets AND drive fx
void setupRareTarget(StarState s) {
  switch (s) {
    case S_RARE_RAINBOW:   setTarget(46); eyeT.fx=1; break;
    case S_RARE_HEARTS:    setTarget(32); eyeT.fx=2; break;
    case S_RARE_STARS:     setTarget(42); eyeT.fx=3; break;
    case S_RARE_GLITCH:    setTarget(4);  eyeT.fx=4; break;
    case S_RARE_MATRIX:    setTarget(0);  eyeT.fx=5; break;
    case S_RARE_SPIRAL:    setTarget(2);  eyeT.fx=6; break;
    case S_RARE_LOADING:   setTarget(0);  eyeT.fx=7; break;
    case S_RARE_ERROR:     setTarget(30); eyeT.fx=8; break;
    case S_RARE_DERP:      setTarget(9);  eyeT.fx=9; break;  // crossed
    case S_RARE_SMUG:      setTarget(17); eyeT.fx=0; break;
    case S_RARE_CRY:       setTarget(24); eyeT.fx=12; break;
    case S_RARE_LAUGH:     setTarget(1);  eyeT.fx=13; eyeT.smile=1.0f;
                           eyeT.gy=sinf(rarePhase*6.0f)*3.0f; break;
    case S_RARE_SHOCKED:   setTarget(30); eyeT.fx=14; eyeT.pupR=0.45f; break;
    case S_RARE_DEAD:      setTarget(0);  eyeT.fx=15; break;  // X eyes, lids open so they show
    case S_RARE_GALAXY:    setTarget(34); eyeT.fx=16; break;
    case S_RARE_HEARTBEAT: setTarget(32); eyeT.fx=17; break;
    case S_RARE_FIRE:      setTarget(33); eyeT.fx=18; break;
    case S_RARE_HYPNO:     setTarget(2);  eyeT.fx=6;  break;
    case S_RARE_STARFIELD: setTarget(44); eyeT.fx=19; break;
    case S_RARE_GLITCH2:   setTarget(5);  eyeT.fx=20; break;
    default: break;
  }
}

// ════════════════════════════════════════════════════════
// INTERPOLATION  (makes every transition smooth)
// ════════════════════════════════════════════════════════
void updateInterp() {
  // Different smoothing speeds for different parameters
  float gazeSpd = 0.10f;
  float blinkSpd = 0.18f;
  float pupSpd  = 0.08f;
  float irSpd   = 0.08f;
  float bwSpd   = 0.07f;
  float colSpd  = 0.10f;

  // Ramp up gaze speed during rapid states
  if (curState == S_ANXIOUS || curState == S_STARTLED) gazeSpd = 0.22f;
  if (curState == S_TILT) gazeSpd = 0.12f;
  if (curState == S_IDLE && millis() - lastSaccade < 140) gazeSpd = 0.4f;  // glances snap

  eye.gx   = lerpF(eye.gx,   eyeT.gx,   gazeSpd);
  eye.gy   = lerpF(eye.gy,   eyeT.gy,   gazeSpd);
  eye.blinkT = lerpF(eye.blinkT, eyeT.blinkT, blinkSpd);
  eye.blinkB = lerpF(eye.blinkB, eyeT.blinkB, blinkSpd);
  eye.pupR = lerpF(eye.pupR, eyeT.pupR, pupSpd);
  eye.irX  = lerpF(eye.irX,  eyeT.irX,  irSpd);
  eye.irY  = lerpF(eye.irY,  eyeT.irY,  irSpd);
  eye.bwL  = lerpF(eye.bwL,  eyeT.bwL,  bwSpd);
  eye.bwR  = lerpF(eye.bwR,  eyeT.bwR,  bwSpd);
  eye.bwY  = lerpF(eye.bwY,  eyeT.bwY,  bwSpd);
  eye.smile = lerpF(eye.smile, eyeT.smile, bwSpd);
  eye.colMix = lerpF(eye.colMix, eyeT.colMix, colSpd);
  eye.colOvr = eyeT.colOvr;
  eye.fx   = eyeT.fx;
  eye.fxP  = eyeT.fxP;

  // Update rare anim targets each frame
  if (curState >= S_RARE_RAINBOW) {
    rarePhase += 0.05f;
    setupRareTarget(curState);
    eyeT.fxP = rarePhase;
    // Exit after ~5 seconds
    if (millis() - stateMs > 5500) {
      setState(S_IDLE);
      setTarget(10); // content after special
    }
  }
}

// ════════════════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════════════════
void drawFrame() {
  if (!sprOK) {
    // Fallback: draw directly (will flicker)
    tft.fillScreen(TFT_BLACK);
    drawEye(EYE_L_X, EYE_Y, true);
    drawEye(EYE_R_X, EYE_Y, false);
    return;
  }

  spr.fillSprite(TFT_BLACK);

  // Handle full-screen special FX
  if (eye.fx == 5) { drawFXMatrix(); }
  else if (eye.fx == 19) { drawFXStarfield(); }
  else {
    drawEye(EYE_L_X, EYE_Y, true);
    drawEye(EYE_R_X, EYE_Y, false);
  }

  spr.pushSprite(0, 0);
}

// Row span of a rotated, filled ellipse at screen row y. False if the row misses it.
static bool ellSpan(float cx, float cy, float rx, float ry, float ang,
                    float y, float &x0, float &x1) {
  float c = cosf(ang), s = sinf(ang), dy = y - cy;
  float irx = 1.0f / (rx * rx), iry = 1.0f / (ry * ry);
  float A = c * c * irx + s * s * iry;
  float B = 2.0f * dy * c * s * (irx - iry);
  float C = dy * dy * (s * s * irx + c * c * iry) - 1.0f;
  float disc = B * B - 4.0f * A * C;
  if (disc <= 0) return false;
  float r = sqrtf(disc);
  x0 = cx + (-B - r) / (2.0f * A);
  x1 = cx + (-B + r) / (2.0f * A);
  return true;
}

// Pupil placement per shape, as fractions of the eye body. u points toward
// the nose, v points down, tilt leans the top of the pupil toward the nose.
struct PupilDef { float u, v, rxF, ryF, tilt; bool round; };
const PupilDef PUPILS[4] = {
  { 0.50f, 0.00f, 0.11f, 0.00f, 0.00f, true  },  // dot
  { 0.33f, 0.03f, 0.50f, 0.00f, 0.00f, true  },  // circle
  { 0.36f, 0.00f, 0.21f, 0.66f, 0.14f, false },  // cat
  { 0.19f, 0.24f, 0.50f, 0.92f, 0.06f, false },  // acorn, runs off the bottom edge
};

// Set by drawEye() so the per-eye effects know where to draw
float    fxPx, fxPy, fxRx, fxRy, fxSide;
uint16_t fxBodyC, fxPupC;

static uint16_t hue565(float p) {
  return tft.color565((int)(128 + 127 * sinf(p)),
                      (int)(128 + 127 * sinf(p + 2.094f)),
                      (int)(128 + 127 * sinf(p + 4.189f)));
}

// Effects that draw their own pupil instead of the design one
static bool fxReplacesPupil(uint8_t fx) {
  return fx == 2 || fx == 3 || fx == 6 || fx == 7 || fx == 8 ||
         fx == 15 || fx == 16 || fx == 18;
}

void drawEye(int cx, int cy, bool isLeft) {
  float side = isLeft ? 1.0f : -1.0f;   // +1 = toward the nose
  float gx = constrain(eye.gx, -26.0f, 26.0f);
  float gy = constrain(eye.gy, -18.0f, 18.0f);

  // width is capped so the two eyes never merge; tall stretches are fine
  float rx = IRIS_RX * constrain(eye.irX, 0.5f, 1.02f);
  float ry = IRIS_RY * constrain(eye.irY, 0.5f, 1.2f);
  if (eye.fx == 17) {   // heartbeat: two quick thumps per cycle
    float a = max(0.0f, sinf(eye.fxP * 3.0f));
    float b = max(0.0f, sinf(eye.fxP * 3.0f - 0.7f));
    float beat = powf(a, 12.0f) + 0.6f * powf(b, 12.0f);
    rx *= 1.0f + 0.06f * beat;
    ry *= 1.0f + 0.06f * beat;
  }
  float ex = cx + gx * 0.35f;
  float ey = cy + gy * 0.35f;
  float bodyAng = -side * EYE_TILT;     // top of each eye leans outward

  // Blinking squashes the whole eye toward a point just below its middle
  float open  = 1.0f - 0.94f * constrain(eye.blinkT, 0.0f, 1.0f);
  float pivot = ey + ry * 0.45f;

  const PupilDef &pd = PUPILS[d_shape];
  float pupScale = constrain(eye.pupR, 0.4f, 1.6f);
  float prx = pd.rxF * rx * pupScale;
  float pry = pd.round ? prx : pd.ryF * ry * pupScale;
  float pu = pd.u, pv = pd.v;
  if (eye.fx == 9) { pu = min(0.62f, pu + 0.30f); pv -= 0.10f; }   // derp: cross-eyed
  float ppx = ex + side * pu * rx + gx * 0.65f;
  float ppy = ey + pv * ry + gy * 0.55f;
  float pupAng = side * pd.tilt;
  bool drawPupil = !fxReplacesPupil(eye.fx);

  uint16_t bodyC = (eye.colMix > 0.5f) ? eye.colOvr
                                       : blend565(d_irisC, eye.colOvr, eye.colMix);
  if (eye.fx == 1)  bodyC = hue565(eye.fxP * 1.5f + (isLeft ? 0.0f : 0.6f));
  if (eye.fx == 16) bodyC = blend565(bodyC, 0x0009, 0.8f);
  uint16_t pupC = isLeft ? d_pupilC : d_pupilC2;

  // Expression lids: a slanted black cut across the top (angry, drowsy)
  // and a flat one along the bottom
  float top = pivot + (ey - ry - pivot) * open;
  float bot = pivot + (ey + ry - pivot) * open;
  float bw  = isLeft ? eye.bwL : eye.bwR;
  float cutDepth = max(0.0f, eye.bwY) * 1.6f + max(0.0f, bw) * 0.9f;
  float cutSlope = max(0.0f, bw) * 0.025f * side;
  float cutA     = top + cutDepth - cutSlope * ex;
  float botCut   = bot - max(0.0f, eye.blinkB - 0.45f * eye.blinkT) * ry * 1.4f;

  // Smile: the bottom lid pushes up in a curve, highest in the middle
  float smile     = constrain(eye.smile, 0.0f, 1.0f);
  float smileBase = bot - smile * ry * 0.45f * open;
  float smileK    = smile * ry * 0.45f * open / (1.69f * rx * rx);   // arc spans the full eye width

  int y0 = max(0,     (int)floorf(pivot + (ey - ry - 2 - pivot) * open));
  int y1 = min(H - 1, (int)ceilf (pivot + (ey + ry + 2 - pivot) * open));
  uint32_t glitchSeed = millis() / 90;

  for (int Y = y0; Y <= y1; Y++) {
    if (Y > botCut) break;
    float sy = pivot + (Y - pivot) / open;
    float bx0, bx1;
    if (!ellSpan(ex, ey, rx, ry, bodyAng, sy, bx0, bx1)) continue;

    if (cutDepth > 0.3f || cutSlope != 0.0f) {
      if (fabsf(cutSlope) < 1e-4f) {
        if (Y < cutA) continue;
      } else {
        float xl = (Y - cutA) / cutSlope;
        if (cutSlope > 0) bx1 = min(bx1, xl);
        else              bx0 = max(bx0, xl);
      }
    }
    if (bx1 - bx0 < 0.5f) continue;

    // glitch: random bands of rows jump sideways and swap colours
    int  shift = 0;
    bool swapC = false;
    if (eye.fx == 4) {
      uint32_t h = (uint32_t)(Y / 7) * 2654435761u ^ glitchSeed * 40503u;
      h ^= h >> 13;
      if ((h & 7) == 0) { shift = (int)((h >> 4) % 17) - 8; swapC = (h >> 9) & 1; }
    }
    uint16_t rowBody = swapC ? pupC : bodyC;
    uint16_t rowPup  = swapC ? bodyC : pupC;

    float px0 = 0, px1 = 0;
    bool pupRow = drawPupil && ellSpan(ppx, ppy, prx, pry, pupAng, sy, px0, px1);

    auto seg = [&](float a0, float a1) {
      if (a1 - a0 < 0.5f) return;
      int i0 = (int)lroundf(a0) + shift, i1 = (int)lroundf(a1) + shift;
      if (eye.fx == 20) {   // rgb split fringes
        spr.drawFastHLine(i0 - 3, Y, i1 - i0, 0xF800);
        spr.drawFastHLine(i0 + 3, Y, i1 - i0, 0x07FF);
      }
      spr.drawFastHLine(i0, Y, i1 - i0, rowBody);
      if (!pupRow) return;
      float q0 = max(px0, a0), q1 = min(px1, a1);
      if (q1 - q0 < 0.5f) return;
      int j0 = (int)lroundf(q0) + shift;
      spr.drawFastHLine(j0, Y, max(1, (int)lroundf(q1) + shift - j0), rowPup);
    };

    if (smileK > 1e-6f && Y > smileBase) {
      float h = sqrtf((Y - smileBase) / smileK);
      seg(bx0, min(bx1, ex - h));
      seg(max(bx0, ex + h), bx1);
    } else {
      seg(bx0, bx1);
    }
  }

  fxPx = ppx;
  fxPy = pivot + (ppy - pivot) * open;
  fxRx = rx;
  fxRy = ry * open;
  fxSide = side;
  fxBodyC = bodyC;
  fxPupC = pupC;
  if (eye.fx != 0 && eye.fx != 5 && eye.fx != 19 && (open > 0.3f || eye.fx == 11)) {
    drawSpecialFX((int)ex, (int)(pivot + (ey - pivot) * open));
  }
}

// ─── Flat shapes for the effects ─────────────────────────
static void fillThickLine(float x0, float y0, float x1, float y1, float w, uint16_t c) {
  float dx = x1 - x0, dy = y1 - y0, len = sqrtf(dx * dx + dy * dy);
  if (len < 0.01f) return;
  float nx = -dy / len * w * 0.5f, ny = dx / len * w * 0.5f;
  spr.fillTriangle((int)(x0 + nx), (int)(y0 + ny), (int)(x1 + nx), (int)(y1 + ny),
                   (int)(x1 - nx), (int)(y1 - ny), c);
  spr.fillTriangle((int)(x0 + nx), (int)(y0 + ny), (int)(x1 - nx), (int)(y1 - ny),
                   (int)(x0 - nx), (int)(y0 - ny), c);
  spr.fillCircle((int)x0, (int)y0, (int)(w * 0.5f), c);
  spr.fillCircle((int)x1, (int)y1, (int)(w * 0.5f), c);
}

static void fillHeart(int x, int y, int r, uint16_t c) {
  spr.fillCircle(x - r / 2, y - r / 4, r / 2 + 1, c);
  spr.fillCircle(x + r / 2, y - r / 4, r / 2 + 1, c);
  spr.fillTriangle(x - r - 1, y - r / 8, x + r + 1, y - r / 8, x, y + r + 2, c);
}

static void fillStar(int x, int y, int r, float rot, uint16_t c) {
  int ir = r * 45 / 100;
  for (int i = 0; i < 5; i++) {
    float a0 = rot - PI / 2 + i * 2 * PI / 5;
    float a1 = a0 + PI / 5, a2 = a0 + 2 * PI / 5;
    int tx = x + (int)(r * cosf(a0)),  ty = y + (int)(r * sinf(a0));
    int ix = x + (int)(ir * cosf(a1)), iy = y + (int)(ir * sinf(a1));
    int nx = x + (int)(r * cosf(a2)),  ny = y + (int)(r * sinf(a2));
    spr.fillTriangle(x, y, tx, ty, ix, iy, c);
    spr.fillTriangle(x, y, ix, iy, nx, ny, c);
  }
}

// A drop: round at the bottom, pointed at the top
static void fillDrop(int x, int y, int r, int tip, uint16_t c) {
  spr.fillCircle(x, y, r, c);
  spr.fillTriangle(x - r, y, x + r, y, x, y - tip, c);
}

static void fillDiamond(int x, int y, int r, uint16_t c) {
  spr.fillTriangle(x - r, y, x + r, y, x, y - r, c);
  spr.fillTriangle(x - r, y, x + r, y, x, y + r, c);
}

// ─── Per-eye special effects ─────────────────────────────
// Same flat style as the eyes: solid shapes in the eye's own colours.
void drawSpecialFX(int cx, int cy) {
  float p  = eye.fxP;
  int   px = (int)fxPx, py = (int)fxPy;
  int   r  = max(4, (int)(fxRx * 0.42f));

  switch (eye.fx) {
    case 2: {   // heart pupils that beat
      float s = 1.0f + 0.15f * max(0.0f, sinf(p * 4.0f));
      fillHeart(px, py, (int)(r * s), 0xF8A6);
      break;
    }
    case 3:     // spinning star pupils
      fillStar(px, py, r * 115 / 100, p * 0.6f * fxSide, 0xFE60);
      break;
    case 6: {   // hypnotic rings sliding inward
      int maxR = (int)(min(fxRx, fxRy) * 0.78f);
      int off  = (int)fmodf(p * 10.0f, 12.0f);
      for (int ring = maxR + 12; ring > 2; ring -= 6) {
        int rr = ring - off;
        if (rr < 2 || rr > maxR) continue;
        spr.fillCircle(cx, cy, rr, ((ring / 6) % 2) ? fxPupC : fxBodyC);
      }
      break;
    }
    case 7: {   // loading spinner
      int head = (int)(p * 8.0f) % 8;
      int dr   = max(3, (int)(fxRx * 0.09f));
      for (int i = 0; i < 8; i++) {
        float a = i * PI / 4 * fxSide - PI / 2;
        int age = (head - i + 8) % 8;
        spr.fillCircle(cx + (int)(fxRx * 0.48f * cosf(a)), cy + (int)(fxRy * 0.48f * sinf(a)),
                       dr, blend565(fxPupC, fxBodyC, age / 8.0f));
      }
      break;
    }
    case 8:     // error: square pupils blinking on and off
      if ((int)(p * 6.0f) % 2 == 0)
        spr.fillRect(px - r * 6 / 10, py - r * 6 / 10, r * 12 / 10, r * 12 / 10, fxPupC);
      break;
    case 10: {  // frost sparkles
      const float SP[3][2] = { { -0.35f, -0.40f }, { 0.30f, -0.10f }, { -0.10f, 0.45f } };
      for (int i = 0; i < 3; i++) {
        int s = 2 + (int)(3.0f * fabsf(sinf(p * 0.8f + i * 2.1f)));
        fillDiamond(cx + (int)(SP[i][0] * fxRx * fxSide), cy + (int)(SP[i][1] * fxRy), s, 0xDFFF);
      }
      break;
    }
    case 11: {  // dream bubbles drifting up
      for (int i = 0; i < 3; i++) {
        float t = fmodf(p * 0.25f + i * 0.33f, 1.0f);
        int by = cy - (int)fxRy - 6 - (int)(t * 34.0f);
        if (by < 2) continue;
        spr.fillCircle(cx - (int)(fxSide * (8 - i * 8)), by, 2 + i, fxBodyC);
      }
      break;
    }
    case 12: {  // a tear running down from the inner corner
      float t = fmodf(p * 0.8f, 1.0f);
      int tx = cx + (int)(fxSide * fxRx * 0.45f);
      int ty = cy + (int)(fxRy * 0.55f) + (int)(t * 46.0f);
      if (ty < H - 6) fillDrop(tx, ty, 5, 12, 0x5D1F);
      break;
    }
    case 15: {  // dead: big X eyes
      int xr = (int)(min(fxRx, fxRy) * 0.5f);
      float w = max(5.0f, xr * 0.45f);
      fillThickLine(cx - xr, cy - xr, cx + xr, cy + xr, w, fxPupC);
      fillThickLine(cx + xr, cy - xr, cx - xr, cy + xr, w, fxPupC);
      break;
    }
    case 16: {  // galaxy: stars orbiting inside a darkened eye
      float lim = min(fxRx, fxRy) * 0.78f;
      for (int i = 0; i < 14; i++) {
        float ang = p * (0.6f + 0.08f * i) * fxSide + i * 2.4f;
        float rad = min(lim, fxRx * (0.10f + 0.05f * i));
        int sx = cx + (int)(rad * cosf(ang));
        int sy = cy + (int)(rad * sinf(ang) * fxRy / fxRx);
        spr.fillCircle(sx, sy, (i % 4 == 0) ? 2 : 1, (i % 3 == 0) ? 0xFFFF : fxPupC);
      }
      break;
    }
    case 18: {  // fire pupils
      float f1 = sinf(p * 9.0f + fxSide), f2 = sinf(p * 11.0f - fxSide);
      int base = py + r / 3;
      fillDrop(px, base,         r * 80 / 100, (int)(r * (2.2f + 0.4f * f1)), 0xF800);
      fillDrop(px, base + r / 8, r * 55 / 100, (int)(r * (1.6f + 0.3f * f2)), 0xFC00);
      fillDrop(px, base + r / 4, r * 30 / 100, r,                             0xFFE0);
      break;
    }
    default:
      break;   // 1, 4, 9, 13, 14, 17 and 20 happen inside drawEye()
  }
}

// ─── Full-screen special effects ─────────────────────────
void drawFXMatrix() {
  // Matrix rain — green characters falling
  spr.fillSprite(TFT_BLACK);
  static uint8_t col[20] = {0};
  static uint32_t lastDrop = 0;
  uint32_t now = millis();
  if (now - lastDrop > 80) {
    lastDrop = now;
    for (int c = 0; c < 20; c++) {
      if (col[c] > 0 || random(5) == 0) {
        if (col[c] < 15) col[c]++;
        else col[c] = 0;
        spr.drawChar(c * 12 + 2, col[c] * 16, (char)('A' + random(26)),
                     0x07E0, TFT_BLACK, 1);
        if (col[c] > 1)
          spr.drawChar(c * 12 + 2, (col[c]-1) * 16, (char)('0' + random(10)),
                       0x0320, TFT_BLACK, 1);
      }
    }
  }
}

void drawFXStarfield() {
  // Stars scrolling — sleep dreamscape
  spr.fillSprite(TFT_BLACK);
  float sp = rarePhase;
  uint32_t s = eyeSeed;
  for (int i = 0; i < 80; i++) {
    s = s * 1664525u + 1013904223u;
    float x = fmodf(((s >> 16) & 0xFF) + sp * 15, 240.0f);
    s = s * 1664525u + 1013904223u;
    float y = (s >> 16) & 0xFF;
    float bright = 0.4f + 0.6f * fabsf(sinf(sp + i));
    uint8_t br = (uint8_t)(bright * 31);
    uint16_t sc = tft.color565(br, br, (uint8_t)(bright * 63));
    spr.fillCircle((int)x % W, (int)y % H, (i % 3 == 0) ? 2 : 1, sc);
  }
  rarePhase += 0.04f;
}

// ════════════════════════════════════════════════════════
// UTILITY
// ════════════════════════════════════════════════════════
void sprFillEllipse(int cx, int cy, int rx, int ry, uint16_t c) {
  if (rx < 1 || ry < 1) return;
  for (int y = -ry; y <= ry; y++) {
    float t = 1.0f - (float)(y*y) / (float)(ry*ry);
    if (t < 0) continue;
    int xw = (int)(rx * sqrtf(t));
    if (xw > 0) spr.drawFastHLine(cx - xw, cy + y, xw * 2, c);
  }
}

void sprDrawEllipse(int cx, int cy, int rx, int ry, uint16_t c) {
  if (rx < 1 || ry < 1) return;
  int steps = max(rx, ry) * 4;
  int px = cx + rx, py = cy;
  for (int i = 1; i <= steps; i++) {
    float a = 2 * PI * i / steps;
    int nx = cx + (int)(rx * cosf(a));
    int ny = cy + (int)(ry * sinf(a));
    spr.drawLine(px, py, nx, ny, c);
    px = nx; py = ny;
  }
}

float lerpF(float a, float b, float t) {
  return a + (b - a) * t;
}

float easeInOut(float t) {
  t = constrain(t, 0.0f, 1.0f);
  return t < 0.5f ? 2*t*t : -1 + (4 - 2*t)*t;
}

uint16_t blend565(uint16_t a, uint16_t b, float t) {
  t = constrain(t, 0.0f, 1.0f);
  uint8_t ar=(a>>11)&0x1F, ag=(a>>5)&0x3F, ab=a&0x1F;
  uint8_t br=(b>>11)&0x1F, bg=(b>>5)&0x3F, bb=b&0x1F;
  return ((uint16_t)((uint8_t)(ar+(br-ar)*t) & 0x1F) << 11) |
         ((uint16_t)((uint8_t)(ag+(bg-ag)*t) & 0x3F) << 5) |
          (uint16_t)((uint8_t)(ab+(bb-ab)*t) & 0x1F);
}

// ─── Backlight ───────────────────────────────────────────
void setBacklight(uint8_t duty) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(BL_PIN, duty);
#else
  ledcWrite(BL_CH, duty);
#endif
}

// Dims with the eyes: full while awake, easing down through doze, nearly off
// asleep. Wakes fast, fades slow, so nothing snaps.
void updateBacklight() {
  static float bl = BL_AWAKE;
  float target = BL_AWAKE;
  if (curState == S_DOZE)
    target = BL_AWAKE + (BL_DOZE - BL_AWAKE) * min(1.0f, dozeLevel);
  else if (curState == S_SLEEP || curState == S_DREAMING)
    target = BL_SLEEP;
  bl += (target - bl) * ((target > bl) ? 0.25f : 0.02f);
  setBacklight((uint8_t)constrain(bl, 0.0f, 255.0f));
}
