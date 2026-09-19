// Renders the shell STLs as dark polished chrome, for the site's product shots.
//   node tools/render_shell.js            writes web/shell_front.png, shell_back.png, shell_flat.png
// Offline and dependency-free: an orthographic z-buffer rasterizer with smooth
// normals (crease-aware), per-pixel reflections of a studio (soft boxes, a strip
// light, a light floor), a black glass screen with glowing mint eyes, a soft
// contact shadow and depth-based darkening so engravings read. 3x3 supersampled.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SIZE = 900, SS = 3;
const SCREEN_D = 33.5, GLASS_Z = 10.25 - 1.2;   // starboy_star.scad: screen_diameter, front face minus the lip

// ─── geometry ────────────────────────────────────────────
function loadSTL(file, mat) {
  const s = fs.readFileSync(path.join(ROOT, 'stl', file), 'utf8');
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  const v = [];
  let m;
  while ((m = re.exec(s))) v.push(+m[1], +m[2], +m[3]);
  return { pos: Float64Array.from(v), mat };
}

// the display glass: a disc just under the front lip
function glassDisc() {
  const v = [], r = SCREEN_D / 2, n = 160;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    v.push(0, 0, GLASS_Z, Math.cos(a0) * r, Math.sin(a0) * r, GLASS_Z, Math.cos(a1) * r, Math.sin(a1) * r, GLASS_Z);
  }
  return { pos: Float64Array.from(v), mat: 2 };
}

// per-corner normals, averaged over neighbouring faces within the crease angle
function smoothNormals(mesh, creaseDeg) {
  const p = mesh.pos, nt = p.length / 9, fn = new Float64Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const o = t * 9;
    const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2];
    const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
  }
  const key = (i) => `${Math.round(p[i] * 1e4)},${Math.round(p[i + 1] * 1e4)},${Math.round(p[i + 2] * 1e4)}`;
  const faces = new Map();
  for (let c = 0; c < nt * 3; c++) {
    const k = key(c * 3);
    if (!faces.has(k)) faces.set(k, []);
    faces.get(k).push(Math.floor(c / 3));
  }
  const cos = Math.cos((creaseDeg * Math.PI) / 180), cn = new Float64Array(nt * 9);
  for (let c = 0; c < nt * 3; c++) {
    const t = Math.floor(c / 3);
    let sx = 0, sy = 0, sz = 0;
    for (const u of faces.get(key(c * 3))) {
      const d = fn[t * 3] * fn[u * 3] + fn[t * 3 + 1] * fn[u * 3 + 1] + fn[t * 3 + 2] * fn[u * 3 + 2];
      if (d >= cos) { sx += fn[u * 3]; sy += fn[u * 3 + 1]; sz += fn[u * 3 + 2]; }
    }
    const l = Math.hypot(sx, sy, sz) || 1;
    cn[c * 3] = sx / l; cn[c * 3 + 1] = sy / l; cn[c * 3 + 2] = sz / l;
  }
  mesh.nrm = cn;
  return mesh;
}

