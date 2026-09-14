(function () {
  const E = window.StarboyEyes;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const pointer = { x: -1e4, y: -1e4, at: -1e9 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); }, { passive: true });

  const tierOf = (pct) => (pct >= 0.4 ? 'common' : pct >= 0.2 ? 'uncommon' : pct >= 0.08 ? 'rare' : 'legendary');
  const grid = document.getElementById('grid');
  const looks = [];
  E.COLORWAYS.forEach((cw, i) => E.SHAPES.forEach((shape, j) => {
    const pct = E.rarity(i) * E.SHAPE_WEIGHT[j] / 100;
    const fig = document.createElement('figure');
    fig.className = 'look';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 240;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `${shape} ${cw.name} eyes`);
    const cap = document.createElement('figcaption');
    const tier = tierOf(pct);
    cap.innerHTML = `<b>${cw.name}</b>${shape} · ${pct.toFixed(2)}%<br><span class="tier ${tier}">${tier}</span>`;
    fig.append(cv, cap);
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', `choose ${shape} ${cw.name} for your star`);
    fig.addEventListener('click', () => choose(i, j));
    fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i, j); } });
    looks.push({ fig, cv, g: cv.getContext('2d'), i, j, pct, visible: false, order: looks.length,
                 gx: 0, gy: 0, phase: Math.random() * 10000, blinkEvery: 2600 + Math.random() * 4200, glance: { at: 0, gx: 0, gy: 0 } });
  }));

  let shapeFilter = -1, sort = 'common';
  const countEl = document.getElementById('count');
  function apply() {
    const sorted = [...looks].sort((a, b) => sort === 'common' ? b.pct - a.pct || a.order - b.order
                                          : sort === 'rarest' ? a.pct - b.pct || a.order - b.order
                                          : a.order - b.order);
    let shown = 0;
    for (const l of sorted) {
      l.fig.hidden = shapeFilter >= 0 && l.j !== shapeFilter;
      if (!l.fig.hidden) shown++;
      grid.appendChild(l.fig);
    }
    countEl.textContent = `${shown} looks`;
  }

  function chipGroup(el, items, current, set) {
    for (const [label, val] of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = label;
      b.setAttribute('aria-pressed', String(val === current()));
      b.addEventListener('click', () => {
        set(val); apply();
        el.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      });
      el.appendChild(b);
    }
  }
  chipGroup(document.getElementById('shape-group'), [['all', -1], ...E.SHAPES.map((s, i) => [s, i])], () => shapeFilter, (v) => { shapeFilter = v; });
  chipGroup(document.getElementById('sort-group'), [['most common', 'common'], ['rarest', 'rarest'], ['by color', 'color']], () => sort, (v) => { sort = v; });
  apply();

  // ─── choose a look → a seed for the serial console, and seed → look ───
  const S = window.StarboySeed;
  const W = E.COLORWAYS.map((c) => c.w);
  const panel = document.getElementById('pick');
  const pickCanvas = document.getElementById('pick-eye');
  const pickG = pickCanvas.getContext('2d');
  const pickName = document.getElementById('pick-name');
  const pickOdds = document.getElementById('pick-odds');
  const pickCmd = document.getElementById('pick-cmd');
  const copyBtn = document.getElementById('pick-copy');
  const seedForm = document.getElementById('seed-form');
  const seedInput = document.getElementById('seed-input');
  const seedMsg = document.getElementById('seed-msg');
  let picked = null;

  function show(colorway, shape, seed) {
    picked = { colorway, shape, seed };
    const cw = E.COLORWAYS[colorway];
    const pct = E.rarity(colorway) * E.SHAPE_WEIGHT[shape] / 100;
    pickName.textContent = `${E.SHAPES[shape]} ${cw.name}`;
    pickOdds.textContent = `${pct.toFixed(2)}% · ${tierOf(pct)}`;
    pickCmd.textContent = `seed ${S.toHex(seed)}`;
    copyBtn.textContent = 'copy';
    panel.hidden = false;
  }

  function choose(colorway, shape) {
    const seed = S.findSeed(colorway, shape, W, E.SHAPE_WEIGHT);
    if (seed !== null) show(colorway, shape, seed);
  }

  document.getElementById('pick-another').addEventListener('click', () => picked && choose(picked.colorway, picked.shape));
  document.getElementById('pick-close').addEventListener('click', () => { panel.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pickCmd.textContent); copyBtn.textContent = 'copied'; }
    catch { copyBtn.textContent = 'select it'; }
  });

  seedForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const seed = S.parseHex(seedInput.value);
    if (seed === null) { seedMsg.textContent = 'a seed is 1 to 8 hex digits, like 1a2b3c4d (the console prints it on boot)'; return; }
    seedMsg.textContent = '';
    const d = S.designFromSeed(seed, W, E.SHAPE_WEIGHT);
    show(d.colorway, d.shape, seed);
  });

  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const l = looks.find((x) => x.cv === en.target);
    if (l) l.visible = en.isIntersecting;
  }), { rootMargin: '120px' });
  looks.forEach((l) => io.observe(l.cv));

  const blinkCurve = (b) => (b < 80 ? (b / 80) * 0.95 : b < 200 ? (1 - (b - 80) / 120) * 0.95 : 0);
  function draw(l, now, dt) {
    const lt = now + l.phase;
    let tgx, tgy;
    if (finePointer && now - pointer.at < 4000) {
      const r = l.cv.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 220);
      tgx = (dx / d) * 21 * m; tgy = (dy / d) * 13 * m;
    } else {
      if (!reduceMotion && lt - l.glance.at > 1800) {
        l.glance.at = lt;
        l.glance.gx = Math.random() < 0.35 ? 0 : Math.random() * 26 - 13;
        l.glance.gy = Math.random() < 0.35 ? 0 : Math.random() * 10 - 5;
      }
      tgx = l.glance.gx; tgy = l.glance.gy;
    }
    const k = 1 - Math.pow(1 - 0.16, dt * 60 / 1000);
    l.gx += (tgx - l.gx) * k; l.gy += (tgy - l.gy) * k;
    const blink = reduceMotion ? 0 : blinkCurve(lt % l.blinkEvery);
    E.render(l.g, { gx: l.gx, gy: l.gy, blinkT: blink, blinkB: blink * 0.45, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0, colOvr: '#000000', fx: 0, fxP: 0 },
             l.j, E.COLORWAYS[l.i], now);
  }

  const start = performance.now();
  looks.forEach((l) => draw(l, start, 16));
  let last = start;
  function loop(now) {
    const dt = Math.min(100, now - last); last = now;
    for (const l of looks) if (l.visible && !l.fig.hidden) draw(l, now, dt);
    if (picked && !panel.hidden) {
      const b = reduceMotion ? 0 : blinkCurve((now + 700) % 3800);
      E.render(pickG, { gx: 0, gy: 0, blinkT: b, blinkB: b * 0.45, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0, colOvr: '#000000', fx: 0, fxP: 0 },
               picked.shape, E.COLORWAYS[picked.colorway], now);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
