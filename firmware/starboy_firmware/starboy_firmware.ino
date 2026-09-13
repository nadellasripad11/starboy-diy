// ============================================================
// STARBOY DIY — ESP32-C3 SuperMini Firmware
// ============================================================
// Hardware:
//   - ESP32-C3 SuperMini
//   - GC9A01 1.28" round TFT (240x240) via SPI
//   - MPU6050 accelerometer/gyro via I2C
//   - DS18B20 temperature sensor via OneWire
//   - INMP441 or MAX4466 mic (optional, for sound behaviors)
//
// Behaviors modeled on the real CREATURE STARBOY:
//   idle        → blink naturally, subtle gaze drift, slow doze
//   shake       → dizzy spinning eyes → angry squint
//   cold        → shiver animation (eyes tremble + squint)
//   loud sound  → anxious, scrunched eyes (requires mic)
//   tilt        → eyes follow gravity direction
//   deep idle   → eyes close, enter sleep mode
// ============================================================

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_GC9A01A.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// ─── Pin definitions ────────────────────────────────────────
#define TFT_DC    2
#define TFT_CS    3
#define TFT_RST   -1   // tie RESET to EN or leave -1
#define TFT_MOSI  6
#define TFT_SCLK  4

#define ONE_WIRE_BUS 5  // DS18B20 data pin

// MPU6050 on default I2C (SDA=8, SCL=9 on most C3 SuperMinis)
// Optional mic: analog pin A0 (GPIO 0) or I2S for INMP441
#define MIC_PIN   0     // MAX4466 analog output (comment out if unused)

// ─── Display ────────────────────────────────────────────────
Adafruit_GC9A01A tft(TFT_CS, TFT_DC, TFT_RST);

// ─── Sensors ────────────────────────────────────────────────
Adafruit_MPU6050 mpu;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

// ─── Colors (GC9A01A uses 16-bit 565) ───────────────────────
#define C_BG      0x0000   // black background
#define C_IRIS    0x07E0   // vivid green iris (like the reference photos)
#define C_PUPIL   0x0000   // black pupil
#define C_SCLERA  0xFFFF   // white sclera
#define C_SHINE   0xFFFF   // specular dot
#define C_EYELID  0x0000   // black eyelid
#define C_ANGRY   0xF800   // red tint for angry state
#define C_COLD    0x001F   // blue tint for cold state

// ─── Display geometry ───────────────────────────────────────
#define DISPLAY_RADIUS  120  // half of 240
#define EYE_X           90   // center of single eye (center of display)
#define EYE_Y           120
#define IRIS_R          52
#define PUPIL_R         28
#define SHINE_R         8

// ─── State machine ──────────────────────────────────────────
enum StarState {
  STATE_IDLE,
  STATE_BLINK,
  STATE_SHAKE_DIZZY,
  STATE_SHAKE_ANGRY,
  STATE_COLD_SHIVER,
  STATE_LOUD_ANXIOUS,
  STATE_TILT,
  STATE_DOZE,
  STATE_SLEEP,
};

StarState currentState = STATE_IDLE;
StarState prevState     = STATE_IDLE;
unsigned long stateEnteredAt = 0;
unsigned long lastInteractionAt = 0;
unsigned long lastBlinkAt = 0;
unsigned long nextBlinkIn = 0;
unsigned long lastTempRead = 0;
unsigned long lastMicSample = 0;
unsigned long lastFrame = 0;

// ─── Eye animation variables ────────────────────────────────
float eyeOffsetX = 0, eyeOffsetY = 0;      // gaze offset (iris wanders)
float eyeTargetX = 0, eyeTargetY = 0;
float blinkAmount = 0;   // 0 = fully open, 1 = fully closed
float shiverX = 0;
float dizzyAngle = 0;
int   angryFurrow = 0;
float dozeLevel = 0;

// ─── Sensor readings ────────────────────────────────────────
float accelX, accelY, accelZ;
float shakeEnergy = 0;
float ambientTemp = 20.0;
int   soundLevel = 0;
bool  hasMic = false;  // set true in setup() if mic pin is readable

