(function () {
  const E = window.StarboyEyes;
  const { clamp } = E;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function makeStar(canvas, readout) {
    const g = canvas.getContext('2d');
    const star = {
      design: E.roll(),
      cur: { ...NEUTRAL }, colOvr: '#000000', fx: 0, fxP: 0,
      mode: 'idle', modeT0: 0, rareFx: null, readout,
      glance: { at: 0, next: 1200, gx: 0, gy: 0 },
      blink: { at: 0, next: 2500 },
      idleMood: { until: 0, mood: null },
      pointer: null, pointerAt: -1e9, dart: { at: 0, gx: 0, gy: 0 },
      onIdle: null,
    };

    star.setMode = (mode, rareFx) => {
      star.mode = mode; star.modeT0 = performance.now(); star.rareFx = rareFx || null;
    };

    function target(now) {
      const t = now - star.modeT0;
      const tg = { ...NEUTRAL };
      let colOvr = '#000000', fx = 0, gazeSpd = 0.10, label = '';

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
          star.idleMood.mood = r < 0.2 ? { smile: 0.7, pupR: 1.1, irY: 0.9, blinkT: 0.08 } : r < 0.32 ? { pupR: 1.15, gy: -3 } : null;
          star.idleMood.until = now + 2500 + Math.random() * 4500;
        }
        Object.assign(tg, star.idleMood.mood || {});
        const pointerLive = star.pointer && now - star.pointerAt < 2500;
        tg.gx = pointerLive ? star.pointer.gx : star.glance.gx + (tg.gx || 0);
        tg.gy = pointerLive ? star.pointer.gy : star.glance.gy + (tg.gy || 0);
        if (now - star.glance.at < 140 && !pointerLive) gazeSpd = 0.4;
        label = pointerLive ? 'idle · watching you' : 'idle · looking around';
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
            colOvr = '#ff0000'; label = 'recovered · grumpy about it';
          } else { star.setMode('idle'); idle(); }
          break;
        case 'cold':
          if (t < 6000) {
            const ph = t * 0.0054;
            Object.assign(tg, { blinkT: 0.25 + 0.1 * Math.sin(ph * 0.4), pupR: 0.6, irY: 1.2, bwL: 12, bwR: 12, bwY: 5, colMix: 0.5 });
            tg.gx = Math.sin(ph) * 7 + Math.sin(ph * 2.7) * 4;
            colOvr = '#0000ff'; fx = 10; gazeSpd = 0.3; label = 'below 10°c · shivering';
          } else { star.setMode('idle'); idle(); }
          break;
        case 'loud':
          if (t < 700) {
            Object.assign(tg, { pupR: 1.25, irX: 1.05, irY: 1.05, bwL: 5, bwR: 5, bwY: -3 });
            tg.gx = Math.sin(t * 0.1) * 8; gazeSpd = 0.3; label = 'loud noise · startled';
          } else if (t < 4000) {
            if (now - star.dart.at > 300) { star.dart = { at: now, gx: Math.random() * 36 - 18, gy: Math.random() * 24 - 12 }; }
            Object.assign(tg, { pupR: 0.9, irX: 1.1, irY: 0.8, bwL: 4, bwR: 4, blinkT: 0.3 + 0.2 * Math.sin(t * 0.008) });
            tg.gx = star.dart.gx; tg.gy = star.dart.gy; gazeSpd = 0.22; label = 'still loud · anxious';
          } else { star.setMode('idle'); idle(); }
          break;
        case 'tilt':
          if (t < 4500) {
            tg.gx = 22 * Math.sin(t / 700); tg.gy = 14 * Math.cos(t / 900); gazeSpd = 0.12;
            label = 'tilted · looking downhill';
          } else { star.setMode('idle'); idle(); }
          break;
        case 'sleep':
          if (t < 2500) {
            const dl = t / 2500;
            Object.assign(tg, { blinkT: 0.45 + dl * 0.35, pupR: 0.85, bwY: 5 * dl, gy: 6 * dl });
            label = '25s alone · dozing off';
          } else if (t < 8500) {
            const dp = (t - 2500) * 0.0036;
            Object.assign(tg, { blinkT: 0.8 + 0.15 * Math.sin(dp), pupR: 0.7, gx: Math.sin(dp * 1.7) * 14, gy: Math.cos(dp * 2.3) * 8 });
            fx = 11; label = 'asleep · dreaming';
          } else if (t < 9800) {
            Object.assign(tg, { blinkT: 0.05, gy: -1, irX: 1.05, irY: 1.05, bwY: -2 });
            label = 'woke up';
          } else { star.setMode('idle'); idle(); }
          break;
        case 'rare':
          if (t < 5500 && star.rareFx) {
            Object.assign(tg, star.rareFx.mood || {});
            fx = star.rareFx.id;
            if (fx === 13) tg.gy = Math.sin(t * 0.009) * 3;
            label = 'rare effect · ' + star.rareFx.name;
          } else { star.setMode('idle'); idle(); }
          break;
        default:
          idle();
      }
      if (star.mode === 'idle' && star.onIdle && star.lastMode !== 'idle') star.onIdle();
      star.lastMode = star.mode;
      return { tg, colOvr, fx, gazeSpd, label };
    }

    function frame(now, dt) {
      const { tg, colOvr, fx, gazeSpd, label } = target(now);
      const k = (s) => 1 - Math.pow(1 - s, dt * 30 / 1000);
      for (const key of LERP_KEYS) {
        const spd = key === 'gx' || key === 'gy' ? gazeSpd : key === 'blinkT' || key === 'blinkB' ? 0.18 : 0.08;
        star.cur[key] += ((tg[key] ?? 0) - star.cur[key]) * k(spd);
      }
      star.colOvr = colOvr; star.fx = fx;
      star.fxP = now / 1000 * (fx === 11 ? 3.6 : 1.5);

      let blink = 0;
      if (!reduceMotion && star.mode !== 'sleep') {
        const age = now - star.blink.at;
        if (age > star.blink.next) { star.blink.at = now; star.blink.next = Math.random() < 0.1 ? 200 : 2200 + Math.random() * 4300; }
        const b = now - star.blink.at;
        blink = b < 80 ? (b / 80) * 0.95 : b < 200 ? (1 - (b - 80) / 120) * 0.95 : 0;
      }
      const eye = { ...star.cur, blinkT: Math.max(star.cur.blinkT, blink), colOvr: star.colOvr, fx: star.fx, fxP: star.fxP };
      eye.blinkB = eye.blinkT * 0.45;
      E.render(g, eye, star.design.shape, E.COLORWAYS[star.design.colorway], now);
      if (star.readout && star.readoutText !== label && star.showLabel) { star.readout.textContent = label; star.readoutText = label; }
    }
    star.frame = frame;
    return star;
  }

  function describe(design) {
    const cw = E.COLORWAYS[design.colorway];
    return `this star rolled <b>${E.SHAPES[design.shape]} ${cw.name}</b><br>${E.rarity(design.colorway).toFixed(1)}% colorway · ${E.SHAPE_WEIGHT[design.shape]}% shape · move your cursor`;
  }

  const hero = makeStar(document.getElementById('hero-eye'), document.getElementById('hero-readout'));
  const heroReadout = document.getElementById('hero-readout');
  heroReadout.innerHTML = describe(hero.design);
  document.getElementById('hero-roll').addEventListener('click', () => {
    hero.design = E.roll();
    heroReadout.innerHTML = describe(hero.design);
  });

  const tryStar = makeStar(document.getElementById('try-eye'), document.getElementById('try-readout'));
  tryStar.showLabel = true;
  tryStar.design = { colorway: E.COLORWAYS.findIndex((c) => c.name === 'starboy'), shape: 2 };

  function trackPointer(star, canvas) {
    window.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      star.pointer = { gx: clamp(dx / (r.width / 2) * 16, -22, 22), gy: clamp(dy / (r.height / 2) * 11, -14, 14) };
      star.pointerAt = performance.now();
    }, { passive: true });
  }
  trackPointer(hero, document.getElementById('hero-eye'));

  const REACTIONS = [
    { mode: 'shake', sensor: 'motion', if: 'shake it hard', then: 'spins dizzy, then gets grumpy about it' },
    { mode: 'cold', sensor: 'temp', if: 'take it below 10°c', then: 'turns icy blue and shivers' },
    { mode: 'loud', sensor: 'mic', if: 'make a loud noise', then: 'jumps, then darts around nervously' },
    { mode: 'tilt', sensor: 'motion', if: 'tilt it', then: 'looks toward the ground' },
    { mode: 'sleep', sensor: 'timer', if: 'leave it alone', then: 'dozes off, dreams, then wakes up' },
  ];
  const list = document.getElementById('reactions');
  const chipsEl = document.getElementById('rare-chips');
  const clearPressed = () => document.querySelectorAll('.reaction, .chip').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  tryStar.onIdle = clearPressed;

  for (const r of REACTIONS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'reaction'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="if">${r.if}</span><span class="then">${r.then}</span><span class="sensor">${r.sensor}</span>`;
    b.addEventListener('click', () => { clearPressed(); b.setAttribute('aria-pressed', 'true'); tryStar.setMode(r.mode); });
    list.appendChild(b);
  }
  for (const fx of RARE) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = fx.name; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { clearPressed(); b.setAttribute('aria-pressed', 'true'); tryStar.setMode('rare', fx); });
    chipsEl.appendChild(b);
  }

  // gallery of every colorway
  const gallery = document.getElementById('gallery');
  const filters = document.getElementById('shape-filters');
  let shapeFilter = -1;
  const cells = E.COLORWAYS.map((cw, i) => {
    const fig = document.createElement('figure');
    fig.className = 'swatch';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 240;
    cv.setAttribute('aria-hidden', 'true');
    const cap = document.createElement('figcaption');
    fig.append(cv, cap);
    gallery.appendChild(fig);
    const cell = { i, cv, g: cv.getContext('2d'), cap, shape: [0, 1, 1, 1, 1, 2, 2, 2, 3, 3][(i * 7) % 10], visible: false,
                   phase: Math.random() * 10000, blinkEvery: 2600 + Math.random() * 4000, glance: { at: 0, gx: 0, gy: 0 } };
    return cell;
  });
  const setCaptions = () => cells.forEach((c) => {
    const shape = shapeFilter < 0 ? c.shape : shapeFilter;
    c.cap.innerHTML = `<b>${E.COLORWAYS[c.i].name}</b>${E.SHAPES[shape]} · ${E.rarity(c.i).toFixed(1)}%`;
  });
  setCaptions();
  [['all shapes', -1], ...E.SHAPES.map((s, i) => [s, i])].forEach(([label, val]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = label;
    b.setAttribute('aria-pressed', String(val === shapeFilter));
    b.addEventListener('click', () => {
      shapeFilter = val; setCaptions();
      filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    });
    filters.appendChild(b);
  });
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const c = cells.find((x) => x.cv === en.target); if (c) c.visible = en.isIntersecting;
  }), { rootMargin: '100px' });
  cells.forEach((c) => io.observe(c.cv));

  function drawCell(c, now) {
    const lt = now + c.phase;
    if (!reduceMotion && lt - c.glance.at > 1800) {
      c.glance.at = lt;
      c.glance.gx = Math.random() < 0.35 ? 0 : Math.round(Math.random() * 26 - 13);
      c.glance.gy = Math.random() < 0.35 ? 0 : Math.round(Math.random() * 10 - 5);
    }
    const b = lt % c.blinkEvery;
    const blink = reduceMotion ? 0 : b < 80 ? (b / 80) * 0.95 : b < 200 ? (1 - (b - 80) / 120) * 0.95 : 0;
    const eye = { ...NEUTRAL, gx: c.glance.gx, gy: c.glance.gy, blinkT: blink, blinkB: blink * 0.45, colOvr: '#000000', fx: 0, fxP: 0 };
    E.render(c.g, eye, shapeFilter < 0 ? c.shape : shapeFilter, E.COLORWAYS[c.i], now);
  }
  const staticNow = performance.now();
  cells.forEach((c) => drawCell(c, staticNow));

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(100, now - last); last = now;
    hero.frame(now, dt);
    tryStar.frame(now, dt);
    for (const c of cells) if (c.visible) drawCell(c, now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
