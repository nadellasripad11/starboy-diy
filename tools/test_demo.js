// Reads the DEMO table out of firmware/starboy_firmware/serial_console.ino and
// replays it through web/mood.js with a fake clock, checking every step ends
// in the mood it promises. Run:  node tools/test_demo.js
const fs = require('fs');
const path = require('path');
const { createMood } = require('../web/mood.js');

const root = path.resolve(__dirname, '..');
const consoleSrc = fs.readFileSync(path.join(root, 'firmware/starboy_firmware/serial_console.ino'), 'utf8');
const ino = fs.readFileSync(path.join(root, 'firmware/starboy_firmware/starboy_firmware.ino'), 'utf8');

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

const table = (consoleSrc.match(/const DemoStep DEMO\[\] = \{([\s\S]*?)\n\};/) || [])[1] || '';
const steps = [...table.matchAll(/\{\s*"([^"]+)",\s*(\d+),\s*(-?[\d.]+)f,\s*(\d+),\s*(DEMO_\w+),\s*(nullptr|"[a-z]+"),\s*(nullptr|"[a-z]+")\s*\}/g)]
  .map((m) => ({
    label: m[1], ms: +m[2], temp: +m[3], sound: +m[4], action: m[5],
    arg: m[6] === 'nullptr' ? null : m[6].slice(1, -1),
    expect: m[7] === 'nullptr' ? null : m[7].slice(1, -1),
  }));
const rowCount = (table.match(/\{\s*"/g) || []).length;
expect(steps.length > 0 && steps.length === rowCount, `parsed ${steps.length} demo steps but the table has ${rowCount} rows`);

// every effect the demo plays must exist in the console's RARES list
const rares = new Set([...consoleSrc.matchAll(/\{ "([a-z]+)", S_RARE_\w+ \}/g)].map((m) => m[1]));
for (const st of steps.filter((s) => s.action === 'DEMO_FX')) {
  expect(rares.has(st.arg), `step "${st.label}": rare effect '${st.arg}' is not in RARES`);
}

// same defaults as the firmware's TUNING_DEFAULTS
const tune = ino.match(/TUNING_DEFAULTS\s*=\s*\{([^}]+)\}/)[1].split(',').map((v) => parseFloat(v));
const [shakeOnG, coldC, loudP2P, dozeMs, sleepMs] = tune;
void shakeOnG;

const mood = createMood({ coldC, loudP2P, dozeMs, sleepMs, random: () => 1 });
let now = 0;
const tick = (ms, env) => { for (let t = 0; t < ms; t += 50) { now += 50; mood.update(now, env); } };

let total = 0;
steps.forEach((st, i) => {
  const env = { temp: st.temp, noise: st.sound, shaking: false, lean: 0 };
  if (st.action !== 'DEMO_SLEEPY') mood.lastInteract = now;   // startDemoStep() counts every step as attention
  // DEMO_SHAKE jumps straight to S_DIZZY_MILD; DEMO_SLEEPY winds the idle clock
  // back to 6s before sleep. mood.js has no setState, so set its fields directly.
  if (st.action === 'DEMO_SHAKE') { mood.state = 'dizzy'; mood.t0 = now; mood.lastInteract = now; }
  if (st.action === 'DEMO_SLEEPY') { mood.state = 'idle'; mood.t0 = now; mood.lastInteract = now - (sleepMs - 6000); }
  tick(st.ms, env);
  total += st.ms;
  if (st.expect) {
    expect(mood.state === st.expect,
      `step ${i + 1} "${st.label}": expected to end ${st.expect}, ended ${mood.state}`);
  }
});

expect(total >= 30000 && total <= 120000, `demo runs ${(total / 1000).toFixed(0)}s, keep it between 30 and 120s for a video`);
expect(/void handleSerial\(\) \{\s*runDemo\(\);/.test(consoleSrc), 'handleSerial() no longer calls runDemo(), so the demo would never advance');
// the replay above assumes these two firmware behaviours; make sure they're still there
expect(/if \(st\.action != DEMO_SLEEPY\) lastInteract = millis\(\);/.test(consoleSrc),
  'startDemoStep() no longer counts demo steps as attention, so he would doze off mid-tour');
expect(/case DEMO_SLEEPY:\s*setState\(S_IDLE\); lastInteract = millis\(\) - \(tune\.sleepMs - 6000UL\);/.test(consoleSrc),
  'DEMO_SLEEPY no longer winds the idle clock to 6s before sleep; update the replay in this test');

if (failures.length) {
  console.error(`✗ ${failures.length} demo check(s) failed:`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log(`✓ demo tour: all ${steps.length} steps end in the right mood (${(total / 1000).toFixed(1)}s)`);