// ─── Thresholds ─────────────────────────────────────────────
#define SHAKE_THRESHOLD    18.0f   // m/s² total shake energy
#define SHAKE_DURATION_MS  1200    // hold shake for this long to trigger
#define COLD_THRESHOLD     10.0f   // °C below this = shiver
#define LOUD_THRESHOLD     600     // raw ADC value (0–4095 on ESP32)
#define IDLE_DOZE_MS       20000UL // 20 s idle → start dozing
#define IDLE_SLEEP_MS      60000UL // 60 s idle → deep sleep animation

unsigned long shakeSince = 0;

// ────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Display
  tft.begin();
  tft.setRotation(0);
  tft.fillScreen(C_BG);

  // MPU6050
  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("MPU6050 not found — motion sensing disabled");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  // Temperature
  tempSensor.begin();

  // Mic (optional)
  pinMode(MIC_PIN, INPUT);
  // Quick ADC check — if it reads > 0 it's likely connected
  analogReadResolution(12);
  int micTest = analogRead(MIC_PIN);
  hasMic = (micTest > 10);

  lastInteractionAt = millis();
  lastBlinkAt = millis();
  nextBlinkIn = random(2000, 5000);

  randomSeed(analogRead(1));
  eyeTargetX = 0; eyeTargetY = 0;
}

// ────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // ── 1. Read sensors ──────────────────────────────────────
  readIMU(now);
  readTemp(now);
  if (hasMic) readMic(now);

  // ── 2. Decide state ──────────────────────────────────────
  updateState(now);

  // ── 3. Update animation variables ───────────────────────
  updateAnimations(now);

  // ── 4. Draw frame (target ~30 fps) ──────────────────────
  if (now - lastFrame >= 33) {
    lastFrame = now;
    drawFrame();
  }
}

// ────────────────────────────────────────────────────────────
// SENSOR READING
// ────────────────────────────────────────────────────────────
void readIMU(unsigned long now) {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  accelX = a.acceleration.x;
  accelY = a.acceleration.y;
  accelZ = a.acceleration.z;

  // Shake energy = deviation from gravity vector magnitude
  float mag = sqrt(accelX*accelX + accelY*accelY + accelZ*accelZ);
  shakeEnergy = abs(mag - 9.8f);

  if (shakeEnergy > SHAKE_THRESHOLD) {
    if (shakeSince == 0) shakeSince = now;
  } else {
    shakeSince = 0;
  }
}

void readTemp(unsigned long now) {
  if (now - lastTempRead > 5000) {
    lastTempRead = now;
    tempSensor.requestTemperatures();
    float t = tempSensor.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C) ambientTemp = t;
  }
}

void readMic(unsigned long now) {
  if (now - lastMicSample > 50) {
    lastMicSample = now;
    int raw = analogRead(MIC_PIN);
    // Rolling max with fast attack, slow decay
    if (raw > soundLevel) soundLevel = raw;
    else soundLevel = (int)(soundLevel * 0.92f);
  }
}

// ────────────────────────────────────────────────────────────
// STATE MACHINE
// ────────────────────────────────────────────────────────────
void setState(StarState s, unsigned long now) {
  prevState = currentState;
  currentState = s;
  stateEnteredAt = now;
}

