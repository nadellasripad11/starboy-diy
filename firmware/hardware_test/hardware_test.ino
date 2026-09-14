// ============================================================
// STARBOY DIY — hardware test
// ============================================================
// Flash this BEFORE closing up the shell. It checks every part on its own
// and shows PASS / FAIL on the round screen and over Serial (115200).
//
//   1. screen      red, green, blue, white fills (look for dead lines)
//   2. backlight   fades down and back up on D2 (GPIO4)
//   3. i2c         scans the bus, expects the MPU6050 at 0x68
//   4. mpu6050     live accel; shake it and the SHAKE bar moves
//   5. ds18b20     finds the sensor and reads the temperature
//   6. mic         live peak-to-peak; clap and the SOUND bar moves
//
// Same pins and libraries as starboy_firmware.ino, and TFT_eSPI must use
// the User_Setup.h from firmware/starboy_firmware.
// ============================================================

#include <TFT_eSPI.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define I2C_SDA       6    // D4
#define I2C_SCL       7    // D5
#define ONE_WIRE_BUS  20   // D7
#define MIC_PIN       3    // D1
#define BL_PIN        4    // D2
#define BL_PWM_FREQ   5000
#define BL_PWM_BITS   8
#define BL_CH         0

TFT_eSPI          tft;
TFT_eSprite       spr(&tft);
Adafruit_MPU6050  mpu;
OneWire           oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);

bool    okI2C = false, okMPU = false, okTemp = false, okMic = false;
uint8_t mpuAddr = 0x68;

void setBacklight(uint8_t duty) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(BL_PIN, duty);
#else
  ledcWrite(BL_CH, duty);
#endif
}

void banner(const char *title, uint16_t bg, uint16_t fg) {
  tft.fillScreen(bg);
  tft.setTextColor(fg, bg);
  tft.setTextDatum(MC_DATUM);
  tft.drawString(title, 120, 120, 4);
}

void result(const char *name, bool ok, const String &detail) {
  Serial.printf("[%s] %-10s %s\n", ok ? "PASS" : "FAIL", name, detail.c_str());
}

int micPeakToPeak() {
  int lo = 4095, hi = 0;
  for (int i = 0; i < 64; i++) {
    int v = analogRead(MIC_PIN);
    lo = min(lo, v);
    hi = max(hi, v);
  }
  return hi - lo;
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n=== starboy hardware test ===");

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(BL_PIN, BL_PWM_FREQ, BL_PWM_BITS);
#else
  ledcSetup(BL_CH, BL_PWM_FREQ, BL_PWM_BITS);
  ledcAttachPin(BL_PIN, BL_CH);
#endif
  setBacklight(255);

  // 1. screen: if you can read this, SPI and the driver are fine
  tft.init();
  tft.setRotation(0);
  const uint16_t fills[4] = { TFT_RED, TFT_GREEN, TFT_BLUE, TFT_WHITE };
  const char   *names[4] = { "RED", "GREEN", "BLUE", "WHITE" };
  for (int i = 0; i < 4; i++) {
    banner(names[i], fills[i], i == 3 ? TFT_BLACK : TFT_WHITE);
    delay(700);
  }
  result("screen", true, "check the fills by eye: no dead lines or tint");

  // 2. backlight
  banner("BACKLIGHT", TFT_BLACK, TFT_WHITE);
  for (int d = 255; d >= 0; d -= 5)  { setBacklight(d); delay(8); }
  for (int d = 0;   d <= 255; d += 5) { setBacklight(d); delay(8); }
  result("backlight", true, "should have faded out and back in; if not, BL is on 3V3 not D2");

  // 3. i2c scan
  Wire.begin(I2C_SDA, I2C_SCL);
  String found;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      found += String(" 0x") + String(addr, HEX);
      if (addr == 0x68 || addr == 0x69) { okI2C = true; mpuAddr = addr; }
    }
  }
  result("i2c", okI2C, found.length() ? "found:" + found : "nothing on SDA=D4 SCL=D5");

  // 4. mpu6050
  if (mpuAddr == 0x69) Serial.println("note: MPU6050 is at 0x69, so AD0 is floating high; tie it to GND");
  okMPU = okI2C && mpu.begin(mpuAddr);
  if (okMPU) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    float mag = sqrtf(a.acceleration.x * a.acceleration.x + a.acceleration.y * a.acceleration.y +
                      a.acceleration.z * a.acceleration.z);
    okMPU = mag > 7.0f && mag < 12.5f;   // resting should read ~9.8 m/s²
    result("mpu6050", okMPU, String("gravity ") + String(mag, 1) + " m/s2 (expect ~9.8)");
  } else {
    result("mpu6050", false, "no response; check AD0 to GND and the I2C wires");
  }

  // 5. ds18b20
  ds18b20.begin();
  int count = ds18b20.getDeviceCount();
  if (count > 0) {
    ds18b20.requestTemperatures();
    float c = ds18b20.getTempCByIndex(0);
    okTemp = c > -20.0f && c < 60.0f && c != DEVICE_DISCONNECTED_C;
    result("ds18b20", okTemp, String(c, 1) + " C");
  } else {
    result("ds18b20", false, "not found; check DATA on D7 and the 4.7k pull-up to 3V3");
  }
  ds18b20.setWaitForConversion(false);

  // 6. mic: resting level should sit near the middle of the ADC range
  analogReadResolution(12);
  long sum = 0;
  for (int i = 0; i < 128; i++) sum += analogRead(MIC_PIN);
  int mid = sum / 128;
  okMic = mid > 800 && mid < 3300;
  result("mic", okMic, String("idle level ") + mid + " (expect ~2048)");

  Serial.println("--- live mode: shake it and clap ---");
  spr.createSprite(240, 240);
}

