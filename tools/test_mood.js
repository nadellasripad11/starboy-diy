// Tests for web/mood.js with a fake clock.  Run:  node tools/test_mood.js
const { createMood, createTiltTracker } = require('../web/mood.js');

let passed = 0;
const failed = [];

function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed.push(`${name}: ${e.message}`); }
}

// A star plus a clock. step() advances in 50ms ticks, like the sandbox timer.
function rig(opts = {}) {
  const log = [];
  const mood = createMood({ random: () => 1, dozeMs: 25000, sleepMs: 75000, ...opts,
    onChange: (next) => log.push(next) });
  // angle: how far the star is tipped from lying flat, in degrees (90 = hanging upright)
  const env = { temp: 20, noise: 100, shaking: false, angle: 0 };
  const tilt = createTiltTracker();
  let now = 0;
  return {
    mood, log, env, tilt,
    step(ms) {
      for (let t = 0; t < ms; t += 50) {
        now += 50;
        const rad = env.angle * Math.PI / 180;
        const lean = tilt.update(now, { x: 0, y: 9.81 * Math.sin(rad), z: 9.81 * Math.cos(rad) });
        mood.update(now, { ...env, lean });
      }
      return mood.state;
    },
    get state() { return mood.state; },
  };
}

function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

test('starts idle and stays idle in a calm room', () => {
  const r = rig();
  eq(r.step(20000), 'idle', 'after 20s');
});

test('chilly below 10°c but not shivering at 7°c', () => {
  const r = rig();
  r.env.temp = 7;
  eq(r.step(100), 'chill', 'right away');
  eq(r.step(20000), 'chill', 'after 20s at 7°c');
});

test('full cold path: chill, shiver, freeze, thaw', () => {
  const r = rig();
  r.env.temp = 0;
  r.step(100);
  eq(r.state, 'chill', 'at 0°c');
  eq(r.step(3800), 'chill', 'before 4s');
  eq(r.step(400), 'shiver', 'after 4s');
  eq(r.step(7800), 'shiver', 'before 8s');
  eq(r.step(400), 'freeze', 'after 8s');
  r.env.temp = 11;
  eq(r.step(100), 'freeze', 'still frozen at 11°c');
  r.env.temp = 12;
  eq(r.step(100), 'idle', 'thawed at 12°c');
});

test('no chill/idle flicker when the air sits right at 10°c', () => {
  const r = rig();
  for (let i = 0; i < 100; i++) {
    r.env.temp = i % 2 ? 9.75 : 10.25;   // ±0.25°c sensor jitter around the threshold
    r.step(100);
  }
  eq(r.log.filter((s) => s === 'chill').length, 1, 'entered chill once');
  eq(r.log.includes('idle'), false, 'never flipped back to idle');
  r.env.temp = 10.75;
  eq(r.step(200), 'chill', 'still chilly just under 11°c');
  r.env.temp = 11;
  eq(r.step(100), 'idle', 'warm again at 11°c');
});

test('warming up from a shiver goes straight to idle', () => {
  const r = rig();
  r.env.temp = 0;
  r.step(4500);
  eq(r.state, 'shiver', 'shivering');
  r.env.temp = 15;
  eq(r.step(100), 'idle', 'warm');
});

test('short noise: startled then calm', () => {
  const r = rig();
  r.env.noise = 2000;
  eq(r.step(100), 'startled', 'loud');
  r.env.noise = 100;
  eq(r.step(900), 'idle', 'quiet after 0.9s');
});

test('long noise: startled, anxious, overwhelmed, calm', () => {
  const r = rig();
  r.env.noise = 2000;
  r.step(100);
  eq(r.step(800), 'anxious', 'still loud');
  eq(r.step(3900), 'anxious', 'before 4s');
  eq(r.step(200), 'overwhelmed', 'after 4s');
  r.env.noise = 100;
  eq(r.step(2900), 'overwhelmed', 'before 3s of quiet');
  eq(r.step(200), 'idle', 'after 3s of quiet');
});

test('a quick shake under 1s does nothing', () => {
  const r = rig();
  r.env.shaking = true;
  eq(r.step(900), 'idle', 'shaken 0.9s');
});

test('shake path: dizzy, spin, recovering, angry, idle', () => {
  const r = rig();
  r.env.shaking = true;
  eq(r.step(1100), 'dizzy', 'after 1s');
  eq(r.step(2100), 'spin', 'after 2 more s');
  eq(r.step(5000), 'spin', 'keeps spinning while shaken');
  r.env.shaking = false;
  eq(r.step(100), 'recovering', 'stops shaking');
  eq(r.step(2100), 'angry', 'mad');
  eq(r.step(3600), 'idle', 'calmed down');
});

test('shaking after sitting idle still shows dizzy before spin', () => {
  const r = rig();
  r.step(10000);
  r.env.shaking = true;
  eq(r.step(1100), 'dizzy', 'after 1s of shaking');
  eq(r.step(1000), 'dizzy', 'still dizzy 1s later');
  eq(r.step(1100), 'spin', 'spins after 2s of dizzy');
});

