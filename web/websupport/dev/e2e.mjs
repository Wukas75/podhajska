// lokálne: node e2e.mjs | proti serveru: E2E_BASE=https://… E2E_TOKEN=<setup_token> E2E_PASS=<heslo admina> node e2e.mjs
// Vytvorí admina "admin" s E2E_PASS (DB musí byť bez admina). Na konci vráti tému/SEO/kontakt,
// zmaže testovacie rezervácie a import URL izby 3 -- testovací obsah nezostane.
const B = process.env.E2E_BASE || 'http://localhost:8088'
const TOKEN = process.env.E2E_TOKEN || 'tok'
const PASS = process.env.E2E_PASS || 'heslo1234'
const CRON = process.env.E2E_CRON || (process.env.E2E_BASE ? '' : 'crontok')
const MAILPIT = process.env.E2E_BASE ? process.env.E2E_MAILPIT : (process.env.E2E_MAILPIT ?? 'http://localhost:8025')
const ICS_SELF = process.env.E2E_BASE ? B + '/ics/2.ics' : 'http://localhost/ics/2.ics'
let cookie = ''
let fails = 0
const ok = (cond, msg, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg + (cond ? '' : ' :: ' + JSON.stringify(extra)?.slice(0, 500))); if (!cond) fails++ }
async function req(method, path, body) {
  const h = {}; if (cookie) h.cookie = cookie
  let b
  if (body instanceof FormData) b = body
  else if (body !== undefined) { h['content-type'] = 'application/json'; b = JSON.stringify(body) }
  const r = await fetch(B + path, { method, headers: h, body: b })
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { s: r.status, j, t, h: r.headers }
}
const d = (n) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const day = (s) => String(s).slice(0, 10)
let f

// cesty ako na Cloudflare Pages (odkaz „Prihlásenie správcu" = /admin)
for (const [p, code, loc] of [['/admin', 200], ['/admin.html', 301, '/admin'], ['/admin/', 301, '/admin'], ['/index.html', 301, '/'], ['/studia', 200], ['/uploads/nie-je.jpg', 404], ['/lib/config.php', 403]]) {
  const x = await fetch(B + p, { redirect: 'manual' })
  const l = x.headers.get('location'); const okLoc = !loc || (l && new URL(l, B).pathname === loc)
  ok(x.status === code && okLoc, `route ${p} -> ${x.status} ${l || ''}`, { status: x.status, l })
}
ok((await (await fetch(B + '/admin')).text()).includes('Správca'), '/admin serves admin.html', null)
let r = await req('GET', '/api/admin/articles'); ok(r.s === 401, 'admin needs auth', r)
r = await req('POST', '/api/setup', { token: 'bad', username: 'admin', password: PASS }); ok(r.s === 403 || r.s === 401, 'setup bad token rejected', r)
r = await req('POST', '/api/setup', { token: TOKEN, username: 'admin', password: PASS }); ok(r.s === 200, 'setup', r)
r = await req('POST', '/api/setup', { token: TOKEN, username: 'x', password: PASS }); ok(r.s >= 400, 'second setup refused', r)
cookie = ''
r = await req('POST', '/api/auth/login', { username: 'admin', password: 'wrong' }); ok(r.s === 401, 'bad login', r)
r = await req('POST', '/api/auth/login', { username: 'admin', password: PASS }); ok(r.s === 200 && cookie, 'login', r)
r = await req('GET', '/api/auth/me'); ok(r.j.authed === true, 'me authed', r)
r = await req('POST', '/api/admin/password', { current: PASS, next: 'noveheslo99' }); ok(r.s === 200, 'change password', r)
r = await req('POST', '/api/admin/password', { current: 'noveheslo99', next: PASS }); ok(r.s === 200, 'change password back', r)

