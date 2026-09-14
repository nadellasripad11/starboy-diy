// Tests for web/seed.js, the port of the firmware's initEyeDesign().
// Run:  node tools/test_seed.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { designFromSeed, findSeed, toHex, parseHex } = require('../web/seed.js');

const root = path.resolve(__dirname, '..');
const ctx = { window: {}, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'web/eyes.js'), 'utf8'), ctx);
const E = ctx.window.StarboyEyes;
const W = E.COLORWAYS.map((c) => c.w);
const SW = [...E.SHAPE_WEIGHT];

let passed = 0;
const failed = [];
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed.push(`${name}: ${e.message}`); } };
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

// A tiny reference implementation written the long way with BigInt, as a
// second opinion on the uint32 overflow and the modulo-before-cast order.
function referenceDesign(seed) {
  let s = BigInt(seed >>> 0);
  const rnd = (n) => {
    s = (s * 1664525n + 1013904223n) & 0xffffffffn;
    return Number(((s >> 8n) % BigInt(n)) & 0xffffn);
  };
  const total = W.reduce((a, b) => a + b, 0);
  let pick = rnd(total), colorway = 99;
  for (let i = 0; i < 100; i++) { if (pick < W[i]) { colorway = i; break; } pick -= W[i]; }
  pick = rnd(100);
  let shape = 3;
  for (let i = 0; i < 4; i++) { if (pick < SW[i]) { shape = i; break; } pick -= SW[i]; }
  return { colorway, shape };
}

// deterministic pseudo-random for the tests themselves
let t = 12345;
const rand = () => ((t = (Math.imul(t, 48271) >>> 0) % 2147483647) / 2147483647);

test('matches a BigInt reference for 50,000 seeds, including edge values', () => {
  const seeds = [1, 2, 0xff, 0x100, 0xffff, 0x10000, 0x7fffffff, 0x80000000, 0xdeadbeef, 0xfffffffe, 0xffffffff];
  for (let i = 0; i < 50000; i++) seeds.push((Math.floor(rand() * 0xffffffff) >>> 0) || 1);
  for (const seed of seeds) {
    const a = designFromSeed(seed, W, SW), b = referenceDesign(seed);
    assert(a.colorway === b.colorway && a.shape === b.shape,
      `seed ${toHex(seed)}: port gave ${a.colorway}/${a.shape}, reference ${b.colorway}/${b.shape}`);
  }
});

test('same seed always gives the same look', () => {
  for (const seed of [1, 0xdeadbeef, 0x1a2b3c4d]) {
    const a = designFromSeed(seed, W, SW), b = designFromSeed(seed, W, SW);
    assert(a.colorway === b.colorway && a.shape === b.shape, `seed ${toHex(seed)} changed between calls`);
  }
});

test('odds over 400,000 seeds match the published rarity', () => {
  const N = 400000;
  const cw = new Array(100).fill(0), sh = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const d = designFromSeed((Math.floor(rand() * 0xffffffff) >>> 0) || 1, W, SW);
    cw[d.colorway]++; sh[d.shape]++;
  }
  const total = W.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 100; i++) {
    const expected = N * W[i] / total;
    const sigma = Math.sqrt(expected);
    assert(Math.abs(cw[i] - expected) < 6 * sigma,
      `colorway ${E.COLORWAYS[i].name}: ${cw[i]} rolls, expected about ${expected.toFixed(0)}`);
  }
  for (let j = 0; j < 4; j++) {
    const expected = N * SW[j] / 100;
    assert(Math.abs(sh[j] - expected) < 6 * Math.sqrt(expected), `shape ${E.SHAPES[j]}: ${sh[j]}, expected about ${expected}`);
  }
});

test('every one of the 400 looks has a seed, and that seed rolls it back', () => {
  for (let c = 0; c < 100; c++) {
    for (let s = 0; s < 4; s++) {
      const seed = findSeed(c, s, W, SW, rand);
      assert(seed !== null, `no seed found for ${E.SHAPES[s]} ${E.COLORWAYS[c].name}`);
      assert(seed !== 0, 'found seed 0, which the firmware ignores');
      const d = designFromSeed(seed, W, SW);
      assert(d.colorway === c && d.shape === s, `seed ${toHex(seed)} does not roll ${E.SHAPES[s]} ${E.COLORWAYS[c].name}`);
    }
  }
});

test('hex helpers round-trip and reject what the console rejects', () => {
  assert(toHex(0x1a2b3c4d) === '1a2b3c4d', 'toHex pads to 8 digits');
  assert(toHex(0xff) === '000000ff', 'toHex pads short values');
  assert(parseHex('1A2B3C4D') === 0x1a2b3c4d, 'uppercase');
  assert(parseHex(' 0xdeadbeef ') === 0xdeadbeef, '0x prefix and spaces');
  assert(parseHex('0') === null, 'zero is not a valid seed');
  assert(parseHex('xyz') === null, 'not hex');
  assert(parseHex('123456789') === null, 'more than 8 digits');
});

if (failed.length) {
  console.error(`✗ ${failed.length} of ${passed + failed.length} seed tests failed:`);
  failed.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log(`✓ all ${passed} seed tests passed`);
