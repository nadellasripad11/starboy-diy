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
  Serial.println(F("commands: status | mood <name> | fx <name> | reroll | seed <hex>"));
  Serial.println(F("          set <shake|cold|loud|doze|sleep|rare> <value> | save | defaults"));
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
  Serial.printf("tune  shake %.1f | cold %.1f | loud %d | doze %lus | sleep %lus | rare %lus\n",
                tune.shakeOnG, tune.coldC, tune.loudP2P,
                (unsigned long)(tune.dozeMs / 1000), (unsigned long)(tune.sleepMs / 1000), (unsigned long)(tune.rareMs / 1000));
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
    else { Serial.println(F("keys: shake cold loud doze sleep rare (times in seconds)")); return; }
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