void updateState(unsigned long now) {
  unsigned long idleFor = now - lastInteractionAt;

  // Priority ladder (highest first)

  // Shake overrides everything except angry follow-through
  if (currentState != STATE_SHAKE_ANGRY) {
    if (shakeSince > 0 && (now - shakeSince) > SHAKE_DURATION_MS) {
      if (currentState != STATE_SHAKE_DIZZY) {
        setState(STATE_SHAKE_DIZZY, now);
        lastInteractionAt = now;
      }
    }
  }

  // Dizzy → angry transition after 3 seconds
  if (currentState == STATE_SHAKE_DIZZY && (now - stateEnteredAt) > 3000) {
    setState(STATE_SHAKE_ANGRY, now);
  }

  // Angry cools off after 4 seconds → back to idle
  if (currentState == STATE_SHAKE_ANGRY && (now - stateEnteredAt) > 4000) {
    setState(STATE_IDLE, now);
  }

  // Cold
  if (currentState == STATE_IDLE || currentState == STATE_TILT || currentState == STATE_DOZE) {
    if (ambientTemp < COLD_THRESHOLD) {
      setState(STATE_COLD_SHIVER, now);
      lastInteractionAt = now;
    }
  }
  if (currentState == STATE_COLD_SHIVER && ambientTemp >= COLD_THRESHOLD + 2.0f) {
    setState(STATE_IDLE, now);  // warm enough, relax
  }

  // Loud sound
  if (hasMic && soundLevel > LOUD_THRESHOLD) {
    if (currentState == STATE_IDLE || currentState == STATE_TILT ||
        currentState == STATE_DOZE || currentState == STATE_SLEEP) {
      setState(STATE_LOUD_ANXIOUS, now);
      lastInteractionAt = now;
    }
  }
  if (currentState == STATE_LOUD_ANXIOUS && soundLevel < LOUD_THRESHOLD * 0.6f
      && (now - stateEnteredAt) > 2000) {
    setState(STATE_IDLE, now);
  }

  // Tilt — detected from gravity vector, low priority
  if (currentState == STATE_IDLE) {
    float tiltXY = sqrt(accelX*accelX + accelY*accelY);
    if (tiltXY > 3.0f) {
      setState(STATE_TILT, now);
    }
  }
  if (currentState == STATE_TILT) {
    float tiltXY = sqrt(accelX*accelX + accelY*accelY);
    if (tiltXY < 1.5f) setState(STATE_IDLE, now);
    else lastInteractionAt = now;
  }

  // Doze / sleep (idle timeout)
  if (currentState == STATE_IDLE) {
    if (idleFor > IDLE_SLEEP_MS) {
      setState(STATE_SLEEP, now);
    } else if (idleFor > IDLE_DOZE_MS) {
      setState(STATE_DOZE, now);
    }
  }
  // Any "real" interaction wakes from doze/sleep
  if ((currentState == STATE_DOZE || currentState == STATE_SLEEP) &&
      (shakeEnergy > 3.0f || (hasMic && soundLevel > LOUD_THRESHOLD * 0.4f))) {
    setState(STATE_IDLE, now);
    lastInteractionAt = now;
  }
}

