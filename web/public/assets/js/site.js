/* Verejná časť webu: hydratácia z /api/site, galéria + lightbox, článok overlay,
   aplikovanie uloženej témy a inline textov. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- téma: vlož uložený CSS override + prípadné fonty ---- */
  window.PODtheme = {
    applyCss: function (css) {
      var el = document.getElementById('pod-theme-overrides');
      if (el) el.textContent = css || '';
    },
    ensureFont: function (vars) {
      if (!vars) return;
      var fams = [];
      [vars.fontHeading, vars.fontBody].forEach(function (f) {
        if (f && fams.indexOf(f) === -1) fams.push(f);
      });
      if (!fams.length) return;
      var href = 'https://fonts.googleapis.com/css2?' +
        fams.map(function (f) { return 'family=' + f.replace(/ /g, '+') + ':wght@400;500;600;700'; }).join('&') +
        '&display=swap';
      var link = document.getElementById('pod-fonts');
      if (link && link.href !== href) link.href = href;
    }
  };

  /* ---- inline texty ---- */
  function applyTexts(texts) {
    if (!texts) return;
    Object.keys(texts).forEach(function (id) {
      var node = document.querySelector('[data-edit="' + id + '"]');
      if (node) node.innerHTML = texts[id];
    });
  }

  /* ---- klikacie obrázky: <a data-img-link="kľúč"> + texts["kľúč.href"] ---- */
  function applyImageLinks(texts) {
    texts = texts || {};
    $$('a[data-img-link]').forEach(function (a) {
      var url = (texts[a.getAttribute('data-img-link') + '.href'] || '').trim();
      if (url) {
        a.setAttribute('href', url);
        if (/^https?:\/\//i.test(url)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        } else {
          a.removeAttribute('target');
          a.removeAttribute('rel');
        }
      } else {
        a.removeAttribute('href');
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
  }

  /* ---- kontaktné údaje / odkazy (telefón, e-mail, Facebook, tlačidlo rezervácie) ---- */
  var contactDefaults = null;
  function snapshotContactDefaults() {
    if (contactDefaults) return;
    contactDefaults = { phone: '', email: '', facebook: '', booking: '#dostupnost' };
    var p = $('[data-contact="phone"]'); if (p) contactDefaults.phone = p.textContent.trim();
    var e = $('[data-contact="email"]'); if (e) contactDefaults.email = e.textContent.trim();
    var f = $('[data-contact="facebook"]'); if (f) contactDefaults.facebook = f.getAttribute('href') || '';
    var b = $('[data-contact="booking"]'); if (b) contactDefaults.booking = b.getAttribute('href') || '#kontakt';
  }
  function telHref(v) { return 'tel:' + String(v).replace(/[^\d+]/g, ''); }
  function applyContact(cfg) {
    snapshotContactDefaults();
    cfg = cfg || {};
    var phone = (cfg.phone || '').trim() || contactDefaults.phone;
    var email = (cfg.email || '').trim() || contactDefaults.email;
    var facebook = (cfg.facebook || '').trim() || contactDefaults.facebook;
    var booking = (cfg.bookingUrl || '').trim() || contactDefaults.booking;

    $$('[data-contact="phone"]').forEach(function (el) {
      el.textContent = phone;
      var a = el.tagName === 'A' ? el : el.closest('a');
      if (a && /^tel:/i.test(a.getAttribute('href') || '')) a.setAttribute('href', telHref(phone));
    });
    $$('[data-contact="email"]').forEach(function (el) {
      el.textContent = email;
      var a = el.tagName === 'A' ? el : el.closest('a');
      if (a && /^mailto:/i.test(a.getAttribute('href') || '')) a.setAttribute('href', 'mailto:' + email);
    });
    $$('a[data-contact="email-link"]').forEach(function (a) {
      var q = (a.getAttribute('href') || '').split('?')[1];
      a.setAttribute('href', 'mailto:' + email + (q ? '?' + q : ''));
    });
    $$('a[data-contact="facebook"]').forEach(function (a) {
      a.setAttribute('href', facebook);
    });
    $$('a[data-contact="booking"]').forEach(function (a) {
      a.setAttribute('href', booking);
      if (/^https?:\/\//i.test(booking)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      } else {
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    });
  }

  /* ---- kalendár dostupnosti + dopytový formulár ---- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function toYmd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addYmd(ymd, n) { var d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return toYmd(d); }
  var MONTHS_SK = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
  var DOW_SK = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];

  var availState = { rooms: [], busy: [], y: 0, m: 0, today: '', note: '' };

  // stav dňa pre izbu: 'occupied' (potvrdené) > 'reserved' (držaná rezervácia) > 'free'
  function dayState(roomId, dayYmd) {
    var st = 'free';
    availState.busy.forEach(function (b) {
      if (b.room_id === roomId && b.start_date <= dayYmd && dayYmd < b.end_date) {
        if (b.status === 'confirmed') st = 'occupied';
        else if (st !== 'occupied') st = 'reserved';
      }
    });
    return st;
  }
  function rangeState(roomId, start, end) {
    var st = 'free';
    availState.busy.forEach(function (b) {
      if (b.room_id === roomId && start < b.end_date && b.start_date < end) {
        if (b.status === 'confirmed') st = 'occupied';
        else if (st !== 'occupied') st = 'reserved';
      }
    });
    return st;
  }

  function initAvailability() {
    var root = document.getElementById('avail');
    if (!root) return;
    var now = new Date();
    availState.today = toYmd(now);
    if (!availState.y) { availState.y = now.getFullYear(); availState.m = now.getMonth(); }
    var to = new Date(now.getFullYear(), now.getMonth() + 8, 1);
    return fetch('/api/availability?from=' + availState.today + '&to=' + toYmd(to))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        availState.rooms = d.rooms || [];
        availState.busy = d.busy || [];
        renderAvail();
      })
      .catch(function () { root.innerHTML = '<p class="muted">Kalendár sa nepodarilo načítať.</p>'; });
  }

  function renderAvail() {
    var root = document.getElementById('avail');
    if (!root) return;
    var y = availState.y, m = availState.m;
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7;         // 0 = pondelok
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var canPrev = !(y === new Date().getFullYear() && m <= new Date().getMonth());

    var html = '' +
      '<div class="avail__nav">' +
      '<button type="button" class="avail__arrow" data-nav="-1"' + (canPrev ? '' : ' disabled') + ' aria-label="Predchádzajúci mesiac">‹</button>' +
      '<strong>' + MONTHS_SK[m] + ' ' + y + '</strong>' +
      '<button type="button" class="avail__arrow" data-nav="1" aria-label="Nasledujúci mesiac">›</button>' +
      '</div>' +
      '<div class="avail__grid avail__grid--dow">' + DOW_SK.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
      '<div class="avail__grid" id="avail-days">';

    for (var i = 0; i < startDow; i++) html += '<span class="avail__day avail__day--out"></span>';
    for (var day = 1; day <= daysInMonth; day++) {
      var ds = y + '-' + pad2(m + 1) + '-' + pad2(day);
      var past = ds < availState.today;
      var states = availState.rooms.map(function (room) { return dayState(room.id, ds); });
      var cells = availState.rooms.map(function (room, ri) {
        var s = states[ri];
        var lbl = s === 'occupied' ? ' – obsadené' : s === 'reserved' ? ' – rezervované' : ' – voľné';
        return '<span class="avail__room' + (s !== 'free' ? ' is-' + s : '') + '" title="' + room.name + lbl + '">' + room.id + '</span>';
      }).join('');
      var allFull = states.every(function (s) { return s !== 'free'; });
      html += '<button type="button" class="avail__day' + (past ? ' avail__day--past' : '') + (allFull ? ' is-full' : '') + '"' +
        (past ? ' disabled' : ' data-day="' + ds + '"') + '>' +
        '<span class="avail__daynum">' + day + '</span><span class="avail__rooms">' + cells + '</span></button>';
    }
    html += '</div>' +
      '<div class="avail__legend">' +
      '<span><i class="avail__sw"></i> voľné</span>' +
      '<span><i class="avail__sw is-reserved"></i> rezervované</span>' +
      '<span><i class="avail__sw is-occupied"></i> obsadené</span>' +
      '<span class="muted">Čísla 1–3 = štúdiá. Kliknite na voľný deň a rezervujte.</span></div>' +
      '<div id="avail-form"></div>';

    if (availState.note) {
      html = '<p class="inq__msg inq__msg--ok" style="margin:0 0 16px">' + availState.note + '</p>' + html;
    }
    root.innerHTML = html;
    root.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = +b.dataset.nav;
        var nm = availState.m + dir;
        availState.y += Math.floor(nm / 12);
        availState.m = ((nm % 12) + 12) % 12;
        renderAvail();
      });
    });
    root.querySelectorAll('[data-day]').forEach(function (b) {
      b.addEventListener('click', function () { openInquiry(b.dataset.day); });
    });
  }

  function openInquiry(dayYmd) {
    var box = document.getElementById('avail-form');
    if (!box) return;
    var rooms = availState.rooms;
    var firstFree = rooms.find(function (r) { return rangeState(r.id, dayYmd, addYmd(dayYmd, 1)) === 'free'; }) || rooms[0];

    box.innerHTML = '' +
      '<form class="inq" novalidate>' +
      '<h3>Rezervácia ubytovania</h3>' +
      '<div class="inq__grid">' +
      '<label>Príchod<input type="date" name="start" value="' + dayYmd + '" min="' + availState.today + '" required></label>' +
      '<label>Odchod<input type="date" name="end" value="' + addYmd(dayYmd, 1) + '" min="' + addYmd(dayYmd, 1) + '" required></label>' +
      '<label>Štúdio<select name="room">' + rooms.map(function (r) {
        return '<option value="' + r.id + '"' + (r.id === (firstFree && firstFree.id) ? ' selected' : '') + '>' + r.name + '</option>';
      }).join('') + '</select></label>' +
      '<label>Meno a priezvisko<input type="text" name="name" required></label>' +
      '<label>E-mail<input type="email" name="email" required></label>' +
      '<label>Telefón<input type="tel" name="phone" required></label>' +
      '</div>' +
      '<label class="inq__full">Poznámka (počet osôb, otázky…)<textarea name="note" rows="2"></textarea></label>' +
      '<p class="inq__hint" id="inq-hint"></p>' +
      '<div class="inq__actions"><button type="submit" class="btn btn--primary">Rezervovať termín</button>' +
      '<button type="button" class="btn btn--ghost" id="inq-cancel">Zrušiť</button></div>' +
      '<p class="inq__msg" id="inq-msg" hidden></p>' +
      '</form>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    var form = box.querySelector('form');
    var hint = box.querySelector('#inq-hint');
    var submitBtn = form.querySelector('button[type=submit]');
    function check() {
      var rid = +form.room.value, s = form.start.value, e = form.end.value;
      if (!s || !e || e <= s) { hint.textContent = 'Zadajte platný termín (odchod po príchode).'; submitBtn.disabled = true; return; }
      form.end.min = addYmd(s, 1);
      var st = rangeState(rid, s, e);
      if (st === 'occupied') { hint.textContent = '⚠ Tento termín je už obsadený. Vyberte iný.'; submitBtn.disabled = true; }
      else if (st === 'reserved') { hint.textContent = '⚠ Tento termín je už predbežne rezervovaný. Vyberte iný.'; submitBtn.disabled = true; }
      else { hint.textContent = ''; submitBtn.disabled = false; }
    }
    ['change', 'input'].forEach(function (ev) { form.addEventListener(ev, check); });
    check();
    box.querySelector('#inq-cancel').addEventListener('click', function () { box.innerHTML = ''; });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = box.querySelector('#inq-msg');
      var payload = {
        room_id: +form.room.value, start_date: form.start.value, end_date: form.end.value,
        name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(), note: form.note.value.trim()
      };
      if (!payload.name || !payload.email || !payload.phone) {
        msg.hidden = false; msg.className = 'inq__msg inq__msg--warn'; msg.textContent = 'Vyplňte meno, e-mail aj telefón.';
        return;
      }
      submitBtn.disabled = true; submitBtn.textContent = 'Odosielam…';
      fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
        .then(function (res) {
          if (!res.ok) {
            submitBtn.disabled = false; submitBtn.textContent = 'Rezervovať termín';
            msg.hidden = false; msg.className = 'inq__msg inq__msg--warn'; msg.textContent = res.b.error || 'Rezerváciu sa nepodarilo odoslať.';
            return;
          }
          availState.note = 'Rezerváciu sme prijali. Termín je predbežne rezervovaný – ozveme sa vám s potvrdením.';
          initAvailability(); // znovu načíta a prekreslí kalendár (nový termín bude „rezervované")
        })
        .catch(function () {
          submitBtn.disabled = false; submitBtn.textContent = 'Rezervovať termín';
          msg.hidden = false; msg.className = 'inq__msg inq__msg--warn'; msg.textContent = 'Chyba spojenia, skúste znova.';
        });
    });
  }

  /* ---- hero slider (fotky z theme_vars.heroImages) ---- */
  var heroTimer = null;
  function renderHero(themeVars) {
    var hero = document.getElementById('domov');
    if (!hero) return;
    var v = themeVars || {};
    var imgs = Array.isArray(v.heroImages) ? v.heroImages.filter(Boolean) : [];
    if (!imgs.length && v.heroImage) imgs = [v.heroImage];
    if (!imgs.length) return;

    var slides = hero.querySelector('.hero__slides');
    if (!slides) {
      slides = document.createElement('div');
      slides.className = 'hero__slides';
      slides.setAttribute('aria-hidden', 'true');
      hero.insertBefore(slides, hero.firstChild);
    }
    slides.innerHTML = '';
    imgs.forEach(function (url, i) {
      var s = document.createElement('div');
      s.className = 'hero__slide' + (i === 0 ? ' is-active' : '');
      s.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
      slides.appendChild(s);
    });

    var oldDots = hero.querySelector('.hero__dots');
    if (oldDots) oldDots.remove();
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (imgs.length < 2 || reduce) return;

    var dots = document.createElement('div');
    dots.className = 'hero__dots';
    var cur = 0;
    function go(n) {
      cur = (n + imgs.length) % imgs.length;
      $$('.hero__slide', slides).forEach(function (el, i) { el.classList.toggle('is-active', i === cur); });
      $$('button', dots).forEach(function (b, i) { b.classList.toggle('is-active', i === cur); });
    }
    function restart() {
      if (heroTimer) clearInterval(heroTimer);
      heroTimer = setInterval(function () { go(cur + 1); }, 6000);
    }
    imgs.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Fotka ' + (i + 1));
      if (i === 0) b.className = 'is-active';
      b.addEventListener('click', function () { go(i); restart(); });
      dots.appendChild(b);
    });
    hero.appendChild(dots);
    restart();
  }

  /* ---- galéria + lightbox ---- */
  var allGallery = [];   // celý zoznam z API
  var gallery = [];      // aktuálne zobrazený (filtrovaný) zoznam – po ňom chodí lightbox
  var galleryCat = 'all';
  function renderGallery(items) {
    // fotky kategórie 'clanky' sú len na vkladanie do článkov – vo verejnej galérii sa nezobrazujú
    allGallery = (items || []).filter(function (g) { return g.category !== 'clanky'; });
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;

    var bar = document.getElementById('gallery-filter');
    if (bar) {
      var cats = {};
      allGallery.forEach(function (g) { if (g.category) cats[g.category] = 1; });
      var multi = Object.keys(cats).length > 1;
      bar.hidden = !multi;
      if (!multi) galleryCat = 'all';
      if (!bar.dataset.bound) {
        bar.dataset.bound = '1';
        bar.addEventListener('click', function (e) {
          var btn = e.target.closest('button[data-cat]');
          if (!btn) return;
          galleryCat = btn.dataset.cat;
          $$('button', bar).forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          paintGallery();
        });
      }
      $$('button', bar).forEach(function (b) { b.classList.toggle('is-active', b.dataset.cat === galleryCat); });
    }
    paintGallery();
  }
  function paintGallery() {
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;
    gallery = galleryCat === 'all'
      ? allGallery.slice()
      : allGallery.filter(function (g) { return g.category === galleryCat; });
    if (!gallery.length) { grid.innerHTML = '<p class="muted">V tejto kategórii zatiaľ nie sú fotky.</p>'; return; }
    grid.innerHTML = '';
    gallery.forEach(function (img, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', img.alt || 'Fotka');
      b.innerHTML = '<img loading="lazy" src="' + img.url + '" alt="' + (img.alt || '') + '">';
      b.addEventListener('click', function () { openLightbox(i); });
      grid.appendChild(b);
    });
  }

  var lbIndex = 0;
  function openLightbox(i) {
    lbIndex = i;
    var lb = document.getElementById('lightbox');
    $('#lightbox-img').src = gallery[i].url;
    $('#lightbox-img').alt = gallery[i].alt || '';
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
  }
  function moveLightbox(d) {
    if (!gallery.length) return;
    lbIndex = (lbIndex + d + gallery.length) % gallery.length;
    $('#lightbox-img').src = gallery[lbIndex].url;
    $('#lightbox-img').alt = gallery[lbIndex].alt || '';
  }
  function closeLightbox() {
    var lb = document.getElementById('lightbox');
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
  }
  (function bindLightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    $('.lightbox__close', lb).addEventListener('click', closeLightbox);
    $('.lightbox__prev', lb).addEventListener('click', function () { moveLightbox(-1); });
    $('.lightbox__next', lb).addEventListener('click', function () { moveLightbox(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') moveLightbox(-1);
      if (e.key === 'ArrowRight') moveLightbox(1);
    });
  })();

  /* ---- blog ---- */
  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s.replace(' ', 'T'));
    if (isNaN(d)) return s;
    return d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function articleCard(a) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'article-card';
    card.setAttribute('data-slug', a.slug);
    card.innerHTML =
      '<div class="article-card__media">' +
      (a.cover_url ? '<img loading="lazy" src="' + esc(a.cover_url) + '" alt="">' : '') +
      '</div>' +
      '<div class="article-card__body">' +
      '<time>' + fmtDate(a.published_at) + '</time>' +
      '<h3>' + esc(a.title) + '</h3>' +
      '<p>' + esc(a.excerpt || '') + '</p>' +
      '</div>';
    card.addEventListener('click', function () { openArticle(a.slug); });
    return card;
  }
  function renderArticleGrid(gridId, items, emptyMsg) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    if (!items.length) {
      grid.hidden = !emptyMsg;
      if (emptyMsg) grid.innerHTML = '<p class="muted">' + emptyMsg + '</p>';
      return;
    }
    grid.hidden = false;
    items.forEach(function (a) { grid.appendChild(articleCard(a)); });
  }
  function renderArticles(items) {
    items = items || [];
    renderArticleGrid('article-grid', items.filter(function (a) { return (a.section || 'blog') === 'blog'; }), 'Zatiaľ tu nie sú žiadne články.');
    renderArticleGrid('okolie-grid', items.filter(function (a) { return a.section === 'okolie'; }), null);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- článok overlay ---- */
  function openArticle(slug) {
    var ov = document.getElementById('article-overlay');
    var box = document.getElementById('article-overlay-content');
    box.innerHTML = '<div class="article-overlay__body"><p class="muted">Načítavam…</p></div>';
    ov.classList.add('is-open');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (location.hash !== '#clanok/' + slug) history.pushState(null, '', '#clanok/' + slug);
    fetch('/api/articles/' + encodeURIComponent(slug))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (a) {
        box.innerHTML =
          (a.cover_url ? '<img src="' + a.cover_url + '" alt="">' : '') +
          '<div class="article-overlay__body">' +
          '<time>' + fmtDate(a.published_at) + '</time>' +
          '<h1>' + esc(a.title) + '</h1>' +
          a.body_html +
          '</div>';
        ov.scrollTop = 0;
      })
      .catch(function () {
        box.innerHTML = '<div class="article-overlay__body"><p>Článok sa nepodarilo načítať.</p></div>';
      });
  }
  function closeArticle() {
    var ov = document.getElementById('article-overlay');
    ov.classList.remove('is-open');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (location.hash.indexOf('#clanok/') === 0) history.pushState(null, '', location.pathname + location.search);
  }
  (function bindArticle() {
    var ov = document.getElementById('article-overlay');
    if (!ov) return;
    $('.article-overlay__close', ov).addEventListener('click', closeArticle);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeArticle(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('is-open')) closeArticle();
    });
    window.addEventListener('popstate', function () {
      if (location.hash.indexOf('#clanok/') === 0) openArticle(location.hash.slice(8));
      else closeArticle();
    });
  })();

  /* ---- navigácia (mobil + aktívna sekcia) ---- */
  (function nav() {
    var toggle = $('.nav-toggle');
    var menu = $('.main-nav');
    if (toggle && menu) {
      toggle.addEventListener('click', function () {
        var open = menu.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      menu.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') { menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
      });
    }
    var links = $$('.main-nav a');
    var map = {};
    links.forEach(function (l) { var id = l.getAttribute('href').slice(1); if (id) map[id] = l; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (l) { l.classList.remove('is-active'); });
          map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) obs.observe(s); });
  })();

  /* ---- štart ---- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  fetch('/api/site')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      window.PODtheme.ensureFont(data.theme_vars);
      window.PODtheme.applyCss(data.theme_css);
      applyTexts(data.texts);
      applyImageLinks(data.texts);
      applyContact(data.contact);
      renderHero(data.theme_vars);
      initAvailability();
      renderGallery(data.gallery);
      renderArticles(data.articles);
      window.PODsite = { data: data, renderGallery: renderGallery, renderArticles: renderArticles, applyTexts: applyTexts, applyImageLinks: applyImageLinks, applyContact: applyContact, renderHero: renderHero };
      if (location.hash.indexOf('#clanok/') === 0) openArticle(location.hash.slice(8));
      document.dispatchEvent(new CustomEvent('pod:site-ready', { detail: data }));
    })
    .catch(function () {
      var g = document.getElementById('gallery-grid');
      if (g) g.innerHTML = '<p class="muted">Galériu sa nepodarilo načítať.</p>';
      var a = document.getElementById('article-grid');
      if (a) a.innerHTML = '<p class="muted">Články sa nepodarilo načítať.</p>';
    });
})();
