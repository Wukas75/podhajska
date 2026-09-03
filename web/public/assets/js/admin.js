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
      '.pod-field input[type=text],.pod-field textarea,.pod-field select{width:100%;border:1px solid #ccc;border-radius:6px;padding:8px;font:14px system-ui}',
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
    var textsDraft = Object.assign({}, state.texts || {});
    var panel = el('div', { class: 'pod-panel', id: 'pod-panel' });

    function sync() { applyLive(vars); }

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
    (function heroImageRow() {
      var wrap = el('div', { class: 'row' });
      wrap.appendChild(el('label', { text: 'Úvodná fotka' }));
      var thumb = el('img', { src: vars.heroImage || '', alt: '', style: 'display:block;width:100%;height:82px;object-fit:cover;border-radius:6px;margin-bottom:6px;background:#333' });
      var pick = el('button', { class: 'pod-btn ghost', style: 'margin-right:6px' }, 'Zmeniť fotku');
      var reset = el('button', { class: 'pod-btn ghost' }, 'Predvolená');
      pick.addEventListener('click', function () {
        pickImage(function (url) { vars.heroImage = url; thumb.src = url; sync(); });
      });
      reset.addEventListener('click', function () {
        vars.heroImage = DEFAULTS.heroImage; thumb.src = DEFAULTS.heroImage; sync();
      });
      wrap.appendChild(thumb); wrap.appendChild(pick); wrap.appendChild(reset);
      panel.appendChild(wrap);
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
    var editing = false;
    teBtn.addEventListener('click', function () {
      editing = !editing;
      teBtn.textContent = editing ? 'Vypnúť editovanie textov' : 'Zapnúť editovanie textov';
      document.querySelectorAll('[data-edit]').forEach(function (node) {
        node.classList.toggle('pod-editing', editing);
        node.contentEditable = editing ? 'true' : 'false';
        // Ak je editovaný text vnútri odkazu (napr. logo v hlavičke), odkaz
        // pri kliknutí chytá navigáciu aj drag a nedá sa doň kliknúť kurzorom.
        // Počas editovania mu dočasne odoberieme href (a po skončení vrátime).
        var a = node.closest('a');
        if (a) {
          if (editing) {
            if (a.hasAttribute('href')) { a.dataset.podEditHref = a.getAttribute('href'); a.removeAttribute('href'); }
          } else if (a.dataset.podEditHref != null) {
            a.setAttribute('href', a.dataset.podEditHref);
            delete a.dataset.podEditHref;
          }
        }
        if (editing) {
          node.addEventListener('input', onEdit);
        } else {
          node.removeEventListener('input', onEdit);
        }
      });
    });
    function onEdit(e) { textsDraft[e.currentTarget.dataset.edit] = e.currentTarget.innerHTML.trim(); }
    teRow.appendChild(teBtn);
    teRow.appendChild(el('p', { class: 'val' }, ''));
    teRow.appendChild(el('label', { text: 'Po zapnutí klikni na text na stránke a prepíš ho. Uloží sa tlačidlom nižšie.' }));
    panel.appendChild(teRow);

    var actions = el('div', { class: 'actions' });
    var saveBtn = el('button', { class: 'pod-btn' }, 'Uložiť');
    var expBtn = el('button', { class: 'pod-btn sec' }, 'Exportovať CSS');
    var resetBtn = el('button', { class: 'pod-btn ghost' }, 'Reset');
    saveBtn.addEventListener('click', function () {
      var css = buildCss(vars);
      saveBtn.textContent = 'Ukladám…'; saveBtn.disabled = true;
      j(API + '/admin/theme', { method: 'PUT', body: JSON.stringify({ theme_vars: vars, theme_css: css, texts: textsDraft }) })
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

  /* ---------- FAB (tlačidlá vpravo dole) ---------- */
  function mountFab(state) {
    injectStyles();
    var fab = el('div', { class: 'pod-adm-fab' });
    var gear = el('button', { title: 'CSS editor' }, '⚙');
    var arts = el('button', { title: 'Články' }, '<span class="lbl">Články</span>');
    var gal = el('button', { title: 'Galéria' }, '<span class="lbl">Foto</span>');
    var out = el('button', { title: 'Odhlásiť sa' }, '⎋');
    gear.addEventListener('click', function () { openPanel(state); });
    arts.addEventListener('click', openArticles);
    gal.addEventListener('click', openGallery);
    out.addEventListener('click', function () {
      j(API + '/auth/logout', { method: 'POST' }).then(function () { location.reload(); });
    });
    fab.appendChild(gear); fab.appendChild(arts); fab.appendChild(gal); fab.appendChild(out);
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
