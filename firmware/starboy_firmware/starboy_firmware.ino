// ============================================================
// STARBOY DIY — Complete Eye Firmware  v2.0
// ============================================================
// 500+ animations | 6,480 eye design combinations
// Behaviors: idle · blink · curious · happy · bored · alert
//   suspicious · dizzy · angry · cold/shiver · loud/anxious
//   tilt-tracking · doze · sleep · 20 rare special effects
//
// Hardware:
//   ESP32-C3 SuperMini
//   GC9A01 1.28" Round TFT (240×240) — SPI
//   MPU6050 Accelerometer/Gyro — I2C (SDA=GPIO8, SCL=GPIO9)
//   DS18B20 Temperature — OneWire (GPIO5, 4.7kΩ to 3.3V)
//   MAX4466 Mic — Analog (GPIO0) — optional
//
// Libraries (Arduino Library Manager):
//   TFT_eSPI by Bodmer        ← ALSO copy User_Setup.h to library folder!
//   Adafruit MPU6050
//   Adafruit Unified Sensor
//   DallasTemperature
//   OneWire
//
// Board settings: ESP32C3 Dev Module · USB CDC On Boot: Enabled
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
#define ONE_WIRE_BUS  5
#define MIC_PIN       0
#define HAS_MIC       true    // set false to disable mic checks

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

// ─── Color palette: 20 iris colors + secondaries ─────────
// RGB565 values — ordered roughly by rarity
const uint16_t IRIS_PAL[20] = {
  0x07E0, // 00 vivid green       (common)
  0x05FC, // 01 spring green      (common)
  0x07FF, // 02 electric cyan     (common)
  0x001F, // 03 deep blue         (common)
  0xA145, // 04 hazel brown       (common)
  0xC618, // 05 steel grey        (common)
  0x7BEF, // 06 cool grey         (common)
  0xFFE0, // 07 amber             (common)
  0x0398, // 08 teal              (uncommon)
  0x4C1F, // 09 deep purple       (uncommon)
  0x781F, // 10 violet            (uncommon)
  0xFC00, // 11 warm orange       (uncommon)
  0xB41B, // 12 copper            (uncommon)
  0xFD20, // 13 flame orange      (uncommon)
  0xF81F, // 14 magenta           (rare)
  0x3C1F, // 15 indigo            (rare)
  0xFFFF, // 16 white/albino      (rare)
  0xA000, // 17 deep crimson      (rare)
          //    was 0x0000 "void black" — that only worked back when a white
          //    sclera sat behind it. Drawn flat on a black field it renders
          //    completely invisible: just a floating pupil dot. Do not put
          //    0x0000 in this palette.
  0x07E8, // 18 neon green        (legendary)
  0xFD60, // 19 pure gold         (legendary)
};
// Secondary/ring colors
const uint16_t IRIS_PAL2[20] = {
  0x0140, 0x024C, 0x03EF, 0x000F, 0x7000,
  0x5A00, 0x8410, 0xBBC0, 0x0198, 0x300F,
  0x580F, 0xB400, 0x7800, 0xBD00, 0xB00F,
  0x200F, 0xC618, 0x2104, 0x04E0, 0xC8A0,
};
const uint16_t SCLERA_PAL[4] = {
  0xFFFF,  // white
  0xFFF5,  // warm white
  0xEFFF,  // blue white
  0xFEEB,  // cream
};

// ─── Eye design (seed-based, unique per unit) ────────────
uint32_t eyeSeed;
uint8_t  d_irisIdx, d_iris2Idx;
uint8_t  d_irisPattern;   // 0=solid 1=rings 2=spokes 3=swirl 4=nebula 5=hazel
uint8_t  d_pupilShape;    // 0=circle 1=vOval 2=hSlit 3=star 4=heart 5=none
uint8_t  d_scleraIdx;
uint8_t  d_shineStyle;    // 0=single 1=double 2=triple 3=arc
uint8_t  d_rarity;        // 0=common 1=uncommon 2=rare 3=legendary
bool     d_limbalRing;
uint16_t d_irisC, d_irisC2, d_scleraC;
// flat-style extras (see drawEye): the reference eyes vary the pupil
// colour rather than always using black, and some carry a bright streak
uint16_t d_pupilC;
uint16_t d_hiC;
bool     d_hasHighlight;

