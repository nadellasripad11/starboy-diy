// Synthesizes the promo soundtrack: every sound effect and the beat are built
// from sine waves and noise here, so there's nothing licensed in it.
//   node promo/sfx.js <events.json> <out.wav>
const fs = require('fs');

const SR = 48000;
const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(20260914);
const noise = () => rand() * 2 - 1;
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

// state-variable band-pass whose centre frequency follows fc(i)
function bandpass(input, fcAt, q = 0.7) {
  const out = new Float32Array(input.length);
  let low = 0, band = 0;
  for (let i = 0; i < input.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(fcAt(i), SR * 0.24) / SR);
    const high = input[i] - low - q * band;
    band += f * high;
    low += f * band;
    out[i] = band;
  }
  return out;
}

// ─── sound effects ───────────────────────────────────────
const SFX = {
  pop() {
    const o = buf(0.16); let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const f = 950 * Math.pow(300 / 950, Math.min(1, i / (0.08 * SR)));
      ph += (TAU * f) / SR;
      o[i] = Math.sin(ph) * Math.exp(-i / (0.035 * SR)) * 0.9 + noise() * Math.exp(-i / (0.0015 * SR)) * 0.35;
    }
    return o;
  },
  blink() {
    const o = buf(0.14); let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const f = 520 * Math.pow(240 / 520, Math.min(1, i / (0.07 * SR)));
      ph += (TAU * f) / SR;
      o[i] = Math.sin(ph) * Math.exp(-i / (0.04 * SR)) * 0.7;
    }
    return o;
  },
  hit() {
    const o = buf(0.55); let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const f = 125 * Math.pow(42 / 125, Math.min(1, i / (0.12 * SR)));
      ph += (TAU * f) / SR;
      const x = Math.sin(ph) * Math.exp(-i / (0.18 * SR)) + noise() * Math.exp(-i / (0.012 * SR)) * 0.6;
      o[i] = Math.tanh(x * 1.7) * 0.9;
    }
    return o;
  },
  boom() {
    const o = buf(1.3); let ph = 0;
    const rumble = bandpass(Float32Array.from({ length: o.length }, noise), () => 120, 1.2);
    for (let i = 0; i < o.length; i++) {
      const f = 95 * Math.pow(34 / 95, Math.min(1, i / (0.3 * SR)));
      ph += (TAU * f) / SR;
      const x = Math.sin(ph) * Math.exp(-i / (0.45 * SR)) + rumble[i] * Math.exp(-i / (0.35 * SR)) * 1.5
              + noise() * Math.exp(-i / (0.01 * SR)) * 0.5;
      o[i] = Math.tanh(x * 2) * 0.95;
    }
    return o;
  },
  whoosh(dur = 0.45, from = 350, to = 6500) {
    const n = Math.ceil(dur * SR);
    const src = Float32Array.from({ length: n }, noise);
    const o = bandpass(src, (i) => from * Math.pow(to / from, Math.sin((Math.PI * i) / n / 2)), 0.9);
    for (let i = 0; i < n; i++) o[i] *= Math.pow(Math.sin((Math.PI * i) / n), 2) * 1.6;
    return o;
  },
  swipe() { return SFX.whoosh(0.2, 1500, 9000); },
  riser() {
    const n = Math.ceil(0.42 * SR);
    const o = bandpass(Float32Array.from({ length: n }, noise), (i) => 300 * Math.pow(5000 / 300, i / n), 0.8);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      ph += (TAU * (200 * Math.pow(6, p))) / SR;
      o[i] = (o[i] * 1.4 + Math.sin(ph) * 0.25) * p * p;
    }
    return o;
  },
  tick() {
    const o = buf(0.05); let ph = 0;
    for (let i = 0; i < o.length; i++) {
      ph += (TAU * 3200) / SR;
      o[i] = Math.sin(ph) * Math.exp(-i / (0.006 * SR)) * 0.8 + noise() * Math.exp(-i / (0.002 * SR)) * 0.3;
    }
    return o;
  },
  key() {
    const o = buf(0.07); let ph = 0; let prev = 0;
    const f = 1600 + rand() * 500;
    for (let i = 0; i < o.length; i++) {
      ph += (TAU * f) / SR;
      const nz = noise(); const hp = nz - prev; prev = nz;
      o[i] = hp * Math.exp(-i / (0.004 * SR)) * 0.6 + Math.sin(ph) * Math.exp(-i / (0.01 * SR)) * 0.3;
    }
    return o;
  },
  sparkle() {
    const o = buf(1.0);
    [1046.5, 1318.5, 1568, 2093].forEach((f, k) => {
      const start = Math.floor(k * 0.055 * SR);
      for (let i = 0; start + i < o.length; i++) {
        const e = Math.exp(-i / (0.25 * SR));
        o[start + i] += (Math.sin((TAU * f * i) / SR) + 0.25 * Math.sin((TAU * 2 * f * i) / SR)) * e * 0.35;
      }
    });
    return o;
  },
  ice() {
    const o = buf(0.9);
    const partials = [2150, 3230, 4470, 5890].map((f) => f * (0.98 + rand() * 0.04));
    for (let i = 0; i < o.length; i++) {
      let x = 0;
      partials.forEach((f, k) => { x += Math.sin((TAU * f * i) / SR) * Math.exp(-i / ((0.35 - k * 0.05) * SR)); });
      o[i] = x * 0.22 + noise() * Math.exp(-i / (0.05 * SR)) * 0.25;
    }
    return o;
  },
  glitch() {
    const o = buf(0.45);
    for (let s = 0; s < 5; s++) {
      const start = Math.floor(s * 0.085 * SR);
      const f = 200 + rand() * 1100;
      const len = Math.floor(0.06 * SR);
      for (let i = 0; i < len && start + i < o.length; i++) {
        const sq = Math.sin((TAU * f * i) / SR) > 0 ? 1 : -1;
        o[start + i] += Math.round((sq * 0.6 + noise() * 0.4) * 3) / 3 * 0.45;
      }
    }
    return o;
  },
  rattle() {
    const n = Math.ceil(0.6 * SR);
    const src = Float32Array.from({ length: n }, (_, i) => noise() * (Math.sin((TAU * 28 * i) / SR) > 0 ? 1 : 0.15));
    const o = bandpass(src, () => 2200, 1.0);
    for (let i = 0; i < n; i++) o[i] *= Math.exp(-i / (0.3 * SR)) * 2.2;
    return o;
  },
  soft() {
    const o = buf(1.0);
    for (let i = 0; i < o.length; i++) {
      o[i] = Math.sin((TAU * 330 * i) / SR) * Math.exp(-i / (0.25 * SR)) * 0.5
           + Math.sin((TAU * 165 * i) / SR) * Math.exp(-i / (0.4 * SR)) * 0.35;
    }
    return o;
  },
};

