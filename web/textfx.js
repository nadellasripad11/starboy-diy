// Letter-by-letter text reveal, plus a little squish when you hover a letter.
//   data-fx="heading"  big text: letters rise in one by one when scrolled into view
//   data-fx="text"     paragraphs (or a section of them): a quicker ripple through the words
// Links and other inline elements inside the text keep working.
(function () {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = [...document.querySelectorAll('[data-fx="heading"], [data-fx="text"]')];
  if (!targets.length) return;

  const style = document.createElement('style');
  style.textContent = `
    [data-fx] .fx-word { display: inline-block; white-space: nowrap; }
    [data-fx] .fx-char { display: inline-block; opacity: 0; transform: translateY(12.5%);
      transition: scale .5s ease-out; }
    [data-fx].fx-in .fx-char { animation: fx-rise var(--fx-dur, 1.2s) cubic-bezier(.16, 1, .3, 1) forwards; }
    [data-fx] .fx-char.fx-bump { scale: .93; transition: scale .1s ease-in; }
    @keyframes fx-rise { to { opacity: 1; transform: translateY(0); } }
  `;
  document.head.appendChild(style);
  if (reduceMotion) return;

  // Walks the element's text nodes and wraps each word in .fx-word and each
  // letter in .fx-char with a staggered delay. Returns the letter count.
  function split(el, startMs, stepMs, maxDelayMs) {
    let index = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.nodeValue.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
        const word = document.createElement('span');
        word.className = 'fx-word';
        for (const ch of part) {
          const c = document.createElement('span');
          c.className = 'fx-char';
          c.textContent = ch;
          c.style.animationDelay = `${Math.min(maxDelayMs, startMs + index * stepMs)}ms`;
          word.appendChild(c);
          index++;
        }
        frag.appendChild(word);
      }
      node.parentNode.replaceChild(frag, node);
    }
    return index;
  }

  const blocks = [];
  for (const el of targets) {
    if (el.dataset.fx === 'heading') {
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.trim());
      split(el, 150, 20, 1500);
      el.querySelectorAll('.fx-char').forEach((c) => c.setAttribute('aria-hidden', 'true'));
      blocks.push(el);
    } else {
      // a section tagged as text ripples each of its paragraphs on its own
      const paras = el.matches('p') ? [el] : [...el.querySelectorAll('p')];
      for (const p of paras) {
        p.dataset.fx = 'text';
        p.style.setProperty('--fx-dur', '.6s');
        split(p, 0, 3, 900);
        blocks.push(p);
      }
    }
  }

  // hover squish, one listener per block
  for (const el of blocks) {
    el.addEventListener('mouseover', (e) => {
      const c = e.target.closest('.fx-char');
      if (!c || !el.contains(c)) return;
      c.classList.add('fx-bump');
      setTimeout(() => c.classList.remove('fx-bump'), 100);
    });
  }

  // Reveal when scrolled into view. The check runs on load, on scroll/resize and
  // from an IntersectionObserver, so text can't get stuck invisible if one of
  // those never fires (background tabs, embedded previews, print).
  const pending = new Set(blocks);
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight * 0.92 && r.bottom > 0;
  };
  const reveal = (el) => {
    if (!pending.delete(el)) return;
    el.classList.add('fx-in');
    io.unobserve(el);
    if (!pending.size) {
      removeEventListener('scroll', check);
      removeEventListener('resize', check);
      clearInterval(poll);
    }
  };
  const check = () => { for (const el of pending) if (inView(el)) reveal(el); };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) reveal(en.target);
  }, { rootMargin: '0px 0px -8% 0px' });
  blocks.forEach((b) => io.observe(b));
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  // scroll events and observers are both tied to painting; a slow timer isn't
  const poll = setInterval(check, 300);
  check();
  addEventListener('beforeprint', () => [...pending].forEach(reveal));
})();