// ─── camera ──────────────────────────────────────────────
function rotation(zDeg, flipY, xDeg, yDeg) {
  const rz = (zDeg * Math.PI) / 180, rx = (xDeg * Math.PI) / 180, ry = (yDeg * Math.PI) / 180;
  const Rz = [[Math.cos(rz), -Math.sin(rz), 0], [Math.sin(rz), Math.cos(rz), 0], [0, 0, 1]];
  const F = flipY ? [[-1, 0, 0], [0, 1, 0], [0, 0, -1]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const Rx = [[1, 0, 0], [0, Math.cos(rx), -Math.sin(rx)], [0, Math.sin(rx), Math.cos(rx)]];
  const Ry = [[Math.cos(ry), 0, Math.sin(ry)], [0, 1, 0], [-Math.sin(ry), 0, Math.cos(ry)]];
  const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  return mul(Ry, mul(Rx, mul(F, Rz)));
}
const apply = (M, x, y, z) => [M[0][0] * x + M[0][1] * y + M[0][2] * z, M[1][0] * x + M[1][1] * y + M[1][2] * z, M[2][0] * x + M[2][1] * y + M[2][2] * z];

// ─── the studio ──────────────────────────────────────────
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const BOX = unit(-0.6, 0.65, 0.45), STRIP = unit(0.85, 0.25, 0.45), BOUNCE = unit(0.3, -0.85, 0.42), TOP = unit(0, 1, 0.15);
const dot = (a, x, y, z) => a[0] * x + a[1] * y + a[2] * z;

// light seen along reflected ray (camera space: x right, y up, z toward the viewer)
function studio(x, y, z) {
  const room = 0.03 + 0.05 * sstep(-0.2, 0.8, y) + 0.24 * sstep(0.25, -0.4, x - y) * sstep(0.6, 1, z);
  const floor = 0.2 * sstep(-0.15, -0.6, y);
  const lights = 1.5 * sstep(0.78, 0.93, dot(BOX, x, y, z)) + 0.95 * sstep(0.9, 0.97, dot(STRIP, x, y, z))
    + 0.4 * sstep(0.7, 0.95, dot(TOP, x, y, z));
  const bounce = 0.3 * sstep(0.84, 0.95, dot(BOUNCE, x, y, z));
  return [room + floor + lights + bounce * 0.7, room + floor + lights + bounce * 0.9, room * 1.05 + floor + lights + bounce];
}

// ─── rendering ───────────────────────────────────────────
function render(meshes, view) {
  const M = rotation(view.rotZ, view.flip, view.tiltX, view.turnY);
  const N = SIZE * SS;

  // fit: project every vertex, then centre and scale (or use a fixed scale/centre)
  let lo = [1e9, 1e9], hi = [-1e9, -1e9];
  for (const m of meshes) for (let i = 0; i < m.pos.length; i += 3) {
    const [x, y] = apply(M, m.pos[i], m.pos[i + 1], m.pos[i + 2]);
    lo = [Math.min(lo[0], x), Math.min(lo[1], y)]; hi = [Math.max(hi[0], x), Math.max(hi[1], y)];
  }
  const scale = (view.scale || Math.min((SIZE * view.fill) / (hi[0] - lo[0]), (SIZE * view.fill) / (hi[1] - lo[1]))) * SS;
  const [ox, oy] = view.center ? apply(M, ...view.center).slice(0, 2) : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
  const cx = N / 2 - ox * scale, cy = N / 2 + oy * scale + (view.lift || 0) * SS;

  const zb = new Float32Array(N * N).fill(-1e9);
  const nx = new Float32Array(N * N), ny = new Float32Array(N * N), nz = new Float32Array(N * N);
  const mat = new Uint8Array(N * N);
  for (const m of meshes) {
    const p = m.pos, q = m.nrm, nt = p.length / 9;
    const sv = new Float64Array(9), sn = new Float64Array(9);
    for (let t = 0; t < nt; t++) {
      for (let k = 0; k < 3; k++) {
        const o = t * 9 + k * 3;
        const [x, y, z] = apply(M, p[o], p[o + 1], p[o + 2]);
        sv[k * 3] = cx + x * scale; sv[k * 3 + 1] = cy - y * scale; sv[k * 3 + 2] = z;
        const [a, b, c] = q ? apply(M, q[o], q[o + 1], q[o + 2]) : [0, 0, 1];
        sn[k * 3] = a; sn[k * 3 + 1] = b; sn[k * 3 + 2] = c;
      }
      const [x0, y0, z0, x1, y1, z1, x2, y2, z2] = sv;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(N - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(N - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
          const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * z0 + w1 * z1 + w2 * z2, i = y * N + x;
          if (z <= zb[i]) continue;
          let a = w0 * sn[0] + w1 * sn[3] + w2 * sn[6], b = w0 * sn[1] + w1 * sn[4] + w2 * sn[7], c = w0 * sn[2] + w1 * sn[5] + w2 * sn[8];
          const l = Math.hypot(a, b, c) || 1;
          a /= l; b /= l; c /= l;
          if (c < 0) { a = -a; b = -b; c = -c; }   // back faces seen through gaps: face the camera
          zb[i] = z; nx[i] = a; ny[i] = b; nz[i] = c; mat[i] = m.mat;
        }
      }
    }
  }

  // depth-based darkening: pixels sitting below their neighbourhood (engravings, recesses)
  const zBlur = blurField(zb, mat, N, Math.round(7 * SS));
  const inv = [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];

  // reflections use a perspective eye point, so even flat faces sweep through the lights
  const EYE = 170 * scale;   // camera distance, in raster pixels (~170mm)
  const tone = (v) => 1 - Math.exp(-1.7 * v);
  const col = new Float32Array(N * N * 3), alpha = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    if (!mat[i]) continue;
    alpha[i] = 1;
    const x = i % N, y = Math.floor(i / N);
    const [vx, vy, vz] = unit(-(x + 0.5 - N / 2), (y + 0.5 - N / 2), EYE - zb[i] * scale);
    const a = nx[i], b = ny[i], c = nz[i];
    const nv = a * vx + b * vy + c * vz;
    const rx = 2 * nv * a - vx, ry = 2 * nv * b - vy, rz = 2 * nv * c - vz;
    let [r, g, bl] = studio(rx, ry, rz);
    let glow = [0, 0, 0];
    if (mat[i] === 2) {
      // black glass: a dim mirror (so the lights glint off it), with the eyes glowing through
      r *= 0.16; g *= 0.16; bl *= 0.16;
      const [mx, my] = apply(inv, (x + 0.5 - cx) / scale, -(y + 0.5 - cy) / scale, zb[i]);
      glow = eyeGlow(mx, my, view.rotZ);
    } else {
      const fres = 0.8 + 0.2 * Math.pow(1 - Math.max(0, nv), 5);
      const occ = 1 - Math.min(0.65, Math.max(0, (zBlur[i] - zb[i]) * 0.9));
      r *= 0.86 * fres * occ; g *= 0.9 * fres * occ; bl *= 0.96 * fres * occ;
    }
    // reflections roll off softly; light the display emits is added as is
    col[i * 3] = tone(r) + glow[0]; col[i * 3 + 1] = tone(g) + glow[1]; col[i * 3 + 2] = tone(bl) + glow[2];
  }

  // downsample, over a light ground with a soft contact shadow
  const out = Buffer.alloc(SIZE * SIZE * 3);
  const cover = new Float32Array(SIZE * SIZE);
  const rgb = new Float32Array(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let ar = 0, ag = 0, ab = 0, aa = 0;
    for (let j = 0; j < SS; j++) for (let k = 0; k < SS; k++) {
      const i = (y * SS + j) * N + x * SS + k;
      if (!alpha[i]) continue;
      aa++; ar += col[i * 3]; ag += col[i * 3 + 1]; ab += col[i * 3 + 2];
    }
    const o = y * SIZE + x;
    cover[o] = aa / (SS * SS);
    if (aa) { rgb[o * 3] = ar / aa; rgb[o * 3 + 1] = ag / aa; rgb[o * 3 + 2] = ab / aa; }
  }
  // holes the ground shows through (vents, the mic port) would be dark inside the real star
  const open = new Uint8Array(SIZE * SIZE), stack = [];
  for (let i = 0; i < SIZE; i++) stack.push(i, (SIZE - 1) * SIZE + i, i * SIZE, i * SIZE + SIZE - 1);
  while (stack.length) {
    const o = stack.pop();
    if (open[o] || cover[o] > 0.5) continue;
    open[o] = 1;
    const x = o % SIZE, y = (o - x) / SIZE;
    if (x > 0) stack.push(o - 1);
    if (x < SIZE - 1) stack.push(o + 1);
    if (y > 0) stack.push(o - SIZE);
    if (y < SIZE - 1) stack.push(o + SIZE);
  }
  // only inside the star itself: the keyring loop's hole is real and stays open
  const ox0 = cx / SS, oy0 = cy / SS, inR = (34 * scale) / SS;
  for (let o = 0; o < SIZE * SIZE; o++) {
    if (open[o] || cover[o] >= 1) continue;
    const x = o % SIZE, y = (o - x) / SIZE;
    if (Math.hypot(x - ox0, y - oy0) > inR) continue;
    for (let ch = 0; ch < 3; ch++) rgb[o * 3 + ch] = rgb[o * 3 + ch] * cover[o] + 0.035 * (1 - cover[o]);
    cover[o] = 1;
  }
  const shadow = shadowOf(cover, view.shadow);
  for (let o = 0; o < SIZE * SIZE; o++) {
    const s = 1 - shadow[o];
    for (let ch = 0; ch < 3; ch++) {
      const ground = view.bg * s, obj = 255 * Math.min(1, rgb[o * 3 + ch]);
      out[o * 3 + ch] = Math.round(ground * (1 - cover[o]) + obj * cover[o]);
    }
  }
  return out;
}