// ─── beat ────────────────────────────────────────────────
const DRUM = {
  kick() {
    const o = buf(0.35); let ph = 0;
    for (let i = 0; i < o.length; i++) {
      const f = 150 * Math.pow(48 / 150, Math.min(1, i / (0.08 * SR)));
      ph += (TAU * f) / SR;
      o[i] = Math.tanh((Math.sin(ph) * Math.exp(-i / (0.12 * SR)) + noise() * Math.exp(-i / (0.003 * SR)) * 0.3) * 1.5);
    }
    return o;
  },
  hat() {
    const o = buf(0.05); let prev = 0;
    for (let i = 0; i < o.length; i++) { const nz = noise(); o[i] = (nz - prev) * Math.exp(-i / (0.012 * SR)); prev = nz; }
    return o;
  },
  snare() {
    const n = Math.ceil(0.25 * SR);
    const o = bandpass(Float32Array.from({ length: n }, noise), () => 1800, 0.6);
    for (let i = 0; i < n; i++) o[i] = o[i] * Math.exp(-i / (0.09 * SR)) * 1.8 + Math.sin((TAU * 190 * i) / SR) * Math.exp(-i / (0.05 * SR)) * 0.5;
    return o;
  },
  bass(freq) {
    const o = buf(0.24);
    for (let i = 0; i < o.length; i++) {
      const env = Math.min(1, i / (0.005 * SR)) * Math.exp(-i / (0.16 * SR));
      o[i] = (Math.sin((TAU * freq * i) / SR) + 0.3 * Math.sin((TAU * 2 * freq * i) / SR)) * env;
    }
    return o;
  },
};