void drawBar(int y, const char *label, float frac, uint16_t c) {
  spr.setTextDatum(ML_DATUM);
  spr.setTextColor(TFT_WHITE, TFT_BLACK);
  spr.drawString(label, 44, y - 12, 2);
  spr.drawRoundRect(44, y, 152, 14, 4, TFT_DARKGREY);
  int w = (int)(148 * constrain(frac, 0.0f, 1.0f));
  if (w > 0) spr.fillRoundRect(46, y + 2, w, 10, 3, c);
}

void drawStatus(int y, const char *label, bool ok) {
  spr.setTextDatum(ML_DATUM);
  spr.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
  spr.drawString(label, 60, y, 2);
  spr.setTextDatum(MR_DATUM);
  spr.setTextColor(ok ? TFT_GREEN : TFT_RED, TFT_BLACK);
  spr.drawString(ok ? "PASS" : "FAIL", 180, y, 2);
}

void loop() {
  static uint32_t lastTemp = 0, lastPrint = 0;
  static float tempC = NAN, shake = 0;

  if (okMPU) {
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    float mag = sqrtf(a.acceleration.x * a.acceleration.x + a.acceleration.y * a.acceleration.y +
                      a.acceleration.z * a.acceleration.z);
    shake = shake * 0.8f + fabsf(mag - 9.8f) * 0.2f;
  }
  if (millis() - lastTemp > 1000) {
    if (okTemp) {
      tempC = ds18b20.getTempCByIndex(0);   // result of the previous non-blocking request
      ds18b20.requestTemperatures();
    }
    lastTemp = millis();
  }
  int p2p = micPeakToPeak();

  spr.fillSprite(TFT_BLACK);
  spr.setTextDatum(MC_DATUM);
  spr.setTextColor(TFT_WHITE, TFT_BLACK);
  spr.drawString("hardware test", 120, 36, 2);
  drawStatus(62, "motion", okMPU);
  drawStatus(80, "temperature", okTemp);
  drawStatus(98, "mic", okMic);
  drawBar(134, "SHAKE", shake / 16.0f, TFT_ORANGE);
  drawBar(170, "SOUND", p2p / 1200.0f, TFT_CYAN);
  spr.setTextDatum(MC_DATUM);
  spr.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
  spr.drawString(okTemp && tempC != DEVICE_DISCONNECTED_C ? String(tempC, 1) + " C" : String("-- C"), 120, 206, 2);
  spr.pushSprite(0, 0);

  if (millis() - lastPrint > 500) {
    Serial.printf("shake %.1f | sound p2p %d | temp %.1f C\n", shake, p2p, tempC);
    lastPrint = millis();
  }
  delay(20);
}
