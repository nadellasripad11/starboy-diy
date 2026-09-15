// ============================================================
// Serial tuning console (115200 baud, newline line endings)
// ============================================================
// Lets you tune a real star without reflashing. Type `help` in the
// Arduino Serial Monitor.
//
//   status                 sensors, state, eyes and all tuning values
//   mood <name>            jump to a mood (idle, happy, dizzy, shiver, sleep...)
//   fx <name>              play a rare effect (hearts, fire, galaxy...)
//   reroll                 roll brand-new eyes and keep them
//   seed <hex>             set a specific eye seed
//   set <key> <value>      change a threshold live (shake, cold, loud, doze, sleep, rare)
//   save / defaults        write tuning to flash / restore factory values
//   fake temp <c>          pretend the air is this temperature
//   fake sound <p2p>       pretend the mic hears this level
//   fake off               go back to the real sensors
//   debug on|off           print sensor values every second
// ============================================================

struct NamedState { const char *name; StarState state; };

const NamedState MOODS[] = {
  { "idle", S_IDLE }, { "curious", S_CURIOUS }, { "happy", S_HAPPY }, { "bored", S_BORED },
  { "alert", S_ALERT }, { "suspicious", S_SUSPICIOUS }, { "dizzy", S_DIZZY_MILD },
  { "spin", S_DIZZY_SEVERE }, { "angry", S_ANGRY }, { "rage", S_SEETHING },
  { "chill", S_CHILL }, { "shiver", S_SHIVER }, { "freeze", S_FREEZE },
  { "startled", S_STARTLED }, { "anxious", S_ANXIOUS }, { "overwhelmed", S_OVERWHELMED },
  { "doze", S_DOZE }, { "sleep", S_SLEEP }, { "dream", S_DREAMING },
};

const NamedState RARES[] = {
  { "rainbow", S_RARE_RAINBOW }, { "hearts", S_RARE_HEARTS }, { "stars", S_RARE_STARS },
  { "glitch", S_RARE_GLITCH }, { "matrix", S_RARE_MATRIX }, { "spiral", S_RARE_SPIRAL },
  { "loading", S_RARE_LOADING }, { "error", S_RARE_ERROR }, { "derp", S_RARE_DERP },
  { "smug", S_RARE_SMUG }, { "cry", S_RARE_CRY }, { "laugh", S_RARE_LAUGH },
  { "shocked", S_RARE_SHOCKED }, { "dead", S_RARE_DEAD }, { "galaxy", S_RARE_GALAXY },
  { "heartbeat", S_RARE_HEARTBEAT }, { "fire", S_RARE_FIRE }, { "hypno", S_RARE_HYPNO },
  { "starfield", S_RARE_STARFIELD }, { "rgb", S_RARE_GLITCH2 },
};

// plain types in these signatures: the Arduino prototype generator places
// function declarations above this file's struct definitions
static const char *stateName(uint8_t s) {
  for (const auto &m : MOODS) if (m.state == s) return m.name;
  for (const auto &r : RARES) if (r.state == s) return r.name;
  return s == S_TILT ? "tilt" : s == S_RECOVERING ? "recovering" :
         s == S_MICROSLEEP ? "microsleep" : s == S_BLINK ? "blink" : "?";
}

// ─── tuning in flash ─────────────────────────────────────
void loadTuning() {
  prefs.begin("tune", true);
  tune.shakeOnG = prefs.getFloat("shake", tune.shakeOnG);
  tune.coldC    = prefs.getFloat("cold",  tune.coldC);
  tune.loudP2P  = prefs.getInt  ("loud",  tune.loudP2P);
  tune.dozeMs   = prefs.getUInt ("doze",  tune.dozeMs);
  tune.sleepMs  = prefs.getUInt ("sleep", tune.sleepMs);
  tune.rareMs   = prefs.getUInt ("rare",  tune.rareMs);
  tune.tempOffsetC = prefs.getFloat("toff", tune.tempOffsetC);
  prefs.end();
}

static void saveTuning() {
  prefs.begin("tune", false);
  prefs.putFloat("shake", tune.shakeOnG);
  prefs.putFloat("cold",  tune.coldC);
  prefs.putInt  ("loud",  tune.loudP2P);
  prefs.putUInt ("doze",  tune.dozeMs);
  prefs.putUInt ("sleep", tune.sleepMs);
  prefs.putUInt ("rare",  tune.rareMs);
  prefs.putFloat("toff",  tune.tempOffsetC);
  prefs.end();
}

