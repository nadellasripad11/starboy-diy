// Checks that the firmware and every web copy of the eye renderer agree.
// Run from the repo root:  node tools/check_parity.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
let checks = 0;
const expect = (ok, msg) => { checks++; if (!ok) failures.push(msg); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

const ino = read('firmware/starboy_firmware/starboy_firmware.ino');

// ─── firmware tables ─────────────────────────────────────
const fwColorways = [...ino.matchAll(/\{\s*"([a-z]+)",\s*0x([0-9A-F]{6}),\s*0x([0-9A-F]{6}),\s*0x([0-9A-F]{6}),\s*(\d+)\s*\}/g)]
  .map((m) => ({ name: m[1], body: m[2].toLowerCase(), pl: m[3].toLowerCase(), pr: m[4].toLowerCase(), w: +m[5] }));
const fwShapeWeight = ino.match(/SHAPE_WEIGHT\[4\]\s*=\s*\{([^}]+)\}/)[1].split(',').map(Number);
const fwPupils = [...ino.matchAll(/\{\s*([\d.]+)f,\s*([\d.]+)f,\s*([\d.]+)f,\s*([\d.]+)f,\s*([\d.]+)f,\s*(true|false)\s*\}/g)]
  .map((m) => [+m[1], +m[2], +m[3], +m[4], +m[5], m[6] === 'true']);
const fwNum = (name) => +ino.match(new RegExp(`#define\\s+${name}\\s+\\(?[A-Z]*\\s*[-+]?\\s*([\\d.]+)`))[1];
const fwGeom = { IRIS_RX: fwNum('IRIS_RX'), IRIS_RY: fwNum('IRIS_RY'), EYE_TILT: fwNum('EYE_TILT'), EYE_OFFSET: fwNum('EYE_R_X') };
const fwTune = ino.match(/TUNING_DEFAULTS\s*=\s*\{([^}]+)\}/)[1].split(',').map((v) => parseFloat(v));
const fwShakeMs = +ino.match(/#define\s+SHAKE_MS\s+(\d+)/)[1];

expect(fwColorways.length === 100, `firmware has ${fwColorways.length} colorways, expected 100`);
expect(new Set(fwColorways.map((c) => c.name)).size === fwColorways.length, 'firmware colorway names are not unique');
expect(fwShapeWeight.reduce((a, b) => a + b, 0) === 100, 'firmware shape weights do not add up to 100');
expect(fwPupils.length === 4, `firmware has ${fwPupils.length} pupil shapes, expected 4`);

// ─── a web renderer, loaded for real ─────────────────────
function loadEyes(rel) {
  const sandbox = { window: {}, Math, console };
  vm.createContext(sandbox);
  vm.runInContext(read(rel), sandbox, { filename: rel });
  return sandbox.window.StarboyEyes;
}

function compareSource(label, src, colorways) {
  expect(colorways.length === fwColorways.length, `${label}: ${colorways.length} colorways vs firmware ${fwColorways.length}`);
  colorways.forEach((c, i) => {
    const f = fwColorways[i];
    if (!f) return;
    const same = c.name === f.name && c.body.replace('#', '') === f.body && c.pl.replace('#', '') === f.pl &&
                 c.pr.replace('#', '') === f.pr && c.w === f.w;
    expect(same, `${label}: colorway #${i} ${c.name} ${c.body}/${c.pl}/${c.pr} w${c.w} != firmware ${f.name} #${f.body}/#${f.pl}/#${f.pr} w${f.w}`);
  });

  const pupils = [...src.matchAll(/\{\s*u:\s*([\d.]+),\s*v:\s*([\d.]+),\s*rxF:\s*([\d.]+),\s*ryF:\s*([\d.]+),\s*tilt:\s*([\d.]+),\s*round:\s*(true|false)\s*\}/g)]
    .map((m) => [+m[1], +m[2], +m[3], +m[4], +m[5], m[6] === 'true']);
  expect(pupils.length === 4, `${label}: found ${pupils.length} pupil shapes`);
  pupils.forEach((p, i) => expect(fwPupils[i] && p.every((v, j) => (typeof v === 'boolean' ? v === fwPupils[i][j] : near(v, fwPupils[i][j]))),
    `${label}: pupil shape ${i} [${p}] != firmware [${fwPupils[i]}]`));

  for (const key of ['IRIS_RX', 'IRIS_RY', 'EYE_TILT']) {
    const m = src.match(new RegExp(`${key}\\s*=\\s*([\\d.]+)`));
    expect(m && near(+m[1], fwGeom[key]), `${label}: ${key} ${m && m[1]} != firmware ${fwGeom[key]}`);
  }
  expect(src.includes(`CX - ${fwGeom.EYE_OFFSET}`) && src.includes(`CX + ${fwGeom.EYE_OFFSET}`),
    `${label}: eyes are not placed at CX ± ${fwGeom.EYE_OFFSET}`);
  expect(src.includes('clamp(eye.irX, 0.5, 1.02)'), `${label}: eye width cap differs from firmware (1.02)`);
}

const E = loadEyes('web/eyes.js');
compareSource('web/eyes.js', read('web/eyes.js'), E.COLORWAYS);
expect(E.SHAPE_WEIGHT.join() === fwShapeWeight.join(), `web/eyes.js: shape weights ${E.SHAPE_WEIGHT} != firmware ${fwShapeWeight}`);

// the preview page keeps its own copy of the table and renderer
const preview = read('firmware/eye_preview.html');
const previewTable = preview.match(/const COLORWAYS = `([^`]+)`/)[1].split('|').map((r, i) => {
  const [name, body, pl, pr] = r.split(' ');
  const w = i < 14 ? 10 : i < 19 ? 8 : i < 31 ? 9 : i < 36 ? 7 : i < 73 ? 3 : i < 86 ? 5 : 2;
  return { name, body, pl, pr, w };
});
expect(/i < 14 \? 10 : i < 19 \? 8 : i < 31 \? 9 : i < 36 \? 7 : i < 73 \? 3 : i < 86 \? 5 : 2/.test(preview),
  'firmware/eye_preview.html: colorway weight formula changed, update this check');
compareSource('firmware/eye_preview.html', preview, previewTable);

// ─── sandbox mood logic uses the firmware thresholds ─────
const sandbox = read('web/sandbox.js');
const sbNum = (name) => { const m = sandbox.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`)); return m && +m[1]; };
expect(sbNum('COLD_C') === fwTune[1], `web/sandbox.js: COLD_C ${sbNum('COLD_C')} != firmware ${fwTune[1]}`);
expect(sbNum('LOUD_P2P') === fwTune[2], `web/sandbox.js: LOUD_P2P ${sbNum('LOUD_P2P')} != firmware ${fwTune[2]}`);
expect(sbNum('SHAKE_MS') === fwShakeMs, `web/sandbox.js: SHAKE_MS ${sbNum('SHAKE_MS')} != firmware ${fwShakeMs}`);

