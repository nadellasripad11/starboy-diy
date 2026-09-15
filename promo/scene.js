// starboy diy promo: a 27.5s vertical video drawn entirely in code.
// Everything is a pure function of time, so frames are deterministic and the
// sound effect cue list (EVENTS) lines up exactly with what's on screen.
(function () {
  const W = 1080, H = 1920, FPS = 30, DURATION = 27.5;
  const E = window.StarboyEyes;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const eyeCanvas = document.createElement('canvas');
  eyeCanvas.width = eyeCanvas.height = 240;
  const eyeCtx = eyeCanvas.getContext('2d');

  // ─── math ──────────────────────────────────────────────
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, start, dur) => clamp01((t - start) / dur);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const cw = (name) => {
    const i = E.COLORWAYS.findIndex((c) => c.name === name);
    if (i < 0) throw new Error(`unknown colorway ${name}`);
    return i;
  };
  const FONT = 'Figtree, "Arial Black", "Segoe UI", sans-serif';
  const MONO = '"JetBrains Mono", Consolas, monospace';
  const BASE_EYE = { gx: 0, gy: 0, blinkT: 0, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0, colOvr: '#000000', fx: 0, fxP: 0 };

  // ─── timeline ──────────────────────────────────────────
  const T = { pet: 3.2, react: 5.6, looks: 11.0, rare: 14.8, build: 18.0, seed: 21.6, outro: 24.2 };
  const BEATS = [
    { t: 5.6,  caption: 'shake him.',   sub: 'he gets dizzy',   sfx: 'rattle', kind: 'shake' },
    { t: 6.95, caption: 'freeze him.',  sub: 'he shivers',      sfx: 'ice',    kind: 'cold' },
    { t: 8.3,  caption: 'yell at him.', sub: 'he panics',       sfx: 'glitch', kind: 'loud' },
    { t: 9.65, caption: 'ignore him.',  sub: 'he falls asleep', sfx: 'soft',   kind: 'sleep' },
  ];
  const CUTS = [
    { t: 15.0,  fx: 2,  name: 'hearts',  cw: 'confetti',    shape: 1 },
    { t: 15.55, fx: 18, name: 'fire',    cw: 'classic',     shape: 2, mood: { blinkT: 0.4, pupR: 0.85, irY: 0.88, bwL: 7, bwR: 7, bwY: 2 } },
    { t: 16.1,  fx: 16, name: 'galaxy',  cw: 'midnight',    shape: 1 },
    { t: 16.65, fx: 1,  name: 'rainbow', cw: 'classic',     shape: 2 },
    { t: 17.2,  fx: 6,  name: 'hypno',   cw: 'radioactive', shape: 1 },
  ];
  const CHIPS = [
    { t: 19.0,  text: 'esp32-c3 brain',      cw: 'starlight' },
    { t: 19.35, text: '1.28" round screen',  cw: 'deepsea' },
    { t: 19.7,  text: 'motion + temp + mic', cw: 'tangerine' },
    { t: 20.05, text: '20.5mm chrome shell', cw: 'orchid' },
  ];
  const SEED_TEXT = '> seed 1da79c35';
  const SEED_START = 22.05, SEED_STEP = 0.055, SEED_LAND = 23.3;
  const RAREST = { cw: 'pinwheel', shape: 0 };   // 0.04%: a weight-2 colorway with the 10% dot shape

  // sound cues, read by promo/sfx.js
  const EVENTS = [];
  const ev = (t, name, gain = 1) => EVENTS.push({ t: Math.round(t * 1000) / 1000, name, gain });
  ev(0.0, 'riser', 0.55); ev(0.35, 'boom'); ev(1.0, 'blink', 0.8); ev(1.3, 'pop'); ev(1.55, 'hit');
  ev(3.3, 'pop'); ev(3.6, 'pop'); ev(3.9, 'pop');
  for (const b of BEATS) { ev(b.t - 0.08, 'whoosh', 0.55); ev(b.t + 0.05, b.sfx, 0.9); ev(b.t + 0.3, 'pop', 0.45); }
  ev(11.0, 'whoosh'); ev(11.35, 'swipe', 0.6);
  for (let i = 0; i < 15; i++) ev(11.4 + i * 0.08, 'tick', 0.45);
  ev(12.62, 'hit'); ev(12.7, 'pop', 0.6); ev(13.3, 'sparkle'); ev(13.45, 'pop', 0.6); ev(14.55, 'whoosh', 0.7);
  ev(14.8, 'boom'); ev(14.95, 'pop', 0.7);
  for (const c of CUTS) ev(c.t, 'hit', 0.8);
  ev(18.0, 'whoosh'); ev(18.75, 'pop', 0.5);
  for (const c of CHIPS) ev(c.t, 'swipe', 0.7);
  ev(21.35, 'whoosh', 0.5);
  ev(21.7, 'pop'); ev(21.9, 'swipe', 0.5);
  [...SEED_TEXT].forEach((ch, i) => { if (ch !== ' ') ev(SEED_START + i * SEED_STEP, 'key', 0.8); });
  for (let i = 0; i < 13; i++) ev(22.15 + i * 0.09, 'tick', 0.3);
  ev(SEED_LAND, 'sparkle'); ev(SEED_LAND + 0.02, 'pop', 0.7); ev(24.1, 'whoosh', 0.5);
  ev(24.3, 'boom'); ev(24.65, 'hit'); ev(25.05, 'pop'); ev(25.45, 'soft', 0.6);
  EVENTS.sort((a, b) => a.t - b.t);

  // ─── star pose keyframes ───────────────────────────────
  const KEYS = [
    { t: 0,     x: 540, y: 800,  s: 0 },
    { t: 0.35,  x: 540, y: 800,  s: 0 },
    { t: 1.0,   x: 540, y: 800,  s: 1, ease: 'back' },
    { t: 3.2,   x: 540, y: 800,  s: 1 },
    { t: 3.7,   x: 540, y: 740,  s: 0.84 },
    { t: 5.6,   x: 540, y: 740,  s: 0.84 },
    { t: 5.9,   x: 540, y: 780,  s: 0.92 },
    { t: 11.0,  x: 540, y: 780,  s: 0.92 },
    { t: 11.4,  x: 540, y: 780,  s: 0,    ease: 'in' },
    { t: 14.8,  x: 540, y: 880,  s: 0 },
    { t: 15.25, x: 540, y: 880,  s: 0.95, ease: 'back' },
    { t: 18.0,  x: 540, y: 880,  s: 0.95 },
    { t: 18.7,  x: 540, y: 560,  s: 0.62 },
    { t: 21.6,  x: 540, y: 560,  s: 0.62 },
    { t: 22.1,  x: 540, y: 1320, s: 0.7 },
    { t: 24.2,  x: 540, y: 1320, s: 0.7 },
    { t: 24.75, x: 540, y: 780,  s: 1.02, ease: 'back' },
    { t: 99,    x: 540, y: 780,  s: 1.02 },
  ];
  function starPose(t) {
    let i = 0;
    while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const p = clamp01((t - a.t) / (b.t - a.t || 1));
    const e = b.ease === 'back' ? easeOutBack(p) : b.ease === 'in' ? easeInCubic(p) : easeInOutCubic(p);
    let x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e);
    const s = Math.max(0, lerp(a.s, b.s, e));

    let rot = Math.sin(t * 1.3) * 0.035;
    if (t >= T.pet && t < T.react) rot += Math.sin((t - T.pet) * 2.4) * 0.07;
    if (t >= T.looks && t < T.rare) rot += easeInCubic(prog(t, T.looks, 0.4)) * 1.4;
    if (t >= T.rare && t < 15.4) rot -= (1 - easeOutCubic(prog(t, T.rare, 0.5))) * 1.6;
    if (t >= T.outro) rot -= (1 - easeOutCubic(prog(t, T.outro, 0.6))) * 0.9;

    const beat = beatAt(t);
    if (beat && beat.kind === 'shake') {
      const decay = 1 - prog(t, beat.t, 1.25);
      x += Math.sin(t * 71) * 26 * decay;
      y += Math.cos(t * 53) * 14 * decay;
      rot += Math.sin(t * 37) * 0.12 * decay;
    }
    if (beat && beat.kind === 'cold') x += Math.sin(t * 90) * 5;

    let scaleX = 1;
    if (t >= T.build && t < T.build + 0.9) scaleX = Math.cos(easeInOutCubic(prog(t, T.build, 0.9)) * Math.PI * 2);
    return { x, y, s, rot, scaleX };
  }

  const beatAt = (t) => (t >= T.react && t < T.looks ? BEATS[Math.min(3, Math.floor((t - T.react) / 1.35))] : null);

  // ─── the eye on his screen ─────────────────────────────
  function blinkAt(t) {
    const ph = (t + 0.7) % 3.1;
    if (ph < 0.08) return (ph / 0.08) * 0.95;
    if (ph < 0.2) return (1 - (ph - 0.08) / 0.12) * 0.95;
    return 0;
  }

  function mainEye(t) {
    let cwi = cw('starlight'), shape = 2, bump = 0;
    const eye = { ...BASE_EYE, fxP: t * 1.5, gx: Math.sin(t * 1.6) * 12, gy: Math.cos(t * 1.13) * 5, blinkT: blinkAt(t) };

    if (t < 1.15) {
      Object.assign(eye, { blinkT: t < 1.0 ? 1 : 1 - prog(t, 1.0, 0.15), gx: 0, gy: 0 });
    } else if (t >= T.react && t < T.looks) {
      const b = beatAt(t), lt = t - b.t;
      if (b.kind === 'shake') { const a = lt * 9; Object.assign(eye, { gx: Math.cos(a) * 20, gy: Math.sin(a) * 16, pupR: 0.8, blinkT: 0.2 }); }
      if (b.kind === 'cold') Object.assign(eye, { colMix: 0.5, colOvr: '#2a4bff', fx: 10, pupR: 0.6, irY: 1.15, bwL: 12, bwR: 12, bwY: 5, blinkT: 0.25, gx: Math.sin(t * 45) * 6, gy: 0 });
      if (b.kind === 'loud') {
        const k = Math.floor(lt / 0.16);
        Object.assign(eye, { gx: hash(k) * 36 - 18, gy: hash(k + 7) * 24 - 12, pupR: 0.9, irX: 1.1, irY: 0.8, bwL: 4, bwR: 4, blinkT: 0.3 });
      }
      if (b.kind === 'sleep') {
        const close = lerp(0.35, 0.97, easeInOutCubic(prog(t, b.t, 0.9)));
        const breathe = lt > 0.9 ? 0.03 * (0.5 + 0.5 * Math.sin(lt * 4)) : 0;
        Object.assign(eye, { blinkT: close - breathe, pupR: 0.7, gx: 0, gy: 4 });
      }
    } else if (t >= T.rare && t < T.build) {
      const cut = [...CUTS].reverse().find((c) => t >= c.t);
      if (cut) {
        cwi = cw(cut.cw);
        shape = cut.shape;
        Object.assign(eye, cut.mood || {}, { fx: cut.fx, gx: 0, gy: 0 });
        bump = 1 - easeOutCubic(prog(t, cut.t, 0.25));
      }
    } else if (t >= T.build && t < T.seed) {
      Object.assign(eye, { smile: 0.6, blinkT: Math.max(eye.blinkT, 0.08) });
    } else if (t >= T.seed && t < T.outro) {
      if (t >= 22.1 && t < SEED_LAND) {
        const k = Math.floor((t - 22.1) / 0.09);
        cwi = Math.floor(hash(k * 3 + 1) * 100);
        shape = Math.floor(hash(k * 5 + 2) * 4);
      }
      if (t >= SEED_LAND) bump = 1 - easeOutCubic(prog(t, SEED_LAND, 0.35));
    } else if (t >= T.outro) {
      Object.assign(eye, { smile: 0.8, blinkT: Math.max(blinkAt(t), 0.08), gx: Math.sin(t * 1.2) * 6, gy: 0 });
    }
    return { eye, cwi, shape, bump };
  }

  // draws a round 240x240 display, pixel-sharp like the real LCD
  function screen(cx, cy, d, eye, shape, cwi, t) {
    E.render(eyeCtx, { ...eye, blinkB: eye.blinkB ?? (eye.blinkT || 0) * 0.45 }, shape, E.COLORWAYS[cwi], t * 1000);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(eyeCanvas, cx - d / 2, cy - d / 2, d, d);
    ctx.restore();
  }

  // ─── chrome star ───────────────────────────────────────
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

  function chrome(R, angle) {
    const g = ctx.createLinearGradient(Math.cos(angle) * -R, Math.sin(angle) * -R, Math.cos(angle) * R, Math.sin(angle) * R);
    [[0, '#4d5058'], [0.18, '#d9dbe2'], [0.34, '#80838d'], [0.5, '#f4f5f9'], [0.66, '#6a6d76'], [0.84, '#cfd1d8'], [1, '#55585f']]
      .forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function drawStar(t, pose, me) {
    const R = 400 * pose.s;
    if (R < 2 || Math.abs(pose.scaleX) < 0.02) return;
    const front = pose.scaleX > 0;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.rot);
    ctx.scale(pose.scaleX, 1);

    const body = starPath(R * 0.84, 0.62);
    const angle = 0.6 + t * 0.5;

    // keyring loop off the upper-right point
    const la = -Math.PI / 2 + (2 * Math.PI) / 5;
    const lx = Math.cos(la) * R * 1.02, ly = Math.sin(la) * R * 1.02;
    ctx.save();
    ctx.translate(lx, ly);   // gradient centred on the loop, or it only picks up the dark end
    ctx.lineWidth = R * 0.055;
    ctx.strokeStyle = chrome(R * 0.12, angle + 1);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 90 * pose.s;
    ctx.shadowOffsetY = 45 * pose.s;
    ctx.fillStyle = chrome(R, angle);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = R * 0.28;
    ctx.lineJoin = 'round';
    ctx.fill(body);
    ctx.stroke(body);
    ctx.shadowColor = 'transparent';

    // a band of light that sweeps across the chrome
    ctx.save();
    ctx.clip(body);
    const sweep = (((t * 0.45) % 1.8) - 0.4) * 2.2 * R;
    const band = ctx.createLinearGradient(sweep - R * 0.4, -R, sweep + R * 0.4, R);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(-R * 1.5, -R * 1.5, R * 3, R * 3);
    ctx.restore();

    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke(body);

    const ringR = R * 0.46;
    if (front) {
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.fillStyle = chrome(ringR, angle + 2.2);
      ctx.fill();
      const sd = ringR * 2 * 0.86 * (1 + me.bump * 0.08);
      screen(0, 0, sd, me.eye, me.shape, me.cwi, t);
      // glass glint
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, sd / 2, 0, Math.PI * 2);
      ctx.clip();
      const glint = ctx.createLinearGradient(-sd / 2, -sd / 2, sd / 4, sd / 4);
      glint.addColorStop(0, 'rgba(255,255,255,0.16)');
      glint.addColorStop(0.45, 'rgba(255,255,255,0)');
      ctx.fillStyle = glint;
      ctx.fillRect(-sd / 2, -sd / 2, sd, sd);
      ctx.restore();
    } else {
      // back: engraved medallion
      ctx.strokeStyle = 'rgba(40,42,48,0.55)';
      ctx.lineWidth = R * 0.018;
      for (const r of [ringR, ringR * 0.82]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(40,42,48,0.5)';
      ctx.font = `800 ${R * 0.11}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('sripadbuilds', 0, 0);
    }
    ctx.restore();
  }

  // ─── background ────────────────────────────────────────
  function background(t, accent) {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.62);
    glow.addColorStop(0, hexA(accent, 0.2));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      const speed = 10 + hash(i + 50) * 34;
      const x = hash(i) * W + Math.sin(t * 0.4 + i) * 12;
      const y = (((hash(i + 100) * H - t * speed) % H) + H) % H;
      ctx.globalAlpha = 0.18 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + hash(i + 200) * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── kinetic type ──────────────────────────────────────
  function kinetic(text, x, y, size, t, t0, o = {}) {
    const { color = '#ffffff', stagger = 0.028, dur = 0.5, exit = null, weight = 800, font = FONT, spacing = -0.035, jitter = 0 } = o;
    const out = exit == null ? 0 : easeInCubic(prog(t, exit, 0.3));
    if (out >= 1 || t < t0) return;
    ctx.font = `${weight} ${size}px ${font}`;
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width + size * spacing);
    const total = widths.reduce((a, b) => a + b, 0) - size * spacing;
    let cx = x - total / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    chars.forEach((ch, i) => {
      const p = prog(t, t0 + i * stagger, dur);
      if (p > 0) {
        const e = easeOutBack(p);
        // the whole line shakes together; per-letter jitter made letters collide
        const jx = jitter ? Math.sin(t * 60) * jitter : 0;
        ctx.save();
        ctx.globalAlpha = clamp01(p * 2.5) * (1 - out);
        ctx.translate(cx + widths[i] / 2 + jx, y + (1 - e) * size * 0.6 - out * size * 0.4);
        const sc = 0.6 + 0.4 * clamp01(e);
        ctx.scale(sc, sc);
        ctx.fillStyle = color;
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      cx += widths[i];
    });
  }

  // ─── scenes ────────────────────────────────────────────
  function sceneIntro(t) {
    kinetic('meet', 540, 1420, 120, t, 1.3, { exit: 3.0, color: '#b9bac1' });
    kinetic('starboy', 540, 1660, 240, t, 1.55, { exit: 3.05, stagger: 0.04 });
  }

  function scenePet(t) {
    kinetic('a tiny pet', 540, 1390, 130, t, 3.3, { exit: 5.3 });
    kinetic('that lives on', 540, 1545, 130, t, 3.6, { exit: 5.33 });
    kinetic('your keychain.', 540, 1700, 124, t, 3.9, { exit: 5.36 });
  }

  function sceneReact(t) {
    const b = beatAt(t);
    if (!b) return;
    const lt = t - b.t;
    const end = b.t + 1.2;
    if (b.kind === 'cold') {
      ctx.fillStyle = `rgba(70,120,255,${0.13 * (1 - prog(t, end, 0.15))})`;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        const x = (hash(i + 400) * W + Math.sin(t * 2 + i) * 20) % W;
        const y = ((hash(i + 500) * H + lt * (260 + hash(i) * 380)) % H);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#e6f0ff';
        ctx.beginPath();
        ctx.arc(x, y, 2 + hash(i + 600) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (b.kind === 'loud') {
      ctx.fillStyle = `rgba(255,40,70,${0.22 * (1 - prog(t, b.t, 0.35))})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (b.kind === 'sleep') {
      ctx.fillStyle = `rgba(0,0,0,${0.35 * prog(t, b.t, 0.8)})`;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        const zt = (lt * 0.8 + i * 0.33) % 1;
        if (lt < 0.4 + i * 0.2) continue;
        ctx.globalAlpha = Math.sin(zt * Math.PI) * 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${60 + i * 22}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('z', 780 + i * 60 + zt * 40, 560 - zt * 220 - i * 30);
      }
      ctx.globalAlpha = 1;
    }
    kinetic(b.caption, 540, 1480, 150, t, b.t + 0.05, { exit: end, jitter: b.kind === 'loud' ? 7 : 0 });
    kinetic(b.sub, 540, 1600, 66, t, b.t + 0.3, { exit: end + 0.02, color: '#9a9ba3', weight: 700, stagger: 0.015 });
  }

  function sceneLooks(t) {
    const exit = easeInCubic(prog(t, 14.55, 0.28));
    const settled = t >= SEED_LAND - 10;   // unused guard keeps the lint quiet
    void settled;
    // counter
    if (t >= 11.4) {
      const n = Math.round(easeOutCubic(prog(t, 11.4, 1.2)) * 400);
      const pop = t >= 12.62 ? 1 + 0.18 * (1 - easeOutCubic(prog(t, 12.62, 0.3))) : 1;
      ctx.save();
      ctx.globalAlpha = 1 - exit;
      ctx.translate(540, 430);
      ctx.scale(pop, pop);
      ctx.font = `800 260px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }
    kinetic('eye looks', 540, 560, 90, t, 12.7, { exit: 14.55, color: '#b9bac1' });

    const highlight = prog(t, 13.3, 0.3);
    const rare = { cwi: cw(RAREST.cw), shape: RAREST.shape };
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = 190 + col * 350, cy = 840 + row * 330;
      const appear = easeOutBack(prog(t, 11.35 + i * 0.06, 0.45));
      const s = Math.max(0, appear * (1 - exit));
      if (s <= 0.01) continue;
      const frozen = t >= 13.3;
      const k = Math.floor(Math.min(t, 13.3) * 8);
      let cwi = Math.floor(hash(i * 13 + k) * 100);
      let shape = Math.floor(hash(i * 7 + k + 3) * 4);
      if (i === 4 && frozen) { cwi = rare.cwi; shape = rare.shape; }
      const dim = i !== 4 ? 1 - highlight * 0.65 : 1;
      const grow = i === 4 ? 1 + highlight * 0.14 : 1;
      const d = 270 * s * grow;
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2 + 14 * s, 0, Math.PI * 2);
      ctx.fillStyle = chrome(d / 2 + 14, 0.7 + t * 0.5 + i);
      ctx.fill();
      const eye = { ...BASE_EYE, gx: Math.sin(t * 2 + i) * 12, gy: Math.cos(t * 1.4 + i) * 5, blinkT: blinkAt(t + i * 0.37) };
      screen(cx, cy, d, eye, shape, cwi, t);
      ctx.restore();
      if (i === 4 && highlight > 0) {
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2 + t * 0.8;
          const r = d / 2 + 50 + Math.sin(t * 5 + j) * 10;
          ctx.globalAlpha = highlight * (0.5 + 0.5 * Math.sin(t * 7 + j * 2)) * (1 - exit);
          ctx.fillStyle = '#fff6c9';
          sparkle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 12 + 6 * Math.sin(t * 6 + j));
        }
        ctx.globalAlpha = 1;
      }
    }
    kinetic('some are 0.04% rare', 540, 1790, 84, t, 13.45, { exit: 14.55, stagger: 0.02 });
  }

  function sparkle(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? r : r * 0.28;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function sceneRare(t) {
    kinetic('20 rare effects', 540, 330, 118, t, 14.95, { exit: 17.85 });
    for (let i = 0; i < CUTS.length; i++) {
      const c = CUTS[i];
      const last = i === CUTS.length - 1;
      const next = last ? 17.85 : CUTS[i + 1].t;
      // hard cut to the next label on each hit; only the last one animates out
      if (t < c.t || (last ? t >= next + 0.3 : t >= next)) continue;
      const f = 1 - prog(t, c.t, 0.18);
      if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${0.14 * f})`; ctx.fillRect(0, 0, W, H); }
      kinetic(c.name, 540, 1600, 130, t, c.t + 0.02, { exit: last ? next : null, stagger: 0.02, dur: 0.3 });
    }
  }

  function sceneBuild(t) {
    CHIPS.forEach((c, i) => {
      const inP = easeOutCubic(prog(t, c.t, 0.42));
      const outP = easeInCubic(prog(t, 21.3 + i * 0.03, 0.35));
      if (inP <= 0 || outP >= 1) return;
      const y = 1010 + i * 160;
      const x = lerp(-560, 540, inP) + outP * 1100;
      const w = 880, h = 128;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#16171a';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      const accent = E.COLORWAYS[cw(c.cw)];
      ctx.beginPath();
      ctx.arc(-w / 2 + 64, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = accent.body;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-w / 2 + 70, 2, 10, 0, Math.PI * 2);
      ctx.fillStyle = accent.pl;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 58px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.text, -w / 2 + 120, 3);
      ctx.restore();
    });
  }

  function sceneSeed(t) {
    kinetic('pick his eyes.', 540, 400, 140, t, 21.7, { exit: 24.05 });
    const box = easeOutBack(prog(t, 21.9, 0.4));
    const out = easeInCubic(prog(t, 24.05, 0.3));
    if (box > 0 && out < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - out;
      ctx.translate(540, 640);
      ctx.scale(box, box);
      ctx.fillStyle = '#141517';
      ctx.beginPath();
      ctx.roundRect(-410, -90, 820, 180, 36);
      ctx.fill();
      const shown = Math.max(0, Math.min(SEED_TEXT.length, Math.floor((t - SEED_START) / SEED_STEP) + 1));
      const typed = SEED_TEXT.slice(0, shown);
      ctx.font = `700 74px ${MONO}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const startX = -ctx.measureText(SEED_TEXT).width / 2;
      ctx.fillStyle = '#7ee2a8';
      ctx.fillText(typed.slice(0, 1), startX, 4);
      ctx.fillStyle = '#e6e6e9';
      const promptW = ctx.measureText('> ').width;
      ctx.fillText(typed.slice(2), startX + promptW, 4);
      if (Math.floor(t * 3) % 2 === 0 || shown < SEED_TEXT.length) {
        ctx.fillStyle = '#e6e6e9';
        ctx.fillRect(startX + ctx.measureText(typed).width + 6, -38, 8, 80);
      }
      ctx.restore();
    }
    if (t >= SEED_LAND) {
      kinetic('cat starlight · 0.17%', 540, 1800, 68, t, SEED_LAND + 0.05, { exit: 24.05, color: '#b9bac1', weight: 700, stagger: 0.015 });
    }
  }

  function sceneOutro(t) {
    kinetic('starboy diy', 540, 1450, 176, t, 24.65, { stagger: 0.035 });
    kinetic('follow the build', 540, 1570, 80, t, 25.05, { color: '#c9cad0', weight: 700, stagger: 0.02 });
    kinetic('starboy-diy.nadellasripad11.workers.dev', 540, 1760, 38, t, 25.45, { color: '#8e8f95', weight: 700, stagger: 0.008, spacing: 0 });
  }

  function render(t) {
    const pose = starPose(t);
    const me = mainEye(t);
    let accent = E.COLORWAYS[me.cwi].body;
    if (t >= T.looks && t < T.rare) accent = E.COLORWAYS[cw(RAREST.cw)].body;
    background(t, accent);

    if (t >= T.looks && t < T.rare) sceneLooks(t);
    drawStar(t, pose, me);

    if (t < T.pet) sceneIntro(t);
    else if (t < T.react) scenePet(t);
    else if (t < T.looks) sceneReact(t);
    else if (t >= T.rare && t < T.build) sceneRare(t);
    else if (t >= T.build && t < T.seed) sceneBuild(t);
    else if (t >= T.seed && t < T.outro) sceneSeed(t);
    else if (t >= T.outro) sceneOutro(t);

    // a quick fade in from black at the very start
    const fadeIn = 1 - prog(t, 0, 0.3);
    if (fadeIn > 0) { ctx.fillStyle = `rgba(0,0,0,${fadeIn})`; ctx.fillRect(0, 0, W, H); }
  }

  window.promoReady = (async () => {
    try {
      await Promise.all([document.fonts.load(`800 100px Figtree`), document.fonts.load(`700 100px Figtree`), document.fonts.load(`700 72px "JetBrains Mono"`)]);
    } catch { /* fall back to system fonts */ }
    await document.fonts.ready;
    return true;
  })();

  window.PROMO = {
    W, H, FPS, DURATION, EVENTS,
    frame(i, type = 'image/jpeg', quality = 0.95) {
      render(i / FPS);
      return canvas.toDataURL(type, quality);
    },
    render,
  };

  if (location.search.includes('play')) {
    window.promoReady.then(() => {
      const start = performance.now();
      const loop = (now) => {
        render(((now - start) / 1000) % DURATION);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  } else {
    window.promoReady.then(() => render(1.8));
  }
})();
