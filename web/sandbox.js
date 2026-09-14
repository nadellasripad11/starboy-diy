// Sensor sandbox: drives the shared mood state machine (mood.js, a copy of the
// firmware's updateState()) from on-page controls. Thresholds match the
// firmware defaults; only the idle timers are shortened so doze and sleep show up fast.
(function () {
  const E = window.StarboyEyes;
  const { clamp } = E;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLD_C = 10, LOUD_P2P = 600, SHAKE_MS = 1000;
  const DOZE_MS = 12000, SLEEP_MS = 24000;

  const NEUTRAL = { gx: 0, gy: 0, blinkT: 0, blinkB: 0, pupR: 1, irX: 1, irY: 1, bwL: 0, bwR: 0, bwY: 0, smile: 0, colMix: 0 };
  const LERP_KEYS = Object.keys(NEUTRAL);

  const LABELS = {
    idle: 'idle', dizzy: 'dizzy', spin: 'spinning', recovering: 'recovering', angry: 'angry',
    chill: 'chilly', shiver: 'shivering', freeze: 'frozen', startled: 'startled', anxious: 'anxious',
    overwhelmed: 'overwhelmed', doze: 'dozing', sleep: 'asleep', dream: 'dreaming', woke: 'just woke up',
    tilt: 'tilted',
  };

  const canvas = document.getElementById('sandbox-eye');
  const g = canvas.getContext('2d');
  const tempIn = document.getElementById('temp');
  const noiseIn = document.getElementById('noise');
  const tempOut = document.getElementById('temp-out');
  const noiseOut = document.getElementById('noise-out');
  const tiltIn = document.getElementById('tilt');
  const tiltOut = document.getElementById('tilt-out');
  const tilt = window.StarboyMood.createTiltTracker();
  const shakeBtn = document.getElementById('shake');
  const moodEl = document.getElementById('mood');
  const idleEl = document.getElementById('idle-bar');
  const logEl = document.getElementById('log');
  const eyeName = document.getElementById('eye-name');

  let design = E.roll();
  const showDesign = () => {
    eyeName.textContent = `${E.SHAPES[design.shape]} ${E.COLORWAYS[design.colorway].name}`;
  };
  showDesign();
  document.getElementById('reroll').addEventListener('click', () => { design = E.roll(); showDesign(); });

  function log(text) {
    const li = document.createElement('li');
    const secs = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
    li.innerHTML = `<span>${secs}</span>${text}`;
    logEl.prepend(li);
    while (logEl.children.length > 7) logEl.lastChild.remove();
  }

  const mood = window.StarboyMood.createMood({
    coldC: COLD_C, loudP2P: LOUD_P2P, shakeMs: SHAKE_MS, dozeMs: DOZE_MS, sleepMs: SLEEP_MS,
    now: performance.now(),
    random: reduceMotion ? () => 1 : Math.random,
    onChange: (next, reason) => {
      moodEl.textContent = LABELS[next];
      log(`<b>${LABELS[next]}</b>${reason ? ' · ' + reason : ''}`);
    },
  });

  const anim = {
    cur: { ...NEUTRAL }, dizzyAngle: 0, shiverPhase: 0,
    glance: { at: 0, next: 1500, gx: 0, gy: 0 }, blink: { at: -1e4, next: 2500 }, dart: { at: 0, gx: 0, gy: 0 },
  };

  // hold to shake: pointer or keyboard
  let shakeHeld = false;
  const startShake = () => { shakeHeld = true; shakeBtn.classList.add('held'); };
  const stopShake = () => { shakeHeld = false; shakeBtn.classList.remove('held'); };
  shakeBtn.addEventListener('pointerdown', (e) => { shakeBtn.setPointerCapture(e.pointerId); startShake(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => shakeBtn.addEventListener(ev, stopShake));
  shakeBtn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startShake(); } });
  shakeBtn.addEventListener('keyup', stopShake);

  const renderInputs = () => {
    tempOut.textContent = `${tempIn.value}°c`;
    const n = +noiseIn.value;
    noiseOut.textContent = n < 200 ? 'quiet' : n < LOUD_P2P ? 'talking' : n < 1800 ? 'loud' : 'very loud';
    tiltOut.textContent = +tiltIn.value === 0 ? 'flat' : `${tiltIn.value}°`;
  };
  tiltIn.addEventListener('input', renderInputs);
  tempIn.addEventListener('input', renderInputs);
  noiseIn.addEventListener('input', renderInputs);
  renderInputs();

  function tick() {
    const now = performance.now();
    const rad = +tiltIn.value * Math.PI / 180;
    const lean = tilt.update(now, { x: 0, y: 9.81 * Math.sin(rad), z: 9.81 * Math.cos(rad) }, shakeHeld ? 20 : 0);
    mood.update(now, { temp: +tempIn.value, noise: +noiseIn.value, shaking: shakeHeld, lean });
    idleEl.style.width = `${mood.idleFraction(now) * 100}%`;
  }

  function target(now) {
    const t = now - mood.t0;
    const tg = { ...NEUTRAL };
    let colOvr = '#000000', fx = 0, gazeSpd = 0.10;

    switch (mood.state) {
      case 'dizzy':
      case 'spin': {
        anim.dizzyAngle += mood.state === 'spin' ? 0.14 : 0.08;
        const r = mood.state === 'spin' ? 26 : 18;
        tg.gx = Math.cos(anim.dizzyAngle) * r; tg.gy = Math.sin(anim.dizzyAngle) * r;
        tg.blinkT = 0.2 + 0.2 * Math.sin(now * 0.005); tg.pupR = 0.8; gazeSpd = 0.22;
        break;
      }
      case 'recovering':
        tg.gx = Math.sin(now * 0.003) * Math.max(0, 8 - t * 0.003); tg.gy = Math.cos(now * 0.004) * 4; tg.blinkT = 0.3;
        break;
      case 'angry':
        Object.assign(tg, { pupR: 0.75, irY: 0.8, bwL: 14, bwR: 14, bwY: 4, colMix: 0.5, gx: Math.sin(now * 0.02) * 1.5 });
        colOvr = '#ff0000';
        break;
      case 'chill':
        anim.shiverPhase += 0.08;
        Object.assign(tg, { blinkT: 0.4, pupR: 0.9, irX: 1.1, irY: 0.8, bwL: 4, bwR: 4, colMix: 0.3 * Math.abs(Math.sin(anim.shiverPhase * 0.3)) });
        tg.gx = Math.sin(anim.shiverPhase) * 3; colOvr = '#0000ff';
        break;
      case 'shiver':
        anim.shiverPhase += 0.18;
        Object.assign(tg, { blinkT: 0.25 + 0.1 * Math.sin(anim.shiverPhase * 0.4), pupR: 0.6, irY: 1.2, bwL: 12, bwR: 12, bwY: 5, colMix: 0.5 });
        tg.gx = Math.sin(anim.shiverPhase) * 7 + Math.sin(anim.shiverPhase * 2.7) * 4;
        colOvr = '#0000ff'; fx = 10; gazeSpd = 0.3;
        break;
      case 'freeze':
        anim.shiverPhase += 0.12;
        Object.assign(tg, { blinkT: 0.5, pupR: 0.5, irX: 0.8, irY: 1.3, bwL: 10, bwR: 10, bwY: 4, colMix: 0.8 });
        tg.gx = Math.sin(anim.shiverPhase * 0.7) * 3; colOvr = '#00ffff'; fx = 10;
        break;
      case 'startled':
        Object.assign(tg, { pupR: 1.25, irX: 1.05, irY: 1.05, bwL: 5, bwR: 5, bwY: -3 });
        tg.gx = t < 300 ? Math.sin(t * 0.1) * 8 : 0; gazeSpd = 0.3;
        break;
      case 'anxious':
        if (now - anim.dart.at > 300) anim.dart = { at: now, gx: Math.random() * 36 - 18, gy: Math.random() * 24 - 12 };
        Object.assign(tg, { pupR: 0.9, irX: 1.1, irY: 0.8, bwL: 4, bwR: 4, blinkT: 0.3 + 0.2 * Math.sin(now * 0.008) });
        tg.gx = anim.dart.gx; tg.gy = anim.dart.gy; gazeSpd = 0.22;
        break;
      case 'overwhelmed':
        Object.assign(tg, { blinkT: 0.45, pupR: 0.6, irY: 1.2, bwL: 12, bwR: 12, bwY: 5, colMix: 0.3 });
        tg.gx = Math.sin(now * 0.015) * 10; colOvr = '#ffff00';
        break;
      case 'doze': {
        const dl = mood.dozeLevel(now);
        Object.assign(tg, { blinkT: 0.45 + dl * 0.35, pupR: 0.85, gy: 6 * dl, bwY: 5 * dl });
        break;
      }
      case 'sleep':
        Object.assign(tg, { blinkT: 1 - 0.03 * (0.5 + 0.5 * Math.sin(now * 0.0015)), pupR: 0.7 });
        break;
      case 'dream': {
        const dp = t * 0.0036;
        Object.assign(tg, { blinkT: 0.8 + 0.15 * Math.sin(dp), pupR: 0.7, gx: Math.sin(dp * 1.7) * 14, gy: Math.cos(dp * 2.3) * 8 });
        fx = 11;
        break;
      }
      case 'woke':
        Object.assign(tg, { gy: -1, irX: 1.05, irY: 1.05, bwY: -2 });
        break;
      case 'tilt':
        // same mapping as the firmware's S_TILT gaze
        tg.gx = clamp(-tilt.dy * 3.5, -22, 22);
        tg.gy = clamp(tilt.dx * 2.5, -16, 16);
        gazeSpd = 0.12;
        break;
      default:
        if (!reduceMotion && now - anim.glance.at > anim.glance.next) {
          anim.glance.at = now;
          anim.glance.next = 900 + Math.random() * 2300;
          const back = Math.random() < 0.33;
          anim.glance.gx = back ? 0 : Math.random() * 28 - 14;
          anim.glance.gy = back ? 0 : Math.random() * 12 - 6;
        }
        tg.gx = anim.glance.gx; tg.gy = anim.glance.gy;
        if (now - anim.glance.at < 140) gazeSpd = 0.4;
    }
    return { tg, colOvr, fx, gazeSpd };
  }

  const blinkCurve = (b) => (b < 80 ? (b / 80) * 0.95 : b < 200 ? (1 - (b - 80) / 120) * 0.95 : 0);
  const sleepy = () => ['sleep', 'dream', 'doze'].includes(mood.state);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    const { tg, colOvr, fx, gazeSpd } = target(now);
    const k = (spd) => 1 - Math.pow(1 - spd, dt * 30 / 1000);
    for (const key of LERP_KEYS) {
      const spd = key === 'gx' || key === 'gy' ? gazeSpd : key === 'blinkT' || key === 'blinkB' ? 0.18 : 0.08;
      anim.cur[key] += ((tg[key] ?? 0) - anim.cur[key]) * k(spd);
    }
    let blink = 0;
    if (!reduceMotion && !sleepy()) {
      if (now - anim.blink.at > anim.blink.next) { anim.blink.at = now; anim.blink.next = Math.random() < 0.1 ? 200 : 2200 + Math.random() * 4300; }
      blink = blinkCurve(now - anim.blink.at);
    }
    const eye = { ...anim.cur, blinkT: Math.max(anim.cur.blinkT, blink), colOvr, fx, fxP: now / 1000 * (fx === 11 ? 3.6 : 1.5) };
    eye.blinkB = eye.blinkT * 0.45;
    E.render(g, eye, design.shape, E.COLORWAYS[design.colorway], now);
    requestAnimationFrame(frame);
  }

  moodEl.textContent = LABELS.idle;
  log('<b>idle</b> · switched on');
  // mood logic on its own timer so it keeps ticking while the tab isn't painting
  setInterval(tick, 50);
  requestAnimationFrame(frame);
})();