// ─── mood.js transition timings match updateState() ─────
const { TIMING, OFFSETS } = require(path.join(root, 'web/mood.js'));
const fwAge = (to) => { const m = ino.match(new RegExp(`age > (\\d+)\\)[^;\\n]*setState\\(${to}\\)`)); return m && +m[1]; };
const fwAgeIf = (cond, to) => { const m = ino.match(new RegExp(`${cond} && age > (\\d+)\\) setState\\(${to}\\)`)); return m && +m[1]; };
const timingPairs = [
  ['dizzyToSpin', fwAge('S_DIZZY_SEVERE')],
  ['spinCalm', fwAgeIf('!shaking', 'S_RECOVERING')],
  ['angryCalm', fwAge('isCold \\? S_CHILL : S_IDLE')],
  ['startled', fwAge('isLoud \\? S_ANXIOUS : S_IDLE')],
  ['anxiousCalm', fwAgeIf('!isLoud', 'S_IDLE')],
  ['anxiousToOverwhelmed', fwAgeIf('isLoud', 'S_OVERWHELMED')],
  ['dreamLength', fwAge('S_SLEEP')],
];
const recover = ino.match(/case S_RECOVERING:\s*if \(age > (\d+)\)/);
timingPairs.push(['recoverToAngry', recover && +recover[1]]);
const shiver = ino.match(/age > (\d+) && ambientTemp < COLD_C - (\d+)\) setState\(S_SHIVER\)/);
const freeze = ino.match(/age > (\d+) && ambientTemp < COLD_C - (\d+)\) setState\(S_FREEZE\)/);
const thaw = ino.match(/ambientTemp >= COLD_C \+ (\d+)\) setState\(S_IDLE\)/);
const overwhelmed = ino.match(/case S_OVERWHELMED:\s*if \(!isLoud && age > (\d+)\)/);
timingPairs.push(['chillToShiver', shiver && +shiver[1]], ['shiverToFreeze', freeze && +freeze[1]],
                 ['overwhelmedCalm', overwhelmed && +overwhelmed[1]]);
for (const [key, fw] of timingPairs) {
  expect(fw !== null && TIMING[key] === fw, `web/mood.js: TIMING.${key} ${TIMING[key]} != firmware ${fw}`);
}
expect(shiver && OFFSETS.shiver === +shiver[2], `web/mood.js: shiver offset ${OFFSETS.shiver} != firmware ${shiver && shiver[2]}`);
expect(freeze && OFFSETS.freeze === +freeze[2], `web/mood.js: freeze offset ${OFFSETS.freeze} != firmware ${freeze && freeze[2]}`);
expect(thaw && OFFSETS.thaw === +thaw[1], `web/mood.js: thaw offset ${OFFSETS.thaw} != firmware ${thaw && thaw[1]}`);
expect(/soundPeak > LOUD_P2P \* 0\.5f/.test(ino) && /noise > cfg\.loudP2P \* 0\.5/.test(read('web/mood.js')),
  'web/mood.js: wake-from-sleep noise level no longer matches the firmware (half the loud level)');

