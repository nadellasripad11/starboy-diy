// Every visit starts with the intro, whichever page someone lands on first:
// home plays it in place, any other page detours through home and then
// carries on to where they were headed. Moving between pages of the site
// isn't a new visit. Visitors can turn the intro off (remembered on this
// device) with the footer switch or "never show intro"; ?intro always plays it.
// Runs in <head>, before first paint, so nothing flashes.
(function () {
  var root = document.documentElement;
  var OFF = 'starboy-intro-off', NAV = 'starboy-nav';
  function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function write(store, key, val) { try { if (val == null) window[store].removeItem(key); else window[store].setItem(key, val); } catch (e) { /* storage blocked */ } }

  // '1' = the visitor turned the intro off, '0' = they turned it on by hand
  // (which also overrides their device's reduced-motion setting)
  var force = /[?&]intro\b/.test(location.search);
  var pref = read('localStorage', OFF);
  var off = pref === '1';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && pref !== '0';

  // came from another page of this site? (referrer, or a marker for browsers that strip it)
  var internal = Date.now() - (+read('sessionStorage', NAV) || 0) < 10000;
  try { if (document.referrer && new URL(document.referrer).origin === location.origin) internal = true; } catch (e) { /* bad referrer */ }
  write('sessionStorage', NAV, null);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && a.origin === location.origin) write('sessionStorage', NAV, String(Date.now()));
  }, true);

  // the footer switch, on every page
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('intro-pref');
    if (!btn) return;
    var show = function () {
      var on = read('localStorage', OFF) !== '1';
      btn.textContent = on ? 'on' : 'off';
      btn.setAttribute('aria-pressed', String(on));
    };
    btn.addEventListener('click', function () { write('localStorage', OFF, read('localStorage', OFF) === '1' ? '0' : '1'); show(); });
    show();
  });

  window.StarboyGate = { markNav: function () { write('sessionStorage', NAV, String(Date.now())); }, turnOff: function () { write('localStorage', OFF, '1'); } };

  if (!force && (off || calm || internal)) return;
  if (root.hasAttribute('data-home')) { root.classList.add('intro-on'); return; }
  var here = location.pathname.split('/').pop() + location.search + location.hash;
  root.style.visibility = 'hidden';   // don't show this page for a frame on the way out
  location.replace('./?intro&next=' + encodeURIComponent(here));
})();
