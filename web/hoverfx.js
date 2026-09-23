// Hover motion for text, in the spirit of studio sites like trionn.com:
//   links and buttons: the letters roll up one after another while a copy rolls in from below
//   big headings: a ripple lifts and blurs the letters round the cursor, fading with distance
//   paragraphs: the word under the cursor does a small version of the ripple
//   the cursor ball (home page) swells over anything clickable
// Only for a mouse (touch has no hover), never with reduced motion. Split
// letters are aria-hidden and their element keeps a label, so screen readers
// still read whole words. Load after the page's own scripts (they build some buttons).
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // any mouse will do: a touchscreen laptop still reports a fine pointer, a phone doesn't
  if (!matchMedia('(any-hover: hover)').matches && !matchMedia('(any-pointer: fine)').matches) return;

  const style = document.createElement('style');
  style.textContent = `
    .roll-c { display: inline-block; clip-path: inset(0 -.12em); }
    .roll-c > span { display: inline-block; text-shadow: 0 1.6em currentColor;
      transition: transform .55s cubic-bezier(.7, 0, .2, 1) calc(var(--i) * 14ms); }
    .roll:hover .roll-c > span, .roll:focus-visible .roll-c > span {
      transform: translateY(-1.6em); animation: roll-blur .55s calc(var(--i) * 14ms); }
    @keyframes roll-blur { 50% { filter: blur(1.3px); } }
    .hv-char { display: inline-block; white-space: pre; }
    #cursor-ball { transition: scale .35s cubic-bezier(.3, 1.6, .5, 1); }
    #cursor-ball.ball-big { scale: 1.9; }
  `;
  document.head.appendChild(style);

  // wrap each visible letter of el's text (skipping icons) in spans; returns them
  function letters(el, cls, make) {
    const out = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.nodeValue.trim()) continue;
      // one inline wrapper per run of text, so a flex parent (like the logo) still
      // sees a single item instead of spacing every letter out
      const run = document.createElement('span');
      for (const ch of node.nodeValue) {
        if (/\s/.test(ch)) { run.appendChild(document.createTextNode(ch)); continue; }
        const c = document.createElement('span');
        c.className = cls;
        c.setAttribute('aria-hidden', 'true');
        make(c, ch, out.length);
        out.push(c);
        run.appendChild(c);
      }
      node.parentNode.replaceChild(run, node);
    }
    return out;
  }

  // ─── rolling letters on links and buttons ───
  const ROLL = 'nav a, .bar, .chip, .reaction, footer a, .leap, .skip, #demo-next, #reroll, .back, a.go';
  for (const el of document.querySelectorAll(ROLL)) {
    if (el.id === 'intro-pref' || el.closest('[data-fx]') || el.classList.contains('roll')) continue;
    const scope = el.querySelector('.if') || el;
    const label = el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim();
    if (!label) continue;
    el.setAttribute('aria-label', label);
    el.classList.add('roll');
    letters(scope, 'roll-c', (c, ch, i) => {
      c.style.setProperty('--i', i);
      const s = document.createElement('span');
      s.textContent = ch;
      c.appendChild(s);
    });
  }

  // ─── ripples through headings and paragraphs ───
  function wave(chars, i, reach, lift, blur) {
    for (let k = Math.max(0, i - reach); k <= Math.min(chars.length - 1, i + reach); k++) {
      const c = chars[k], d = Math.abs(k - i), a = 1 - d / (reach + 1);
      if (c._wave && c._wave.playState === 'running') continue;
      c._wave = c.animate([
        { translate: '0 0', filter: 'blur(0px)' },
        { translate: `0 ${(-lift * a).toFixed(3)}em`, filter: `blur(${(blur * a).toFixed(2)}px)`, offset: 0.4 },
        { translate: '0 0', filter: 'blur(0px)' },
      ], { duration: 560, delay: d * 26, easing: 'cubic-bezier(.3, 0, .2, 1)' });
    }
  }

  // headings: textfx already split the home page's; split the rest here
  for (const h of document.querySelectorAll('h1, h2')) {
    let chars = [...h.querySelectorAll('.fx-char')];
    if (!chars.length) {
      if (!h.hasAttribute('aria-label')) h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
      chars = letters(h, 'hv-char', (c, ch) => { c.textContent = ch; });
    }
    h.addEventListener('mouseover', (e) => {
      const i = chars.indexOf(e.target.closest('.fx-char, .hv-char'));
      if (i >= 0) wave(chars, i, 5, 0.16, 1.6);
    });
  }

  // paragraphs textfx split into words: ripple just the hovered word
  for (const p of document.querySelectorAll('p[data-fx="text"]')) {
    p.addEventListener('mouseover', (e) => {
      const word = e.target.closest('.fx-word');
      if (!word || word._last === e.target) return;
      word._last = e.target;
      const chars = [...word.querySelectorAll('.fx-char')];
      wave(chars, chars.indexOf(e.target.closest('.fx-char')), chars.length, 0.08, 0.6);
    });
    p.addEventListener('mouseout', (e) => { const w = e.target.closest('.fx-word'); if (w) w._last = null; });
  }

  // ─── the cursor ball swells over anything clickable ───
  const ball = document.getElementById('cursor-ball');
  if (ball) {
    addEventListener('mouseover', (e) => ball.classList.toggle('ball-big', !!e.target.closest('a, button, [role="button"]')));
  }
})();