// mint eyes on the display, in model millimetres (the 240px screen is ~32.4mm)
// (rotZ turns the star; the picture on the display stays level)
function eyeGlow(mx, my, rotZ) {
  const a = (rotZ * Math.PI) / 180, x = mx * Math.cos(a) - my * Math.sin(a), y = mx * Math.sin(a) + my * Math.cos(a);
  const k = 32.4 / 240, rx = 48 * k, ry = 56 * k, mint = [0.56, 0.95, 0.92];
  for (const side of [-1, 1]) {
    const ex = side * 52 * k;
    if (((x - ex) / rx) ** 2 + (y / ry) ** 2 < 1) {
      const px = ex - side * 0.5 * rx;   // the 'dot' pupil sits toward the middle
      return Math.hypot(x - px, y) < 5.3 * k ? [0.05, 0.3, 0.33] : mint.map((c) => c * 0.95);
    }
  }
  const ring = Math.exp(-(((Math.hypot(x, y) - SCREEN_D / 2 + 0.35) / 0.45) ** 2));
  return mint.map((c) => c * ring * 0.9);
}

function blurField(z, mat, N, r) {
  // box blur of depth, with empty pixels taking the local surface's depth where possible
  const src = new Float32Array(N * N), w = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) if (mat[i]) { src[i] = z[i]; w[i] = 1; }
  const s1 = boxBlur(src, N, r), w1 = boxBlur(w, N, r);
  for (let i = 0; i < N * N; i++) s1[i] = w1[i] > 0 ? s1[i] / w1[i] : 0;
  return s1;
}