// ─── seed.js rolls eyes exactly like initEyeDesign() ────
const seedSrc = read('web/seed.js');
const { LCG_MUL, LCG_ADD } = require(path.join(root, 'web/seed.js'));
const lcg = ino.match(/void initEyeDesign\(\)[\s\S]*?s = s \* (\d+)u \+ (\d+)u;\s*return \(uint16_t\)\(\(s >> (\d+)\) % n\);/);
expect(lcg && +lcg[1] === LCG_MUL && +lcg[2] === LCG_ADD, `web/seed.js: LCG ${LCG_MUL}/${LCG_ADD} != firmware ${lcg && lcg[1]}/${lcg && lcg[2]}`);
expect(lcg && seedSrc.includes(`(s >>> ${lcg[3]}) % n`), `web/seed.js: shift/modulo order differs from firmware >> ${lcg && lcg[3]} then % n`);
const initBody = (ino.match(/void initEyeDesign\(\)\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
const rollOrder = [...initBody.matchAll(/pick = rnd\((\w+)\)/g)].map((m) => m[1]);
expect(rollOrder.join() === 'total,100', `firmware: eye roll order is [${rollOrder}], seed.js assumes colorway (total) then shape (100)`);
expect(/if \(eyeSeed == 0\)/.test(initBody), 'firmware: seed 0 is no longer treated as unset; update parseHex in web/seed.js');

// both must skip the shake interrupt while already in the dizzy chain
expect(/shaking && curState != S_DIZZY_MILD && curState != S_DIZZY_SEVERE/.test(ino),
  'firmware: shake interrupt no longer skips S_DIZZY_MILD / S_DIZZY_SEVERE');
expect(/\['dizzy', 'spin', 'recovering', 'angry'\]\.includes\(m\.state\)/.test(read('web/mood.js')),
  "web/mood.js: shake interrupt no longer skips 'dizzy' and 'spin'");

// ─── tilt: same thresholds, and it must not count as attention ─
const { TILT } = require(path.join(root, 'web/mood.js'));
const fwDef = (name) => { const m = ino.match(new RegExp(`#define\\s+${name}\\s+([\\d.]+)`)); return m && +m[1]; };
expect(fwDef('TILT_ON_DEG') === TILT.onDeg, `web/mood.js: TILT.onDeg ${TILT.onDeg} != firmware ${fwDef('TILT_ON_DEG')}`);
expect(fwDef('TILT_OFF_DEG') === TILT.offDeg, `web/mood.js: TILT.offDeg ${TILT.offDeg} != firmware ${fwDef('TILT_OFF_DEG')}`);
expect(fwDef('TILT_REST_TAU_MS') === TILT.restTauMs, `web/mood.js: TILT.restTauMs ${TILT.restTauMs} != firmware ${fwDef('TILT_REST_TAU_MS')}`);
const tiltCase = (ino.match(/case S_TILT:[\s\S]*?break;/) || [''])[0];
expect(tiltCase.includes('TILT_OFF_DEG') && !/lastInteract\s*=/.test(tiltCase.replace(/\/\/.*$/gm, '')),
  'firmware: S_TILT refreshes lastInteract again, so a star left at an angle would never sleep');
expect(!/atan2f\(accelY, accelZ\)/.test(ino), 'firmware: tilt is measured against lying flat again, so a hanging keychain reads as tilted');

// ─── colorway names used by name in page scripts exist ───
const names = new Set(fwColorways.map((c) => c.name));
for (const rel of ['web/app.js', 'devlog/cards.html']) {
  const src = read(rel);
  // single lookups: c.name === 'x', byName('x'), cell(size, 'x', ...), rare rows ['label', 'x', shape, ...]
  const used = [...src.matchAll(/c\.name === '([a-z]+)'|byName\('([a-z]+)'\)|cell\(\d+,\s*'([a-z]+)'|\['[a-z ]+',\s*'([a-z]+)',\s*\d,/g)]
    .map((m) => m[1] || m[2] || m[3] || m[4]);
  // whole lists of names handed to .forEach((name, ...) =>
  const lists = [...src.matchAll(/\[([^\[\]]*)\]\s*\.forEach\(\(name\b/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]));
  for (const n of [...used, ...lists]) {
    expect(names.has(n), `${rel}: uses colorway '${n}', which doesn't exist`);
  }
}

// ─── rarity math sanity ──────────────────────────────────
const total = fwColorways.reduce((a, c) => a + c.w, 0);
const rarest = Math.min(...fwColorways.map((c) => c.w)) / total * Math.min(...fwShapeWeight);
expect(Math.abs(rarest - 0.04) < 0.005, `rarest look is ${rarest.toFixed(3)}%, but the site and devlog say 0.04%`);
expect(E.rarity(0).toFixed(1) === (100 * fwColorways[0].w / total).toFixed(1), 'web rarity() disagrees with firmware weights');

if (failures.length) {
  console.error(`✗ ${failures.length} of ${checks} parity checks failed:`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log(`✓ all ${checks} parity checks passed (firmware, web/eyes.js, eye_preview.html, sandbox.js)`);
