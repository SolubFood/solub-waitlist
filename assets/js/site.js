// SolubFood — shared behaviour for index.html, kitchen.html and join.html.
// Every block checks that its elements exist, so each page only runs what it has.

// Mobile menu
(function () {
  var header = document.querySelector('.site-header');
  var btn = header && header.querySelector('.nav-toggle');
  if (!btn) return;
  function setOpen(open) {
    header.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  btn.addEventListener('click', function () { setOpen(!header.classList.contains('nav-open')); });
  header.querySelectorAll('.main-nav a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); btn.focus(); } });
})();

var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('footerYear').textContent = new Date().getFullYear();

  (function cookieConsent() {
    var KEY = 'solub_consent';
    var banner = document.getElementById('cookieBanner');
    var acceptBtn = document.getElementById('cookieAccept');
    var declineBtn = document.getElementById('cookieDecline');
    if (!banner) return;

    function loadPlausible() {
      if (document.getElementById('plausible-script')) return;
      var s = document.createElement('script');
      s.id = 'plausible-script';
      s.defer = true;
      s.setAttribute('data-domain', 'solubfood.com');
      s.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(s);
    }

    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (err) {}

    if (stored === 'accepted') {
      loadPlausible();
    } else if (stored !== 'declined') {
      banner.hidden = false;
    }

    acceptBtn.addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'accepted'); } catch (err) {}
      banner.hidden = true;
      loadPlausible();
    });
    declineBtn.addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'declined'); } catch (err) {}
      banner.hidden = true;
    });
  })();

  // The intro video is a sketch until January 2027 — this just gives
  // honest feedback instead of a dead button until the real .mp4 lands.
  // To wire the real video: replace the <img> in .founder-media with a
  // <video controls playsinline> and drop this handler.
  (function introVideoPlaceholder() {
    var btn = document.getElementById('heroPlayBtn');
    var note = document.getElementById('heroVideoNote');
    if (!btn || !note) return;
    var defaultNote = note.textContent;
    btn.addEventListener('click', function () {
      note.textContent = 'The full video lands in January 2027.';
      setTimeout(function () { note.textContent = defaultNote; }, 2600);
    });
  })();

  // Tag each signup with where it came from (?ref=… from creators, QRs and events; utm_* from ads),
  // kept for the session so it survives moving around the site. Fills both forms.
  (function captureSignupSource() {
    var params = new URLSearchParams(window.location.search);
    ['ref', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
      var v = params.get(k);
      try {
        if (v) sessionStorage.setItem('solub_' + k, v);
        else v = sessionStorage.getItem('solub_' + k);
      } catch (err) {}
      if (!v) return;
      document.querySelectorAll('form input[type="hidden"][name="' + k + '"]').forEach(function (input) {
        input.value = v.slice(0, 80);
      });
    });
  })();

  // Both forms post to FormSubmit (AJAX endpoint), which emails each submission to the team.
  function wireForm(formId, doneId, successText) {
    var form = document.getElementById(formId);
    if (!form) return;
    var status = form.querySelector('[data-status]');
    var done = document.getElementById(doneId);
    var btn = form.querySelector('button[type="submit"]');
    var mailFallback = 'hello@teamsolub.com';

    function markInvalid() {
      form.querySelectorAll('input[required], textarea[required]').forEach(function (el) {
        if (el.type === 'radio') return;
        el.setAttribute('aria-invalid', el.checkValidity() ? 'false' : 'true');
      });
    }
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.checkValidity()) e.target.setAttribute('aria-invalid', 'false');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { markInvalid(); form.reportValidity(); return; }
      var honey = form.querySelector('.form-honey');
      if (honey && honey.value) return;

      var ts = form.querySelector('input[name="timestamp"]');
      if (ts) ts.value = new Date().toISOString();
      btn.disabled = true;
      status.className = 'form-status';
      status.textContent = 'Sending…';

      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      }).then(function (res) {
        if (!res.ok) throw new Error('bad status');
        form.hidden = true;
        if (done) {
          done.className = 'form-status done success paper p-beige';
          done.textContent = successText;
          done.hidden = false;
        }
      }).catch(function () {
        btn.disabled = false;
        status.className = 'form-status error';
        status.innerHTML = 'Something went wrong — email us directly at <a href="mailto:' + mailFallback + '">' + mailFallback + '</a>';
      });
    });
  }
  wireForm('waitlistForm', 'waitlistDone', "You're in! Welcome to SolubFood, Founding Member.");
  wireForm('kitchenJoinForm', 'kitchenJoinDone', "Thanks! We'll be in touch within a few days.");

  // Intro: blur-in, one piece after another.
  (function heroReveal() {
    var intro = document.getElementById('heroIntro');
    if (!intro) return;
    if (reduceMotion) { intro.classList.add('is-visible'); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { intro.classList.add('is-visible'); }); });
  })();

  // Scroll-driven home loop. Progress uses the same curve as framer-motion's useScroll({ target }):
  // 0 when the block's top enters the bottom of the screen, 1 when its bottom leaves the top.
  // The card stands up (rotateX 75°→0°, scale 1.15→1); while it's pinned, the four icons ride in
  // together and the home pops. One rAF-throttled handler, no library.
  (function loopScroll() {
    var box = document.getElementById('loopScroll');
    var fig = document.getElementById('homeLoop');
    if (!box || !fig) return;
    if (reduceMotion) { box.classList.add('is-static'); return; }
    fig.classList.add('is-scroll');
    var stage = box.querySelector('.loop-stage');
    var items = fig.querySelectorAll('.it');
    var home = fig.querySelector('.home');
    var burst = fig.querySelector('.burst');
    var flows = fig.querySelectorAll('.flow');
    var ticking = false;
    function clamp(v) { return Math.min(1, Math.max(0, v)); }
    function map(v, a, b, from, to) { return from + (to - from) * clamp((v - a) / (b - a)); }
    function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function update() {
      ticking = false;
      var r = box.getBoundingClientRect();
      var vh = window.innerHeight;
      if (r.bottom < -50 || r.top > vh + 50) return;
      var p = clamp((vh - r.top) / (r.height + vh));          // whole journey
      var q = clamp(-r.top / Math.max(1, r.height - vh));     // while pinned
      stage.style.setProperty('--rx', map(p, 0, 0.4, 75, 0).toFixed(2));
      stage.style.setProperty('--sc', map(p, 0.25, 0.45, 1.15, 1).toFixed(3));
      var ride = ease(clamp((q - 0.12) / 0.5));                // belts → front door
      var enter = clamp((q - 0.66) / 0.14);                    // through the door
      items.forEach(function (it) {
        var dx = parseFloat(it.style.getPropertyValue('--dx')) || 0;
        var dy = parseFloat(it.style.getPropertyValue('--dy')) || 0;
        var off = -68 * (1 - ride) + 48 * enter;
        it.style.transform = 'translate(' + (dx * off).toFixed(1) + 'px,' + (dy * off).toFixed(1) + 'px) scale(' + (1 - 0.7 * enter).toFixed(3) + ')';
        it.style.opacity = (1 - enter).toFixed(3);
      });
      var pop = Math.sin(Math.PI * clamp((q - 0.78) / 0.16));
      home.style.transform = 'scale(' + (1 + 0.1 * pop).toFixed(3) + ') rotate(' + (-2 * pop).toFixed(2) + 'deg)';
      burst.style.opacity = pop.toFixed(3);
      flows.forEach(function (f) { f.style.strokeDashoffset = (-q * 216).toFixed(1); });
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  })();

  // Pause the home loop while it's off screen, so it costs nothing when nobody's looking.
  (function pauseLoopOffscreen() {
    var loop = document.getElementById('homeLoop');
    if (!loop || reduceMotion || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { loop.classList.toggle('is-paused', !en.isIntersecting); });
    }).observe(loop);
  })();