// ────────────────────────────────────────────────────────────
// ANIMATION VARIABLE UPDATE
// ────────────────────────────────────────────────────────────
void updateAnimations(unsigned long now) {
  float dt = 0.033f;  // ~30fps step
  unsigned long stateAge = now - stateEnteredAt;

  // Gaze wander (idle, tilt, anxious)
  static unsigned long lastGazeShift = 0;
  static float gazeShiftInterval = 3000;

  switch (currentState) {

    case STATE_IDLE:
      dozeLevel = max(0.0f, dozeLevel - dt * 0.5f);
      angryFurrow = 0;
      shiverX = 0;

      // Smooth gaze tracking toward target
      eyeOffsetX += (eyeTargetX - eyeOffsetX) * 0.08f;
      eyeOffsetY += (eyeTargetY - eyeOffsetY) * 0.08f;

      // Periodic gaze shift (saccade)
      if (now - lastGazeShift > (unsigned long)gazeShiftInterval) {
        lastGazeShift = now;
        gazeShiftInterval = random(2000, 6000);
        eyeTargetX = random(-14, 14);
        eyeTargetY = random(-10, 10);
      }

      // Blink
      updateBlink(now);
      break;

    case STATE_TILT: {
      // Eyes follow tilt: gravity vector → gaze direction
      float tiltX = -accelY * 2.5f;  // invert for natural feel
      float tiltY =  accelX * 2.0f;
      tiltX = constrain(tiltX, -18.0f, 18.0f);
      tiltY = constrain(tiltY, -14.0f, 14.0f);
      eyeOffsetX += (tiltX - eyeOffsetX) * 0.1f;
      eyeOffsetY += (tiltY - eyeOffsetY) * 0.1f;
      updateBlink(now);
      break;
    }

    case STATE_SHAKE_DIZZY:
      // Iris spins in a circle
      dizzyAngle += dt * 5.0f;
      eyeOffsetX = cos(dizzyAngle) * 16.0f;
      eyeOffsetY = sin(dizzyAngle) * 14.0f;
      blinkAmount = 0.2f + 0.2f * sin(now * 0.008f);
      break;

    case STATE_SHAKE_ANGRY:
      // Eyes squint hard, furrow brows
      blinkAmount += (0.55f - blinkAmount) * 0.15f;
      angryFurrow = 12;
      eyeOffsetX *= 0.9f;
      eyeOffsetY *= 0.9f;
      // Tremor
      eyeOffsetX += (random(0, 100) - 50) * 0.04f;
      break;

    case STATE_COLD_SHIVER: {
      // Fast horizontal tremble + slight squint
      float phase = (float)now * 0.022f;
      shiverX = sin(phase) * 5.0f + sin(phase * 2.7f) * 3.0f;
      blinkAmount = 0.25f + 0.05f * sin(phase * 0.5f);
      eyeOffsetX = shiverX;
      eyeOffsetY += (0.0f - eyeOffsetY) * 0.1f;
      break;
    }

    case STATE_LOUD_ANXIOUS: {
      // Darting, scared eyes; heavy squint
      blinkAmount = 0.3f + 0.2f * sin(now * 0.01f);
      if (random(100) < 15) {
        eyeTargetX = random(-20, 20);
        eyeTargetY = random(-16, 16);
      }
      eyeOffsetX += (eyeTargetX - eyeOffsetX) * 0.15f;
      eyeOffsetY += (eyeTargetY - eyeOffsetY) * 0.15f;
      break;
    }

    case STATE_DOZE:
      // Eyes half-closed, gaze drifts slowly downward
      dozeLevel += (0.55f - dozeLevel) * 0.015f;
      blinkAmount = dozeLevel;
      eyeOffsetY += (8.0f - eyeOffsetY) * 0.02f;
      eyeOffsetX *= 0.98f;
      // Occasional slow blink
      if (now - lastBlinkAt > 6000) {
        blinkAmount = 0.8f;
        if (now - lastBlinkAt > 6300) lastBlinkAt = now;
      }
      break;

    case STATE_SLEEP:
      // Eyes closed, blinkAmount = 1
      blinkAmount += (1.0f - blinkAmount) * 0.05f;
      dozeLevel = 1.0f;
      eyeOffsetX *= 0.97f;
      eyeOffsetY *= 0.97f;
      // Tiny breathing oscillation on eyelid
      blinkAmount = 1.0f - 0.03f * (0.5f + 0.5f * sin(now * 0.002f));
      break;
  }
}

void updateBlink(unsigned long now) {
  if (now - lastBlinkAt > nextBlinkIn) {
    // Start blink
    blinkAmount = 1.0f;
    lastBlinkAt = now;
    nextBlinkIn = random(2000, 6000);
  } else {
    // Quick open after blink
    float timeSinceBlink = (now - lastBlinkAt);
    if (timeSinceBlink < 80) {
      blinkAmount = 1.0f;
    } else if (timeSinceBlink < 200) {
      blinkAmount = 1.0f - (timeSinceBlink - 80) / 120.0f;
    } else {
      blinkAmount = 0.0f;
    }
  }
}

