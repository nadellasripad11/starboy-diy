// First-visit intro: starboy hops onto a dark stage, a spotlight clunks on and
// finds him, and "leap into the experience" sends him flying into the camera.
// His screen fills the view, then opens like an iris onto the page.
// gate.js decides when it plays (every visit, from any page). ?intro=3.5 freezes it at
// 3.5s and ?intro=5,0.6 freezes 0.6s into the leap (for checking frames).
(function () {
  const root = document.documentElement;
  const el = document.getElementById('intro');
  if (!el) return;
  if (!root.classList.contains('intro-on') || !window.StarboyEyes || !window.StarboyStar) {
    root.classList.remove('intro-on');
    el.remove();
    return;
  }

  const Star = window.StarboyStar;
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const leapBtn = document.getElementById('intro-leap');
  const skipBtn = document.getElementById('intro-skip');
  const neverBtn = document.getElementById('intro-never');
  const optsEl = el.querySelector('.intro-opts');
  // where they were headed, if they landed on another page first (pages of this site only)
  const nextRaw = new URLSearchParams(location.search).get('next');
  const next = nextRaw && /^[\w-]+\.html([?#]\S*)?$/.test(nextRaw) ? nextRaw : null;
  const CW = Star.HERO.cw, SHAPE = Star.HERO.shape;
  const BASE = { gx: 0, gy: 0, blinkT: 0, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0, colOvr: '#000000', fx: 0, fxP: 0 };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, start, dur) => clamp01((t - start) / dur);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // seconds from the first frame
  const HOP0 = 0.35, HOP = 0.72, HOPS = 3, LAND = HOP0 + HOP * HOPS;
  const LIGHT = 3.2, ASK = 4.4;
  // seconds from the click
  const CROUCH = 0.2, FLY = 0.75, SHUT = 0.15, IRIS = 0.8;
  const FLY_END = CROUCH + FLY, IRIS0 = FLY_END + SHUT, DONE = IRIS0 + IRIS;
  const WARM = '255,244,222';

  const freeze = /[?&]intro=([\d.]+)(?:,([\d.]+))?/.exec(location.search);
  const freezeT = freeze ? parseFloat(freeze[1]) : null;
  const freezeU = freeze && freeze[2] != null ? parseFloat(freeze[2]) : null;

  let W = 0, H = 0, dpr = 1;
  function fit() {
    const w = innerWidth, h = innerHeight, d = Math.min(2, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const size = () => Math.min(W * 0.22, H * 0.18);

  // ─── what he's doing ───────────────────────────────────
  function lightAt(t) {
    const f = t - LIGHT;   // a stage light that sputters before it catches
    if (f < 0) return 0;
    if (f < 0.06) return 1;
    if (f < 0.13) return 0.12;
    if (f < 0.19) return 0.85;
    if (f < 0.27) return 0.25;
    return 1;
  }

  function blinkAt(t) {
    const ph = (t + 0.4) % 2.9;
    if (ph < 0.08) return (ph / 0.08) * 0.95;
    if (ph < 0.2) return (1 - (ph - 0.08) / 0.12) * 0.95;
    return 0;
  }

  function eyeAt(t) {
    const e = { ...BASE, blinkT: blinkAt(t), fxP: t * 1.5 };
    if (t < LAND) Object.assign(e, { gx: 16, gy: 2 });   // watching where he's going
    else if (t < LIGHT) {                                  // in the dark: hello? anyone?
      const k = t - LAND;
      Object.assign(e, { gx: k < 0.25 ? 0 : k < 0.55 ? -18 : 18, pupR: 0.75, blinkT: 0 });
    } else if (t < LIGHT + 0.8) {
      Object.assign(e, { gy: -12, pupR: 1.2, irY: 1.12, blinkT: 0 });   // whoa, a light
    } else {
      Object.assign(e, { smile: easeOutCubic(prog(t, LIGHT + 0.8, 0.3)) * 0.35, gx: Math.sin(t * 1.3) * 5 });
      if (t > ASK) {
        const ph = (t - ASK) % 3.2;   // keeps peeking down at the button
        if (ph > 0.3 && ph < 1.0) Object.assign(e, { gx: 0, gy: 12 });
      }
    }
    return e;
  }

  function poseAt(t, R, cx, ry) {
    const pose = { x: cx, y: ry, sx: 1, sy: 1, rot: 0 };
    if (t < HOP0) { pose.x = -R * 2; return pose; }
    if (t < LAND) {
      // three hops in from the left, each a little lower than the last
      const i = Math.min(HOPS - 1, Math.floor((t - HOP0) / HOP));
      const p = (t - HOP0 - i * HOP) / HOP;
      const x0 = lerp(-R * 1.6, cx, i / HOPS), x1 = lerp(-R * 1.6, cx, (i + 1) / HOPS);
      const q = prog(p, 0.15, 0.85);
      const air = Math.sin(Math.PI * q);
      pose.x = lerp(x0, x1, easeInOutCubic(q));
      pose.y = ry - R * (0.95 - i * 0.2) * air;
      pose.sx = 1 - 0.07 * air;
      pose.sy = 1 + 0.1 * air;
      pose.rot = 0.16 * air;
      if (p < 0.15) {   // push off the ground
        const k = Math.sin(Math.PI * (p / 0.15));
        pose.sx += 0.14 * k;
        pose.sy -= 0.18 * k;
        pose.rot -= 0.05 * k;
      }
      return pose;
    }
    const land = Math.sin(Math.PI * prog(t, LAND, 0.22));
    pose.sx += 0.14 * land;
    pose.sy -= 0.18 * land;
    pose.y -= R * 0.18 * Math.sin(Math.PI * prog(t, LIGHT + 0.3, 0.35));   // a startled little jump
    if (t > LIGHT + 1) pose.y += Math.sin(t * 2.4) * R * 0.025;
    return pose;
  }

  // ─── drawing ───────────────────────────────────────────
  // brushed gunmetal around the current origin, for the rim of the opening iris
  function chrome(R, angle) {
    const g = ctx.createLinearGradient(Math.cos(angle) * -R, Math.sin(angle) * -R, Math.cos(angle) * R, Math.sin(angle) * R);
    [[0, '#4d5058'], [0.18, '#e2e4ea'], [0.34, '#80838d'], [0.5, '#f7f8fb'], [0.66, '#5f626b'], [0.84, '#d2d4db'], [1, '#4f525a']]
      .forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function drawStage(L, cx, floorY, R, t) {
    if (L > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const amb = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, R * 4);
      amb.addColorStop(0, `rgba(${WARM},${0.06 * L})`);
      amb.addColorStop(1, `rgba(${WARM},0)`);
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, W, H);
      // the beam: three soft layers, rounded off where it meets the floor
      for (const [spread, a] of [[1.0, 0.05], [0.8, 0.06], [0.6, 0.07]]) {
        const top = R * 0.28 * spread, bot = R * 1.55 * spread;
        const g = ctx.createLinearGradient(0, 0, 0, floorY);
        g.addColorStop(0, `rgba(${WARM},${a * 1.8 * L})`);
        g.addColorStop(1, `rgba(${WARM},${a * L})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - top, 0);
        ctx.lineTo(cx + top, 0);
        ctx.lineTo(cx + bot, floorY);
        ctx.ellipse(cx, floorY, bot, bot * 0.2, 0, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
      }
      // dust drifting in the light
      for (let i = 0; i < 26; i++) {
        const v = (hash(i + 50) + t * 0.03 * (0.5 + hash(i + 9))) % 1;
        const y = v * floorY;
        const half = lerp(R * 0.28, R * 1.55, v);
        const x = cx + (hash(i) * 2 - 1) * half * 0.85 + Math.sin(t * 0.7 + i) * 6;
        ctx.globalAlpha = 0.4 * L * (0.5 + 0.5 * Math.sin(t * 1.5 + i));
        ctx.fillStyle = `rgb(${WARM})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + hash(i + 3) * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // the pool of light on the floor
      ctx.translate(cx, floorY);
      ctx.scale(1, 0.2);
      const r = R * 1.75;
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      pool.addColorStop(0, `rgba(${WARM},${0.42 * L})`);
      pool.addColorStop(0.6, `rgba(${WARM},${0.16 * L})`);
      pool.addColorStop(1, `rgba(${WARM},0)`);
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShadow(x, floorY, R, lift, L) {
    const k = clamp01(lift);
    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(1, 0.18);
    const r = R * 0.95 * (1 - k * 0.4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(0,0,0,${(0.25 + 0.45 * L) * (1 - k * 0.5)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── the loop ──────────────────────────────────────────
  let t0 = null, leapAt = null, asked = false, raf = 0, ended = false;

  function draw(t, u) {
    fit();
    if (!W || !H) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const R = size(), cx = W / 2, ry = H * 0.5, floorY = ry + R * 0.82;
    const lit = lightAt(t);   // how lit he is; the stage light itself fades once he leaps
    let L = lit;
    const pose = poseAt(t, R, cx, ry);
    const eye = eyeAt(t);
    let scale = 1;

    if (u >= 0) {
      if (u < CROUCH) {   // wind up
        const k = Math.sin((Math.PI / 2) * (u / CROUCH));
        pose.sx = 1 + 0.14 * k;
        pose.sy = 1 - 0.2 * k;
        pose.y += R * 0.08 * k;
        Object.assign(eye, { blinkT: 0.35, pupR: 0.9, gx: 0, gy: 0, smile: 0 });
      } else {            // and launch, straight at the camera
        const k = prog(u, CROUCH, FLY);
        const endScale = (Math.hypot(W, H) * 1.2) / (R * 0.46 * 2 * 0.86);
        scale = Math.exp(Math.log(endScale) * easeInCubic(k));
        const m = easeInOutCubic(k);
        pose.x = lerp(pose.x, cx, m);
        pose.y = lerp(pose.y, H / 2, m) - Math.sin(Math.PI * k) * R * 0.5;
        pose.rot = lerp(pose.rot, 0, k) + Math.sin(Math.PI * k) * 0.12;
        const st = 1 - easeOutCubic(prog(u, CROUCH, 0.25));
        pose.sx = 1 - 0.1 * st;
        pose.sy = 1 + 0.16 * st;
        Object.assign(eye, { smile: 1, pupR: 1.1, gx: 0, gy: 0, blinkT: u > FLY_END ? easeInCubic(prog(u, FLY_END, SHUT)) * 0.98 : 0 });
        L *= 1 - easeOutCubic(prog(u, CROUCH, 0.35));
      }
    }

    ctx.fillStyle = '#07070a';
    ctx.fillRect(0, 0, W, H);

    if (u < IRIS0) {
      const lift = (ry - pose.y) / R;
      if (scale < 1.5) {
        drawStage(L, cx, floorY, R, t);
        if (pose.x > -R * 1.5) drawShadow(pose.x, floorY, R, lift, L);
      }
      Star.draw(ctx, { x: pose.x, y: pose.y, R: R * scale, cacheR: R, rot: pose.rot, sx: pose.sx, sy: pose.sy,
        dim: 1 - lit, t, eye, shape: SHAPE, cw: CW, dpr });
    } else {
      // his closed screen fills the view; open it like an iris onto the page
      el.style.background = 'transparent';
      const k = easeInOutCubic(prog(u, IRIS0, IRIS));
      const r = k * (Math.hypot(W, H) / 2 + 60);
      const rim = Math.max(8, Math.min(W, H) * 0.035);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.beginPath();
      ctx.arc(0, 0, r + rim, 0, Math.PI * 2);
      ctx.fillStyle = chrome(r + rim, 0.6 + t * 0.5);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function tick(now) {
    if (ended) return;
    if (t0 == null) t0 = now;
    const t = freezeT != null ? freezeT : (now - t0) / 1000;
    const u = freezeU != null ? freezeU : leapAt == null ? -1 : (now - leapAt) / 1000;
    if (!asked && t >= ASK && leapAt == null && freezeU == null) {
      asked = true;
      leapBtn.classList.add('show');
      leapBtn.focus({ preventScroll: true });
    }
    draw(t, u);
    // headed to another page: go while his screen is shut, it opens there instead
    if (next && u >= IRIS0 && freezeU == null) return go();
    if (u >= DONE && freezeU == null) return finish();
    raf = requestAnimationFrame(tick);
  }

  function go() {
    ended = true;
    cancelAnimationFrame(raf);
    if (window.StarboyGate) StarboyGate.markNav();
    location.replace(next);
  }

  function finish() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    root.classList.remove('intro-on');
    el.remove();
    if (freeze == null && /[?&](intro|next)\b/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }

  function leap() {
    if (leapAt != null) return;
    leapAt = performance.now();
    leapBtn.classList.add('gone');
    optsEl.hidden = true;
  }

  function skip() {
    if (next) return go();
    leapBtn.classList.add('gone');
    el.classList.add('fade');
    setTimeout(finish, 350);
  }

  function never() {
    if (window.StarboyGate) StarboyGate.turnOff();
    skip();
  }

  function onKey(e) {
    if (e.key === 'Escape') skip();
  }

  leapBtn.addEventListener('click', leap);
  skipBtn.addEventListener('click', skip);
  neverBtn.addEventListener('click', never);
  addEventListener('keydown', onKey);
  raf = requestAnimationFrame(tick);
})();
