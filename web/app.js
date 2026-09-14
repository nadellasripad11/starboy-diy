(function () {
  const E = window.StarboyEyes;
  const { clamp } = E;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const NEUTRAL = { gx: 0, gy: 0, blinkT: 0, blinkB: 0, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0 };
  const LERP_KEYS = Object.keys(NEUTRAL);
  const RARE = [
    { id: 1, name: 'rainbow' }, { id: 2, name: 'hearts' }, { id: 3, name: 'stars' }, { id: 4, name: 'glitch' },
    { id: 6, name: 'hypno' }, { id: 7, name: 'loading' }, { id: 8, name: 'error', mood: { pupR: 1.4, irX: 1.1 } },
    { id: 9, name: 'derp' }, { id: 12, name: 'cry', mood: { blinkT: 0.55, irY: 0.8, bwY: 4 } },
    { id: 13, name: 'laugh', mood: { smile: 1, blinkT: 0.08 } }, { id: 14, name: 'shocked', mood: { pupR: 0.45, irX: 1.1 } },
    { id: 15, name: 'dead' }, { id: 16, name: 'galaxy' }, { id: 17, name: 'heartbeat' },
    { id: 18, name: 'fire', mood: { blinkT: 0.4, pupR: 0.85, irY: 0.88, bwL: 7, bwR: 7, bwY: 2 } }, { id: 20, name: 'rgb split' },
  ];

  const pointer = { x: -1e4, y: -1e4, at: -1e9 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now();
  }, { passive: true });

  const blinkCurve = (b) => (b < 80 ? (b / 80) * 0.95 : b < 200 ? (1 - (b - 80) / 120) * 0.95 : 0);

  // ─── hero: a crowd of little guys packed into one big circle ───
  function pack(seed) {
    let s = seed >>> 0;
    const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const radii = [0.19, 0.165, 0.145, 0.125, 0.112, 0.1, 0.092, 0.084, 0.078, 0.072, 0.066, 0.062, 0.058, 0.055,
                   0.052, 0.048, 0.046, 0.043, 0.04, 0.038, 0.036, 0.034, 0.032, 0.03, 0.028, 0.027, 0.026, 0.025];
    const placed = [];
    for (const r of radii) {
      let best = null;
      for (let i = 0; i < 1600; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (0.5 - r - 0.018);
        const x = 0.5 + Math.cos(a) * d, y = 0.5 + Math.sin(a) * d;
        if (!placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + 0.011)) continue;
        const score = d + rnd() * 0.08;
        if (!best || score < best.score) best = { x, y, r, score };
      }
      if (best) placed.push(best);
    }
    return placed;
  }

  const cluster = document.getElementById('cluster');
  const layout = pack(20260913);
  const sleepyPool = layout.map((p, i) => [p.r, i]).filter(([r]) => r < 0.07 && r > 0.04).map(([, i]) => i);
  const sleepers = new Set(sleepyPool.slice(0, 2));

  const bubbles = layout.map((p, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bubble';
    el.setAttribute('aria-label', 'reroll these eyes');
    el.style.left = `${p.x * 100}%`;
    el.style.top = `${p.y * 100}%`;
    el.style.width = el.style.height = `${p.r * 200}%`;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 240;
    el.appendChild(cv);
    cluster.appendChild(el);
    const b = {
      el, g: cv.getContext('2d'), design: E.roll(),
      gx: 0, gy: 0, tgx: 0, tgy: 0,
      glanceAt: 0, glanceNext: 600 + Math.random() * 2500,
      blinkAt: -1e4, blinkNext: 1500 + Math.random() * 5000,
      asleep: sleepers.has(i), wakeUntil: 0, wokeAt: -1e9,
      fx: null, fxUntil: 0,
    };
    el.addEventListener('click', () => {
      b.design = E.roll();
      b.fx = null;
      if (!reduceMotion) el.animate([{ transform: 'translate(-50%,-50%) scale(.86)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    });
    el.addEventListener('pointerenter', () => {
      if (b.asleep && performance.now() > b.wakeUntil) { b.wokeAt = performance.now(); }
      b.wakeUntil = performance.now() + 3000;
    });
    return b;
  });

  let clusterVisible = true;
  new IntersectionObserver(([en]) => { clusterVisible = en.isIntersecting; }).observe(cluster);

  let nextRareAt = performance.now() + 3000;
  function drawBubble(b, now, dt) {
    const rect = b.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const sleeping = b.asleep && now > b.wakeUntil;
    const pointerLive = finePointer && now - pointer.at < 4000;

    if (sleeping) {
      b.tgx = 0; b.tgy = 4;
    } else if (pointerLive) {
      const dx = pointer.x - cx, dy = pointer.y - cy, d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 240);
      b.tgx = (dx / d) * 21 * m;
      b.tgy = (dy / d) * 13 * m;
    } else if (!reduceMotion && now - b.glanceAt > b.glanceNext) {
      b.glanceAt = now;
      b.glanceNext = 900 + Math.random() * 2600;
      const back = Math.random() < 0.3;
      b.tgx = back ? 0 : Math.random() * 28 - 14;
      b.tgy = back ? 0 : Math.random() * 12 - 6;
    }
    const k = 1 - Math.pow(1 - 0.16, dt * 60 / 1000);
    b.gx += (b.tgx - b.gx) * k;
    b.gy += (b.tgy - b.gy) * k;

    let blink = 0;
    if (!reduceMotion && !sleeping) {
      if (now - b.blinkAt > b.blinkNext) { b.blinkAt = now; b.blinkNext = Math.random() < 0.1 ? 220 : 2200 + Math.random() * 4300; }
      blink = blinkCurve(now - b.blinkAt);
    }

    const eye = { ...NEUTRAL, gx: b.gx, gy: b.gy, blinkT: blink, colOvr: '#000000', fx: 0, fxP: now / 1000 * 1.5 };
    if (sleeping) {
      eye.blinkT = 0.95 + 0.03 * Math.sin(now / 900);
    } else if (now - b.wokeAt < 700) {
      eye.pupR = 1.3; eye.irX = 1.05; eye.irY = 1.08;
    }
    if (b.fx && now < b.fxUntil && !sleeping) {
      Object.assign(eye, b.fx.mood || {});
      eye.fx = b.fx.id;
      if (eye.fx === 13) eye.gy = Math.sin(now * 0.009) * 3;
    }
    eye.blinkB = eye.blinkT * 0.45;
    E.render(b.g, eye, b.design.shape, E.COLORWAYS[b.design.colorway], now);
  }

  // ─── "what he does": one star you can poke ───
  function makeStar(canvas, readout) {
    const g = canvas.getContext('2d');
    const star = {
      design: { colorway: E.COLORWAYS.findIndex((c) => c.name === 'starboy'), shape: 2 },
      cur: { ...NEUTRAL }, mode: 'idle', modeT0: 0, rareFx: null,
      glance: { at: 0, next: 1200, gx: 0, gy: 0 }, blink: { at: -1e4, next: 2500 },
      idleMood: { until: 0, mood: null }, dart: { at: 0, gx: 0, gy: 0 }, label: '',
    };
    star.setMode = (mode, rareFx) => { star.mode = mode; star.modeT0 = performance.now(); star.rareFx = rareFx || null; };

    function target(now) {
      const t = now - star.modeT0;
      const tg = { ...NEUTRAL };
      let colOvr = '#000000', fx = 0, gazeSpd = 0.10, label = '';
      const toIdle = () => { star.setMode('idle'); onIdle(); idle(); };
      const idle = () => {
        if (!reduceMotion && now - star.glance.at > star.glance.next) {
          star.glance.at = now;
          star.glance.next = 900 + Math.random() * 2300;
          const back = Math.random() < 0.33;
          star.glance.gx = back ? 0 : clamp(Math.round(Math.random() * 28 - 14), -22, 22);
          star.glance.gy = back ? 0 : clamp(Math.round(Math.random() * 12 - 6), -12, 12);
        }
        if (now > star.idleMood.until) {
          const r = Math.random();
          star.idleMood.mood = r < 0.2 ? { smile: 0.7, pupR: 1.1, irY: 0.9, blinkT: 0.08 } : r < 0.32 ? { pupR: 1.15 } : null;
          star.idleMood.until = now + 2500 + Math.random() * 4500;
        }
        Object.assign(tg, star.idleMood.mood || {});
        tg.gx = star.glance.gx; tg.gy = star.glance.gy;
        if (now - star.glance.at < 140) gazeSpd = 0.4;
        label = 'idle · looking around';
      };

      switch (star.mode) {
        case 'shake':
          if (t < 3200) {
            const a = t * 0.006, rad = t < 1500 ? 18 : 26;
            tg.gx = Math.cos(a) * rad; tg.gy = Math.sin(a) * rad;
            tg.blinkT = 0.2 + 0.2 * Math.sin(t * 0.005); tg.pupR = 0.8;
            gazeSpd = 0.22; label = 'shaking · dizzy';
          } else if (t < 6000) {
            Object.assign(tg, { pupR: 0.75, irY: 0.8, bwL: 14, bwR: 14, bwY: 4, colMix: 0.5, gx: Math.sin(t * 0.02) * 1.5 });
            colOvr = '#ff0000'; label = 'recovered · mad at you';
          } else toIdle();
          break;
        case 'cold':
          if (t < 6000) {
            const ph = t * 0.0054;
            Object.assign(tg, { blinkT: 0.25 + 0.1 * Math.sin(ph * 0.4), pupR: 0.6, irY: 1.2, bwL: 12, bwR: 12, bwY: 5, colMix: 0.5 });
            tg.gx = Math.sin(ph) * 7 + Math.sin(ph * 2.7) * 4;
            colOvr = '#0000ff'; fx = 10; gazeSpd = 0.3; label = 'below 10°c · shivering';
          } else toIdle();
          break;
        case 'loud':
          if (t < 700) {
            Object.assign(tg, { pupR: 1.25, irX: 1.05, irY: 1.05, bwY: -3 });
            tg.gx = Math.sin(t * 0.1) * 8; gazeSpd = 0.3; label = 'loud noise · startled';
          } else if (t < 4000) {
            if (now - star.dart.at > 300) star.dart = { at: now, gx: Math.random() * 36 - 18, gy: Math.random() * 24 - 12 };
            Object.assign(tg, { pupR: 0.9, irY: 0.8, bwL: 4, bwR: 4, blinkT: 0.3 + 0.2 * Math.sin(t * 0.008) });
            tg.gx = star.dart.gx; tg.gy = star.dart.gy; gazeSpd = 0.22; label = 'still loud · anxious';
          } else toIdle();
          break;
        case 'tilt':
          if (t < 4500) {
            tg.gx = 22 * Math.sin(t / 700); tg.gy = 14 * Math.cos(t / 900); gazeSpd = 0.12;
            label = 'tilted · looking downhill';
          } else toIdle();
          break;
        case 'sleep':
          if (t < 2500) {
            const dl = t / 2500;
            Object.assign(tg, { blinkT: 0.45 + dl * 0.35, pupR: 0.85, bwY: 5 * dl, gy: 6 * dl });
            label = 'left alone · dozing off';
          } else if (t < 8500) {
            const dp = (t - 2500) * 0.0036;
            Object.assign(tg, { blinkT: 0.8 + 0.15 * Math.sin(dp), pupR: 0.7, gx: Math.sin(dp * 1.7) * 14, gy: Math.cos(dp * 2.3) * 8 });
            fx = 11; label = 'asleep · dreaming';
          } else if (t < 9800) {
            Object.assign(tg, { blinkT: 0.05, gy: -1, irX: 1.05, irY: 1.05, bwY: -2 });
            label = 'woke up';
          } else toIdle();
          break;
        case 'rare':
          if (t < 5500 && star.rareFx) {
            Object.assign(tg, star.rareFx.mood || {});
            fx = star.rareFx.id;
            if (fx === 13) tg.gy = Math.sin(t * 0.009) * 3;
            label = 'rare effect · ' + star.rareFx.name;
          } else toIdle();
          break;
        default:
          idle();
      }
      return { tg, colOvr, fx, gazeSpd, label };
    }

    star.frame = (now, dt) => {
      const { tg, colOvr, fx, gazeSpd, label } = target(now);
      const k = (s) => 1 - Math.pow(1 - s, dt * 30 / 1000);
      for (const key of LERP_KEYS) {
        const spd = key === 'gx' || key === 'gy' ? gazeSpd : key === 'blinkT' || key === 'blinkB' ? 0.18 : 0.08;
        star.cur[key] += ((tg[key] ?? 0) - star.cur[key]) * k(spd);
      }
      let blink = 0;
      if (!reduceMotion && star.mode !== 'sleep') {
        if (now - star.blink.at > star.blink.next) { star.blink.at = now; star.blink.next = Math.random() < 0.1 ? 200 : 2200 + Math.random() * 4300; }
        blink = blinkCurve(now - star.blink.at);
      }
      const eye = { ...star.cur, blinkT: Math.max(star.cur.blinkT, blink), colOvr, fx, fxP: now / 1000 * (fx === 11 ? 3.6 : 1.5) };
      eye.blinkB = eye.blinkT * 0.45;
      E.render(g, eye, star.design.shape, E.COLORWAYS[star.design.colorway], now);
      if (label !== star.label) { star.label = label; readout.textContent = label; }
    };
    return star;
  }

  const tryCanvas = document.getElementById('try-eye');
  const tryStar = makeStar(tryCanvas, document.getElementById('try-readout'));
  const clearPressed = () => document.querySelectorAll('.reaction, .chip').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  function onIdle() { clearPressed(); }

  const REACTIONS = [
    { mode: 'shake', sensor: 'motion', if: 'shake him hard', then: 'spins dizzy, then gets mad at you' },
    { mode: 'cold', sensor: 'temp', if: 'take him below 10°c', then: 'turns icy blue and shivers' },
    { mode: 'loud', sensor: 'mic', if: 'make a loud noise', then: 'jumps, then darts around nervously' },
    { mode: 'tilt', sensor: 'motion', if: 'tilt him', then: 'looks toward the ground' },
    { mode: 'sleep', sensor: 'timer', if: 'leave him alone', then: 'dozes off, dreams, then wakes up' },
  ];
  const list = document.getElementById('reactions');
  for (const r of REACTIONS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'reaction'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="if">${r.if}</span><span class="then">${r.then}</span><span class="sensor">${r.sensor}</span>`;
    b.addEventListener('click', () => { clearPressed(); b.setAttribute('aria-pressed', 'true'); tryStar.setMode(r.mode); });
    list.appendChild(b);
  }
  const chips = document.getElementById('rare-chips');
  for (const fx of RARE) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = fx.name; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { clearPressed(); b.setAttribute('aria-pressed', 'true'); tryStar.setMode('rare', fx); });
    chips.appendChild(b);
  }
  let tryVisible = false;
  new IntersectionObserver(([en]) => { tryVisible = en.isIntersecting; }).observe(tryCanvas);

  // ─── soft grey cursor ball ───
  const ball = document.getElementById('cursor-ball');
  const ballOn = finePointer && !reduceMotion;
  if (!ballOn) ball.hidden = true;
  let bx = -200, by = -200;

  // ─── one loop for everything ───
  const heroNow = performance.now();
  bubbles.forEach((b) => drawBubble(b, heroNow, 16));
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(100, now - last);
    last = now;
    if (clusterVisible) {
      if (!reduceMotion && now > nextRareAt) {
        const awake = bubbles.filter((b) => !b.asleep);
        const pick = awake[Math.floor(Math.random() * awake.length)];
        pick.fx = RARE[Math.floor(Math.random() * RARE.length)];
        pick.fxUntil = now + 4000;
        nextRareAt = now + 4500 + Math.random() * 4500;
      }
      for (const b of bubbles) drawBubble(b, now, dt);
    }
    if (tryVisible) tryStar.frame(now, dt);
    if (ballOn) {
      const k = 1 - Math.pow(1 - 0.25, dt * 60 / 1000);
      bx += (pointer.x - bx) * k; by += (pointer.y - by) * k;
      ball.style.transform = `translate(${bx}px, ${by}px)`;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
