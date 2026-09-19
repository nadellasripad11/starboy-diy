// Starboy's chrome star. The silhouette becomes a height field (a rounded
// bevel round the edge and into the keyring hole, a slight dome, a raised ring
// round the screen) and every pixel reflects a sky, a horizon and soft boxes off its
// normal, so it reads like polished chrome instead of painted stripes. The metal is
// built once per size and cached; the glass screen and its glow are drawn live.
(function () {
  const E = window.StarboyEyes;
  const GLOW = '143,243,234';
  const cache = new Map();
  const eyeCanvas = document.createElement('canvas');
  eyeCanvas.width = eyeCanvas.height = 240;
  const eyeCtx = eyeCanvas.getContext('2d');

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const norm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  // lights, as directions from the star (x right, y down, z toward the viewer)
  const BOX = norm(-0.6, -0.65, 0.45);     // big soft box, up and left
  const STRIP = norm(0.85, -0.25, 0.45);   // tall strip light on the right
  const BOUNCE = norm(0.3, 0.85, 0.42);    // cool bounce from below right

  // the chrome world along reflected ray (x, y, z; y down): bright sky above a
  // horizon, dark ground below, soft boxes on top. Returns [r, g, b] in 0..1+
  function studio(x, y, z) {
    const HZ = 0.1;
    const sky = 0.52 + 0.48 * sstep(HZ, -0.75, y);
    const ground = 0.12 + 0.3 * sstep(0.3, 0.9, y);
    const k = sstep(HZ - 0.012, HZ + 0.03, y);
    const rim = 0.3 * Math.exp(-(((y - HZ + 0.03) / 0.02) ** 2));   // the bright band of sky at the horizon
    const base = (sky + rim) * (1 - k) + ground * k;
    const lights = 1.1 * sstep(0.8, 0.94, x * BOX[0] + y * BOX[1] + z * BOX[2])
      + 0.8 * sstep(0.9, 0.97, x * STRIP[0] + y * STRIP[1] + z * STRIP[2]);
    const bounce = 0.25 * sstep(0.84, 0.95, x * BOUNCE[0] + y * BOUNCE[1] + z * BOUNCE[2]);
    return [base * 0.93 + lights + bounce * 0.7, base * 0.96 + lights + bounce * 0.9, base * 1.02 + lights + bounce];
  }

  function starPath(R, ratio) {
    const p = new Path2D();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? R : R * ratio;
      if (i === 0) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.closePath();
    return p;
  }

  // exact squared distance transform along one line (Felzenszwalb & Huttenlocher)
  function dt1(f, n, d, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  }

  // distance from each inside pixel to the silhouette edge
  function edgeDistance(cover, S) {
    const g = new Float64Array(S * S);
    for (let i = 0; i < S * S; i++) g[i] = cover[i] >= 0.5 ? 1e12 : 0;
    const f = new Float64Array(S), d = new Float64Array(S), v = new Int32Array(S), z = new Float64Array(S + 1);
    for (let x = 0; x < S; x++) {
      for (let y = 0; y < S; y++) f[y] = g[y * S + x];
      dt1(f, S, d, v, z);
      for (let y = 0; y < S; y++) g[y * S + x] = d[y];
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) f[x] = g[y * S + x];
      dt1(f, S, d, v, z);
      for (let x = 0; x < S; x++) g[y * S + x] = Math.sqrt(d[x]);
    }
    return g;
  }

  // separable box blur, in place
  function smooth(a, S, r) {
    const tmp = new Float32Array(S), n = 2 * r + 1;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < S; j++) {
        const at = pass === 0 ? (i) => j * S + i : (i) => i * S + j;
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += a[at(Math.min(S - 1, Math.max(0, i)))];
        for (let i = 0; i < S; i++) {
          tmp[i] = sum / n;
          sum += a[at(Math.min(S - 1, i + r + 1))] - a[at(Math.max(0, i - r))];
        }
        for (let i = 0; i < S; i++) a[at(i)] = tmp[i];
      }
    }
  }

  // the metal at radius Rp (device pixels), plus a matching dark silhouette
  function build(Rp) {
    const S = Math.ceil(Rp * 2.5) + 4, C = S / 2, N = S * S;
    const sil = document.createElement('canvas');
    sil.width = sil.height = S;
    const sg = sil.getContext('2d');
    sg.translate(C, C);
    const body = starPath(Rp * 0.84, 0.62);
    sg.fillStyle = sg.strokeStyle = '#fff';
    sg.lineWidth = Rp * 0.28;
    sg.lineJoin = 'round';
    sg.fill(body);
    sg.stroke(body);
    // the keyring hole through the upper-right point (CAD: 5mm at 27.5 of 33.5mm).
    // Cut before the edge distance, so the rounded bevel wraps into the hole too.
    const la = -Math.PI / 2 + (2 * Math.PI) / 5;
    sg.globalCompositeOperation = 'destination-out';
    sg.beginPath();
    sg.arc(Math.cos(la) * Rp * 0.8, Math.sin(la) * Rp * 0.8, Rp * 0.074, 0, Math.PI * 2);
    sg.fill();
    sg.globalCompositeOperation = 'source-over';
    const px = sg.getImageData(0, 0, S, S).data;
    const cover = new Float32Array(N);
    for (let i = 0; i < N; i++) cover[i] = px[i * 4 + 3] / 255;
    const dist = edgeDistance(cover, S);

    const B = Rp * 0.14, D = Rp * 0.11;                      // bevel width, dome height
    const sr = Rp * 0.3956, rb = Rp * 0.5;                   // screen radius, bezel outer radius
    const rc = (sr + rb) / 2, tw = (rb - sr) / 2;

    const h = new Float32Array(N), alpha = new Float32Array(N);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, dx = x + 0.5 - C, dy = y + 0.5 - C, rho = Math.hypot(dx, dy);
        let a = cover[i], hh = 0;
        if (a > 0) {
          const e = Math.min(1, dist[i] / B);
          const dome = D * Math.max(0, 1 - (rho / Rp) ** 2);
          hh = B * Math.sqrt(1 - (1 - e) ** 2) + dome;
          const q = (rho - rc) / tw;
          if (Math.abs(q) < 1) hh = Math.max(hh, B + dome + tw * 1.3 * Math.sqrt(1 - q * q));
          else if (rho < sr) hh = B + dome;
          a *= clamp01(rho - sr + 0.5);                        // the screen goes here, live
        }
        h[i] = hh;
        alpha[i] = a;
      }
    }

    // soften the height field so the edge distance's pixel steps don't show as dashes
    smooth(h, S, Math.max(1, Math.round(Rp * 0.012)));
    smooth(h, S, Math.max(1, Math.round(Rp * 0.012)));

    const out = new ImageData(S, S), dark = new ImageData(S, S);
    const o = out.data, k = dark.data;
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        const i = y * S + x, a = alpha[i];
        if (a <= 0) continue;
        const [nx, ny, nz] = norm(-(h[i + 1] - h[i - 1]) / 2, -(h[i + S] - h[i - S]) / 2, 1);
        const c = studio(2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1);
        const rho = Math.hypot(x + 0.5 - C, y + 0.5 - C);
        const ao = 1 - 0.4 * Math.exp(-(((rho - rb) / (Rp * 0.025)) ** 2)) * (rho > rb ? 1 : 0);
        o[i * 4] = Math.min(255, 255 * c[0] * 0.86 * ao);
        o[i * 4 + 1] = Math.min(255, 255 * c[1] * 0.9 * ao);
        o[i * 4 + 2] = Math.min(255, 255 * c[2] * 0.96 * ao);
        o[i * 4 + 3] = 255 * a;
        k[i * 4] = 7; k[i * 4 + 1] = 7; k[i * 4 + 2] = 10; k[i * 4 + 3] = 255 * a;
      }
    }
    const metal = document.createElement('canvas');
    metal.width = metal.height = S;
    metal.getContext('2d').putImageData(out, 0, 0);
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, S, S);
    sg.putImageData(dark, 0, 0);
    return { metal, dark: sil, S, C, Rp };
  }

  function metalFor(Rp) {
    Rp = Math.max(24, Math.min(720, Math.round(Rp / 24) * 24));
    let c = cache.get(Rp);
    if (!c) {
      c = build(Rp);
      cache.set(Rp, c);
      if (cache.size > 4) cache.delete(cache.keys().next().value);
    }
    return c;
  }

  // the glass: live eyes, depth toward the rim, a soft glare and a crisp arc of light
  function glass(ctx, d, eye, shape, cw, t, dpr) {
    E.render(eyeCtx, { ...eye, blinkB: eye.blinkB ?? (eye.blinkT || 0) * 0.45 }, shape, cw, t * 1000);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(eyeCanvas, -d / 2, -d / 2, d, d);
    const depth = ctx.createRadialGradient(0, 0, d * 0.3, 0, 0, d / 2);
    depth.addColorStop(0, 'rgba(0,0,0,0)');
    depth.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = depth;
    ctx.fillRect(-d / 2, -d / 2, d, d);
    const glare = ctx.createRadialGradient(-d * 0.2, -d * 0.28, 0, -d * 0.2, -d * 0.28, d * 0.45);
    glare.addColorStop(0, 'rgba(255,255,255,0.16)');
    glare.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = Math.max(1, d * 0.018);
    ctx.beginPath();
    ctx.arc(0, 0, d * 0.43, Math.PI * 1.13, Math.PI * 1.4);
    ctx.stroke();
    ctx.shadowColor = `rgba(${GLOW},0.9)`;
    ctx.shadowBlur = d * 0.12 * dpr;
    ctx.strokeStyle = `rgba(${GLOW},0.9)`;
    ctx.lineWidth = Math.max(1.5, d * 0.028);
    ctx.beginPath();
    ctx.arc(0, 0, d / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // o: { x, y, R, rot, sx, sy, dim (0 lit .. 1 dark), t, eye, shape, cw, dpr,
  //      shadow (drop shadow), cacheR (build the metal at this radius, e.g. while zooming) }
  function draw(ctx, o) {
    const dpr = o.dpr || 1;
    const m = metalFor((o.cacheR || o.R) * dpr);
    const k = o.R / m.Rp;   // css px per metal pixel
    const dim = clamp01(o.dim || 0);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot || 0);
    ctx.scale(o.sx ?? 1, o.sy ?? 1);
    const s = m.S * k, off = -m.C * k;
    if (o.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = o.R * 0.22 * dpr;
      ctx.shadowOffsetY = o.R * 0.11 * dpr;
      ctx.drawImage(m.dark, off, off, s, s);
      ctx.restore();
    }
    if (dim > 0) ctx.drawImage(m.dark, off, off, s, s);
    ctx.globalAlpha = 1 - dim * 0.9;
    ctx.drawImage(m.metal, off, off, s, s);
    ctx.globalAlpha = 1;
    if (dim > 0) {
      // in the dark the screen's glow is what lights him
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, o.R * 0.35, 0, 0, o.R * 1.05);
      g.addColorStop(0, `rgba(${GLOW},${0.22 * dim})`);
      g.addColorStop(1, `rgba(${GLOW},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-o.R * 1.1, -o.R * 1.1, o.R * 2.2, o.R * 2.2);
      ctx.restore();
    }
    glass(ctx, o.R * 0.3956 * 2, o.eye, o.shape, o.cw, o.t || 0, dpr);
    ctx.restore();
  }

  // the site's hero look: big glowing mint eyes with tiny pupils ('dot')
  const HERO = { cw: { name: 'mint', body: '#8ff3ea', pl: '#0e4d53', pr: '#0e4d53', w: 0 }, shape: 0 };

  window.StarboyStar = { draw, GLOW, HERO };
})();