const orig = (await req('GET', '/api/site')).j
ok(['theme_vars', 'texts', 'seo', 'contact'].every(k => orig[k] && typeof orig[k] === 'object' && !Array.isArray(orig[k])), 'site settings are objects, not []', orig)
r = await req('PUT', '/api/admin/theme', { theme_vars: orig.theme_vars, texts: {}, seo: {}, contact: {} })
r = await req('GET', '/api/site'); ok(!Array.isArray(r.j.texts) && !Array.isArray(r.j.seo) && JSON.stringify(r.j.theme_vars) === JSON.stringify(orig.theme_vars), 'empty {} round-trips as {}', r.j)
// theme / seo / contact with diacritics
r = await req('PUT', '/api/admin/theme', { theme_vars: { accent: '#ff0000' }, theme_css: '.x{}', texts: { 'hero.title': 'Ahoj Žlťučký kôň' }, seo: { title: 'SEO Štúdiá' }, contact: { phone: '+421 900 000 000' } })
ok(r.s === 200, 'theme put', r)
r = await req('GET', '/api/site')
ok(r.j.theme_vars?.accent === '#ff0000' && r.j.texts?.['hero.title'] === 'Ahoj Žlťučký kôň' && r.j.seo?.title === 'SEO Štúdiá' && r.j.contact?.phone, 'site reflects theme', r.j)
ok(Array.isArray(r.j.gallery) && r.j.gallery.length > 0 && r.j.gallery.every(g => g.category !== 'clanky'), 'public gallery excludes clanky (' + r.j.gallery?.length + ')', Object.keys(r.j))

