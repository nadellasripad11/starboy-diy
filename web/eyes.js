// Eye renderer, ported row for row from drawEye() / drawSpecialFX() in
// firmware/starboy_firmware/starboy_firmware.ino. Draws into a 240×240
// canvas, the same resolution as the GC9A01 display on the real star.
(function () {
  const COLORWAYS = `marmalade f99f05 6e6123 6e6123|matcha c7fba6 5e6e06 5e6e06|houseplant 039442 71ff6f 71ff6f|terrarium 6ff5d0 106e54 106e54|whale 0059a3 0095ff 0095ff|frog 42de86 436a16 436a16|denim 6c92f8 102a6e 102a6e|petunia f8affb f006b4 f006b4|lipgloss a10180 fc609c fc609c|jawbreaker f6759f 56031f 56031f|cherry ae0002 ff5252 ff5252|pebble 645252 a4a4a4 a4a4a4|valentine dd06cb 7b1612 7b1612|plum 7260e6 622058 622058|gumball f20f07 ffffff ffffff|sprinkler 59bf05 ffffff ffffff|pool 05a8f9 fceeee fceeee|moon 4028ff ebfffc ebfffc|bubblegum f442e7 ffffff ffffff|seaglass fbfbfb 167b61 167b61|laser ffffff ff0000 ff0000|snowball ffffff 5a79f3 5a79f3|smoothie ffece0 ce0959 ce0959|peach fdfbe2 f76e5d f76e5d|goldfish e0f4fb de9109 de9109|seashell fcd9cf 070571 070571|hydrangea e1bfe1 2722db 2722db|cupcake f9ffb2 ca00ca ca00ca|limeade eafcc5 09b6ce 09b6ce|teacup f6e5a5 0d73f7 0d73f7|candycane 9cfbd5 790c05 790c05|ladybug c3110e 000000 000000|avocado 8bd67c 230606 230606|submarine 0f7ba9 000000 000000|eggplant e202e8 0a0a0a 0a0a0a|og ffffff 000000 000000|lobster f95320 044a5f 044a5f|pumpkin e87102 55fc6e 55fc6e|beachball f6fd21 1c9de3 1c9de3|glowstick e9f905 360342 360342|cactus c4f41d 530aec 530aec|highlighter 95f124 f50dcf f50dcf|kiwi 55f927 9f7717 9f7717|flytrap 15f817 5e045e 5e045e|junebug 14da70 3516af 3516af|sunset ae2400 f855fc f855fc|robin 15abf8 5e2304 5e2304|jukebox 024bde fb4cc3 fb4cc3|starboy 7b43f5 f6bd49 f6bd49|sonar 126487 2ee605 2ee605|guava 84fb8e f64982 f64982|blacklight 6922f0 a3f410 a3f410|taffy f474dc e8fca6 e8fca6|lilac 7202fc fdb0ce fdb0ce|nightlight 7768fe 55fc87 55fc87|crocus d602e8 fbf823 fbf823|rosebush 1e6935 fc7ac0 fc7ac0|parakeet 018335 23fafb 23fafb|glowworm f40df8 19f515 19f515|spearmint 9cfbce 790572 790572|motel fa486f 92fabe 92fabe|buoy 14abd6 eefa24 eefa24|slushie c206ad 49f6d9 49f6d9|siren fd0c0d 2905e6 2905e6|ember 994400 00eeff 00eeff|jelly b60080 429efb 429efb|popsicle 71feae 5598fc 5598fc|dragonfruit b60053 cffa0f cffa0f|hibiscus b6003c 05e605 05e605|jam c5013c 09ce93 09ce93|candle 973849 f7fbbc f7fbbc|calculator 737373 09e151 09e151|doorbell bebebe e42d06 e42d06|postcard be6a6a 76d8eb 76d8eb|flowerpot cc6262 3e4002 3e4002|juicebox f6826c 95059b 95059b|mallard 7b8401 0737a7 0737a7|tomato 60a611 b4040f b4040f|chamomile 509156 f4c524 f4c524|peacock 02b0b6 7923fb 7923fb|sandbox b8804a f7f574 f7f574|kite 7db5f4 c10787 c10787|puddle a7aff6 837605 837605|moth ec75f6 564803 564803|strawberry fcb7f2 069a1e 069a1e|flamingo fcb7c3 068f9a 068f9a|static 666666 000000 ffffff|eraser 666666 ffeded 000000|pinball b60207 d2f9f9 60d105|socks b865a8 76d8eb 8f1716|koi fe6873 0a0a0a d0f910|marble d1d9fa c11207 d20adf|stoplight 34f7fd 038c03 f91024|bumblebee fdcb21 0a0a0a d10566|lilypad d1f63b 10812b 0f91f4|popcorn eaf66e bb240a 0964e7|spumoni f6eab9 177e39 2722db|umbrella e7e3e9 f65f28 4f6bf8|sherbet e4f4e2 4a0a99 db8405|neapolitan 87493b eb76dd b7abf3`
    .split('|').map((r, i) => {
      const [name, body, pl, pr] = r.split(' ');
      const w = i < 14 ? 10 : i < 19 ? 8 : i < 31 ? 9 : i < 36 ? 7 : i < 73 ? 3 : i < 86 ? 5 : 2;
      return { name, body: '#' + body, pl: '#' + pl, pr: '#' + pr, w };
    });
  const TOTAL = COLORWAYS.reduce((a, c) => a + c.w, 0);
  const SHAPES = ['dot', 'circle', 'cat', 'acorn'];
  const SHAPE_WEIGHT = [10, 40, 30, 20];
  const PUPILS = [
    { u: 0.50, v: 0.00, rxF: 0.11, ryF: 0.00, tilt: 0.00, round: true },
    { u: 0.33, v: 0.03, rxF: 0.50, ryF: 0.00, tilt: 0.00, round: true },
    { u: 0.36, v: 0.00, rxF: 0.21, ryF: 0.66, tilt: 0.14, round: false },
    { u: 0.19, v: 0.24, rxF: 0.50, ryF: 0.92, tilt: 0.06, round: false },
  ];
  const CX = 120, CY = 120, H = 240, IRIS_RX = 48, IRIS_RY = 56, EYE_TILT = 0.10;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const T = Math.trunc;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const blend = (a, b, t) => { const A = hex(a), B = hex(b); t = clamp(t, 0, 1); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const hue = (p) => `rgb(${128 + 127 * Math.sin(p) | 0},${128 + 127 * Math.sin(p + 2.094) | 0},${128 + 127 * Math.sin(p + 4.189) | 0})`;

  function hline(g, x, y, w, c) { if (w <= 0) return; g.fillStyle = c; g.fillRect(x, y, w, 1); }
  function circle(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x + 0.5, y + 0.5, r + 0.5, 0, Math.PI * 2); g.fill(); }
  function tri(g, x0, y0, x1, y1, x2, y2, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x0 + .5, y0 + .5); g.lineTo(x1 + .5, y1 + .5); g.lineTo(x2 + .5, y2 + .5); g.closePath(); g.fill(); }

  function ellSpan(cx, cy, rx, ry, ang, y) {
    const c = Math.cos(ang), s = Math.sin(ang), dy = y - cy;
    const irx = 1 / (rx * rx), iry = 1 / (ry * ry);
    const A = c * c * irx + s * s * iry, B = 2 * dy * c * s * (irx - iry);
    const C = dy * dy * (s * s * irx + c * c * iry) - 1, disc = B * B - 4 * A * C;
    if (disc <= 0) return null;
    const r = Math.sqrt(disc);
    return [cx + (-B - r) / (2 * A), cx + (-B + r) / (2 * A)];
  }

  const REPLACES_PUPIL = new Set([2, 3, 6, 7, 8, 15, 16, 18]);

  function drawEye(g, cx, cy, isLeft, eye, shape, cw, now) {
    const side = isLeft ? 1 : -1;
    const gx = clamp(eye.gx, -26, 26), gy = clamp(eye.gy, -18, 18);
    let rx = IRIS_RX * clamp(eye.irX, 0.5, 1.02), ry = IRIS_RY * clamp(eye.irY, 0.5, 1.2);
    if (eye.fx === 17) {
      const a = Math.max(0, Math.sin(eye.fxP * 3)), b = Math.max(0, Math.sin(eye.fxP * 3 - 0.7));
      const beat = a ** 12 + 0.6 * b ** 12;
      rx *= 1 + 0.06 * beat; ry *= 1 + 0.06 * beat;
    }
    const ex = cx + gx * 0.35, ey = cy + gy * 0.35, bodyAng = -side * EYE_TILT;
    const open = 1 - 0.94 * clamp(eye.blinkT, 0, 1), pivot = ey + ry * 0.45;
    const pd = PUPILS[shape], ps = clamp(eye.pupR, 0.4, 1.6);
    const prx = pd.rxF * rx * ps, pry = pd.round ? prx : pd.ryF * ry * ps;
    let pu = pd.u, pv = pd.v;
    if (eye.fx === 9) { pu = Math.min(0.62, pu + 0.30); pv -= 0.10; }
    const ppx = ex + side * pu * rx + gx * 0.65, ppy = ey + pv * ry + gy * 0.55, pupAng = side * pd.tilt;
    const drawPupil = !REPLACES_PUPIL.has(eye.fx);

    let bodyC = eye.colMix > 0.5 ? eye.colOvr : blend(cw.body, eye.colOvr, eye.colMix);
    if (eye.fx === 1) bodyC = hue(eye.fxP * 1.5 + (isLeft ? 0 : 0.6));
    if (eye.fx === 16) bodyC = blend(bodyC, '#00004a', 0.8);
    const pupC = isLeft ? cw.pl : cw.pr;

    const top = pivot + (ey - ry - pivot) * open, bot = pivot + (ey + ry - pivot) * open;
    const bw = isLeft ? eye.bwL : eye.bwR;
    const cutDepth = Math.max(0, eye.bwY) * 1.6 + Math.max(0, bw) * 0.9;
    const cutSlope = Math.max(0, bw) * 0.025 * side, cutA = top + cutDepth - cutSlope * ex;
    const botCut = bot - Math.max(0, eye.blinkB - 0.45 * eye.blinkT) * ry * 1.4;
    const smile = clamp(eye.smile, 0, 1);
    const smileBase = bot - smile * ry * 0.45 * open, smileK = smile * ry * 0.45 * open / (1.69 * rx * rx);
    const y0 = Math.max(0, Math.floor(pivot + (ey - ry - 2 - pivot) * open));
    const y1 = Math.min(H - 1, Math.ceil(pivot + (ey + ry + 2 - pivot) * open));
    const glitchSeed = Math.floor(now / 90);

    for (let Y = y0; Y <= y1; Y++) {
      if (Y > botCut) break;
      const sy = pivot + (Y - pivot) / open;
      const b = ellSpan(ex, ey, rx, ry, bodyAng, sy);
      if (!b) continue;
      let [bx0, bx1] = b;
      if (cutDepth > 0.3 || cutSlope !== 0) {
        if (Math.abs(cutSlope) < 1e-4) { if (Y < cutA) continue; }
        else { const xl = (Y - cutA) / cutSlope; if (cutSlope > 0) bx1 = Math.min(bx1, xl); else bx0 = Math.max(bx0, xl); }
      }
      if (bx1 - bx0 < 0.5) continue;

      let shift = 0, swapC = false;
      if (eye.fx === 4) {
        let h = (Math.imul(T(Y / 7), 2654435761) ^ Math.imul(glitchSeed, 40503)) >>> 0;
        h = (h ^ (h >>> 13)) >>> 0;
        if ((h & 7) === 0) { shift = ((h >>> 4) % 17) - 8; swapC = ((h >>> 9) & 1) === 1; }
      }
      const rowBody = swapC ? pupC : bodyC, rowPup = swapC ? bodyC : pupC;
      const p = drawPupil ? ellSpan(ppx, ppy, prx, pry, pupAng, sy) : null;

      const seg = (a0, a1) => {
        if (a1 - a0 < 0.5) return;
        const i0 = Math.round(a0) + shift, i1 = Math.round(a1) + shift;
        if (eye.fx === 20) { hline(g, i0 - 3, Y, i1 - i0, '#ff0000'); hline(g, i0 + 3, Y, i1 - i0, '#00ffff'); }
        hline(g, i0, Y, i1 - i0, rowBody);
        if (!p) return;
        const q0 = Math.max(p[0], a0), q1 = Math.min(p[1], a1);
        if (q1 - q0 < 0.5) return;
        const j0 = Math.round(q0) + shift;
        hline(g, j0, Y, Math.max(1, Math.round(q1) + shift - j0), rowPup);
      };
      if (smileK > 1e-6 && Y > smileBase) {
        const h = Math.sqrt((Y - smileBase) / smileK);
        seg(bx0, Math.min(bx1, ex - h));
        seg(Math.max(bx0, ex + h), bx1);
      } else seg(bx0, bx1);
    }

    const F = { px: ppx, py: pivot + (ppy - pivot) * open, rx, ry: ry * open, side, body: bodyC, pup: pupC };
    if (eye.fx !== 0 && (open > 0.3 || eye.fx === 11)) drawFX(g, eye, T(ex), T(pivot + (ey - pivot) * open), F);
  }

  function thickLine(g, x0, y0, x1, y1, w, c) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    const nx = -dy / len * w * 0.5, ny = dx / len * w * 0.5;
    tri(g, T(x0 + nx), T(y0 + ny), T(x1 + nx), T(y1 + ny), T(x1 - nx), T(y1 - ny), c);
    tri(g, T(x0 + nx), T(y0 + ny), T(x1 - nx), T(y1 - ny), T(x0 - nx), T(y0 - ny), c);
    circle(g, T(x0), T(y0), T(w * 0.5), c); circle(g, T(x1), T(y1), T(w * 0.5), c);
  }
  function heart(g, x, y, r, c) {
    circle(g, x - T(r / 2), y - T(r / 4), T(r / 2) + 1, c);
    circle(g, x + T(r / 2), y - T(r / 4), T(r / 2) + 1, c);
    tri(g, x - r - 1, y - T(r / 8), x + r + 1, y - T(r / 8), x, y + r + 2, c);
  }
  function star(g, x, y, r, rot, c) {
    const ir = T(r * 45 / 100);
    for (let i = 0; i < 5; i++) {
      const a0 = rot - Math.PI / 2 + i * 2 * Math.PI / 5, a1 = a0 + Math.PI / 5, a2 = a0 + 2 * Math.PI / 5;
      tri(g, x, y, x + T(r * Math.cos(a0)), y + T(r * Math.sin(a0)), x + T(ir * Math.cos(a1)), y + T(ir * Math.sin(a1)), c);
      tri(g, x, y, x + T(ir * Math.cos(a1)), y + T(ir * Math.sin(a1)), x + T(r * Math.cos(a2)), y + T(r * Math.sin(a2)), c);
    }
  }
  function drop(g, x, y, r, tip, c) { circle(g, x, y, r, c); tri(g, x - r, y, x + r, y, x, y - tip, c); }
  function diamond(g, x, y, r, c) { tri(g, x - r, y, x + r, y, x, y - r, c); tri(g, x - r, y, x + r, y, x, y + r, c); }

  function drawFX(g, eye, cx, cy, F) {
    const p = eye.fxP, px = T(F.px), py = T(F.py), r = Math.max(4, T(F.rx * 0.42));
    switch (eye.fx) {
      case 2: heart(g, px, py, T(r * (1 + 0.15 * Math.max(0, Math.sin(p * 4)))), '#ff1431'); break;
      case 3: star(g, px, py, T(r * 115 / 100), p * 0.6 * F.side, '#ffce00'); break;
      case 6: {
        const maxR = T(Math.min(F.rx, F.ry) * 0.78), off = T((p * 10) % 12);
        for (let ring = maxR + 12; ring > 2; ring -= 6) {
          const rr = ring - off;
          if (rr < 2 || rr > maxR) continue;
          circle(g, cx, cy, rr, (T(ring / 6) % 2) ? F.pup : F.body);
        }
        break;
      }
      case 7: {
        const head = T(p * 8) % 8, dr = Math.max(3, T(F.rx * 0.09));
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 * F.side - Math.PI / 2, age = (head - i + 8) % 8;
          circle(g, cx + T(F.rx * 0.48 * Math.cos(a)), cy + T(F.ry * 0.48 * Math.sin(a)), dr, blend(F.pup, F.body, age / 8));
        }
        break;
      }
      case 8:
        if (T(p * 6) % 2 === 0) { g.fillStyle = F.pup; g.fillRect(px - T(r * 6 / 10), py - T(r * 6 / 10), T(r * 12 / 10), T(r * 12 / 10)); }
        break;
      case 10: {
        const SP = [[-0.35, -0.40], [0.30, -0.10], [-0.10, 0.45]];
        SP.forEach(([u, v], i) => diamond(g, cx + T(u * F.rx * F.side), cy + T(v * F.ry), 2 + T(3 * Math.abs(Math.sin(p * 0.8 + i * 2.1))), '#deffff'));
        break;
      }
      case 11:
        for (let i = 0; i < 3; i++) {
          const t = (p * 0.25 + i * 0.33) % 1, by = cy - T(F.ry) - 6 - T(t * 34);
          if (by >= 2) circle(g, cx - T(F.side * (8 - i * 8)), by, 2 + i, F.body);
        }
        break;
      case 12: {
        const t = (p * 0.8) % 1, ty = cy + T(F.ry * 0.55) + T(t * 46);
        if (ty < H - 6) drop(g, cx + T(F.side * F.rx * 0.45), ty, 5, 12, '#5aa2ff');
        break;
      }
      case 15: {
        const xr = T(Math.min(F.rx, F.ry) * 0.5), w = Math.max(5, xr * 0.45);
        thickLine(g, cx - xr, cy - xr, cx + xr, cy + xr, w, F.pup);
        thickLine(g, cx + xr, cy - xr, cx - xr, cy + xr, w, F.pup);
        break;
      }
      case 16: {
        const lim = Math.min(F.rx, F.ry) * 0.78;
        for (let i = 0; i < 14; i++) {
          const ang = p * (0.6 + 0.08 * i) * F.side + i * 2.4, rad = Math.min(lim, F.rx * (0.10 + 0.05 * i));
          circle(g, cx + T(rad * Math.cos(ang)), cy + T(rad * Math.sin(ang) * F.ry / F.rx), i % 4 === 0 ? 2 : 1, i % 3 === 0 ? '#ffffff' : F.pup);
        }
        break;
      }
      case 18: {
        const f1 = Math.sin(p * 9 + F.side), f2 = Math.sin(p * 11 - F.side), base = py + T(r / 3);
        drop(g, px, base, T(r * 80 / 100), T(r * (2.2 + 0.4 * f1)), '#ff0000');
        drop(g, px, base + T(r / 8), T(r * 55 / 100), T(r * (1.6 + 0.3 * f2)), '#ff8200');
        drop(g, px, base + T(r / 4), T(r * 30 / 100), r, '#ffff00');
        break;
      }
    }
  }

  function render(g, eye, shape, cw, now) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 240, 240);
    drawEye(g, CX - 52, CY, true, eye, shape, cw, now);
    drawEye(g, CX + 52, CY, false, eye, shape, cw, now);
  }

  function weightedPick(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) { if (r < weights[i]) return i; r -= weights[i]; }
    return weights.length - 1;
  }
  function roll() {
    return { colorway: weightedPick(COLORWAYS.map((c) => c.w)), shape: weightedPick(SHAPE_WEIGHT) };
  }
  const rarity = (i) => 100 * COLORWAYS[i].w / TOTAL;

  window.StarboyEyes = { COLORWAYS, SHAPES, SHAPE_WEIGHT, render, roll, rarity, clamp };
})();
