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
      renderGallery(data.gallery);
      renderArticles(data.articles);
      window.PODsite = { data: data, renderGallery: renderGallery, renderArticles: renderArticles, applyTexts: applyTexts };
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