// ─── sensor overrides for testing on the bench ───────────
static bool  fakeTempOn = false, fakeSoundOn = false;
static float fakeTempC = 20.0f;
static int   fakeSound = 0;

void applySensorOverrides() {
  if (fakeTempOn)  ambientTemp = fakeTempC;
  if (fakeSoundOn) soundPeak = fakeSound;
}

// ─── commands ────────────────────────────────────────────
static void printHelp() {
  Serial.println(F("commands: status | hw | demo | mood <name> | fx <name> | reroll | seed <hex>"));
  Serial.println(F("          set <shake|cold|loud|doze|sleep|rare|tempoffset> <value> | save | defaults"));
  Serial.println(F("          fake temp <c> | fake sound <p2p> | fake off | debug on|off"));
  Serial.print(F("moods: "));
  for (const auto &m : MOODS) { Serial.print(m.name); Serial.print(' '); }
  Serial.print(F("\nrare fx: "));
  for (const auto &r : RARES) { Serial.print(r.name); Serial.print(' '); }
  Serial.println();
}

static void printStatus() {
  const Colorway &cw = COLORWAYS[d_colorway];
  Serial.printf("state %s for %lus | idle %lus\n", stateName(curState),
                (unsigned long)((millis() - stateMs) / 1000), (unsigned long)((millis() - lastInteract) / 1000));
  Serial.printf("eyes  %s %s (seed 0x%08X)\n", SHAPE_NAMES[d_shape], cw.name, eyeSeed);
  Serial.printf("sense shake %.1f | temp %.1fC%s | sound %d%s | tilt %.0f deg from rest | mpu %s\n",
                shakeE, ambientTemp, fakeTempOn ? " (fake)" : "", soundPeak, fakeSoundOn ? " (fake)" : "",
                tiltLean, mpuOK ? "ok" : "missing");
  Serial.printf("tune  shake %.1f | cold %.1f | loud %d | doze %lus | sleep %lus | rare %lus | tempoffset %+.1f\n",
                tune.shakeOnG, tune.coldC, tune.loudP2P,
                (unsigned long)(tune.dozeMs / 1000), (unsigned long)(tune.sleepMs / 1000), (unsigned long)(tune.rareMs / 1000),
                tune.tempOffsetC);
}

// Day-one wiring check without reflashing the hardware test sketch.
static void printHardware() {
  Serial.println(F("hardware:"));
  Serial.printf("  screen    %s\n", sprOK ? "sprite buffer ok (if you can see the eyes, spi is wired right)"
                                          : "no sprite buffer, drawing directly (will flicker)");
  uint8_t found = 0;
  String addrs;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { found++; addrs += " 0x" + String(a, HEX); }
  }
  Serial.printf("  i2c       %u device(s):%s\n", found, found ? addrs.c_str() : " none, check SDA on D4 and SCL on D5");
  Serial.printf("  mpu6050   %s\n", mpuOK ? "ok" : "missing, check its wires and AD0 to GND");
  uint8_t probes = ds18b20.getDeviceCount();
  Serial.printf("  ds18b20   %s | reading %.1fC (offset %+.1f)\n",
                probes ? "ok" : "missing, check DATA on D7 and the 4.7k pull-up", ambientTemp, tune.tempOffsetC);
  if (HAS_MIC) {
    long sum = 0;
    int lo = 4095, hi = 0;
    for (int i = 0; i < 128; i++) {
      int v = analogRead(MIC_PIN);
      sum += v;
      lo = min(lo, v);
      hi = max(hi, v);
    }
    int mid = sum / 128;
    Serial.printf("  mic       idle level %d (expect ~2048) | swing %d | loud at %d\n", mid, hi - lo, tune.loudP2P);
    if (mid < 200 || mid > 3900) Serial.println(F("            level looks stuck: check OUT on D1 and VCC on 3V3"));
  } else {
    Serial.println(F("  mic       disabled (HAS_MIC is false)"));
  }
  Serial.println(F("  battery   not measured (no sense pin wired)"));
}

static bool jumpTo(bool rare, const String &name) {
  const NamedState *list = rare ? RARES : MOODS;
  size_t n = rare ? sizeof(RARES) / sizeof(RARES[0]) : sizeof(MOODS) / sizeof(MOODS[0]);
  for (size_t i = 0; i < n; i++) {
    if (name != list[i].name) continue;
    lastInteract = millis();
    setState(list[i].state);
    if (list[i].state >= S_RARE_RAINBOW) setupRareTarget(list[i].state);
    Serial.printf("-> %s\n", list[i].name);
    return true;
  }
  return false;
}

