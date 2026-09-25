/* Admin režim: overí prihlásenie, pridá ⚙ panel (CSS editor), správu článkov a galérie.
   Beží na každej stránke; UI sa zobrazí len prihlásenému správcovi.
   Na /admin (body[data-admin-page="login"]) vykreslí prihlasovací formulár. */
(function () {
  'use strict';

  var API = '/api';
  var j = function (url, opts) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); });
  };
  var el = function (tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  };

  var DEFAULTS = {
    accent: '#1f7a8c', accentDark: '#14566a', bg: '#ffffff', surface: '#f3f7f8',
    text: '#33403f', heading: '#1b2a2b', muted: '#6b7b7a',
    fontHeading: 'Playfair Display', fontBody: 'Poppins',
    fsBase: 17, fsH1: 46, fsH2: 31, sectionPadY: 88,
    heroMinH: 84, heroOverlayType: 'linear-bottom', heroOverlayIntensity: 56,
    heroOverlayColor: '#0d2b33', heroImage: '/assets/img/bazen-trysky.jpg',
    radius: 14, buttonStyle: 'rounded'
  };
  var FONTS = ['Playfair Display', 'Poppins', 'Montserrat', 'Lora', 'Inter', 'Oswald', 'Anton', 'Merriweather', 'Raleway', 'Cormorant Garamond'];

  /* ---------- štýly admin UI ---------- */
  function injectStyles() {
    if (document.getElementById('pod-admin-css')) return;
    var s = el('style', { id: 'pod-admin-css' });
    s.textContent = [
      '.pod-adm-fab{position:fixed;right:20px;bottom:20px;z-index:300;display:flex;flex-direction:column;gap:10px}',
      '.pod-adm-fab button{width:52px;height:52px;border-radius:50%;border:0;background:#14566a;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25)}',
      '.pod-adm-fab button:hover{background:#1f7a8c}',
      '.pod-adm-fab .lbl{font-size:10px;line-height:1;display:block}',
      '.pod-panel{position:fixed;top:0;right:0;bottom:0;width:360px;max-width:92vw;background:#1c1c1c;color:#e8e8e8;z-index:320;overflow-y:auto;transform:translateX(100%);transition:transform .25s ease;font:14px/1.5 system-ui,sans-serif;direction:rtl;scrollbar-width:thin;scrollbar-color:#555 #1c1c1c}',
      '.pod-panel>*{direction:ltr}',
      '.pod-panel::-webkit-scrollbar{width:10px}',
      '.pod-panel::-webkit-scrollbar-thumb{background:#555;border-radius:5px}',
      '.pod-panel.is-open{transform:none}',
      '.pod-panel h2{font:600 15px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;margin:0;padding:18px 18px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center}',
      '.pod-panel h3{font:700 11px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:#e0002f;margin:22px 18px 8px}',
      '.pod-panel .row{padding:6px 18px}',
      '.pod-panel label{display:block;font-size:12px;color:#aaa;margin-bottom:4px}',
      '.pod-panel input[type=color]{width:38px;height:30px;padding:0;border:1px solid #444;background:#222;vertical-align:middle}',
      '.pod-panel input[type=text]{width:120px;background:#262626;border:1px solid #444;color:#eee;padding:5px 7px;border-radius:5px}',
      '.pod-panel input[type=range]{width:100%}',
      '.pod-panel select{width:100%;background:#262626;border:1px solid #444;color:#eee;padding:6px;border-radius:5px}',
      '.pod-panel .val{float:right;color:#e0002f;font-weight:600}',
      '.pod-panel .x{background:none;border:0;color:#aaa;font-size:20px;cursor:pointer}',
      '.pod-panel .actions{padding:18px;display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid #333;margin-top:14px;position:sticky;bottom:0;background:#1c1c1c}',
      '.pod-btn{background:#e0002f;color:#fff;border:0;padding:9px 14px;border-radius:6px;cursor:pointer;font:600 13px system-ui}',
      '.pod-btn.sec{background:#333}',
      '.pod-btn.ghost{background:none;border:1px solid #555;color:#ccc}',
      '[data-edit].pod-editing{outline:2px dashed #e0002f;outline-offset:3px;cursor:text}',
      '.pod-cal{margin:6px 0 18px}',
      '.pod-cal h4{margin:0 0 6px;font:600 14px system-ui}',
      '.pod-cal__nav{display:flex;align-items:center;gap:14px;margin-bottom:10px}',
      '.pod-cal__nav strong{min-width:150px;text-align:center}',
      '.pod-cal__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}',
      '.pod-cal__grid span.dow{font:600 10px system-ui;text-align:center;color:#888;text-transform:uppercase}',
      '.pod-cal__d{border:1px solid #ddd;border-radius:5px;background:#fff;color:#222;font:600 12px system-ui;min-height:34px;cursor:pointer;padding:2px}',
      '.pod-cal__d.out{border:0;background:none;cursor:default}',
      '.pod-cal__d.past{opacity:.35;cursor:default}',
      '.pod-cal__d.manual{background:#fde2e4;border-color:#f2b8bd}',
      '.pod-cal__d.booking{background:#dfeafd;border-color:#b9d4f5;cursor:default}',
      '.pod-cal__d.pending{background:#fff2d6;border-color:#f0d79a}',
      '.pod-cal__d.sel{outline:2px solid #e0002f;outline-offset:1px}',
      '.pod-cal__d:hover:not(.out):not(.past):not(.booking){border-color:#e0002f}',
      '.pod-modal{position:fixed;inset:0;z-index:340;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:5vh 0}',
      '.pod-modal__box{background:#fff;color:#222;width:min(920px,94vw);max-height:90vh;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}',
      '.pod-modal__head{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eee;flex:0 0 auto}',
      '.pod-modal__head h3{margin:0;font:600 18px system-ui}',
      '.pod-modal__body{padding:20px;overflow-y:auto;flex:1 1 auto}',
      '.pod-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}',
      '.pod-list li{display:flex;gap:10px;align-items:center;border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px}',
      '.pod-list li img{width:60px;height:44px;object-fit:cover;border-radius:4px}',
      '.pod-list li .grow{flex:1;min-width:0}',
      '.pod-list li input[type=text]{width:100%;border:1px solid #ddd;border-radius:5px;padding:5px 7px}',
      '.pod-field{margin-bottom:14px}',
      '.pod-field label{display:block;font:600 12px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:5px}',
      '.pod-field input[type=text],.pod-field input[type=password],.pod-field textarea,.pod-field select{width:100%;border:1px solid #ccc;border-radius:6px;padding:8px;font:14px system-ui}',
      '.wz{border:1px solid #ccc;border-radius:6px;overflow:hidden}',
      '.wz-bar{display:flex;flex-wrap:wrap;gap:2px;background:#f4f4f4;border-bottom:1px solid #ddd;padding:4px}',
      '.wz-btn{background:#fff;border:1px solid #ddd;border-radius:4px;padding:4px 8px;cursor:pointer;font:12px system-ui}',
      '.wz-btn:hover{background:#eee}',
      '.wz-area{min-height:220px;max-height:80vh;padding:12px 14px;font:15px/1.6 Georgia,serif;resize:vertical;overflow:auto}',
      '.wz-area:focus{outline:none}',
      '.pod-row{display:flex;gap:12px;flex-wrap:wrap}.pod-row>*{flex:1;min-width:180px}',
      '.pod-login{max-width:380px;margin:12vh auto;padding:0 20px;font:15px/1.6 system-ui}',
      '.pod-login h1{font:600 24px system-ui;margin-bottom:6px}',
      '.pod-login input{width:100%;border:1px solid #ccc;border-radius:8px;padding:11px;margin-top:10px;font:15px system-ui}',
      '.pod-login button{width:100%;margin-top:16px;background:#14566a;color:#fff;border:0;border-radius:8px;padding:12px;font:600 15px system-ui;cursor:pointer}',
      '.pod-login .msg{margin-top:12px;color:#c00;font-size:14px}',
      '.pod-login .muted{color:#888;font-size:13px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- CSS z premenných ---------- */
  function hexToRgb(h) {
    h = (h || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function overlayCss(v) {
    var c = hexToRgb(v.heroOverlayColor), a = Math.max(0, Math.min(1, (+v.heroOverlayIntensity || 0) / 100));
    var rgba = function (m) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (Math.round(a * m * 100) / 100) + ')'; };
    switch (v.heroOverlayType) {
      case 'linear-top': return 'linear-gradient(to bottom, ' + rgba(1) + ' 0%, ' + rgba(0.2) + ' 60%, ' + rgba(0.55) + ' 100%)';
      case 'radial': return 'radial-gradient(circle at 50% 40%, ' + rgba(0.15) + ' 0%, ' + rgba(1) + ' 100%)';
      case 'solid': return 'linear-gradient(' + rgba(1) + ', ' + rgba(1) + ')';
      default: return 'linear-gradient(to top, ' + rgba(1) + ' 0%, ' + rgba(0.25) + ' 60%, ' + rgba(0.6) + ' 100%)';
    }
  }
  function fontStack(name, kind) {
    return '"' + name + '", ' + (kind === 'heading' ? 'Georgia, serif' : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
  }
  function buildCss(v) {
    return ':root{' +
      '--pod-accent:' + v.accent + ';' +
      '--pod-accent-dark:' + v.accentDark + ';' +
      '--pod-bg:' + v.bg + ';' +
      '--pod-surface:' + v.surface + ';' +
      '--pod-text:' + v.text + ';' +
      '--pod-heading:' + v.heading + ';' +
      '--pod-muted:' + v.muted + ';' +
      '--pod-font-heading:' + fontStack(v.fontHeading, 'heading') + ';' +
      '--pod-font-body:' + fontStack(v.fontBody, 'body') + ';' +
      '--pod-fs-base:' + v.fsBase + 'px;' +
      '--pod-fs-h1:' + v.fsH1 + 'px;' +
      '--pod-fs-h2:' + v.fsH2 + 'px;' +
      '--pod-section-pad-y:' + v.sectionPadY + 'px;' +
      '--pod-radius:' + v.radius + 'px;' +
      '--pod-btn-radius:' + (v.buttonStyle === 'sharp' ? '4px' : '999px') + ';' +
      '--pod-hero-min-h:' + v.heroMinH + 'vh;' +
      '--pod-hero-overlay:' + overlayCss(v) + ';' +
      (v.heroImage ? '--pod-hero-image:url("' + String(v.heroImage).replace(/"/g, '') + '");' : '') +
      '}';
  }
  function applyLive(v) {
    var css = buildCss(v);
    var t = document.getElementById('pod-theme-overrides');
    if (t) t.textContent = css;
    if (window.PODtheme) window.PODtheme.ensureFont({ fontHeading: v.fontHeading, fontBody: v.fontBody });
    return css;
  }

  /* ---------- CSS editor panel ---------- */
  function buildPanel(state) {
    var vars = Object.assign({}, DEFAULTS, state.theme_vars || {});
    // hero slider: pole fotiek; spätne kompatibilné s pôvodným jediným heroImage
    vars.heroImages = (Array.isArray(vars.heroImages) ? vars.heroImages.slice() : []).filter(Boolean);
    if (!vars.heroImages.length) vars.heroImages = [vars.heroImage || DEFAULTS.heroImage];
    vars.heroImage = vars.heroImages[0];
    var textsDraft = Object.assign({}, state.texts || {});
    var seoDraft = Object.assign({}, state.seo || {});
    var contactDraft = Object.assign({}, state.contact || {});
    var panel = el('div', { class: 'pod-panel', id: 'pod-panel' });

    function sync() {
      applyLive(vars);
      if (window.PODsite && window.PODsite.renderHero) window.PODsite.renderHero(vars);
    }

    function color(key, label) {
      var wrap = el('div', { class: 'row' });
      wrap.appendChild(el('label', { text: label }));
      var ci = el('input', { type: 'color', value: vars[key] });
      var ti = el('input', { type: 'text', value: vars[key] });
      ci.addEventListener('input', function () { vars[key] = ci.value; ti.value = ci.value; sync(); });
      ti.addEventListener('change', function () { if (/^#[0-9a-fA-F]{6}$/.test(ti.value)) { vars[key] = ti.value; ci.value = ti.value; sync(); } });
      wrap.appendChild(ci); wrap.appendChild(document.createTextNode(' ')); wrap.appendChild(ti);
      return wrap;
    }
    function range(key, label, min, max, unit) {
      var wrap = el('div', { class: 'row' });
      var lab = el('label', { text: label + ' ' });
      var val = el('span', { class: 'val', text: vars[key] + (unit || '') });
      lab.appendChild(val); wrap.appendChild(lab);
      var r = el('input', { type: 'range', min: min, max: max, value: vars[key] });
      r.addEventListener('input', function () { vars[key] = +r.value; val.textContent = r.value + (unit || ''); sync(); });
      wrap.appendChild(r);
      return wrap;
    }
    function select(key, label, options) {
      var wrap = el('div', { class: 'row' });
      wrap.appendChild(el('label', { text: label }));
      var s = el('select');
      options.forEach(function (o) {
        var opt = el('option', { value: o.v }, o.t);
        if (vars[key] === o.v) opt.selected = true;
        s.appendChild(opt);
      });
      s.addEventListener('change', function () { vars[key] = s.value; sync(); });
      wrap.appendChild(s);
      return wrap;
    }
    function head(t) { return el('h3', { text: t }); }

    var top = el('h2', null, 'CSS editor');
    var x = el('button', { class: 'x', 'aria-label': 'Zavrieť' }, '&times;');
    x.addEventListener('click', function () { panel.classList.remove('is-open'); });
    top.appendChild(x);
    panel.appendChild(top);

    panel.appendChild(head('Farby'));
    panel.appendChild(color('accent', 'Akcent (hlavná)'));
    panel.appendChild(color('accentDark', 'Akcent tmavá'));
    panel.appendChild(color('bg', 'Pozadie'));
    panel.appendChild(color('surface', 'Pozadie sekcií'));
    panel.appendChild(color('text', 'Text'));
    panel.appendChild(color('heading', 'Nadpisy'));
    panel.appendChild(color('muted', 'Tlmený text'));

    panel.appendChild(head('Fonty'));
    var fontOpts = FONTS.map(function (f) { return { v: f, t: f }; });
    panel.appendChild(select('fontHeading', 'Nadpisy', fontOpts));
    panel.appendChild(select('fontBody', 'Text / menu', fontOpts));

    panel.appendChild(head('Veľkosti písma'));
    panel.appendChild(range('fsBase', 'Základ', 14, 20, 'px'));
    panel.appendChild(range('fsH1', 'Nadpis H1', 30, 64, 'px'));
    panel.appendChild(range('fsH2', 'Nadpis H2', 22, 44, 'px'));

    panel.appendChild(head('Rozostupy a tvar'));
    panel.appendChild(range('sectionPadY', 'Odsadenie sekcií', 40, 140, 'px'));
    panel.appendChild(range('radius', 'Zaoblenie kariet', 0, 28, 'px'));
    panel.appendChild(select('buttonStyle', 'Tlačidlá', [{ v: 'rounded', t: 'Zaoblené' }, { v: 'sharp', t: 'Ostré' }]));

    panel.appendChild(head('Hero'));
    (function heroSliderRows() {
      var wrap = el('div', { class: 'row' });
      wrap.appendChild(el('label', { text: 'Úvodné fotky (slider) — poradie zhora nadol' }));
      var list = el('div', { style: 'display:grid;gap:6px;margin-bottom:8px' });

      function commit() {
        vars.heroImage = vars.heroImages[0] || '';
        paint();
        sync();
      }
      function paint() {
        list.innerHTML = '';
        vars.heroImages.forEach(function (url, i) {
          var item = el('div', { style: 'display:flex;align-items:center;gap:6px' });
          item.appendChild(el('img', { src: url, alt: '', style: 'width:46px;height:34px;object-fit:cover;border-radius:4px;background:#333;flex:0 0 auto' }));
          item.appendChild(el('span', { style: 'flex:1' }));
          var up = el('button', { class: 'pod-btn ghost', style: 'padding:2px 7px', title: 'Vyššie' }, '▲');
          var dn = el('button', { class: 'pod-btn ghost', style: 'padding:2px 7px', title: 'Nižšie' }, '▼');
          var rm = el('button', { class: 'pod-btn ghost', style: 'padding:2px 7px', title: 'Odstrániť' }, '✕');
          up.disabled = i === 0;
          dn.disabled = i === vars.heroImages.length - 1;
          up.addEventListener('click', function () { var a = vars.heroImages; a.splice(i - 1, 0, a.splice(i, 1)[0]); commit(); });
          dn.addEventListener('click', function () { var a = vars.heroImages; a.splice(i + 1, 0, a.splice(i, 1)[0]); commit(); });
          rm.addEventListener('click', function () {
            vars.heroImages.splice(i, 1);
            if (!vars.heroImages.length) vars.heroImages = [DEFAULTS.heroImage];
            commit();
          });
          item.appendChild(up); item.appendChild(dn); item.appendChild(rm);
          list.appendChild(item);
        });
      }

      var add = el('button', { class: 'pod-btn ghost', style: 'margin-right:6px' }, '+ Pridať fotku');
      add.addEventListener('click', function () {
        pickImage(function (url) { vars.heroImages.push(url); commit(); });
      });
      var reset = el('button', { class: 'pod-btn ghost' }, 'Predvolená');
      reset.addEventListener('click', function () { vars.heroImages = [DEFAULTS.heroImage]; commit(); });

      wrap.appendChild(list);
      wrap.appendChild(add);
      wrap.appendChild(reset);
      panel.appendChild(wrap);
      paint();
    })();
    panel.appendChild(range('heroMinH', 'Výška (min-height)', 50, 100, 'vh'));
    panel.appendChild(select('heroOverlayType', 'Typ prekrytia', [
      { v: 'linear-bottom', t: 'Lineárne zdola' }, { v: 'linear-top', t: 'Lineárne zhora' },
      { v: 'radial', t: 'Radiálne' }, { v: 'solid', t: 'Plná farba' }
    ]));
    panel.appendChild(range('heroOverlayIntensity', 'Intenzita prekrytia', 0, 100, '%'));
    panel.appendChild(color('heroOverlayColor', 'Farba prekrytia'));

    panel.appendChild(head('Editor textov'));
    var teRow = el('div', { class: 'row' });
    var teBtn = el('button', { class: 'pod-btn ghost' }, 'Zapnúť editovanie textov');
    var linkBtn = el('button', { class: 'pod-btn ghost', style: 'margin-left:6px' }, '🔗 Odkaz');
    linkBtn.disabled = true;
    var editing = false;

    // Počas editovania odkazy dočasne strácajú href (aby nenavigovali); skutočná
    // hodnota sa drží v data-pod-edit-href. Pri ukladaní ju vrátime späť.
    function stashLink(a, on) {
      if (on) {
        if (a.hasAttribute('href')) { a.dataset.podEditHref = a.getAttribute('href'); a.removeAttribute('href'); }
      } else if (a.dataset.podEditHref != null) {
        a.setAttribute('href', a.dataset.podEditHref);
        delete a.dataset.podEditHref;
      }
    }
    function cleanHtml(node) {
      var c = node.cloneNode(true);
      c.querySelectorAll('a[data-pod-edit-href]').forEach(function (a) {
        a.setAttribute('href', a.getAttribute('data-pod-edit-href'));
        a.removeAttribute('data-pod-edit-href');
      });
      c.removeAttribute('contenteditable');
      c.classList.remove('pod-editing');
      return c.innerHTML.trim();
    }
    function onEdit(e) { textsDraft[e.currentTarget.dataset.edit] = cleanHtml(e.currentTarget); }

    teBtn.addEventListener('click', function () {
      editing = !editing;
      teBtn.textContent = editing ? 'Vypnúť editovanie textov' : 'Zapnúť editovanie textov';
      linkBtn.disabled = !editing;
      document.querySelectorAll('[data-edit]').forEach(function (node) {
        node.classList.toggle('pod-editing', editing);
        node.contentEditable = editing ? 'true' : 'false';
        // odkaz OKOLO editovaného textu (napr. logo v hlavičke) aj odkazy VNÚTRI
        // (napr. zoznam odkazov v pätičke) – dočasne bez href a bez drag,
        // nech sa dá do textu kliknúť aj označiť ho myšou
        var around = node.closest('a');
        if (around) {
          stashLink(around, editing);
          if (editing) around.setAttribute('draggable', 'false');
          else around.removeAttribute('draggable');
        }
        node.querySelectorAll('a').forEach(function (a) { stashLink(a, editing); });
        if (editing) node.addEventListener('input', onEdit);
        else node.removeEventListener('input', onEdit);
      });
      // Všetky odkazy v hlavičke a pätičke (aj tie bez data-edit, napr. logo
      // v pätičke nad adresou) – počas editovania bez href a bez drag, aby
      // klik vedľa textu nenavigoval preč a nezačal ťahať odkaz.
      document.querySelectorAll('header a, footer a').forEach(function (a) {
        stashLink(a, editing);
        if (editing) a.setAttribute('draggable', 'false');
        else a.removeAttribute('draggable');
      });
      document.querySelectorAll('a[data-img-link]').forEach(function (a) { stashLink(a, editing); });
    });

    // Nechá fokus v editovanom texte a nastaví/zmení/odstráni odkaz na výbere alebo v odkaze pod kurzorom.
    linkBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    linkBtn.addEventListener('click', function () {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) { alert('Najprv klikni do textu (alebo označ text) v editovanej časti stránky.'); return; }
      var anchorEl = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
      var host = anchorEl && anchorEl.closest('[data-edit]');
      if (!host || host.contentEditable !== 'true') { alert('Kurzor musí byť v editovanej časti stránky.'); return; }
      var linkEl = anchorEl.closest('a');
      var hasSelection = sel.toString().length > 0;
      var current = linkEl ? (linkEl.dataset.podEditHref != null ? linkEl.dataset.podEditHref : linkEl.getAttribute('href') || '') : '';
      var url = prompt('Odkaz (URL). Prázdne pole = odstrániť odkaz:', current);
      if (url === null) return;
      url = url.trim();

      function styleLink(a) {
        if (/^https?:\/\//i.test(url)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
        else { a.removeAttribute('target'); a.removeAttribute('rel'); }
        // drž href v stashi, nech počas editovania nenaviguje
        if (url) { a.dataset.podEditHref = url; a.removeAttribute('href'); }
      }
      if (linkEl && !hasSelection) {
        if (url) { styleLink(linkEl); }
        else { // rozbaliť odkaz
          var p = linkEl.parentNode;
          while (linkEl.firstChild) p.insertBefore(linkEl.firstChild, linkEl);
          p.removeChild(linkEl);
        }
      } else if (hasSelection) {
        if (url) {
          host.querySelectorAll('a').forEach(function (a) { a.setAttribute('data-pod-known', '1'); });
          document.execCommand('createLink', false, url);
          host.querySelectorAll('a:not([data-pod-known])').forEach(styleLink);
          host.querySelectorAll('a[data-pod-known]').forEach(function (a) { a.removeAttribute('data-pod-known'); });
        } else {
          document.execCommand('unlink');
        }
      } else {
        alert('Označ text, ktorý má byť odkazom, alebo klikni do existujúceho odkazu.');
        return;
      }
      textsDraft[host.dataset.edit] = cleanHtml(host);
    });

    teRow.appendChild(teBtn);
    teRow.appendChild(linkBtn);
    teRow.appendChild(el('label', { style: 'margin-top:8px', text: 'Zapni editovanie, klikni na text na stránke a prepíš ho. „🔗 Odkaz" nastaví/zmení odkaz na označenom texte alebo v odkaze pod kurzorom (aj v pätičke). Ulož tlačidlom nižšie.' }));
    panel.appendChild(teRow);

    panel.appendChild(head('Odkazy na obrázkoch'));
    [
      ['studia.image', 'Sekcia Štúdiá – obrázok'],
      ['wellness.image', 'Sekcia Wellness – obrázok']
    ].forEach(function (pair) {
      var key = pair[0] + '.href';
      var wrap = el('div', { class: 'row' });
      wrap.appendChild(el('label', { text: pair[1] + ' — odkaz po kliknutí' }));
      var inp = el('input', { type: 'text', placeholder: 'https://…  (prázdne = bez odkazu)', value: textsDraft[key] || '' });
      inp.style.width = '100%';
      inp.addEventListener('input', function () {
        var v = inp.value.trim();
        if (v) textsDraft[key] = v; else delete textsDraft[key];
        var a = document.querySelector('a[data-img-link="' + pair[0] + '"]');
        if (!a) return;
        if (v) {
          a.setAttribute('href', v);
          if (/^https?:\/\//i.test(v)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
          else { a.removeAttribute('target'); a.removeAttribute('rel'); }
        } else {
          a.removeAttribute('href'); a.removeAttribute('target'); a.removeAttribute('rel');
        }
      });
      wrap.appendChild(inp);
      panel.appendChild(wrap);
    });

    panel.appendChild(head('Kontakt a odkazy (hlavička + päta)'));
    (function contactRows() {
      function preview() {
        if (window.PODsite && window.PODsite.applyContact) window.PODsite.applyContact(contactDraft);
      }
      [
        ['phone', 'Telefón', '+421 911 151 414'],
        ['email', 'E-mail', 'info@podhajska.net'],
        ['facebook', 'Facebook (URL)', 'https://www.facebook.com/…'],
        ['bookingUrl', 'Tlačidlo „Overiť dostupnosť termínu" — odkaz', '#kontakt / https://… / mailto:…']
      ].forEach(function (f) {
        var wrap = el('div', { class: 'row' });
        wrap.appendChild(el('label', { text: f[1] }));
        var inp = el('input', { type: 'text', placeholder: f[2], value: contactDraft[f[0]] || '' });
        inp.style.width = '100%';
        inp.addEventListener('input', function () {
          var v = inp.value.trim();
          if (v) contactDraft[f[0]] = v; else delete contactDraft[f[0]];
          preview();
        });
        wrap.appendChild(inp);
        panel.appendChild(wrap);
      });
      panel.appendChild(el('div', { class: 'row' },
        '<label style="color:#888">Prázdne pole = ponechá sa pôvodná hodnota. Zmena sa prejaví v hlavičke, v sekcii Kontakt aj v päte.</label>'));
    })();

    panel.appendChild(head('SEO'));
    (function seoRows() {
      var DEF_TITLE = 'Štúdiá Podhájska – pokojné ubytovanie pre dospelých';
      var DEF_DESC = 'Moderné štúdiá v Podhájskej v uzavretom areáli s bazénom, záhradou a wellness Wellness Classic. Ubytovanie výhradne pre dospelých (18+).';

      var titleWrap = el('div', { class: 'row' });
      titleWrap.appendChild(el('label', { text: 'Titulok stránky (aj pri zdieľaní na Facebooku a pod.)' }));
      var titleInp = el('input', { type: 'text', placeholder: DEF_TITLE, value: seoDraft.title || '' });
      titleInp.style.width = '100%';
      titleInp.addEventListener('input', function () {
        var v = titleInp.value.trim();
        if (v) seoDraft.title = v; else delete seoDraft.title;
      });
      titleWrap.appendChild(titleInp);
      panel.appendChild(titleWrap);

      var descWrap = el('div', { class: 'row' });
      descWrap.appendChild(el('label', { text: 'Popis pre vyhľadávače a zdieľanie' }));
      var descInp = el('textarea', { rows: 3, placeholder: DEF_DESC });
      descInp.style.cssText = 'width:100%;background:#262626;border:1px solid #444;color:#eee;padding:6px;border-radius:5px;resize:vertical;font:inherit';
      descInp.value = seoDraft.description || '';
      descInp.addEventListener('input', function () {
        var v = descInp.value.trim();
        if (v) seoDraft.description = v; else delete seoDraft.description;
      });
      descWrap.appendChild(descInp);
      panel.appendChild(descWrap);

      var imgWrap = el('div', { class: 'row' });
      imgWrap.appendChild(el('label', { text: 'Obrázok pri zdieľaní odkazu (og:image)' }));
      var thumb = el('img', {
        src: seoDraft.ogImage || vars.heroImage || '', alt: '',
        style: 'display:block;width:100%;height:82px;object-fit:cover;border-radius:6px;margin-bottom:6px;background:#333'
      });
      var pick = el('button', { class: 'pod-btn ghost', style: 'margin-right:6px' }, 'Vybrať fotku');
      var clear = el('button', { class: 'pod-btn ghost' }, 'Predvolený');
      pick.addEventListener('click', function () {
        pickImage(function (url) { seoDraft.ogImage = url; thumb.src = url; });
      });
      clear.addEventListener('click', function () {
        delete seoDraft.ogImage; thumb.src = vars.heroImage || '';
      });
      imgWrap.appendChild(thumb); imgWrap.appendChild(pick); imgWrap.appendChild(clear);
      panel.appendChild(imgWrap);

      var noindexWrap = el('div', { class: 'row' });
      var noindexLbl = el('label', { style: 'display:flex;align-items:center;gap:8px;cursor:pointer' });
      var noindexChk = el('input', { type: 'checkbox' });
      noindexChk.style.cssText = 'width:auto';
      noindexChk.checked = !!seoDraft.noindex;
      noindexChk.addEventListener('change', function () {
        if (noindexChk.checked) seoDraft.noindex = true; else delete seoDraft.noindex;
      });
      noindexLbl.appendChild(noindexChk);
      noindexLbl.appendChild(document.createTextNode('Skryť stránku pred vyhľadávačmi (noindex)'));
      noindexWrap.appendChild(noindexLbl);
      panel.appendChild(noindexWrap);
    })();

    var actions = el('div', { class: 'actions' });
    var saveBtn = el('button', { class: 'pod-btn' }, 'Uložiť');
    var expBtn = el('button', { class: 'pod-btn sec' }, 'Exportovať CSS');
    var resetBtn = el('button', { class: 'pod-btn ghost' }, 'Reset');
    saveBtn.addEventListener('click', function () {
      var css = buildCss(vars);
      saveBtn.textContent = 'Ukladám…'; saveBtn.disabled = true;
      j(API + '/admin/theme', { method: 'PUT', body: JSON.stringify({ theme_vars: vars, theme_css: css, texts: textsDraft, seo: seoDraft, contact: contactDraft }) })
        .then(function (r) {
          saveBtn.disabled = false;
          saveBtn.textContent = r.ok ? 'Uložené ✓' : 'Chyba';
          setTimeout(function () { saveBtn.textContent = 'Uložiť'; }, 1800);
        });
    });
    expBtn.addEventListener('click', function () {
      var blob = new Blob([buildCss(vars)], { type: 'text/css' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'podhajska-theme.css' });
      document.body.appendChild(a); a.click(); a.remove();
    });
    resetBtn.addEventListener('click', function () {
      if (!confirm('Vrátiť všetky hodnoty na predvolené?')) return;
      vars = Object.assign({}, DEFAULTS);
      applyLive(vars);
      panel.remove();
      openPanel(Object.assign({}, state, { theme_vars: vars }));
    });
    actions.appendChild(saveBtn); actions.appendChild(expBtn); actions.appendChild(resetBtn);
    panel.appendChild(actions);

    sync(); // zladí živý náhľad (vrátane hero slideru) so stavom panela
    return panel;
  }

  var panelState = null;
  function openPanel(state) {
    panelState = state;
    var existing = document.getElementById('pod-panel');
    if (existing) { existing.classList.toggle('is-open'); return; }
    var p = buildPanel(state);
    document.body.appendChild(p);
    requestAnimationFrame(function () { p.classList.add('is-open'); });
  }

  /* ---------- generický modál ---------- */
  function modal(title) {
    var m = el('div', { class: 'pod-modal' });
    var box = el('div', { class: 'pod-modal__box' });
    var head = el('div', { class: 'pod-modal__head' });
    head.appendChild(el('h3', { text: title }));
    var x = el('button', { class: 'pod-btn ghost' }, 'Zavrieť');
    x.addEventListener('click', function () { m.remove(); });
    head.appendChild(x);
    var body = el('div', { class: 'pod-modal__body' });
    box.appendChild(head); box.appendChild(body); m.appendChild(box);
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
    return { modal: m, body: body, close: function () { m.remove(); } };
  }

  function refreshPublic() {
    fetch('/api/site').then(function (r) { return r.json(); }).then(function (d) {
      if (window.PODsite) {
        window.PODsite.data = d;
        window.PODsite.renderGallery(d.gallery);
        window.PODsite.renderArticles(d.articles);
      }
    });
  }

  /* ---------- správa galérie ---------- */
  function openGallery() {
    var ui = modal('Fotogaléria');
    var body = ui.body;
    var up = el('div', { class: 'pod-field' },
      '<label>Nahrať fotky</label>' +
      '<select id="pod-up-cat" style="margin-bottom:8px">' +
      '<option value="studio">Kategória: Štúdio 1,2,3</option>' +
      '<option value="wellness">Kategória: Wellness</option>' +
      '<option value="exterier" selected>Kategória: Exteriér</option>' +
      '<option value="clanky">Kategória: Články (len do článkov)</option>' +
      '</select>' +
      '<input type="file" id="pod-up" accept="image/*" multiple>');
    var status = el('p', { class: 'muted' }, '');
    var list = el('ul', { class: 'pod-list' });
    body.appendChild(up); body.appendChild(status); body.appendChild(list);

    var items = [];
    function render() {
      list.innerHTML = '';
      items.forEach(function (g, idx) {
        var li = el('li', { draggable: 'true' });
        li.dataset.idx = idx;
        li.appendChild(el('img', { src: g.url, alt: '' }));
        var grow = el('div', { class: 'grow' });
        var alt = el('input', { type: 'text', value: g.alt || '', placeholder: 'Popis (alt)' });
        alt.addEventListener('change', function () {
          j(API + '/admin/gallery/' + g.id, { method: 'PUT', body: JSON.stringify({ alt: alt.value }) }).then(refreshPublic);
        });
        grow.appendChild(alt);
        var cat = el('select', { style: 'margin-top:6px' });
        [['studio', 'Štúdio 1,2,3'], ['wellness', 'Wellness'], ['exterier', 'Exteriér'], ['clanky', 'Články (len do článkov)']].forEach(function (x) {
          var o = el('option', { value: x[0] }, x[1]);
          if ((g.category || 'exterier') === x[0]) o.selected = true;
          cat.appendChild(o);
        });
        cat.addEventListener('change', function () {
          j(API + '/admin/gallery/' + g.id, { method: 'PUT', body: JSON.stringify({ category: cat.value }) }).then(refreshPublic);
        });
        grow.appendChild(cat);
        li.appendChild(grow);
        var upB = el('button', { class: 'pod-btn ghost', title: 'Vyššie' }, '▲');
        var dnB = el('button', { class: 'pod-btn ghost', title: 'Nižšie' }, '▼');
        var del = el('button', { class: 'pod-btn', title: 'Zmazať' }, '✕');
        upB.addEventListener('click', function () { move(idx, -1); });
        dnB.addEventListener('click', function () { move(idx, 1); });
        del.addEventListener('click', function () {
          if (!confirm('Zmazať túto fotku?')) return;
          j(API + '/admin/gallery/' + g.id, { method: 'DELETE' }).then(function () { load(); refreshPublic(); });
        });
        li.appendChild(upB); li.appendChild(dnB); li.appendChild(del);
        li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', idx); });
        li.addEventListener('dragover', function (e) { e.preventDefault(); });
        li.addEventListener('drop', function (e) {
          e.preventDefault();
          var from = +e.dataTransfer.getData('text/plain');
          if (from === idx) return;
          var moved = items.splice(from, 1)[0];
          items.splice(idx, 0, moved);
          render(); persistOrder();
        });
        list.appendChild(li);
      });
    }
    function move(idx, dir) {
      var to = idx + dir;
      if (to < 0 || to >= items.length) return;
      var m = items.splice(idx, 1)[0];
      items.splice(to, 0, m);
      render(); persistOrder();
    }
    function persistOrder() {
      j(API + '/admin/gallery/reorder', { method: 'PUT', body: JSON.stringify({ ids: items.map(function (i) { return i.id; }) }) }).then(refreshPublic);
    }
    function load() {
      j(API + '/admin/gallery').then(function (r) { items = r.body || []; render(); });
    }
    up.querySelector('#pod-up').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      if (!files.length) return;
      status.textContent = 'Nahrávam ' + files.length + ' fotiek…';
      var i = 0;
      (function next() {
        if (i >= files.length) { status.textContent = 'Hotovo.'; e.target.value = ''; load(); refreshPublic(); return; }
        var fd = new FormData();
        fd.append('file', files[i]);
        fd.append('category', up.querySelector('#pod-up-cat').value);
        fetch(API + '/admin/gallery', { method: 'POST', body: fd }).then(function () { i++; next(); });
      })();
    });
    load();
  }

  /* ---------- kalendár obsadenosti ---------- */
  var CAL_MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
  var CAL_DOW = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
  function cpad(n) { return n < 10 ? '0' + n : '' + n; }
  function cYmd(d) { return d.getFullYear() + '-' + cpad(d.getMonth() + 1) + '-' + cpad(d.getDate()); }
  function cAdd(ymd, n) { var d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return cYmd(d); }

  function openCalendar() {
    var ui = modal('Kalendár obsadenosti');
    var body = ui.body;
    var now = new Date();
    var view = { y: now.getFullYear(), m: now.getMonth() };
    var sel = null; // { roomId, start }
    var data = null;
    var today = cYmd(now);

    function roomName(id) { var r = (data.rooms || []).find(function (x) { return x.id === id; }); return r ? r.name : 'Izba ' + id; }
    function bookingOn(roomId, ds) {
      return (data.bookings || []).find(function (b) {
        return b.room_id === roomId && b.start_date <= ds && ds < b.end_date;
      });
    }
    function patchBooking(id, patch) {
      return j(API + '/admin/bookings/' + id, { method: 'PATCH', body: JSON.stringify(patch) });
    }

    function load() {
      j(API + '/admin/calendar').then(function (r) {
        if (!r.ok) { body.innerHTML = '<p>' + ((r.body && r.body.error) || 'Chyba') + '</p>'; return; }
        data = r.body;
        render();
      });
    }

    function render() {
      body.innerHTML = '';

      /* --- rezervácie čakajúce na schválenie --- */
      if ((data.pending || []).length) {
        var pf = el('div', { class: 'pod-field' });
        pf.appendChild(el('label', { text: 'Rezervácie na schválenie (' + data.pending.length + ')' }));
        data.pending.forEach(function (p) {
          var row = el('div', { style: 'border:1px solid #f0d79a;border-radius:8px;padding:10px;margin-bottom:8px;background:#fff9ec' });
          row.innerHTML =
            '<b>' + escapeHtml(roomName(p.room_id)) + '</b> · ' + p.start_date + ' → ' + p.end_date +
            '<br>' + escapeHtml(p.guest_name) + ' · ' + escapeHtml(p.guest_email || '—') + ' · ' + escapeHtml(p.guest_phone || '—') +
            (p.note ? '<br><i>' + escapeHtml(p.note) + '</i>' : '');
          var ok = el('button', { class: 'pod-btn', style: 'margin:8px 6px 0 0' }, 'Potvrdiť (obsadené)');
          var no = el('button', { class: 'pod-btn ghost', style: 'margin-top:8px' }, 'Zamietnuť');
          ok.addEventListener('click', function () {
            patchBooking(p.id, { status: 'confirmed', summary: 'Rezervácia: ' + p.guest_name }).then(function () { load(); refreshPublic(); });
          });
          no.addEventListener('click', function () {
            patchBooking(p.id, { status: 'cancelled' }).then(function () { load(); refreshPublic(); });
          });
          row.appendChild(ok); row.appendChild(no);
          pf.appendChild(row);
        });
        body.appendChild(pf);
      }

      /* --- mesačný prehľad, 3 izby --- */
      var nav = el('div', { class: 'pod-cal__nav' });
      var prev = el('button', { class: 'pod-btn ghost' }, '‹');
      var next = el('button', { class: 'pod-btn ghost' }, '›');
      var canPrev = !(view.y === now.getFullYear() && view.m <= now.getMonth());
      prev.disabled = !canPrev;
      prev.addEventListener('click', function () { shift(-1); });
      next.addEventListener('click', function () { shift(1); });
      nav.appendChild(prev);
      nav.appendChild(el('strong', { text: CAL_MONTHS[view.m] + ' ' + view.y }));
      nav.appendChild(next);
      body.appendChild(nav);
      body.appendChild(el('p', { class: 'muted', style: 'margin:0 0 12px;font-size:12px' },
        'Klik na voľný deň = začiatok termínu, druhý klik = koniec (deň odchodu). ' +
        'Žlté = rezervované (klik = potvrdiť), ružové = obsadené. Klik na obsadený/rezervovaný deň ' +
        'ponúkne uvoľniť len ten deň alebo zrušiť celú rezerváciu. Modré = z Booking.com (upravuje sa v Booking.com).'));

      var first = new Date(view.y, view.m, 1);
      var startDow = (first.getDay() + 6) % 7;
      var dim = new Date(view.y, view.m + 1, 0).getDate();

      (data.rooms || []).forEach(function (room) {
        var wrap = el('div', { class: 'pod-cal' });
        wrap.appendChild(el('h4', { text: room.name }));
        var grid = el('div', { class: 'pod-cal__grid' });
        CAL_DOW.forEach(function (x) { grid.appendChild(el('span', { class: 'dow', text: x })); });
        for (var i = 0; i < startDow; i++) grid.appendChild(el('span', { class: 'pod-cal__d out' }));
        for (var day = 1; day <= dim; day++) {
          var ds = view.y + '-' + cpad(view.m + 1) + '-' + cpad(day);
          var bk = bookingOn(room.id, ds);
          var cls = 'pod-cal__d';
          if (ds < today) cls += ' past';
          if (bk) cls += bk.source === 'booking' ? ' booking' : bk.status === 'pending' ? ' pending' : ' manual';
          if (sel && sel.roomId === room.id && sel.start === ds) cls += ' sel';
          var btn = el('button', { class: cls, text: String(day) });
          btn.dataset.room = room.id;
          btn.dataset.day = ds;
          if (bk) { btn.dataset.bid = bk.id; btn.dataset.src = bk.source; btn.dataset.status = bk.status; btn.title = bk.summary || bk.source; }
          grid.appendChild(btn);
        }
        grid.addEventListener('click', onDayClick);
        wrap.appendChild(grid);
        body.appendChild(wrap);
      });

      /* --- synchronizácia s Booking.com --- */
      body.appendChild(el('h3', { style: 'margin:18px 0 8px;font:700 12px system-ui;letter-spacing:.14em;text-transform:uppercase;color:#e0002f' , text: 'Synchronizácia s Booking.com'}));
      (data.rooms || []).forEach(function (room) {
        var f = el('div', { class: 'pod-field' });
        f.appendChild(el('label', { text: room.name }));
        var imp = el('input', { type: 'text', placeholder: 'iCal URL z Booking.com (import obsadenosti)' });
        imp.value = room.ics_import_url || '';
        var save = el('button', { class: 'pod-btn ghost', style: 'margin:6px 6px 0 0' }, 'Uložiť URL');
        save.addEventListener('click', function () {
          save.disabled = true;
          j(API + '/admin/rooms/' + room.id, { method: 'PUT', body: JSON.stringify({ ics_import_url: imp.value.trim() }) })
            .then(function () { load(); });
        });
        var exportUrl = data.ics_base + room.id + '.ics';
        var copy = el('button', { class: 'pod-btn ghost', style: 'margin-top:6px' }, 'Kopírovať náš .ics pre Booking');
        copy.addEventListener('click', function () {
          navigator.clipboard.writeText(exportUrl).then(function () {
            copy.textContent = 'Skopírované ✓';
            setTimeout(function () { copy.textContent = 'Kopírovať náš .ics pre Booking'; }, 1600);
          });
        });
        f.appendChild(imp); f.appendChild(save); f.appendChild(copy);
        f.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:5px;word-break:break-all' }, escapeHtml(exportUrl)));
        f.appendChild(el('div', { class: 'muted', style: 'font-size:11px;margin-top:3px' },
          room.last_import_at ? 'Posledný import: ' + room.last_import_at + ' · ' + escapeHtml(room.last_import_msg || '') : 'Zatiaľ neimportované'));
        body.appendChild(f);
      });
      var syncBtn = el('button', { class: 'pod-btn' }, 'Synchronizovať teraz');
      syncBtn.addEventListener('click', function () {
        syncBtn.disabled = true; syncBtn.textContent = 'Synchronizujem…';
        j(API + '/admin/calendar/sync', { method: 'POST' }).then(function () { load(); refreshPublic(); });
      });
      body.appendChild(syncBtn);
      if (data.last_sync) body.appendChild(el('span', { class: 'muted', style: 'font-size:11px;margin-left:10px' }, 'naposledy: ' + data.last_sync));
    }

    function shift(d) {
      var nm = view.m + d;
      view.y += Math.floor(nm / 12);
      view.m = ((nm % 12) + 12) % 12;
      sel = null;
      render();
    }

    function onDayClick(e) {
      var btn = e.target.closest('.pod-cal__d');
      if (!btn || btn.classList.contains('out') || btn.classList.contains('past')) return;
      var roomId = Number(btn.dataset.room);
      var ds = btn.dataset.day;
      var src = btn.dataset.src;
      var status = btn.dataset.status;
      var bid = btn.dataset.bid;

      if (src === 'booking') return;
      if (bid && status === 'pending') {
        if (confirm('Potvrdiť túto rezerváciu ako OBSADENÉ?\n\nOK = potvrdiť, Zrušiť = nechať tak (zamietnuť sa dá v zozname hore).')) {
          patchBooking(bid, { status: 'confirmed' }).then(function () { load(); refreshPublic(); });
        }
        return;
      }
      if (bid) {
        var bk = (data.bookings || []).find(function (x) { return String(x.id) === String(bid); });
        var rng = bk ? bk.start_date + ' → ' + bk.end_date : ds;
        var multi = bk && cAdd(bk.start_date, 1) !== bk.end_date;
        var mm = modal('Zrušiť termín');
        mm.body.parentElement.style.width = 'min(420px, 92vw)';
        mm.body.innerHTML = '<p style="margin:0 0 14px">' + escapeHtml(roomName(roomId)) + ' · ' + rng +
          (bk && bk.guest_name ? '<br>' + escapeHtml(bk.guest_name) : '') + '</p>';
        var done = function () { mm.close(); load(); refreshPublic(); };
        if (multi) {
          var b1 = el('button', { class: 'pod-btn ghost', style: 'display:block;width:100%;margin-bottom:8px' }, 'Uvoľniť len ' + ds);
          b1.addEventListener('click', function () {
            j(API + '/admin/bookings/' + bid + '/free-day', { method: 'POST', body: JSON.stringify({ day: ds }) }).then(done);
          });
          mm.body.appendChild(b1);
        }
        var b2 = el('button', { class: 'pod-btn', style: 'display:block;width:100%;margin-bottom:8px' }, 'Zrušiť celú rezerváciu');
        b2.addEventListener('click', function () {
          j(API + '/admin/bookings/' + bid, { method: 'DELETE' }).then(done);
        });
        var b3 = el('button', { class: 'pod-btn ghost', style: 'display:block;width:100%' }, 'Späť');
        b3.addEventListener('click', mm.close);
        mm.body.appendChild(b2); mm.body.appendChild(b3);
        return;
      }
      // voľný deň – budovanie rozsahu
      if (!sel || sel.roomId !== roomId || ds < sel.start) {
        sel = { roomId: roomId, start: ds };
        render();
        return;
      }
      // druhý klik = deň odchodu (exkluzívny). Rovnaký deň dvakrát = 1 noc.
      var end = ds === sel.start ? cAdd(sel.start, 1) : ds;
      var label = prompt('Blokovať ' + roomName(roomId) + ': ' + sel.start + ' → ' + end + ' (odchod)\nPopis (nepovinné):', 'Obsadené');
      if (label === null) { sel = null; render(); return; }
      j(API + '/admin/bookings', {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId, start_date: sel.start, end_date: end, summary: label || 'Obsadené' }),
      }).then(function () { sel = null; load(); refreshPublic(); });
    }

    load();
  }

  /* ---------- správa článkov ---------- */
  var ARTICLE_SECTIONS = [['blog', 'Blog'], ['okolie', 'Okolie a aktivity']];

  function openArticles() {
    var ui = modal('Články');
    var body = ui.body;
    var curSection = 'blog';

    var tabs = el('div', { style: 'display:flex;gap:8px;margin-bottom:14px' });
    var tabBtns = ARTICLE_SECTIONS.map(function (s) {
      var b = el('button', { class: 'pod-btn ghost' }, s[1]);
      b.addEventListener('click', function () { setTab(s[0]); });
      tabs.appendChild(b);
      return b;
    });
    var newBtn = el('button', { class: 'pod-btn' }, '+ Nový článok');
    var list = el('ul', { class: 'pod-list' });
    body.appendChild(tabs); body.appendChild(newBtn); body.appendChild(el('div', { style: 'height:12px' })); body.appendChild(list);
    newBtn.addEventListener('click', function () { editArticle(null, curSection); });

    function setTab(s) {
      curSection = s;
      tabBtns.forEach(function (b, i) { b.className = 'pod-btn' + (ARTICLE_SECTIONS[i][0] === s ? '' : ' ghost'); });
      load();
    }

    function load() {
      j(API + '/admin/articles').then(function (r) {
        list.innerHTML = '';
        var rows = (r.body || []).filter(function (a) { return (a.section || 'blog') === curSection; });
        if (!rows.length) {
          list.appendChild(el('li', null, '<span class="muted">V tejto sekcii zatiaľ nie sú žiadne články.</span>'));
          return;
        }
        rows.forEach(function (a) {
          var li = el('li');
          li.appendChild(el('div', { class: 'grow' },
            '<strong>' + escapeHtml(a.title) + '</strong><br><span class="muted">' +
            (a.status === 'published' ? 'publikované' : 'koncept') + ' · /' + a.slug + '</span>'));
          var edB = el('button', { class: 'pod-btn ghost' }, 'Upraviť');
          var dlB = el('button', { class: 'pod-btn' }, 'Zmazať');
          edB.addEventListener('click', function () { editArticle(a.id, curSection); });
          dlB.addEventListener('click', function () {
            if (!confirm('Zmazať článok „' + a.title + '"?')) return;
            j(API + '/admin/articles/' + a.id, { method: 'DELETE' }).then(function () { load(); refreshPublic(); });
          });
          li.appendChild(edB); li.appendChild(dlB);
          list.appendChild(li);
        });
      });
    }

    function editArticle(id, section) {
      var f = modal(id ? 'Upraviť článok' : 'Nový článok');
      var wrap = f.body;
      wrap.innerHTML =
        '<div class="pod-field"><label>Titulok</label><input type="text" id="a-title"></div>' +
        '<div class="pod-row">' +
        '<div class="pod-field"><label>Slug (URL)</label><input type="text" id="a-slug" placeholder="nechaj prázdne = z titulku"></div>' +
        '<div class="pod-field"><label>Stav</label><select id="a-status"><option value="draft">Koncept</option><option value="published">Publikované</option></select></div>' +
        '<div class="pod-field"><label>Sekcia</label><select id="a-section"><option value="blog">Blog</option><option value="okolie">Okolie a aktivity</option></select></div>' +
        '</div>' +
        '<div class="pod-field"><label>Perex</label><textarea id="a-excerpt" rows="2"></textarea></div>' +
        '<div class="pod-field"><label>Titulná fotka (URL)</label><input type="text" id="a-cover" placeholder="/assets/img/... alebo /img/..."> <button class="pod-btn ghost" id="a-cover-pick" type="button">Vybrať z galérie</button></div>' +
        '<div class="pod-field"><label>Obsah</label><div id="a-body"></div></div>' +
        '<div style="display:flex;gap:8px;position:sticky;bottom:-20px;background:#fff;padding:12px 0;margin-top:4px;border-top:1px solid #eee"><button class="pod-btn" id="a-save">Uložiť</button><button class="pod-btn ghost" id="a-cancel">Zrušiť</button></div>';
      var ed = window.PODwysiwyg.create(wrap.querySelector('#a-body'), { onImage: pickImage });
      wrap.querySelector('#a-cancel').addEventListener('click', function () { f.close(); });
      wrap.querySelector('#a-cover-pick').addEventListener('click', function () {
        pickImage(function (url) { wrap.querySelector('#a-cover').value = url; });
      });
      wrap.querySelector('#a-section').value = section || 'blog';

      if (id) {
        j(API + '/admin/articles/' + id).then(function (r) {
          var a = r.body;
          wrap.querySelector('#a-title').value = a.title || '';
          wrap.querySelector('#a-slug').value = a.slug || '';
          wrap.querySelector('#a-status').value = a.status || 'draft';
          wrap.querySelector('#a-section').value = a.section || 'blog';
          wrap.querySelector('#a-excerpt').value = a.excerpt || '';
          wrap.querySelector('#a-cover').value = a.cover_url || '';
          ed.set(a.body_html || '');
        });
      }
      wrap.querySelector('#a-save').addEventListener('click', function () {
        var payload = {
          title: wrap.querySelector('#a-title').value.trim(),
          slug: wrap.querySelector('#a-slug').value.trim(),
          status: wrap.querySelector('#a-status').value,
          section: wrap.querySelector('#a-section').value,
          excerpt: wrap.querySelector('#a-excerpt').value.trim(),
          cover_url: wrap.querySelector('#a-cover').value.trim(),
          body_html: ed.get()
        };
        if (!payload.title) { alert('Zadaj titulok.'); return; }
        var req = id
          ? j(API + '/admin/articles/' + id, { method: 'PUT', body: JSON.stringify(payload) })
          : j(API + '/admin/articles', { method: 'POST', body: JSON.stringify(payload) });
        req.then(function (r) {
          if (!r.ok) { alert(r.body && r.body.error || 'Chyba pri ukladaní'); return; }
          f.close(); load(); refreshPublic();
        });
      });
    }

    setTab('blog');
  }

  /* Výber fotky z galérie – zdieľaný (články aj CSS editor hero). */
  function pickImage(cb) {
    var p = modal('Vyber fotku');
    j(API + '/admin/gallery').then(function (r) {
      var grid = el('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px' });
      (r.body || []).forEach(function (g) {
        var b = el('button', { class: 'pod-btn ghost', style: 'padding:0;border:0' },
          '<img src="' + g.url + '" style="width:100%;height:90px;object-fit:cover;border-radius:6px">');
        b.addEventListener('click', function () { cb(g.url, g.alt); p.close(); });
        grid.appendChild(b);
      });
      p.body.appendChild(grid);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- zmena hesla správcu ---------- */
  function openPassword() {
    var ui = modal('Zmeniť heslo');
    var field = function (label, auto) {
      var f = el('div', { class: 'pod-field' });
      f.appendChild(el('label', { text: label }));
      var i = el('input', { type: 'password', autocomplete: auto });
      f.appendChild(i);
      ui.body.appendChild(f);
      return i;
    };
    var cur = field('Súčasné heslo', 'current-password');
    var nw = field('Nové heslo (aspoň 8 znakov)', 'new-password');
    var nw2 = field('Nové heslo znova', 'new-password');
    var msg = el('p', { style: 'margin:0 0 12px;font:14px system-ui;color:#c00;min-height:1.2em' });
    var btn = el('button', { class: 'pod-btn' }, 'Zmeniť heslo');
    ui.body.appendChild(msg); ui.body.appendChild(btn);
    var say = function (t, ok) { msg.style.color = ok ? '#0a7a3a' : '#c00'; msg.textContent = t; };

    function submit() {
      if (!cur.value || !nw.value || !nw2.value) return say('Vyplň všetky tri polia.');
      if (nw.value.length < 8) return say('Nové heslo musí mať aspoň 8 znakov.');
      if (nw.value !== nw2.value) return say('Nové heslá sa nezhodujú.');
      if (nw.value === cur.value) return say('Nové heslo musí byť iné ako súčasné.');
      btn.disabled = true; say('');
      j(API + '/admin/password', { method: 'POST', body: JSON.stringify({ current: cur.value, next: nw.value }) })
        .then(function (r) {
          btn.disabled = false;
          if (!r.ok) { say((r.body && r.body.error) || 'Heslo sa nepodarilo zmeniť.'); return; }
          cur.value = nw.value = nw2.value = '';
          say('Heslo je zmenené. Pri ďalšom prihlásení použi nové heslo.', true);
          setTimeout(ui.close, 2500);
        })
        .catch(function () { btn.disabled = false; say('Chyba spojenia, skús znova.'); });
    }
    btn.addEventListener('click', submit);
    [cur, nw, nw2].forEach(function (i) {
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    });
    cur.focus();
  }

  /* ---------- FAB (tlačidlá vpravo dole) ---------- */
  function mountFab(state) {
    injectStyles();
    var fab = el('div', { class: 'pod-adm-fab' });
    var gear = el('button', { title: 'CSS editor' }, '⚙');
    var arts = el('button', { title: 'Články' }, '<span class="lbl">Články</span>');
    var gal = el('button', { title: 'Galéria' }, '<span class="lbl">Foto</span>');
    var cal = el('button', { title: 'Kalendár obsadenosti' }, '<span class="lbl">Kalendár</span>');
    var pwd = el('button', { title: 'Zmeniť heslo' }, '🔑');
    var out = el('button', { title: 'Odhlásiť sa' }, '⎋');
    gear.addEventListener('click', function () { openPanel(state); });
    arts.addEventListener('click', openArticles);
    gal.addEventListener('click', openGallery);
    cal.addEventListener('click', openCalendar);
    pwd.addEventListener('click', openPassword);
    out.addEventListener('click', function () {
      j(API + '/auth/logout', { method: 'POST' }).then(function () { location.reload(); });
    });
    fab.appendChild(gear); fab.appendChild(arts); fab.appendChild(gal); fab.appendChild(cal); fab.appendChild(pwd); fab.appendChild(out);
    document.body.appendChild(fab);
  }

  /* ---------- prihlasovacia stránka ---------- */
  function renderLogin() {
    injectStyles();
    var root = document.getElementById('admin-root') || document.body;
    var box = el('div', { class: 'pod-login' });
    box.innerHTML = '<h1>Správca webu</h1><p class="muted">Prihlás sa do administrácie Štúdiá Podhájska.</p>';
    var mode = { setup: false };

    function form() {
      box.querySelectorAll('.dyn').forEach(function (n) { n.remove(); });
      var u = el('input', { class: 'dyn', type: 'text', placeholder: 'Používateľské meno', autocomplete: 'username' });
      var p = el('input', { class: 'dyn', type: 'password', placeholder: 'Heslo', autocomplete: mode.setup ? 'new-password' : 'current-password' });
      var t = el('input', { class: 'dyn', type: 'text', placeholder: 'Setup token' });
      var btn = el('button', { class: 'dyn' }, mode.setup ? 'Vytvoriť správcu' : 'Prihlásiť sa');
      var msg = el('div', { class: 'dyn msg' });
      var swap = el('div', { class: 'dyn muted', style: 'margin-top:14px;cursor:pointer;text-decoration:underline' },
        mode.setup ? 'Späť na prihlásenie' : 'Prvé spustenie? Vytvoriť správcu');
      box.appendChild(u); box.appendChild(p);
      if (mode.setup) box.appendChild(t);
      box.appendChild(btn); box.appendChild(msg); box.appendChild(swap);
      swap.addEventListener('click', function () { mode.setup = !mode.setup; form(); });
      btn.addEventListener('click', function () {
        msg.textContent = '';
        var url = mode.setup ? API + '/setup' : API + '/auth/login';
        var payload = mode.setup
          ? { username: u.value.trim(), password: p.value, token: t.value.trim() }
          : { username: u.value.trim(), password: p.value };
        btn.disabled = true;
        j(url, { method: 'POST', body: JSON.stringify(payload) }).then(function (r) {
          btn.disabled = false;
          if (!r.ok) { msg.textContent = (r.body && r.body.error) || 'Nepodarilo sa'; return; }
          if (mode.setup) { mode.setup = false; msg.style.color = '#0a0'; msg.textContent = 'Správca vytvorený, prihlás sa.'; form(); }
          else location.href = '/';
        });
      });
    }
    form();
    root.appendChild(box);
  }

  /* ---------- štart ---------- */
  if (document.body.getAttribute('data-admin-page') === 'login') {
    renderLogin();
    return;
  }
  j(API + '/auth/me').then(function (r) {
    if (!r.ok || !r.body.authed) return;
    var boot = function (state) { mountFab(state); };
    if (window.PODsite && window.PODsite.data) boot(window.PODsite.data);
    else document.addEventListener('pod:site-ready', function (e) { boot(e.detail); }, { once: true });
  });
})();