// ===========================================================
// Member card on a lanyard (Culture). Vanilla port of a React "lanyard badge":
// two strap strands meet at a buckle, a short strap + ring hold the card.
// The strap is a verlet rope drawn as a printed ribbon on a <canvas>; the card is
// HTML turned in 3D with CSS. Drag it (the strap pulls taut), flick it to spin,
// tap / Enter / the button to flip. Brand colours and Archivo only.
// ===========================================================
(function memberBadge() {
  var root = document.getElementById('memberBadge');
  if (!root) return;
  var canvas = root.querySelector('canvas');
  var card = root.querySelector('.ly-card');
  var inner = root.querySelector('.ly-inner');
  var btn = document.querySelector('.ly-flip[aria-controls="memberBadge"]');
  var ctx = canvas && canvas.getContext('2d');
  if (!card || !inner || !ctx) return;

  var RED = '#E74426', BEIGE = '#F6E9D7', INK = '#1A1714';
  var FONT = "'Archivo', system-ui, sans-serif";
  var STRAP = { color: RED, ink: BEIGE, text: 'more than people', label: 'SOLUBFOOD · GOLD COAST' };

  // ---- SolubCard front ------------------------------------------------------
  // Same for every member (the community): the cream card and its pink hairline drawings.
  // Different for every member: their country's shape as contour lines, its real flag, the country and their name.
  // Data for every country: assets/data/solubcard/ (built by tools/build-card-data.mjs from Natural Earth) and assets/flags/.
  // Preview: a visitor can try any country; nothing is stored. With accounts, the country and name come from the profile.
  var artEl = document.getElementById('lyArt');
  var flagEl = document.getElementById('lyFlag');
  var fromEl = document.getElementById('lyFrom');
  var countrySel = document.getElementById('lyCountry');

  // Official flags in their real colours (assets/flags/<code>.svg, from flag-icons).
  function setFlag(code) {
    if (!flagEl) return;
    flagEl.innerHTML = code ? '<img src="assets/flags/' + code + '.svg" alt="" width="40" height="30">' : '';
    flagEl.style.display = code ? '' : 'none';
  }

  // The shared hairline drawings (identical on every card).
  var HAIR = '<g fill="none" stroke="#E688B7" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M68 31 Q120 41 172 31"/>' +
    [0, 1, 2, 3].map(function (i) { var x = 75 + i * 24, y = 32 + Math.sin((i + .5) / 4 * Math.PI) * 4; return '<path d="M' + x + ' ' + y + ' h18 v16 l-3 2 l-3 -2 l-3 2 l-3 -2 l-3 2 l-3 -2 Z"/><circle cx="' + (x + 9) + '" cy="' + (y + 7) + '" r="3"/>'; }).join('') +
    '<g transform="translate(212 66)"><circle r="11"/>' + [0,1,2,3,4,5,6,7,8,9,10,11].map(function (i) { return '<line x1="0" y1="-15" x2="0" y2="' + (i % 2 ? -19 : -22) + '" transform="rotate(' + i * 30 + ')"/>'; }).join('') + '<path d="M-4 3 Q0 6 4 3"/><circle cx="-4" cy="-3" r=".6"/><circle cx="4" cy="-3" r=".6"/></g>' +
    '<g transform="translate(22 92) rotate(-12)"><path d="M0 0 L9 11 L0 24 L-9 11 Z M-9 11 H9 M0 0 V24"/><path d="M0 24 q4 8 -2 16 q-5 8 2 16"/></g>' +
    '<g transform="translate(206 120)"><circle r="12"/><path d="M-6 -4 l10 -4 M-7 1 l12 -5 M-5 6 l10 -4"/></g>' +
    '<g transform="translate(200 166)"><path d="M0 10 Q-3 34 13 37 Q29 34 26 10 Z"/><ellipse cx="13" cy="10" rx="13" ry="3.5"/><path d="M17 8 L27 -14 M24 -14 h6"/></g>' +
    '<g transform="translate(26 206)"><ellipse rx="17" ry="7"/><path d="M-17 0 v4 Q0 14 17 4 V0"/><circle cx="-6" cy="-1" r=".9"/><circle cx="5" cy="-2" r=".9"/></g>' +
    '<g transform="translate(196 240) rotate(-14)"><path d="M0 14 Q17 -10 34 14 Z"/><path d="M5 11 l2 -2 M10 5 l2 -2 M17 2 l2 1 M24 4 l2 2 M28 9 l2 2"/></g>' +
    '<g transform="translate(24 256)"><circle r="12"/><path d="M-6 3 q6 4 12 0"/><circle cx="-3" cy="-3" r=".8"/><circle cx="3" cy="-4" r=".8"/></g>' +
    '</g>';

  // Card artwork as one SVG image: drawn once per country, so the card's animation never repaints it.
  function artSVG(c) {
    var map = '';
    if (c && c.d) {
      var step = 4, rings = '';
      for (var k = 14; k >= 1; k--) {
        rings += '<path d="' + c.d + '" stroke="#E74426" stroke-width="' + (2 * k * step) + '"/><path d="' + c.d + '" stroke="#F6E9D7" stroke-width="' + (2 * k * step - 1.3) + '"/>';
      }
      map = '<defs><clipPath id="c"><path d="' + c.d + '"/></clipPath>' +
        '<filter id="w" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="4.5"/></filter></defs>' +
        '<path d="' + c.d + '" fill="#F6E9D7"/>' +
        '<g clip-path="url(#c)"><g filter="url(#w)" fill="none" stroke-linejoin="round">' + rings + '</g></g>' +
        '<path d="' + c.d + '" fill="none" stroke="#E74426" stroke-width="1.1" stroke-linejoin="round"/>' +
        (c.dot ? '<circle cx="' + c.dot[0] + '" cy="' + c.dot[1] + '" r="2.8" fill="#1A1714"/>' : '');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 240 360"><rect width="240" height="360" fill="#F6E9D7"/>' + HAIR + map + '</svg>';
  }
  // One line if the name fits at a good size; very long names (República Dominicana) go to two lines.
  // One line if the name fits at a good size; very long names (República Dominicana) go to two lines.
  function fitCountry() {
    if (!fromEl) return;
    var em = 2.5;
    fromEl.style.whiteSpace = 'nowrap'; fromEl.style.fontSize = '';
    while (fromEl.scrollWidth > fromEl.clientWidth + 1 && em > 1.75) { em -= 0.05; fromEl.style.fontSize = em.toFixed(2) + 'em'; }
    if (fromEl.scrollWidth <= fromEl.clientWidth + 1) return;
    fromEl.style.whiteSpace = 'normal'; em = 2.1; fromEl.style.fontSize = em + 'em';
    while (fromEl.scrollWidth > fromEl.clientWidth + 1 && em > 1.1) { em -= 0.05; fromEl.style.fontSize = em.toFixed(2) + 'em'; }
  }
  var NAMES = {}, shapeCache = {}, current = '';
  function loadShape(code) {
    var key = code || 'latam';
    if (shapeCache[key]) return Promise.resolve(shapeCache[key]);
    return fetch('assets/data/solubcard/shapes/' + key + '.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { shapeCache[key] = d; return d; }).catch(function () { return null; });
  }
  function showCountry(code) {
    current = code;
    var name = code ? (NAMES[code] || code.toUpperCase()) : 'Your country';
    if (fromEl) fromEl.textContent = name;
    setFlag(code);
    fitCountry();
    card.setAttribute('aria-label', 'SolubCard' + (code ? ' from ' + name : '') + '. Drag to swing it, press Enter to flip it over.');
    if (artEl && !artEl.getAttribute('src')) artEl.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSVG(null));
    loadShape(code).then(function (shape) {
      if (current !== code || !artEl) return; // a newer choice won
      artEl.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSVG(shape));
    });
  }
  showCountry('');
  // Every country in the world, one A–Z list grouped by first letter (no country is set apart).
  fetch('assets/data/solubcard/countries.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
    if (!list) return;
    var groups = {}, order = [];
    list.forEach(function (c) {
      NAMES[c[0]] = c[1];
      var letter = c[1].normalize('NFD').charAt(0).toUpperCase();
      if (!groups[letter]) { groups[letter] = ''; order.push(letter); }
      groups[letter] += '<option value="' + c[0] + '">' + c[1].replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>';
    });
    if (countrySel) {
      var keep = countrySel.value;
      countrySel.innerHTML = '<option value="">Choose your country</option>' +
        order.map(function (l) { return '<optgroup label="' + l + '">' + groups[l] + '</optgroup>'; }).join('');
      countrySel.value = keep;
    }
  }).catch(function () {});
  if (countrySel) {
    countrySel.addEventListener('change', function () {
      showCountry(countrySel.value);
      if (spinTarget !== 0) flip(); // show the front, where the country is
    });
  }

  // ---- physics -------------------------------------------------------------
  function integrate(pts, dt, g, damping) {
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!p.w) continue;
      var vx = (p.x - p.px) * damping, vy = (p.y - p.py) * damping;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g * dt * dt;
    }
  }
  function solve(pts, links, iterations) {
    for (var k = 0; k < iterations; k++) {
      for (var n = 0; n < links.length; n++) {
        var a = pts[links[n][0]], b = pts[links[n][1]], rest = links[n][2];
        var ws = a.w + b.w;
        if (!ws) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.hypot(dx, dy) || 1e-6;
        var f = (d - rest) / (d * ws);
        a.x += dx * f * a.w; a.y += dy * f * a.w;
        b.x -= dx * f * b.w; b.y -= dy * f * b.w;
      }
    }
  }
  function spinStep(s, target, dt, drive) {
    s.v += (-(s.a - target) * 18 - s.v * 3.2 + drive) * dt;
    s.a += s.v * dt;
  }

  // ---- printed strap texture -------------------------------------------------
  function drawSun(c, cx, cy, r) {
    c.save(); c.translate(cx, cy);
    c.lineWidth = Math.max(0.8, r * 0.03);
    [1, 0.62, 0.4].forEach(function (k) { c.beginPath(); c.arc(0, 0, r * k, 0, Math.PI * 2); c.stroke(); });
    for (var i = 0; i < 16; i++) {
      c.save(); c.rotate((i / 16) * Math.PI * 2);
      c.beginPath(); c.moveTo(-r * 0.05, -r * 0.42); c.lineTo(0, -r * 0.6); c.lineTo(r * 0.05, -r * 0.42); c.fill();
      c.restore();
    }
    c.beginPath(); c.arc(0, 0, r * 0.14, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function makeStrap(length, width, dpr, o) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(width * dpr));
    c.height = Math.max(1, Math.round(length * dpr));
    var x2 = c.getContext('2d');
    x2.setTransform(0, dpr, -dpr, 0, c.width, 0); // x runs down the strap, y across it
    x2.fillStyle = o.color; x2.fillRect(0, 0, length, width);
    x2.strokeStyle = x2.fillStyle = o.ink;
    if (!o.plain) {
      x2.save(); x2.beginPath(); x2.rect(0, 0, length, width); x2.clip();
      x2.textBaseline = 'middle';
      var textFont = '800 ' + Math.round(width * 0.46) + 'px ' + FONT;
      var labelFont = '900 ' + Math.round(width * 0.34) + 'px ' + FONT;
      x2.font = textFont; var textW = x2.measureText(o.text).width;
      x2.font = labelFont; var labelW = x2.measureText(o.label).width;
      var gap = width * 0.6, x = width * 0.4, flip = 1;
      while (x < length) {
        x2.globalAlpha = 0.5;
        drawSun(x2, x + width * 1.3, width * (0.5 + flip * 0.28), width * 1.35);
        x += width * 2.8;
        x2.globalAlpha = 0.95;
        x2.font = textFont; x2.fillText(o.text, x, width * 0.53); x += textW + gap;
        x2.font = labelFont; x2.fillText('—  ' + o.label + '  —', x, width * 0.54);
        x += labelW + x2.measureText('—    —').width + gap;
        flip = -flip;
      }
      x2.restore();
    }
    x2.globalAlpha = 0.35; x2.lineWidth = 1; x2.beginPath();
    x2.moveTo(0, 1.5); x2.lineTo(length, 1.5); x2.moveTo(0, width - 1.5); x2.lineTo(length, width - 1.5); x2.stroke();
    return c;
  }

  // ---- state -----------------------------------------------------------------
  var STEP = 1 / 120, GRAVITY = 2400, ITER = 18, N = 14;
  var cw, ch, ringR, clipH, sw, lowLen, arm;
  var pts = [], links = [], left = [], right = [], low = [], iB = 0, iT = 0, iC = 0;
  var strandRest = 1, dpr = 1, W = 1, H = 1, strapTex = null, plainTex = null;
  var spin = { a: 0, v: 0 }, spinTarget = 0;

  function add(x, y, w) { pts.push({ x: x, y: y, px: x, py: y, w: w }); return pts.length - 1; }
  function strand(from, to, n, slack) {
    var a = pts[from], b = pts[to];
    var rest = (Math.hypot(b.x - a.x, b.y - a.y) * slack) / n;
    var ids = [from];
    for (var i = 1; i < n; i++) ids.push(add(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 1));
    ids.push(to);
    for (var k = 0; k < n; k++) links.push([ids[k], ids[k + 1], rest]);
    return { ids: ids, rest: rest };
  }

  function sizeCard() {
    cw = root.clientWidth < 420 ? 200 : 236;
    ch = Math.round(cw * 1.5);
    ringR = Math.max(7, Math.round(cw * 0.036));
    clipH = Math.round(cw * 0.1);
    sw = Math.max(14, Math.round(cw * 0.1));
    lowLen = sw * 2.2;
    arm = ringR * 2 + clipH + ch * 0.55;
    card.style.width = cw + 'px';
    card.style.height = (ch + ringR + clipH) + 'px';
    card.style.setProperty('--s', (cw / 240).toFixed(3));
    inner.style.top = (ringR + clipH * 0.6) + 'px';
    inner.style.height = ch + 'px';
  }

  function build() {
    sizeCard();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, root.clientWidth); H = Math.max(1, root.clientHeight);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    pts = []; links = [];
    var cx = W / 2;
    var spread = Math.min(W * 0.16, cw * 0.55);
    var top = -sw * 2;
    var bY = Math.max(H * 0.16, Math.min(H * 0.42, H - (lowLen + ringR * 2 + clipH + ch) - 28));
    var aL = add(cx - spread, top, 0);
    iB = add(cx, bY, 1.4);
    var l = strand(aL, iB, N, 1.03);
    var aR = add(cx + spread, top, 0);
    var r = strand(aR, iB, N, 1.03);
    iT = add(cx, bY + lowLen, 0.8);
    var lo = strand(iB, iT, 3, 1);
    iC = add(cx, bY + lowLen + arm, 0.25);
    links.push([iT, iC, arm]);
    left = l.ids; right = r.ids; low = lo.ids; strandRest = l.rest;
    strapTex = makeStrap(strandRest * N + 4, sw, dpr, STRAP);
    plainTex = makeStrap(lowLen + 4, sw * 0.8, dpr, { color: STRAP.color, ink: STRAP.ink, plain: true });
    if (reduceMotion) {
      for (var i = 0; i < 900; i++) { integrate(pts, STEP, GRAVITY, 0.98); solve(pts, links, ITER); }
    } else {
      pts[iC].x += cw * 0.55; pts[iC].px = pts[iC].x - 2; // enter mid-swing
      spin.v = 5;
    }
  }

  // ---- drawing ---------------------------------------------------------------
  function ribbon(ids, tex, rest, light) {
    var Wt = tex.width;
    for (var i = 0; i < ids.length - 1; i++) {
      var a = pts[ids[i]], b = pts[ids[i + 1]];
      var dx = (b.x - a.x) * dpr, dy = (b.y - a.y) * dpr;
      var len = Math.hypot(dx, dy) || 1e-6;
      var tx = dx / len, ty = dy / len, nx = ty, ny = -tx;
      var v0 = i * rest * dpr, dv = rest * dpr, k = len / dv;
      ctx.setTransform(nx, ny, tx * k, ty * k, a.x * dpr - (nx * Wt) / 2 - tx * k * v0, a.y * dpr - (ny * Wt) / 2 - ty * k * v0);
      var src = Math.min(dv + 1.5, tex.height - v0);
      if (src > 0) ctx.drawImage(tex, 0, v0, Wt, src, 0, v0, Wt, src);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.22 * (1 - Math.max(0, nx * light))).toFixed(3) + ')';
      ctx.fillRect(0, v0, Wt, dv + 1);
    }
  }
  function metal(x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, BEIGE); g.addColorStop(0.45, '#8C857C'); g.addColorStop(0.55, '#5E5852'); g.addColorStop(1, BEIGE);
    return g;
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!strapTex || !plainTex) return;
    ribbon(left, strapTex, strandRest, -1);
    ribbon(right, strapTex, strandRest, 1);
    ribbon(low, plainTex, lowLen / 3, 0);
    var B = pts[iB], T = pts[iT];
    var ang = Math.atan2(T.x - B.x, T.y - B.y), u = sw / 20;
    ctx.setTransform(dpr, 0, 0, dpr, B.x * dpr, B.y * dpr);
    ctx.rotate(-ang);
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6 * dpr; ctx.shadowOffsetY = 2 * dpr;
    ctx.fillStyle = metal(-16 * u, 0, 16 * u, 0);
    rrect(-15 * u, -14 * u, 30 * u, 17 * u, 3 * u); ctx.fill();
    rrect(-11 * u, 1 * u, 22 * u, 15 * u, 3 * u); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(26,23,20,0.55)';
    ctx.fillRect(-10 * u, -9 * u, 20 * u, 2.2 * u);
    ctx.fillRect(-5 * u, 6 * u, 10 * u, 3 * u);
    ctx.setTransform(dpr, 0, 0, dpr, T.x * dpr, (T.y + ringR * 0.8) * dpr);
    ctx.lineWidth = Math.max(2.5, ringR * 0.38);
    ctx.strokeStyle = metal(-ringR, -ringR, ringR, ringR);
    ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
  }
  function place() {
    var T = pts[iT], C = pts[iC];
    var swing = Math.atan2(C.x - T.x, C.y - T.y);
    card.style.transform = 'translate3d(' + (T.x - cw / 2).toFixed(2) + 'px,' + (T.y + ringR).toFixed(2) + 'px,0) rotate(' + (-swing).toFixed(4) + 'rad)';
    inner.style.transform = 'perspective(1100px) rotateY(' + spin.a.toFixed(4) + 'rad)';
    inner.style.setProperty('--ly-dim', ((1 - Math.abs(Math.cos(spin.a))) * 0.5).toFixed(3));
    inner.style.setProperty('--ly-shine', (50 + Math.sin(spin.a) * 70 + swing * 90).toFixed(1) + '%');
  }

  // ---- interaction -----------------------------------------------------------
  var drag = null;
  function local(e) { var r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function setBack(back) {
    var v = back ? 'true' : 'false';
    card.setAttribute('aria-pressed', v);
    if (btn) { btn.setAttribute('aria-pressed', v); btn.textContent = back ? 'Show front' : 'Show back'; }
  }
  function flip() { spinTarget = spinTarget === 0 ? Math.PI : 0; setBack(spinTarget !== 0); wake(); }
  card.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    var p = local(e), T = pts[iT];
    drag = { id: e.pointerId, ox: T.x - p[0], oy: T.y - p[1], tx: T.x, ty: T.y, sx: p[0], sy: p[1], moved: false };
    pts[iT].w = 0;
    card.setPointerCapture(e.pointerId);
    card.style.cursor = 'grabbing';
    wake();
  });
  card.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = local(e);
    drag.tx = p[0] + drag.ox; drag.ty = p[1] + drag.oy;
    if (Math.hypot(p[0] - drag.sx, p[1] - drag.sy) > 5) drag.moved = true;
  });
  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) flip();
    drag = null; pts[iT].w = 0.8; card.style.cursor = 'grab';
  }
  card.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', up);
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  if (btn) btn.addEventListener('click', flip);

  // ---- loop (runs only while the card is on screen) ---------------------------
  var raf = 0, acc = 0, last = 0, t = 0, visible = true;
  function tick(now) {
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    var steps = 0;
    while (acc >= STEP && steps < 8) {
      acc -= STEP; steps++; t += STEP;
      if (drag) { var T = pts[iT]; T.px = T.x; T.py = T.y; T.x += (drag.tx - T.x) * 0.35; T.y += (drag.ty - T.y) * 0.35; }
      var C = pts[iC];
      if (!reduceMotion && !drag) C.x += (22 * Math.sin(t * 0.7) + 12 * Math.sin(t * 1.9)) * STEP * STEP; // a light draught
      integrate(pts, STEP, GRAVITY, 0.992);
      solve(pts, links, ITER);
      spinStep(spin, spinTarget, STEP, (C.x - C.px) / STEP * 0.03 + (reduceMotion ? 0 : 0.6 * Math.sin(t * 0.5)));
    }
    draw(); place();
    raf = visible ? requestAnimationFrame(tick) : 0;
  }
  function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  spinTarget = 0; spin.a = 0;
  build(); draw(); place(); wake(); fitCountry();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); draw(); place(); fitCountry(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) wake(); }).observe(root);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      if (Math.abs(root.clientWidth - W) < 1 && Math.abs(root.clientHeight - H) < 1) return;
      build(); draw(); place(); fitCountry();
    }).observe(root);
  }
})();