function boxBlur(a, N, r) {
  const out = new Float32Array(N * N), tmp = new Float32Array(N * N), n = 2 * r + 1;
  for (let y = 0; y < N; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[y * N + Math.min(N - 1, Math.max(0, x))];
    for (let x = 0; x < N; x++) {
      tmp[y * N + x] = s / n;
      s += a[y * N + Math.min(N - 1, x + r + 1)] - a[y * N + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < N; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(N - 1, Math.max(0, y)) * N + x];
    for (let y = 0; y < N; y++) {
      out[y * N + x] = s / n;
      s += tmp[Math.min(N - 1, y + r + 1) * N + x] - tmp[Math.max(0, y - r) * N + x];
    }
  }
  return out;
}

function shadowOf(cover, opt) {
  const shifted = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const sy = y - opt.dy, sx = x - (opt.dx || 0);
    if (sy >= 0 && sy < SIZE && sx >= 0 && sx < SIZE) shifted[y * SIZE + x] = cover[sy * SIZE + sx];
  }
  let s = shifted;
  for (let i = 0; i < 3; i++) s = boxBlur(s, SIZE, opt.blur);
  for (let i = 0; i < s.length; i++) s[i] *= opt.alpha;
  return s;
}

// ─── png ─────────────────────────────────────────────────
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(rgb) {
  const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) rgb.copy(raw, y * (SIZE * 3 + 1) + 1, y * SIZE * 3, (y + 1) * SIZE * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ─── the three shots ─────────────────────────────────────
const front = smoothNormals(loadSTL('starboy_front.stl', 1), 35);
const bezel = smoothNormals(loadSTL('starboy_bezel.stl', 1), 35);
const back = smoothNormals(loadSTL('starboy_back.stl', 1), 35);
const glass = glassDisc();

const SHOTS = {
  // straight on, keyring up and right, the screen opening centred at 31.8% of the width (the page lays the live eyes over it)
  // (both shells together: the assembled star, so the keyring loop is whole and holes show the inside)
  shell_flat: { meshes: [front, back, bezel, glass], view: { rotZ: 18, tiltX: 0, turnY: 0, scale: (SIZE * 0.318) / SCREEN_D, center: [0, 0, 0], bg: 248, shadow: { dy: 22, blur: 16, alpha: 0.22 } } },
  shell_front: { meshes: [front, back, bezel, glass], view: { rotZ: 18, tiltX: -38, turnY: 24, fill: 0.72, bg: 255, shadow: { dy: 34, dx: 6, blur: 22, alpha: 0.2 } } },
  shell_back: { meshes: [back, front], view: { rotZ: 18, flip: true, tiltX: -38, turnY: -24, fill: 0.72, bg: 255, shadow: { dy: 34, dx: -6, blur: 22, alpha: 0.2 } } },
};

const only = process.argv.slice(2);
for (const [name, shot] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  const t0 = Date.now();
  const file = path.join(ROOT, 'web', `${name}.png`);
  fs.writeFileSync(file, png(render(shot.meshes, shot.view)));
  console.log(`${name}.png  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