test('angry in the cold calms into chill, not idle', () => {
  const r = rig();
  r.env.shaking = true;
  r.step(3200);
  eq(r.state, 'spin', 'spinning');
  r.env.shaking = false;
  r.env.temp = 5;
  eq(r.step(3600), 'recovering', 'spin winds down after 3.5s');
  eq(r.step(2100), 'angry', 'mad');
  eq(r.step(3600), 'chill', 'calms into the cold');
});

test('left alone: doze at 25s, sleep at 75s', () => {
  const r = rig();
  eq(r.step(24900), 'idle', 'before 25s');
  eq(r.step(200), 'doze', 'after 25s');
  eq(r.step(49800), 'doze', 'before 75s');
  eq(r.step(200), 'sleep', 'after 75s');
});

test('talking does not wake a sleeper, a loud-ish noise does', () => {
  const r = rig({ dozeMs: 3000, sleepMs: 4000 });
  r.step(4200);
  eq(r.state, 'sleep', 'asleep');
  r.env.noise = 250;
  eq(r.step(500), 'sleep', 'talking at 250');
  r.env.noise = 350;
  eq(r.step(100), 'woke', 'noise above half the loud level');
  r.env.noise = 100;
  eq(r.step(1700), 'idle', 'awake');
});

test('a shake wakes a dozing star immediately', () => {
  const r = rig({ dozeMs: 1000, sleepMs: 60000 });
  r.step(1200);
  eq(r.state, 'doze', 'dozing');
  r.env.shaking = true;
  eq(r.step(50), 'idle', 'nudged');
});

test('being cold does not count as attention (like the firmware)', () => {
  const r = rig({ dozeMs: 5000, sleepMs: 60000 });
  r.env.temp = 5;
  r.step(3000);
  r.env.temp = 20;
  r.step(100);
  eq(r.state, 'idle', 'warmed up');
  eq(r.step(2000), 'doze', 'the idle timer kept running while cold');
});

test('dreams only start when random allows it, and end after 6s', () => {
  let roll = 1;
  const r = rig({ dozeMs: 1000, sleepMs: 2000, random: () => roll });
  r.step(2200);
  eq(r.step(10000), 'sleep', 'no dream with random = 1');
  roll = 0;
  eq(r.step(100), 'dream', 'dream with random = 0');
  roll = 1;
  eq(r.step(6100), 'sleep', 'back to sleep');
});

test('hanging upright on a belt loop from boot never counts as tilted', () => {
  const r = rig();
  r.env.angle = 90;
  eq(r.step(20000), 'idle', 'after 20s hanging');
  eq(r.step(60000), 'sleep', 'falls asleep like normal');
  eq(r.log.includes('tilt'), false, 'never tilted');
});

test('tipping him reacts, then he gets used to the new angle', () => {
  const r = rig();
  r.step(5000);
  r.env.angle = 90;
  eq(r.step(200), 'tilt', 'tipped from flat to upright');
  eq(r.step(20000), 'idle', 'settled within 20s');
  eq(r.tilt.lean < 12, true, `lean dropped below 12°, is ${r.tilt.lean.toFixed(1)}`);
});

test('being left at an angle is not attention, so he still dozes', () => {
  const r = rig();
  r.step(1000);
  r.env.angle = 60;
  r.step(200);
  eq(r.state, 'tilt', 'tipped');
  eq(r.step(24500), 'idle', 'settled but not dozing yet');
  eq(r.step(1000), 'doze', 'dozes 25s after the tip, not 25s after settling');
});

test('small wobbles under 25° do not trigger tilt', () => {
  const r = rig();
  r.step(2000);
  for (let i = 0; i < 20; i++) {
    r.env.angle = i % 2 ? 20 : -20;
    r.step(300);
  }
  eq(r.log.includes('tilt'), false, 'no tilt from ±20° wobbles');
});

test('a shake does not teach him a new resting position', () => {
  const tilt = createTiltTracker();
  tilt.update(0, { x: 0, y: 0, z: 9.81 });
  for (let t = 50; t <= 10000; t += 50) tilt.update(t, { x: 0, y: 9.81, z: 0 }, 20);
  eq(tilt.lean > 80, true, `still ~90° from rest after 10s of shaking-level readings, got ${tilt.lean.toFixed(1)}`);
});

test('onChange reports every transition once, in order', () => {
  const r = rig();
  r.env.noise = 2000;
  r.step(1000);
  r.env.noise = 100;
  r.step(3000);
  eq(r.log.join(' > '), 'startled > anxious > idle', 'transitions');
});

test('custom thresholds from the tuning console are respected', () => {
  const r = rig({ coldC: 5, loudP2P: 1500 });
  r.env.temp = 7;
  r.env.noise = 1000;
  eq(r.step(500), 'idle', '7°c and 1000 are fine with cold 5 / loud 1500');
  r.env.temp = 4;
  eq(r.step(100), 'chill', '4°c is cold');
});

if (failed.length) {
  console.error(`✗ ${failed.length} of ${passed + failed.length} mood tests failed:`);
  failed.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log(`✓ all ${passed} mood tests passed`);