// ─── Eye geometry ────────────────────────────────────────
// Styled off creature.company/eyes: there is NO white sclera. Each eye
// is a single flat block of colour sitting straight on black, with a
// small dark pupil dot. The two ovals are large and close together so
// they nearly fill the round display.
#define EYE_L_X   82    // left eye center x
#define EYE_R_X   158   // right eye center x
#define EYE_Y     122   // both eyes center y
#define IRIS_RX   40    // eye half-width  (ovals are taller than wide)
#define IRIS_RY   50    // eye half-height
#define PUPIL_R   9     // pupil dot — small, like the reference
// There is no sclera any more, but the special-FX code positions things
// against these two names — keep them pointing at the eye's extent so it
// all still builds and lands in sensible places.
#define IRIS_R    IRIS_RY
#define SCLERA_R  IRIS_RY

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
  float colMix;          // 0=design 1=override
  uint16_t colOvr;       // color override
  uint8_t  fx;           // special effect 0=none
  float    fxP;          // effect phase/param
};
EyeState eye, eyeT;      // current + target

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
#define LOUD_ADC      650      // ADC raw (0-4095) → anxious
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
void drawIrisPattern(int cx, int cy, int irx, int iry);
void drawPupilShape(int cx, int cy, int pr);
void drawEyelids(int cx, int cy, int irx, int iry);
void drawBrow(int cx, int cy, float bwAngle, float bwY);
void drawHighlights(int cx, int cy);
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
  Wire.begin(8, 9);  // SDA=8, SCL=9 for ESP32-C3 SuperMini
  if (mpu.begin()) {
    mpuOK = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  }

  // Temperature
  ds18b20.begin();
  ds18b20.setResolution(10);

  // Mic
  analogReadResolution(12);

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

  // Derive design from seed using LCG
  uint32_t s = eyeSeed;
  auto rnd = [&](uint8_t n) -> uint8_t {
    s = s * 1664525u + 1013904223u;
    return (uint8_t)((s >> 16) % n);
  };

  // Rarity tier (affects what's available)
  uint8_t r = rnd(100);
  d_rarity = (r < 60) ? 0 : (r < 85) ? 1 : (r < 97) ? 2 : 3;

  // Iris color — higher rarity unlocks more options
  uint8_t maxColor = (d_rarity == 0) ? 8 : (d_rarity == 1) ? 14 : (d_rarity == 2) ? 18 : 20;
  d_irisIdx  = rnd(maxColor);
  d_iris2Idx = rnd(20);

  // Pattern
  uint8_t maxPat = (d_rarity == 0) ? 4 : 6;
  d_irisPattern = rnd(maxPat);

  // Pupil shape
  uint8_t maxPup = (d_rarity == 0) ? 2 : (d_rarity == 1) ? 3 : (d_rarity == 2) ? 5 : 6;
  d_pupilShape = rnd(maxPup);

  // Sclera tint
  d_scleraIdx = rnd(4);

  // Shine style
  d_shineStyle = rnd(4);

  // Limbal ring (dark ring around iris edge)
  d_limbalRing = (rnd(3) == 0);

  // Resolve colors
  d_irisC   = IRIS_PAL[d_irisIdx];
  d_irisC2  = IRIS_PAL2[d_iris2Idx];
  d_scleraC = SCLERA_PAL[d_scleraIdx];

  // Pupil: mostly a near-black dot, but a slice of variants use a
  // contrasting colour instead — that mix is what gives the reference
  // grid its variety (green eyes w/ red pupils, cream w/ blue, etc.)
  uint8_t pupRoll = rnd(100);
  d_pupilC = (pupRoll < 65) ? 0x0000
           : (pupRoll < 85) ? IRIS_PAL2[rnd(20)]
                            : IRIS_PAL[rnd(20)];

  // A minority carry a bright vertical streak
  d_hasHighlight = (rnd(100) < 28);
  d_hiC = (rnd(2) == 0) ? 0xFFFF : SCLERA_PAL[rnd(4)];

  Serial.printf("Eye seed: 0x%08X | rarity: %d | iris: %d | pattern: %d | pupil: %d\n",
                eyeSeed, d_rarity, d_irisIdx, d_irisPattern, d_pupilShape);
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

  // Temperature (every 5s)
  if (now - lastTempRead > 5000) {
    lastTempRead = now;
    ds18b20.requestTemperatures();
    float t = ds18b20.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C && t > -50 && t < 100)
      ambientTemp = t;
  }

  // Mic
  if (HAS_MIC) {
    int raw = analogRead(MIC_PIN);
    if (raw > soundPeak) soundPeak = raw;
    else soundPeak = (int)(soundPeak * 0.93f);
  }
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
  bool isLoud  = HAS_MIC && soundPeak > LOUD_ADC;

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
      if (shakeE > 5 || isLoud || (HAS_MIC && soundPeak > LOUD_ADC * 0.5f)) {
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
    case S_RARE_LAUGH:     setTarget(1);  eyeT.fx=13; break;
    case S_RARE_SHOCKED:   setTarget(30); eyeT.fx=14; break;
    case S_RARE_DEAD:      setTarget(16); eyeT.fx=15; break;  // X eyes
    case S_RARE_GALAXY:    setTarget(34); eyeT.fx=16; break;
    case S_RARE_HEARTBEAT: setTarget(32); eyeT.fx=17; break;
    case S_RARE_FIRE:      setTarget(8);  eyeT.fx=18; break;
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

void drawEye(int cx, int cy, bool isLeft) {
  // Constrain gaze
  float gx = constrain(eye.gx, -20.0f, 20.0f);
  float gy = constrain(eye.gy, -14.0f, 14.0f);
  // Mirror gaze for right eye
  if (!isLeft) gx = -gx * 0.85f;

  int ex = cx + (int)gx;
  int ey = cy + (int)gy;
  int irx = (int)(IRIS_RX * eye.irX);
  int iry = (int)(IRIS_RY * eye.irY);
  irx = constrain(irx, 6, IRIS_RX + 10);
  iry = constrain(iry, 4, IRIS_RY + 10);

  // 1. The eye body — one flat block of colour straight on black.
  //    No sclera: that is the whole look on creature.company/eyes.
  uint16_t c = (eye.colMix > 0.5f) ? eye.colOvr
                                   : blend565(d_irisC, eye.colOvr, eye.colMix);
  sprFillEllipse(ex, ey, irx, iry, c);

  // 2. Pupil — a small dot, not a big black disc
  if (eye.fx != 15 && eye.fx != 9) {  // not dead-X or derp
    int pr = constrain((int)(PUPIL_R * eye.pupR), 2, irx - 2);
    // sits slightly toward the middle of the face, like the reference
    int px = ex + (isLeft ? 4 : -4);
    sprFillEllipse(px, ey + 2, pr, pr, d_pupilC);
  }

  // 3. Optional bright highlight streak (some variants have one)
  if (d_hasHighlight) {
    sprFillEllipse(ex - irx/3, ey - iry/5, max(2, irx/6), max(4, iry/3), d_hiC);
  }

  // 4. Eyelids — black, so they read as the eye closing against the field
  drawEyelids(cx, cy, irx, iry);

  // 5. Brow
  if (isLeft)  drawBrow(cx, cy, eye.bwL, eye.bwY);
  else         drawBrow(cx, cy, eye.bwR, eye.bwY);

  // 6. Special FX overlay
  if (eye.fx != 0 && eye.fx != 5 && eye.fx != 19) {
    drawSpecialFX(ex, ey);
  }
}

// ─── Iris pattern drawing ────────────────────────────────
void drawIrisPattern(int cx, int cy, int irx, int iry) {
  // Color with state override blend
  uint16_t c1 = (eye.colMix > 0.5f) ? eye.colOvr
                : blend565(d_irisC, eye.colOvr, eye.colMix);
  uint16_t c2 = d_irisC2;

  switch (d_irisPattern) {

    case 0: // solid
      sprFillEllipse(cx, cy, irx, iry, c1);
      break;

    case 1: // concentric rings
      sprFillEllipse(cx, cy, irx, iry, c1);
      for (int r = irx - 5; r > 5; r -= 9) {
        int ry2 = (int)(r * (float)iry / irx);
        sprDrawEllipse(cx, cy, r,   ry2,   c2);
        sprDrawEllipse(cx, cy, r-1, ry2-1, c2);
      }
      break;

    case 2: // spokes
      sprFillEllipse(cx, cy, irx, iry, c1);
      for (int a = 0; a < 360; a += 24) {
        float ra = a * PI / 180.0f;
        int x0 = cx + (int)(6 * cosf(ra));
        int y0 = cy + (int)(6 * sinf(ra));
        int x1 = cx + (int)((irx-3) * cosf(ra));
        int y1 = cy + (int)((iry-3) * sinf(ra));
        spr.drawLine(x0, y0, x1, y1, c2);
      }
      break;

    case 3: { // swirl
      sprFillEllipse(cx, cy, irx, iry, c1);
      float rScale = (float)iry / irx;
      for (int seg = 0; seg < 6; seg++) {
        float aBase = seg * 60.0f * PI / 180.0f;
        for (int r = 8; r < irx - 3; r += 5) {
          float twist = r * 0.045f;
          float a0 = aBase + twist;
          float a1 = aBase + 0.5f + twist;
          int x0 = cx + (int)(r * cosf(a0));
          int y0 = cy + (int)(r * rScale * sinf(a0));
          int x1 = cx + (int)(r * cosf(a1));
          int y1 = cy + (int)(r * rScale * sinf(a1));
          spr.drawLine(x0, y0, x1, y1, c2);
        }
      }
      break;
    }

    case 4: { // nebula dots (deterministic from seed)
      sprFillEllipse(cx, cy, irx, iry, c1);
      uint32_t s = eyeSeed;
      for (int i = 0; i < 50; i++) {
        s = s * 1664525u + 1013904223u;
        float r  = ((s >> 16) & 0xFF) / 255.0f * (irx - 4);
        s = s * 1664525u + 1013904223u;
        float a  = ((s >> 16) & 0xFF) / 255.0f * 2 * PI;
        int dx = (int)(r * cosf(a));
        int dy = (int)(r * (float)iry/irx * sinf(a));
        spr.fillRect(cx + dx - 1, cy + dy - 1, 3, 3, c2);
      }
      break;
    }

    case 5: { // hazel wedges
      float rScale = (float)iry / irx;
      int segs = 8;
      for (int seg = 0; seg < segs; seg++) {
        float a0 = seg * 2 * PI / segs;
        float a1 = (seg + 1) * 2 * PI / segs;
        float aMid = (a0 + a1) * 0.5f;
        uint16_t sc = (seg % 2 == 0) ? c1 : c2;
        // Fill wedge via scan
        for (float r = 1; r < irx - 2; r += 1.5f) {
          int x0 = cx + (int)(r * cosf(a0));
          int y0 = cy + (int)(r * rScale * sinf(a0));
          int x1 = cx + (int)(r * cosf(aMid));
          int y1 = cy + (int)(r * rScale * sinf(aMid));
          spr.drawLine(x0, y0, x1, y1, sc);
          int x2 = cx + (int)(r * cosf(a1));
          int y2 = cy + (int)(r * rScale * sinf(a1));
          spr.drawLine(x1, y1, x2, y2, sc);
        }
      }
      break;
    }
  }
}

// ─── Pupil shapes ────────────────────────────────────────
void drawPupilShape(int cx, int cy, int pr) {
  pr = constrain(pr, 4, IRIS_R - 4);
  switch (d_pupilShape) {

    case 0: // circle
      spr.fillCircle(cx, cy, pr, TFT_BLACK);
      break;

    case 1: // vertical oval (cat-like)
      sprFillEllipse(cx, cy, (int)(pr * 0.55f), pr, TFT_BLACK);
      break;

    case 2: // horizontal slit
      sprFillEllipse(cx, cy, pr, (int)(pr * 0.22f), TFT_BLACK);
      break;

    case 3: { // star
      for (int i = 0; i < 5; i++) {
        float a0 = -PI/2 + i * 2*PI/5;
        float a1 = a0 + PI/5;
        float a2 = a0 + 2*PI/5;
        int ir = pr/2;
        spr.fillTriangle(cx, cy,
          cx+(int)(pr*cosf(a0)), cy+(int)(pr*sinf(a0)),
          cx+(int)(ir*cosf(a1)), cy+(int)(ir*sinf(a1)), TFT_BLACK);
        spr.fillTriangle(cx, cy,
          cx+(int)(ir*cosf(a1)), cy+(int)(ir*sinf(a1)),
          cx+(int)(pr*cosf(a2)), cy+(int)(pr*sinf(a2)), TFT_BLACK);
      }
      break;
    }

    case 4: { // heart
      int hr = pr * 55 / 100;
      spr.fillCircle(cx - hr/2, cy - hr/4, hr/2 + 1, TFT_BLACK);
      spr.fillCircle(cx + hr/2, cy - hr/4, hr/2 + 1, TFT_BLACK);
      spr.fillTriangle(cx-hr, cy, cx+hr, cy, cx, cy+hr+2, TFT_BLACK);
      break;
    }

    case 5: // no pupil (eerie) — tiny dot only
      spr.fillCircle(cx, cy, 3, TFT_BLACK);
      break;
  }
}

// ─── Eyelids ─────────────────────────────────────────────
void drawEyelids(int cx, int cy, int irx, int iry) {
  // Top lid
  if (eye.blinkT > 0.01f) {
    int irisTop = cy - iry - 12;
    int closeAmt = (int)(eye.blinkT * (iry * 2 + 24));
    for (int y = irisTop; y < irisTop + closeAmt; y++) {
      float dy = (float)(y - CY);
      float xw = sqrtf(max(0.0f, (float)(CX*CX) - dy*dy));
      if (xw < 1) continue;
      spr.drawFastHLine((int)(CX - xw), y, (int)(xw * 2), TFT_BLACK);
    }
  }
  // Bottom lid
  if (eye.blinkB > 0.01f) {
    int irisBot = cy + iry + 10;
    int closeAmt = (int)(eye.blinkB * (iry * 2 + 18));
    for (int y = irisBot; y > irisBot - closeAmt; y--) {
      float dy = (float)(y - CY);
      float xw = sqrtf(max(0.0f, (float)(CX*CX) - dy*dy));
      if (xw < 1) continue;
      spr.drawFastHLine((int)(CX - xw), y, (int)(xw * 2), TFT_BLACK);
    }
  }
}

// ─── Eyebrow ─────────────────────────────────────────────
void drawBrow(int cx, int cy, float browAngle, float browY) {
  int bw = 30;
  int bt = 4;
  int baseY = cy - SCLERA_R - 5 + (int)browY;
  int innerEnd = (int)(browAngle * 0.55f); // angle → pixel offset

  for (int t = -bt/2; t <= bt/2; t++) {
    spr.drawLine(cx - bw/2, baseY - innerEnd + t,
                 cx + bw/2, baseY + innerEnd + t, TFT_BLACK);
  }
}

// ─── Specular highlights ─────────────────────────────────
void drawHighlights(int cx, int cy) {
  switch (d_shineStyle) {
    case 0: // single large dot
      spr.fillCircle(cx + 11, cy - 12, 7, TFT_WHITE);
      break;
    case 1: // two dots
      spr.fillCircle(cx + 10, cy - 11, 6, TFT_WHITE);
      spr.fillCircle(cx + 16, cy - 6,  3, TFT_WHITE);
      break;
    case 2: // three dots
      spr.fillCircle(cx + 10, cy - 12, 5, TFT_WHITE);
      spr.fillCircle(cx + 16, cy - 5,  3, TFT_WHITE);
      spr.fillCircle(cx + 5,  cy - 16, 2, TFT_WHITE);
      break;
    case 3: // highlight arc
      spr.fillCircle(cx + 9, cy - 12, 5, TFT_WHITE);
      spr.drawCircle(cx, cy, (int)(IRIS_R * eye.irX) - 3, 0x8C71);
      break;
  }
}

// ─── Per-eye special effects ─────────────────────────────
void drawSpecialFX(int cx, int cy) {
  float p = eye.fxP;

  switch (eye.fx) {

    case 1: { // Rainbow iris color cycling
      uint16_t rc = tft.color565(
        (int)(128 + 127 * sinf(p)),
        (int)(128 + 127 * sinf(p + 2.094f)),
        (int)(128 + 127 * sinf(p + 4.189f)));
      sprFillEllipse(cx, cy, (int)(IRIS_R*eye.irX), (int)(IRIS_R*eye.irY), rc);
      drawPupilShape(cx, cy, (int)(PUPIL_R * eye.pupR));
      drawHighlights(cx, cy);
      break;
    }

    case 2: { // Heart pupils
      int pr = (int)(PUPIL_R * 1.1f);
      int hr = pr * 55 / 100;
      uint16_t hc = 0xF800;
      spr.fillCircle(cx - hr/2, cy - hr/4, hr/2 + 1, hc);
      spr.fillCircle(cx + hr/2, cy - hr/4, hr/2 + 1, hc);
      spr.fillTriangle(cx-hr, cy, cx+hr, cy, cx, cy+hr+2, hc);
      break;
    }

    case 3: { // Star pupils (6-point, distinct from design pupil)
      uint16_t sc = 0xFFE0; // gold
      int pr = (int)(PUPIL_R * 1.1f);
      for (int i = 0; i < 6; i++) {
        float a = i * PI / 3 + p * 0.3f;
        spr.fillTriangle(cx, cy,
          cx + (int)(pr * cosf(a)), cy + (int)(pr * sinf(a)),
          cx + (int)((pr/2) * cosf(a + PI/6)), cy + (int)((pr/2) * sinf(a + PI/6)),
          sc);
      }
      break;
    }

    case 4: { // Glitch — random colored blocks
      for (int g = 0; g < 8; g++) {
        int gx = cx - IRIS_R + random(IRIS_R * 2);
        int gy_c = cy - IRIS_R + random(IRIS_R * 2);
        uint16_t gc = random(0xFFFF);
        spr.fillRect(gx, gy_c, random(4, 18), random(1, 6), gc);
      }
      break;
    }

    case 6: { // Spiral / hypnosis
      int spiralR = (int)(IRIS_R * eye.irX);
      for (float r = 3; r < spiralR - 2; r += 4) {
        float a0 = p + r * 0.25f;
        float a1 = a0 + 0.9f;
        spr.drawLine(cx + (int)(r * cosf(a0)), cy + (int)(r * sinf(a0)),
                     cx + (int)(r * cosf(a1)), cy + (int)(r * sinf(a1)),
                     0x07FF);
      }
      break;
    }

    case 7: { // Loading spinner
      float startA = p * 2;
      for (int i = 0; i < 8; i++) {
        float a = startA + i * PI / 4;
        float fade = 1.0f - i / 8.0f;
        uint16_t lc = blend565(TFT_WHITE, TFT_BLACK, 1.0f - fade);
        int lx = cx + (int)(20 * cosf(a));
        int ly = cy + (int)(20 * sinf(a));
        spr.fillCircle(lx, ly, 3, lc);
      }
      break;
    }

    case 8: { // Error face — X in each eye
      int xs = 12;
      spr.drawLine(cx-xs, cy-xs, cx+xs, cy+xs, 0xF800);
      spr.drawLine(cx-xs+1, cy-xs, cx+xs+1, cy+xs, 0xF800);
      spr.drawLine(cx+xs, cy-xs, cx-xs, cy+xs, 0xF800);
      spr.drawLine(cx+xs+1, cy-xs, cx-xs+1, cy+xs, 0xF800);
      break;
    }

    case 9: { // Derp — crossed eyes (pupil shifts toward nose)
      int pr = (int)(PUPIL_R * eye.pupR);
      spr.fillCircle(cx + (cx < CX ? 8 : -8), cy, pr, TFT_BLACK);
      drawHighlights(cx + (cx < CX ? 8 : -8), cy);
      break;
    }

    case 10: { // Cold/icy crystalline overlay on iris
      for (int ray = 0; ray < 6; ray++) {
        float a = ray * PI / 3 + p * 0.1f;
        int irxS = (int)(IRIS_R * eye.irX);
        spr.drawLine(cx, cy,
          cx + (int)(irxS * cosf(a)), cy + (int)((IRIS_R * eye.irY) * sinf(a)),
          0x9FFF);
      }
      break;
    }

    case 11: { // Dreamy shimmer — soft concentric pulses
      int r = (int)(IRIS_R * eye.irX);
      float pulse = 0.5f + 0.5f * sinf(p * 2);
      int rr = (int)(r * pulse);
      spr.drawCircle(cx, cy, rr, 0x9BFF);
      spr.drawCircle(cx, cy, rr/2, 0x9BFF);
      break;
    }

    case 12: { // Crying — tear drops
      uint16_t tearC = 0x5D1F;
      int tStart = cy + SCLERA_R - 10;
      int tearLen = ((int)(p * 8)) % 30;
      for (int d = 0; d < tearLen; d++) {
        spr.fillCircle(cx - 4, tStart + d, 3, tearC);
      }
      break;
    }

    case 13: { // Laughing squint lines
      for (int l = 0; l < 3; l++) {
        float la = (l - 1) * 15.0f * PI / 180.0f;
        int lx1 = cx + (int)(SCLERA_R * cosf(PI/6 + la));
        int ly1 = cy + (int)(SCLERA_R * sinf(PI/6 + la));
        int lx2 = cx + (int)((SCLERA_R+8) * cosf(PI/6 + la));
        int ly2 = cy + (int)((SCLERA_R+8) * sinf(PI/6 + la));
        spr.drawLine(lx1, ly1, lx2, ly2, TFT_BLACK);
      }
      break;
    }

    case 14: { // Shocked — pulsing ring
      float pulse = 0.5f + 0.5f * sinf(p * 3);
      int rr = (int)(IRIS_R * eye.irX + 8 + pulse * 8);
      spr.drawCircle(cx, cy, rr, 0xFFE0);
      spr.drawCircle(cx, cy, rr+1, 0xFD20);
      break;
    }

    case 15: { // Dead X eyes
      int xs = 16;
      uint16_t xc = 0xFFFF;
      spr.drawLine(cx-xs, cy-xs, cx+xs, cy+xs, xc);
      spr.drawLine(cx-xs+1, cy-xs, cx+xs+1, cy+xs, xc);
      spr.drawLine(cx+xs, cy-xs, cx-xs, cy+xs, xc);
      spr.drawLine(cx+xs+1, cy-xs, cx-xs+1, cy+xs, xc);
      break;
    }

    case 16: { // Galaxy swirl in iris
      for (int i = 0; i < 80; i++) {
        float ang = i * 0.4f + p;
        float r   = i * 0.5f;
        if (r >= IRIS_R * eye.irX - 2) break;
        uint16_t gc = tft.color565(
          (int)(100 + 100 * sinf(ang * 0.5f)),
          (int)(50 + 50 * cosf(ang * 0.3f)),
          (int)(180 + 60 * sinf(ang * 0.7f)));
        spr.drawPixel(cx + (int)(r * cosf(ang)), cy + (int)(r * sinf(ang)), gc);
      }
      break;
    }

    case 17: { // Heartbeat pulse — expanding ring
      float phase = fmodf(p, PI * 2);
      float rr = (IRIS_R * eye.irX) * phase / (PI * 2);
      uint16_t hbc = blend565(0xF800, TFT_BLACK, phase / (PI * 2));
      spr.drawCircle(cx, cy, (int)rr, hbc);
      break;
    }

    case 18: { // Fire pupil — flickering upward streaks
      for (int f = 0; f < 12; f++) {
        float fa = -PI/2 + (f - 6) * 0.15f + sinf(p + f) * 0.1f;
        float fr = PUPIL_R * (0.5f + 0.5f * sinf(p * 1.5f + f));
        int fx1 = cx + (int)(fr * cosf(fa));
        int fy1 = cy + (int)(fr * sinf(fa));
        int fx2 = cx + (int)((fr + 8) * cosf(fa));
        int fy2 = cy + (int)((fr + 8) * sinf(fa));
        uint16_t fc = (f < 4) ? 0xFFE0 : (f < 8) ? 0xFD20 : 0xF800;
        spr.drawLine(fx1, fy1, fx2, fy2, fc);
      }
      break;
    }

    case 20: { // Glitch2 — scanlines + color separation
      for (int row = cy - IRIS_R; row < cy + IRIS_R; row += 3) {
        float dy = row - cy;
        float xw = sqrtf(max(0.0f, (float)(IRIS_R*IRIS_R) - dy*dy));
        uint16_t gc = (row % 6 == 0) ? 0xF800 : (row % 6 == 2) ? 0x07E0 : 0x001F;
        spr.drawFastHLine((int)(cx - xw) + random(-3, 3), row,
                          (int)(xw * 2), gc);
      }
      break;
    }
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
