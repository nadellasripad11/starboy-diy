// A close-up of starboy reacting to each sensor, drawn frame by frame at 1080x1080.
// Same eye code as the firmware (web/eyes.js is a row-for-row port), driven here by
// a script instead of real sensors — the captions say so, since nothing is built yet.
// promo/render.js --scene reactions.html drives PROMO.frame(i).
(function () {
  const W = 1080, H = 1080, FPS = 30;
  const E = window.StarboyEyes, Star = window.StarboyStar;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const FONT = 'Figtree, "Arial Black", "Segoe UI", sans-serif';
  const CW = Star.HERO.cw, SHAPE = Star.HERO.shape;
  const BASE = { gx: 0, gy: 0, blinkT: 0, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0, colOvr: '#000000', fx: 0, fxP: 0 };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const prog = (t, s, d) => clamp01((t - s) / d);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // each beat: when it starts, what the sensor is, and what he does about it
  const BEATS = [
    { t: 0.0, len: 2.2, sensor: 'idle', title: 'he just sits there', sub: 'looking around, blinking' },
    { t: 2.2, len: 3.0, sensor: 'motion · mpu6050', title: 'shake him', sub: 'his eyes spin, then he glares at you' },
    { t: 5.2, len: 3.0, sensor: 'temp · ds18b20', title: 'take him below 10°c', sub: 'he turns icy blue and shivers' },
    { t: 8.2, len: 3.0, sensor: 'mic · max4466', title: 'yell at him', sub: 'he jumps, then darts around' },
    { t: 11.2, len: 3.6, sensor: 'no input', title: 'leave him alone', sub: 'he dozes off and dreams' },
  ];
  const DURATION = 14.8;
  const beatAt = (t) => BEATS[Math.max(0, BEATS.findIndex((b, i) => t < b.t + b.len || i === BEATS.length - 1))];

  function blinkAt(t) {
    const ph = (t + 0.5) % 3.1;
    if (ph < 0.08) return (ph / 0.08) * 0.95;
    if (ph < 0.2) return (1 - (ph - 0.08) / 0.12) * 0.95;
    return 0;
  }

  // what his eyes do in each beat — the same moods the firmware drives from real sensors
  function eyeAt(t) {
    const b = beatAt(t), lt = t - b.t;
    const e = { ...BASE, blinkT: blinkAt(t), fxP: t * 1.5 };
    if (b.sensor === 'idle') {
      const k = Math.floor(lt / 0.9);
      Object.assign(e, { gx: (hash(k) * 2 - 1) * 16, gy: (hash(k + 5) * 2 - 1) * 8 });
    } else if (b.sensor.startsWith('motion')) {
      if (lt < 1.9) {
        const a = lt * 9;
        Object.assign(e, { gx: Math.cos(a) * 20, gy: Math.sin(a) * 16, pupR: 0.8, blinkT: 0.2 });
      } else {
        // recovered, and cross about it
        Object.assign(e, { pupR: 0.75, irY: 0.8, bwL: 14, bwR: 14, bwY: 4, colMix: 0.5, colOvr: '#ff0000', gx: Math.sin(t * 20) * 1.5 });
      }
    } else if (b.sensor.startsWith('temp')) {
      const ph = lt * 5.4;
      Object.assign(e, { blinkT: 0.25 + 0.1 * Math.sin(ph * 0.4), pupR: 0.6, irY: 1.2, bwL: 12, bwR: 12, bwY: 5,
        colMix: 0.5, colOvr: '#0000ff', fx: 10, gx: Math.sin(ph) * 7 + Math.sin(ph * 2.7) * 4 });
    } else if (b.sensor.startsWith('mic')) {
      if (lt < 0.7) Object.assign(e, { pupR: 1.25, irX: 1.05, irY: 1.05, bwY: -3, gx: Math.sin(lt * 20) * 8 });
      else {
        const k = Math.floor((lt - 0.7) / 0.3);
        Object.assign(e, { gx: hash(k) * 36 - 18, gy: hash(k + 7) * 24 - 12, pupR: 0.9, irY: 0.8, bwL: 4, bwR: 4,
          blinkT: 0.3 + 0.2 * Math.sin(lt * 8) });
      }
    } else {
      const close = 0.45 + 0.45 * easeInOutCubic(prog(lt, 0.1, 1.4));
      Object.assign(e, { blinkT: Math.min(0.95, close), pupR: 0.7, gy: 4, bwY: 5 * prog(lt, 0.1, 1.2) });
      if (lt > 1.6) { e.fx = 11; e.fxP = t * 3.6; e.gx = Math.sin(lt * 1.7) * 14; }
    }
    return e;
  }

  // he moves too: the shake rattles him, the cold makes him shiver, the noise makes him jump
  function poseAt(t) {
    const b = beatAt(t), lt = t - b.t;
    const p = { x: W / 2, y: 470, rot: Math.sin(t * 1.1) * 0.02, s: 1 };
    if (b.sensor.startsWith('motion') && lt < 1.9) {
      const decay = 1 - prog(lt, 0, 1.9);
      p.x += Math.sin(t * 71) * 26 * decay;
      p.y += Math.cos(t * 53) * 14 * decay;
      p.rot += Math.sin(t * 37) * 0.12 * decay;
    }
    if (b.sensor.startsWith('temp')) p.x += Math.sin(t * 90) * 5;
    if (b.sensor.startsWith('mic') && lt < 0.7) {
      p.y -= 26 * Math.sin(Math.PI * prog(lt, 0, 0.45));
      p.rot += Math.sin(t * 60) * 0.03;
    }
    if (b.sensor === 'no input') p.y += 10 * easeOutCubic(prog(lt, 0.2, 1.6));   // he sinks a little
    return p;
  }

  function background(t) {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, W, H);
    const b = beatAt(t);
    const tint = b.sensor.startsWith('temp') ? [40, 90, 210] : b.sensor.startsWith('mic') ? [210, 50, 70]
      : b.sensor.startsWith('motion') ? [150, 60, 40] : [120, 110, 160];
    const g = ctx.createRadialGradient(W / 2, 470, 0, W / 2, 470, 720);
    g.addColorStop(0, `rgba(${tint.join(',')},0.2)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function text(str, x, y, size, color, weight = 800, align = 'center') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function captions(t) {
    const b = beatAt(t), lt = t - b.t;
    const inK = easeOutCubic(prog(lt, 0.05, 0.35));
    const out = prog(lt, b.len - 0.3, 0.3);
    const a = inK * (1 - out);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - inK) * 18);

    // the sensor doing the work, as a chip
    ctx.font = `700 30px ${FONT}`;
    const label = b.sensor.toUpperCase();
    const w = ctx.measureText(label).width + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - w / 2, 812, w, 54, 27);
    ctx.fill();
    text(label, W / 2, 848, 30, '#b9bac1', 700);

    text(b.title, W / 2, 940, 74, '#ffffff');
    text(b.sub, W / 2, 1000, 40, '#9a9ba3', 700);
    ctx.restore();
  }

  function render(t) {
    background(t);
    const p = poseAt(t);
    Star.draw(ctx, { x: p.x, y: p.y, R: 330 * p.s, cacheR: 330, rot: p.rot, dim: 0, t,
      eye: eyeAt(t), shape: SHAPE, cw: CW, dpr: 1 });
    captions(t);
    // it's a simulation, and it says so
    text('simulated on the same animation code that runs on the star', W / 2, 1052, 26, '#6d6e75', 700);
    const fade = 1 - prog(t, 0, 0.35), end = prog(t, DURATION - 0.4, 0.4);
    const black = Math.max(fade, end);
    if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
  }

  window.promoReady = (async () => {
    try { await Promise.all([document.fonts.load(`800 74px Figtree`), document.fonts.load(`700 30px Figtree`)]); } catch { /* system fonts */ }
    await document.fonts.ready;
    return true;
  })();

  window.PROMO = {
    W, H, FPS, DURATION, EVENTS: [], AUDIO: {},
    frame(i, type = 'image/jpeg', quality = 0.95) {
      render(i / FPS);
      return canvas.toDataURL(type, quality);
    },
    render,
  };

  if (location.search.includes('play')) {
    window.promoReady.then(() => {
      const start = performance.now();
      const loop = (now) => { render(((now - start) / 1000) % DURATION); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
  } else {
    window.promoReady.then(() => render(3.2));
  }
})();