static void setEyeSeed(uint32_t seed) {
  prefs.begin("starboy", false);
  prefs.putUInt("seed", seed);
  prefs.end();
  initEyeDesign();
}

// ─── demo: a ~77s tour of his moods for filming ──────────
// Most steps only fake the sensors and let the real mood logic react, so the
// video shows actual behaviour. tools/test_demo.js reads this table and
// replays it through web/mood.js to check each step ends in `expect`.
enum DemoAction : uint8_t { DEMO_NONE, DEMO_SHAKE, DEMO_FX, DEMO_SLEEPY };
struct DemoStep { const char *label; uint16_t ms; float temp; int sound; uint8_t action; const char *arg; const char *expect; };

const DemoStep DEMO[] = {
  { "just sitting there",  4000, 20.0f,    0, DEMO_NONE,   nullptr,   "idle" },
  { "loud room",           6000, 20.0f, 2500, DEMO_NONE,   nullptr,   "overwhelmed" },
  { "quiet again",         3500, 20.0f,    0, DEMO_NONE,   nullptr,   "idle" },
  { "cold outside",       14000,  0.0f,    0, DEMO_NONE,   nullptr,   "freeze" },
  { "back inside",         2500, 20.0f,    0, DEMO_NONE,   nullptr,   "idle" },
  { "shaken",             11500, 20.0f,    0, DEMO_SHAKE,  nullptr,   "idle" },
  { "rare: hearts",        5600, 20.0f,    0, DEMO_FX,     "hearts",  nullptr },
  { "rare: fire",          5600, 20.0f,    0, DEMO_FX,     "fire",    nullptr },
  { "rare: galaxy",        5600, 20.0f,    0, DEMO_FX,     "galaxy",  nullptr },
  { "rare: rainbow",       5600, 20.0f,    0, DEMO_FX,     "rainbow", nullptr },
  { "left alone",         10000, 20.0f,    0, DEMO_SLEEPY, nullptr,   "sleep" },
  { "a noise wakes him",   3000, 20.0f,  400, DEMO_NONE,   nullptr,   "idle" },
};
const uint8_t DEMO_STEPS = sizeof(DEMO) / sizeof(DEMO[0]);

static int8_t   demoStep = -1;
static uint32_t demoStepMs = 0;

static void startDemoStep(uint8_t i) {
  const DemoStep &st = DEMO[i];
  demoStep = i;
  demoStepMs = millis();
  fakeTempOn = true;  fakeTempC = st.temp;
  fakeSoundOn = true; fakeSound = st.sound;
  lastRareCheck = millis();              // keep random rare effects out of the way
  // the demo counts as attention, or he dozes off mid-tour (cold and noise
  // don't reset the idle timer); only "left alone" lets the clock run
  if (st.action != DEMO_SLEEPY) lastInteract = millis();
  Serial.printf("demo %u/%u: %s\n", i + 1, DEMO_STEPS, st.label);
  switch (st.action) {
    case DEMO_SHAKE:  lastInteract = millis(); setState(S_DIZZY_MILD); break;
    case DEMO_FX:     jumpTo(true, String(st.arg)); break;
    case DEMO_SLEEPY: setState(S_IDLE); lastInteract = millis() - (tune.sleepMs - 6000UL); break;
    default: break;
  }
}

static void stopDemo(const char *why) {
  demoStep = -1;
  fakeTempOn = fakeSoundOn = false;
  lastInteract = millis();
  Serial.printf("demo %s, back to the real sensors\n", why);
}

void runDemo() {
  if (demoStep < 0 || millis() - demoStepMs < DEMO[demoStep].ms) return;
  if (demoStep + 1 < DEMO_STEPS) startDemoStep(demoStep + 1);
  else stopDemo("done");
}