function place(L, R, clip, tSec, gain, pan) {
  const start = Math.floor(tSec * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = 0; i < clip.length && start + i < L.length; i++) {
    if (start + i < 0) continue;
    L[start + i] += clip[i] * gl;
    R[start + i] += clip[i] * gr;
  }
}

function build(meta) {
  const dur = meta.duration + 0.4;
  const L = buf(dur), R = buf(dur);
  const cache = {};

  // beat: 120bpm from the first boom until the fade at the end
  const bpm = 120, beatLen = 60 / bpm, start = 0.35, end = meta.duration - 0.6;
  const roots = [55, 43.65, 65.41, 49];
  const kick = DRUM.kick(), hat = DRUM.hat(), snare = DRUM.snare();
  const bassNotes = roots.map((f) => DRUM.bass(f));
  const gaps = [[14.5, 14.8], [24.0, 24.3]];
  for (let b = 0; start + b * beatLen < end; b++) {
    const t = start + b * beatLen;
    if (gaps.some(([a, z]) => t >= a && t < z)) continue;
    const fade = t > meta.duration - 2 ? Math.max(0, (end - t) / 1.4) : 1;
    const intro = t < 1.5 ? 0.6 : 1;
    const g = 0.75 * fade * intro;
    place(L, R, kick, t, 0.55 * g, 0);
    place(L, R, hat, t + beatLen / 2, 0.1 * g, 0.3);
    place(L, R, hat, t + beatLen * 0.75, 0.05 * g, -0.3);
    if (b % 2 === 1) place(L, R, snare, t, 0.2 * g, -0.05);
    const note = bassNotes[Math.floor(b / 4) % 4];
    place(L, R, note, t + 0.02, 0.2 * g, 0);
    place(L, R, note, t + beatLen / 2, 0.14 * g, 0);
  }

  // effects on their cues
  for (const e of meta.events) {
    if (!SFX[e.name]) throw new Error(`no sound effect named ${e.name}`);
    const clip = e.name === 'key' ? SFX.key() : (cache[e.name] = cache[e.name] || SFX[e.name]());
    const pan = (Math.sin(e.t * 12.9898) * 43758.5453 % 1) * 0.5;
    place(L, R, clip, e.t, 0.8 * e.gain, pan);
  }

  // normalise, then a gentle soft limit
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const norm = peak > 0 ? 0.92 / peak : 1;
  const lim = (x) => Math.tanh(x * norm * 1.25) / Math.tanh(1.25);
  for (let i = 0; i < L.length; i++) { L[i] = lim(L[i]); R[i] = lim(R[i]); }
  return [L, R];
}

function writeWav(file, [L, R]) {
  const n = L.length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(file, data);
}

if (require.main === module) {
  const [eventsFile, outFile] = process.argv.slice(2);
  if (!eventsFile || !outFile) { console.error('usage: node promo/sfx.js <events.json> <out.wav>'); process.exit(1); }
  const meta = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
  writeWav(outFile, build(meta));
  const names = [...new Set(meta.events.map((e) => e.name))];
  console.log(`wrote ${outFile}: ${meta.duration}s, ${meta.events.length} cues (${names.join(', ')})`);
}

module.exports = { build, writeWav, SFX };
