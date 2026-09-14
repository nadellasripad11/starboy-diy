// Exact port of initEyeDesign() in firmware/starboy_firmware/starboy_firmware.ino:
// the same 32-bit LCG and the same weighted picks, so a seed shown here is the
// look a real star rolls, and `seed <hex>` in the serial console sets it.
(function (root) {
  const LCG_MUL = 1664525, LCG_ADD = 1013904223;

  function designFromSeed(seed, weights, shapeWeights) {
    let s = seed >>> 0;
    const rnd = (n) => {
      s = (Math.imul(s, LCG_MUL) + LCG_ADD) >>> 0;
      return ((s >>> 8) % n) & 0xffff;   // (uint16_t)((s >> 8) % n): modulo first, then the cast
    };
    const total = weights.reduce((a, w) => a + w, 0);
    let pick = rnd(total);
    let colorway = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
      if (pick < weights[i]) { colorway = i; break; }
      pick -= weights[i];
    }
    pick = rnd(100);
    let shape = shapeWeights.length - 1;
    for (let i = 0; i < shapeWeights.length; i++) {
      if (pick < shapeWeights[i]) { shape = i; break; }
      pick -= shapeWeights[i];
    }
    return { colorway, shape };
  }

  // Random search for a seed that rolls a given look. The rarest look is 1 in
  // ~2500, so this almost always finishes in a few milliseconds.
  function findSeed(colorway, shape, weights, shapeWeights, random = Math.random, maxTries = 2000000) {
    for (let i = 0; i < maxTries; i++) {
      const seed = (Math.floor(random() * 0xffffffff) >>> 0) || 1;
      const d = designFromSeed(seed, weights, shapeWeights);
      if (d.colorway === colorway && d.shape === shape) return seed;
    }
    return null;
  }

  const toHex = (seed) => (seed >>> 0).toString(16).padStart(8, '0');
  const parseHex = (text) => {
    const clean = String(text).trim().toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{1,8}$/.test(clean)) return null;
    const v = parseInt(clean, 16) >>> 0;
    return v === 0 ? null : v;   // the firmware treats 0 as "no seed yet"
  };

  const api = { designFromSeed, findSeed, toHex, parseHex, LCG_MUL, LCG_ADD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarboySeed = api;
})(typeof window !== 'undefined' ? window : this);
