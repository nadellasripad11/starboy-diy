// Starboy's mood state machine: a JS copy of updateState() in
// firmware/starboy_firmware/starboy_firmware.ino, with no DOM so it can be
// driven by the sandbox page or by tools/test_mood.js with a fake clock.
(function (root) {
  const TIMING = {
    dizzyToSpin: 2000,       // S_DIZZY_MILD   -> S_DIZZY_SEVERE
    spinCalm: 3500,          // S_DIZZY_SEVERE -> S_RECOVERING once shaking stops
    recoverToAngry: 2000,    // S_RECOVERING   -> S_ANGRY
    angryCalm: 3500,         // S_ANGRY        -> idle / chill
    chillToShiver: 4000,     // S_CHILL        -> S_SHIVER (colder than cold - 5)
    shiverToFreeze: 8000,    // S_SHIVER       -> S_FREEZE (colder than cold - 8)
    startled: 800,           // S_STARTLED     -> anxious / idle
    anxiousCalm: 2500,       // S_ANXIOUS      -> idle once quiet
    anxiousToOverwhelmed: 4000,
    overwhelmedCalm: 3000,
    dreamLength: 6000,
    wokeLength: 1600,
  };
  const OFFSETS = { shiver: 5, freeze: 8, thaw: 2 };

  function createMood(opts = {}) {
    const cfg = {
      coldC: 10, loudP2P: 600, shakeMs: 1000, dozeMs: 25000, sleepMs: 75000,
      random: Math.random, onChange: () => {}, now: 0, ...opts,
    };
    const m = { state: 'idle', t0: cfg.now, lastInteract: cfg.now, shakeStart: 0, cfg };

    function set(next, reason) {
      if (m.state === next) return;
      const prev = m.state;
      m.state = next;
      m.t0 = m.now;
      cfg.onChange(next, reason || '', prev);
    }

    // inputs: { temp: °C, noise: mic peak-to-peak, shaking: bool (held right now) }
    m.update = (now, { temp, noise, shaking: held }) => {
      m.now = now;
      if (held && !m.shakeStart) m.shakeStart = now;
      if (!held) m.shakeStart = 0;

      const age = now - m.t0;
      const shaking = held && now - m.shakeStart > cfg.shakeMs;
      const isCold = temp < cfg.coldC;
      const isLoud = noise > cfg.loudP2P;
      if (held) m.lastInteract = now;

      // like the firmware: entering dizzy ends this tick, so the old state's age
      // can't instantly push dizzy on to spin
      if (shaking && !['dizzy', 'spin', 'recovering', 'angry'].includes(m.state)) {
        set('dizzy', 'shaken for 1s');
        return m.state;
      }

      switch (m.state) {
        case 'dizzy': if (age > TIMING.dizzyToSpin) set('spin', 'still shaking'); break;
        case 'spin': if (!shaking && age > TIMING.spinCalm) set('recovering', 'shaking stopped'); break;
        case 'recovering': if (age > TIMING.recoverToAngry) set('angry'); break;
        case 'angry': if (age > TIMING.angryCalm) set(isCold ? 'chill' : 'idle', 'calmed down'); break;
        case 'chill':
          if (!isCold) set('idle', 'warmed up');
          else if (age > TIMING.chillToShiver && temp < cfg.coldC - OFFSETS.shiver) set('shiver', `below ${cfg.coldC - OFFSETS.shiver}°c`);
          break;
        case 'shiver':
          if (!isCold) set('idle', 'warmed up');
          else if (age > TIMING.shiverToFreeze && temp < cfg.coldC - OFFSETS.freeze) set('freeze', `below ${cfg.coldC - OFFSETS.freeze}°c`);
          break;
        case 'freeze': if (temp >= cfg.coldC + OFFSETS.thaw) set('idle', 'thawed out'); break;
        case 'startled': if (age > TIMING.startled) set(isLoud ? 'anxious' : 'idle', isLoud ? 'still loud' : 'quiet again'); break;
        case 'anxious':
          if (!isLoud && age > TIMING.anxiousCalm) set('idle', 'quiet again');
          else if (isLoud && age > TIMING.anxiousToOverwhelmed) set('overwhelmed', 'loud for 4s');
          break;
        case 'overwhelmed': if (!isLoud && age > TIMING.overwhelmedCalm) set('idle', 'quiet again'); break;
        case 'doze':
          if (held || isLoud) { m.lastInteract = now; set('idle', 'woken up'); }
          else if (now - m.lastInteract > cfg.sleepMs) set('sleep', 'left alone longer');
          break;
        case 'sleep':
          if (held || noise > cfg.loudP2P * 0.5) { m.lastInteract = now; set('woke', held ? 'shaken awake' : 'noise woke him'); }
          else if (age > TIMING.dreamLength && cfg.random() < 0.004) set('dream');
          break;
        case 'dream': if (age > TIMING.dreamLength) set('sleep'); break;
        case 'woke': if (age > TIMING.wokeLength) set('idle'); break;
      }

      if (m.state === 'idle') {
        if (isCold) set('chill', `below ${cfg.coldC}°c`);
        else if (isLoud) { m.lastInteract = now; set('startled', 'loud noise'); }
        else if (now - m.lastInteract > cfg.dozeMs) set('doze', 'left alone');
      }
      return m.state;
    };

    m.idleFraction = (now) =>
      m.state === 'sleep' || m.state === 'dream' ? 1 : Math.min(1, Math.max(0, (now - m.lastInteract) / cfg.sleepMs));
    m.dozeLevel = (now) =>
      Math.min(1, Math.max(0, (now - m.lastInteract - cfg.dozeMs) / (cfg.sleepMs - cfg.dozeMs)));
    return m;
  }

  const api = { createMood, TIMING, OFFSETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarboyMood = api;
})(typeof window !== 'undefined' ? window : this);