static void runCommand(String line) {
  line.trim();
  line.toLowerCase();
  if (!line.length()) return;
  int sp = line.indexOf(' ');
  String cmd = sp < 0 ? line : line.substring(0, sp);
  String arg = sp < 0 ? String() : line.substring(sp + 1);
  arg.trim();

  if (cmd == "help" || cmd == "?") { printHelp(); return; }
  if (cmd == "status")             { printStatus(); return; }
  if (cmd == "hw")                 { printHardware(); return; }

  if (cmd == "mood") {
    if (!jumpTo(false, arg)) Serial.println(F("unknown mood, try `help`"));
    else if ((arg == "chill" || arg == "shiver" || arg == "freeze") && ambientTemp >= tune.coldC)
      Serial.println(F("note: it's not cold, so this ends right away. try `fake temp 2` first"));
    else if ((arg == "anxious" || arg == "overwhelmed") && soundPeak <= tune.loudP2P)
      Serial.println(F("note: it's quiet, so this ends soon. try `fake sound 2000` first"));
    return;
  }
  if (cmd == "fx") {
    if (!jumpTo(true, arg)) Serial.println(F("unknown effect, try `help`"));
    return;
  }

  if (cmd == "demo") {
    if (arg == "stop") { if (demoStep >= 0) stopDemo("stopped"); return; }
    uint32_t total = 0;
    for (uint8_t i = 0; i < DEMO_STEPS; i++) total += DEMO[i].ms;
    Serial.printf("demo: %u steps, about %lus. start filming! (`demo stop` to end early)\n",
                  DEMO_STEPS, (unsigned long)(total / 1000));
    startDemoStep(0);
    return;
  }

  if (cmd == "reroll") {
    uint32_t seed = (uint32_t)esp_random();
    setEyeSeed(seed ? seed : 0xDEADBEEF);
    return;
  }
  if (cmd == "seed") {
    uint32_t seed = strtoul(arg.c_str(), nullptr, 16);
    if (!seed) { Serial.println(F("usage: seed 1a2b3c4d")); return; }
    setEyeSeed(seed);
    return;
  }

  if (cmd == "set") {
    int sp2 = arg.indexOf(' ');
    if (sp2 < 0) { Serial.println(F("usage: set <key> <value>")); return; }
    String key = arg.substring(0, sp2);
    float v = arg.substring(sp2 + 1).toFloat();
    if      (key == "shake") tune.shakeOnG = constrain(v, 1.0f, 60.0f);
    else if (key == "cold")  tune.coldC    = constrain(v, -20.0f, 40.0f);
    else if (key == "loud")  tune.loudP2P  = constrain((int)v, 20, 4095);
    else if (key == "doze")  tune.dozeMs   = (uint32_t)constrain(v, 5.0f, 3600.0f) * 1000UL;
    else if (key == "sleep") tune.sleepMs  = (uint32_t)constrain(v, 10.0f, 7200.0f) * 1000UL;
    else if (key == "rare")  tune.rareMs   = (uint32_t)constrain(v, 5.0f, 3600.0f) * 1000UL;
    else if (key == "tempoffset") tune.tempOffsetC = constrain(v, -15.0f, 15.0f);
    else { Serial.println(F("keys: shake cold loud doze sleep rare tempoffset (times in seconds)")); return; }
    if (tune.sleepMs <= tune.dozeMs) tune.sleepMs = tune.dozeMs + 10000UL;
    printStatus();
    Serial.println(F("live now. type `save` to keep it after a restart"));
    return;
  }
  if (cmd == "save")     { saveTuning(); Serial.println(F("saved")); return; }
  if (cmd == "defaults") {
    tune = TUNING_DEFAULTS;
    saveTuning();
    Serial.println(F("factory tuning restored"));
    printStatus();
    return;
  }

  if (cmd == "fake") {
    if (arg == "off")                 { fakeTempOn = fakeSoundOn = false; Serial.println(F("real sensors")); }
    else if (arg.startsWith("temp ")) { fakeTempOn = true;  fakeTempC = arg.substring(5).toFloat(); Serial.printf("fake temp %.1fC\n", fakeTempC); }
    else if (arg.startsWith("sound ")){ fakeSoundOn = true; fakeSound = arg.substring(6).toInt();   Serial.printf("fake sound %d\n", fakeSound); }
    else Serial.println(F("usage: fake temp <c> | fake sound <p2p> | fake off"));
    return;
  }
  if (cmd == "debug") {
    debugSensors = (arg == "on");
    Serial.printf("debug %s\n", debugSensors ? "on" : "off");
    return;
  }

  Serial.println(F("unknown command, type `help`"));
}

void handleSerial() {
  runDemo();
  static String buf;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length()) runCommand(buf);
      buf = "";
    } else if (buf.length() < 80) {
      buf += c;
    }
  }
}