// SEO meta server-side (index.php, fáza 5)
const staticHtml = (await import('node:fs')).readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8')
const tag = (html, re) => (html.match(re) || [])[0]
const seoTheme = (seo) => req('PUT', '/api/admin/theme', { theme_vars: { accent: '#ff0000' }, texts: { 'hero.title': 'Ahoj Žlťučký kôň' }, seo, contact: { phone: '+421 900 000 000' } })
await seoTheme({ title: 'Štúdiá "A" <b> & $1 \\1', description: 'Popis ľščť "x"', ogImage: '/assets/img/og.jpg', noindex: true })
for (const p of ['/', '/index.html']) {
  f = await fetch(B + p); const html = await f.text()
  ok(f.headers.get('content-type')?.startsWith('text/html'), p + ' is html', f.headers.get('content-type'))
  ok(html.includes('<title>Štúdiá &quot;A&quot; &lt;b&gt; &amp; $1 \\1</title>'), p + ' title escaped', tag(html, /<title>.*?<\/title>/))
  ok(html.includes('<meta property="og:title" content="Štúdiá &quot;A&quot; &lt;b&gt; &amp; $1 \\1" />'), p + ' og:title', tag(html, /<meta property="og:title"[^>]*>/))
  ok(html.includes('<meta name="description" content="Popis ľščť &quot;x&quot;" />') && html.includes('<meta property="og:description" content="Popis ľščť &quot;x&quot;" />'), p + ' description', tag(html, /<meta name="description"[^>]*>/))
  ok(html.includes('<meta property="og:image" content="' + B + '/assets/img/og.jpg" />'), p + ' og:image absolute', tag(html, /<meta property="og:image"[^>]*>/))
  ok((html.match(/name="robots" content="noindex, nofollow"/g) || []).length === 1 && html.indexOf('noindex') < html.indexOf('</head>'), p + ' noindex once in head', null)
}
await seoTheme({ ogImage: 'https://cdn.example.com/x.jpg' })
f = await fetch(B + '/'); let html = await f.text()
ok(html.includes('content="https://cdn.example.com/x.jpg"') && !html.includes('noindex') && html.includes('<title>Štúdiá Podhájska – pokojné ubytovanie pre dospelých</title>'), 'partial seo: absolute ogImage kept, rest static', tag(html, /<title>.*?<\/title>/))
await seoTheme({})
html = await (await fetch(B + '/')).text()
ok(html.replace(/\?v=\d+"/g, '"') === staticHtml, 'empty seo = static index.html (okrem ?v= pri assetoch)', null)
ok(/href="\/assets\/css\/base\.css\?v=\d+"/.test(html) && /src="\/assets\/js\/site\.js\?v=\d+"/.test(html), 'asset cache-busting ?v=', html.match(/<link[^>]*base\.css[^>]*>/)?.[0])
ok(/max-age/.test((await fetch(B + '/assets/img/bazen-trysky.jpg', { method: 'HEAD' })).headers.get('cache-control') || '') && /no-cache/.test((await fetch(B + '/assets/css/base.css', { method: 'HEAD' })).headers.get('cache-control') || ''), 'cache headers (img max-age, css no-cache)', null)
await seoTheme({ title: 'SEO Štúdiá' })

// articles
r = await req('GET', '/api/admin/articles'); ok(r.s === 200, 'articles list', r)
r = await req('POST', '/api/admin/articles', { title: 'Testovací článok ľščťž', excerpt: 'e', body_html: '<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:x">l</a><img src="/uploads/gallery/a.jpg"></p>', status: 'published', section: 'okolie' })
ok(r.s === 200 && r.j.id, 'article create', r); const aid = r.j.id
r = await req('GET', '/api/admin/articles/' + aid); const art = r.j.article ?? r.j
ok(art.slug === 'testovaci-clanok-lsctz', 'slugify diacritics: ' + art.slug, art)
ok(!/script|onclick|javascript/i.test(art.body_html) && /\/uploads\/gallery\/a\.jpg/.test(art.body_html), 'sanitize: ' + art.body_html, art.body_html)
r = await req('GET', '/api/articles/' + art.slug); ok(r.s === 200, 'public article by slug', r)
r = await req('PUT', '/api/admin/articles/' + aid, { status: 'draft' }); ok(r.s === 200, 'article to draft', r)
r = await req('GET', '/api/articles/' + art.slug); ok(r.s === 404, 'draft hidden publicly', r)
r = await req('POST', '/api/admin/articles', { title: 'Testovací článok ľščťž' }); const aid2 = r.j.id
r = await req('GET', '/api/admin/articles/' + aid2); ok((r.j.article ?? r.j).slug === 'testovaci-clanok-lsctz-2', 'unique slug: ' + (r.j.article ?? r.j).slug, r.j)
r = await req('DELETE', '/api/admin/articles/' + aid); ok(r.s === 200, 'article delete', r)
await req('DELETE', '/api/admin/articles/' + aid2)

// gallery upload
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
let fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'fotka.php'); fd.append('alt', 'Alt ž'); fd.append('category', 'wellness')
r = await req('POST', '/api/admin/gallery', fd); ok(r.s === 200 && /\.png$/.test(r.j.url), 'upload (ext from mime): ' + r.j.url, r); const gid = r.j.id, gurl = r.j.url
f = await fetch(B + gurl); ok(f.status === 200 && f.headers.get('content-type') === 'image/png', 'uploaded file served', f.status)
fd = new FormData(); fd.append('file', new Blob(['<?php echo 1;'], { type: 'image/png' }), 'x.png')
r = await req('POST', '/api/admin/gallery', fd); ok(r.s === 400, 'non-image rejected despite claimed type', r)
r = await req('PUT', '/api/admin/gallery/' + gid, { alt: 'Nový alt', category: 'studio' }); ok(r.s === 200, 'gallery put', r)
r = await req('GET', '/api/admin/gallery'); const imgs = r.j.images ?? r.j; const me = imgs.find(i => i.id === gid); ok(me?.alt === 'Nový alt' && me.category === 'studio', 'gallery updated', me)
const ids = imgs.map(i => i.id).reverse()
r = await req('PUT', '/api/admin/gallery/reorder', { ids }); ok(r.s === 200, 'reorder', r)
r = await req('GET', '/api/admin/gallery'); ok((r.j.images ?? r.j)[0].id === ids[0], 'reorder applied', (r.j.images ?? r.j).slice(0, 2))
r = await req('DELETE', '/api/admin/gallery/' + gid); ok(r.s === 200, 'gallery delete', r)
f = await fetch(B + gurl); ok(f.status === 404, 'deleted file gone', f.status)

// calendar
if (MAILPIT) await fetch(MAILPIT + '/api/v1/messages', { method: 'DELETE' }).catch(() => {})
r = await req('POST', '/api/inquiry', { room_id: 1, start_date: d(10), end_date: d(13), name: 'Ján Hosť', email: 'jan@example.com', phone: '0900 123 456', note: 'Príchod <b>večer</b>' }); ok(r.s === 200, 'inquiry', r)
if (MAILPIT) {
  let msg = null
  for (let i = 0; i < 20 && !msg; i++) { const l = await (await fetch(MAILPIT + '/api/v1/messages')).json(); msg = l.messages?.[0]; if (!msg) await new Promise((res) => setTimeout(res, 250)) }
  ok(msg, 'reservation e-mail sent', null)
  if (msg) {
    const full = await (await fetch(MAILPIT + '/api/v1/message/' + msg.ID)).json()
    const dd = (n) => { const [y, m, dy] = d(n).split('-'); return `${+dy}. ${+m}. ${y}` }
    ok(full.To?.[0]?.Address === 'info@podhajska.net', 'mail to info@podhajska.net', full.To)
    ok(full.ReplyTo?.[0]?.Address === 'jan@example.com', 'mail reply-to = guest', full.ReplyTo)
    ok(full.Subject === `Rezervácia ${dd(10)} → ${dd(13)} · Štúdio 1 · Ján Hosť`, 'mail subject: ' + full.Subject, full.Subject)
    ok(/Ján Hosť/.test(full.HTML) && /0900 123 456/.test(full.HTML) && /3 noci/.test(full.HTML) && full.HTML.includes('Príchod &lt;b&gt;večer&lt;/b&gt;'), 'mail body (escaped note)', full.HTML?.slice(0, 600))
    ok(full.From?.Address === 'info@podhajska.net' && full.From?.Name === 'Bungalovy Classic', `mail from ${full.From?.Name} <${full.From?.Address}>`, full.From)
  }
}
r = await req('POST', '/api/inquiry', { room_id: 1, start_date: d(12), end_date: d(14), name: 'X', email: 'x@example.com', phone: '1' }); ok(r.s === 409, 'overlap 409', r)
r = await req('POST', '/api/inquiry', { room_id: 1, start_date: d(13), end_date: d(14), name: 'X', email: 'x@example.com', phone: '1' }); ok(r.s === 200, 'back-to-back allowed (end exclusive)', r)
r = await req('POST', '/api/inquiry', { room_id: 1, start_date: d(20), end_date: d(21), name: 'X', email: 'x@example.com' }); ok(r.s === 400, 'phone required', r)
r = await req('GET', '/api/availability'); ok(r.j.busy?.filter(b => b.room_id === 1).length === 2 && r.j.busy.every(b => b.status === 'pending'), 'availability shows pending', r.j.busy)
ok(!JSON.stringify(r.j).includes('jan@example.com'), 'availability leaks no guest data', r.j)
r = await req('GET', '/api/admin/calendar'); ok(r.s === 200, 'admin calendar', r)
const pend = (r.j.bookings ?? []).find(b => b.guest_email === 'jan@example.com'); ok(pend, 'pending booking in admin', r.j)
r = await req('PATCH', '/api/admin/bookings/' + pend.id, { status: 'confirmed' }); ok(r.s === 200, 'confirm', r)
r = await req('POST', '/api/admin/bookings/' + pend.id + '/free-day', { day: d(11) }); ok(r.s === 200, 'free middle day (split)', r)
r = await req('GET', '/api/admin/calendar')
const jan = r.j.bookings.filter(b => b.guest_email === 'jan@example.com' && b.status === 'confirmed').map(b => day(b.start_date) + '..' + day(b.end_date)).sort()
ok(JSON.stringify(jan) === JSON.stringify([d(10) + '..' + d(11), d(12) + '..' + d(13)]), 'split result ' + jan, jan)
r = await req('POST', '/api/admin/bookings', { room_id: 2, start_date: d(5), end_date: d(8), summary: 'Ručne' }); ok(r.s === 200, 'manual block room 2', r)
r = await req('POST', '/api/admin/bookings', { room_id: 2, start_date: d(4), end_date: d(3) }); ok(r.s === 400, 'manual end<=start rejected', r)

// ics export + import loop
r = await req('GET', '/ics/2.ics'); ok(r.s === 200 && r.t.includes('BEGIN:VEVENT') && r.t.includes('DTSTART;VALUE=DATE:' + d(5).replaceAll('-', '')), 'ics export room 2', r.t)
ok(r.t.includes('\r\n'), 'ics CRLF line endings', null)
r = await req('PUT', '/api/admin/rooms/3', { ics_import_url: ICS_SELF }); ok(r.s === 200, 'set import url', r)
r = await req('POST', '/api/admin/calendar/sync'); ok(r.s === 200 && r.j?.ok === true && typeof r.t === 'string' && r.t.startsWith('{'), 'sync ' + JSON.stringify(r.j).slice(0, 200), r.t)
if (CRON) {
  for (const [q, code] of [['', 403], ['?token=zle', 403], ['?token=' + CRON, 200]]) {
    const x = await fetch(B + '/api/cron/sync' + q); const j = await x.json().catch(() => null)
    ok(x.status === code && (code !== 200 || j?.ok === true), 'cron url ' + (q ? q.slice(0, 12) : '(bez tokenu)') + ' -> ' + x.status, j)
  }
}
r = await req('GET', '/api/admin/calendar')
const imp = r.j.bookings.filter(b => b.room_id === 3 && b.source === 'booking'); ok(imp.length === 1 && day(imp[0].start_date) === d(5), 'imported into room 3', r.j.bookings.filter(b => b.room_id === 3))
const room3 = (r.j.rooms ?? []).find(x => x.id === 3); ok(room3?.last_import_msg, 'room last_import_msg: ' + room3?.last_import_msg, room3)
r = await req('GET', '/ics/3.ics'); ok(!r.t.includes('BEGIN:VEVENT'), 'booking-source not re-exported', r.t)
if (imp[0]) { r = await req('POST', '/api/admin/bookings/' + imp[0].id + '/free-day', { day: d(6) }); ok(r.s >= 400, 'free-day refused on booking source', r) }
await req('POST', '/api/admin/calendar/sync'); r = await req('GET', '/api/admin/calendar')
ok(r.j.bookings.filter(b => b.room_id === 3 && b.source === 'booking').length === 1, 'resync idempotent', null)
const man = r.j.bookings.find(b => b.room_id === 2); await req('DELETE', '/api/admin/bookings/' + man.id)
await req('POST', '/api/admin/calendar/sync'); r = await req('GET', '/api/admin/calendar')
ok(r.j.bookings.filter(b => b.room_id === 3).length === 0, 'vanished event removed on sync', r.j.bookings.filter(b => b.room_id === 3))

// upratanie: pôvodná téma, žiadne testovacie rezervácie ani import URL
r = await req('PUT', '/api/admin/theme', { theme_vars: orig.theme_vars, theme_css: orig.theme_css, texts: orig.texts, seo: orig.seo, contact: orig.contact }); ok(r.s === 200, 'restore theme', r)
r = await req('PUT', '/api/admin/rooms/3', { ics_import_url: '' }); ok(r.s === 200, 'clear import url', r)
r = await req('GET', '/api/admin/calendar'); for (const b of r.j.bookings ?? []) await req('DELETE', '/api/admin/bookings/' + b.id)
r = await req('GET', '/api/admin/calendar'); ok((r.j.bookings ?? []).length === 0, 'bookings cleaned', r.j.bookings)
r = await req('GET', '/api/site'); ok(JSON.stringify(r.j.theme_vars) === JSON.stringify(orig.theme_vars) && JSON.stringify(r.j.seo) === JSON.stringify(orig.seo), 'theme restored', r.j.seo)
r = await req('POST', '/api/auth/logout'); r = await req('GET', '/api/auth/me'); ok(r.j.authed === false, 'logout', r)
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
