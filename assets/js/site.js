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

  (function cultureWords() {
    var chips = document.querySelectorAll('.country-chip');
    var cards = document.querySelectorAll('.word-card');
    if (!cards.length) return;
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        card.setAttribute('aria-pressed', card.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      });
    });
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var country = chip.getAttribute('data-country');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        cards.forEach(function (card) {
          var keys = card.getAttribute('data-countries').split(' ');
          card.hidden = country !== 'all' && keys.indexOf(country) === -1;
        });
      });
    });
  })();

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