// ────────────────────────────────────────────────────────────
// DRAWING
// ────────────────────────────────────────────────────────────
void drawFrame() {
  // Clear BG
  tft.fillCircle(DISPLAY_RADIUS, DISPLAY_RADIUS, DISPLAY_RADIUS, C_BG);

  // Choose iris color based on state
  uint16_t irisColor = C_IRIS;
  if (currentState == STATE_SHAKE_ANGRY) {
    // Shift iris toward red
    irisColor = blendColor(C_IRIS, C_ANGRY, 0.6f);
  } else if (currentState == STATE_COLD_SHIVER) {
    irisColor = blendColor(C_IRIS, C_COLD, 0.4f);
  }

  // Eye position
  int cx = EYE_X + (int)eyeOffsetX;
  int cy = EYE_Y + (int)eyeOffsetY;
  cx = constrain(cx, DISPLAY_RADIUS - 35, DISPLAY_RADIUS + 35);
  cy = constrain(cy, DISPLAY_RADIUS - 30, DISPLAY_RADIUS + 30);

  // Draw sclera (white of eye)
  tft.fillCircle(cx, cy, IRIS_R + 6, C_SCLERA);

  // Draw iris
  tft.fillCircle(cx, cy, IRIS_R, irisColor);

  // Iris detail rings (makes it look more like a real eye)
  tft.drawCircle(cx, cy, IRIS_R - 5, blendColor(irisColor, C_BG, 0.3f));
  tft.drawCircle(cx, cy, IRIS_R - 10, blendColor(irisColor, C_BG, 0.5f));

  // Draw pupil
  tft.fillCircle(cx, cy, PUPIL_R, C_PUPIL);

  // Specular shine dot
  tft.fillCircle(cx + 10, cy - 10, SHINE_R, C_SHINE);
  tft.fillCircle(cx + 14, cy - 6, 4, C_SHINE);

  // Draw eyelid (top)
  int lidCloseTop = (int)(blinkAmount * (IRIS_R + 8));
  if (lidCloseTop > 0) {
    // Draw a filled arc over the top of the eye to simulate closing lid
    for (int y = cy - IRIS_R - 8; y <= cy - IRIS_R - 8 + lidCloseTop; y++) {
      // Chord of the sclera circle
      float dy = (float)(y - cy);
      float chordHalf = sqrt(max(0.0f, (float)((IRIS_R+8)*(IRIS_R+8)) - dy*dy));
      tft.drawFastHLine((int)(cx - chordHalf), y, (int)(chordHalf * 2.0f), C_EYELID);
    }
  }

  // Bottom eyelid (slightly less movement for realism)
  int lidCloseBot = (int)(blinkAmount * (IRIS_R + 4) * 0.6f);
  if (lidCloseBot > 0) {
    for (int y = cy + IRIS_R + 4; y >= cy + IRIS_R + 4 - lidCloseBot; y--) {
      float dy = (float)(y - cy);
      float chordHalf = sqrt(max(0.0f, (float)((IRIS_R+6)*(IRIS_R+6)) - dy*dy));
      tft.drawFastHLine((int)(cx - chordHalf), y, (int)(chordHalf * 2.0f), C_EYELID);
    }
  }

  // Angry furrow mark (V-shape above the eye)
  if (angryFurrow > 0) {
    int fx = cx;
    int fy = cy - IRIS_R - 10;
    for (int t = 0; t < 3; t++) {
      tft.drawLine(fx - 16, fy - angryFurrow, fx, fy - 4 + t, C_EYELID);
    }
  }

  // Cold: blue tint flash on sclera
  if (currentState == STATE_COLD_SHIVER && ((millis() / 200) % 3 == 0)) {
    tft.drawCircle(cx, cy, IRIS_R + 5, C_COLD);
    tft.drawCircle(cx, cy, IRIS_R + 6, C_COLD);
  }
}

// ─── Utility: blend two 565 colors ─────────────────────────
uint16_t blendColor(uint16_t a, uint16_t b, float t) {
  uint8_t ar = (a >> 11) & 0x1F;
  uint8_t ag = (a >> 5)  & 0x3F;
  uint8_t ab = (a)       & 0x1F;
  uint8_t br = (b >> 11) & 0x1F;
  uint8_t bg = (b >> 5)  & 0x3F;
  uint8_t bb = (b)       & 0x1F;
  uint8_t cr = (uint8_t)(ar + (br - ar) * t);
  uint8_t cg = (uint8_t)(ag + (bg - ag) * t);
  uint8_t cb = (uint8_t)(ab + (bb - ab) * t);
  return ((uint16_t)cr << 11) | ((uint16_t)cg << 5) | (uint16_t)cb;
}
