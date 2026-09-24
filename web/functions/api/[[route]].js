// API pre Štúdiá Podhájska – Cloudflare Pages Function (Hono).
// Obsluhuje všetky /api/* cesty. Dáta: D1 (binding DB), fotky: R2 (binding R2).

import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { parseIcs, addDays } from '../_ical.js'

const app = new Hono().basePath('/api')
const enc = new TextEncoder()
const dec = new TextDecoder()

/* ---------- pomocné: base64 / crypto ---------- */

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const b64d = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urld = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return b64d(str)
}

async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  )
  return b64(bits)
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await pbkdf2(password, salt), salt: b64(salt) }
}
async function verifyPassword(password, hashB64, saltB64) {
  const h = await pbkdf2(password, b64d(saltB64))
  return timingSafeEqual(h, hashB64)
}
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return b64url(sig)
}
async function makeSession(secret, uid, days = 30) {
  const payload = b64url(enc.encode(JSON.stringify({ uid, exp: Date.now() + days * 864e5 })))
  return `${payload}.${await hmac(secret, payload)}`
}
async function readSession(secret, token) {
  if (!token || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  if (!timingSafeEqual(await hmac(secret, payload), sig)) return null
  try {
    const obj = JSON.parse(dec.decode(b64urld(payload)))
    if (!obj.exp || obj.exp < Date.now()) return null
    return obj
  } catch {
    return null
  }
}

/* ---------- pomocné: rôzne ---------- */

const safeJson = (str, fallback) => {
  try {
    return str ? JSON.parse(str) : fallback
  } catch {
    return fallback
  }
}

const COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g')
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/* ---------- pomocné: kalendár ---------- */

const YMD = /^\d{4}-\d{2}-\d{2}$/
const ymd = (v) => (YMD.test(String(v || '')) ? String(v) : null)
const todayYmd = () => new Date().toISOString().slice(0, 10)

// Odloží beh na pozadie (Cloudflare waitUntil); v lokálnom shime len fire-and-forget.
function defer(c, promise) {
  const p = Promise.resolve(promise).catch((e) => console.error('defer', e))
  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') c.executionCtx.waitUntil(p)
}

// Naimportuje obsadenosť z Booking.com (.ics URL per izba) do tabuľky bookings (source='booking').
async function syncImports(env) {
  const rooms = (await env.DB.prepare("SELECT id, ics_import_url FROM rooms WHERE ics_import_url != ''").all()).results || []
  const out = []
  for (const room of rooms) {
    try {
      const resp = await fetch(room.ics_import_url, { headers: { 'User-Agent': 'StudiaPodhajska-Calendar/1.0' } })
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const events = parseIcs(await resp.text())
      const uids = []
      for (const ev of events) {
        if (!ev.start || !ev.end) continue
        const uid = 'bk-' + room.id + '-' + (ev.uid || ev.start + '_' + ev.end)
        uids.push(uid)
        await env.DB.prepare(
          `INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary)
           VALUES (?, ?, ?, 'booking', 'confirmed', ?, ?)
           ON CONFLICT(uid) DO UPDATE SET
             start_date = excluded.start_date, end_date = excluded.end_date,
             summary = excluded.summary, status = 'confirmed', updated_at = datetime('now')`,
        )
          .bind(room.id, ev.start, ev.end, uid, String(ev.summary || 'Booking.com').slice(0, 120))
          .run()
      }
      // zmaž importované, ktoré už v Booking kalendári nie sú (zrušené rezervácie)
      if (uids.length) {
        const ph = uids.map(() => '?').join(',')
        await env.DB.prepare(`DELETE FROM bookings WHERE room_id = ? AND source = 'booking' AND uid NOT IN (${ph})`)
          .bind(room.id, ...uids)
          .run()
      } else {
        await env.DB.prepare("DELETE FROM bookings WHERE room_id = ? AND source = 'booking'").bind(room.id).run()
      }
      await env.DB.prepare("UPDATE rooms SET last_import_at = datetime('now'), last_import_msg = ? WHERE id = ?")
        .bind(events.length + ' udalostí', room.id)
        .run()
      out.push({ room_id: room.id, ok: true, events: events.length })
    } catch (e) {
      await env.DB.prepare("UPDATE rooms SET last_import_at = datetime('now'), last_import_msg = ? WHERE id = ?")
        .bind('Chyba: ' + String(e.message || e).slice(0, 160), room.id)
        .run()
      out.push({ room_id: room.id, ok: false, error: String(e.message || e) })
    }
  }
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('calendar_last_sync', datetime('now'), datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')`,
  ).run()
  return out
}

// Lazy cron: ak od posledného importu ubehlo >2 h, spusti ho na pozadí.
async function maybeSync(c) {
  try {
    const row = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'calendar_last_sync'").first()
    const last = row && row.value ? Date.parse(String(row.value).replace(' ', 'T') + 'Z') : 0
    if (Date.now() - last > 2 * 3600 * 1000) {
      await c.env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES ('calendar_last_sync', datetime('now'), datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')`,
      ).run()
      defer(c, syncImports(c.env))
    }
  } catch {
    /* ignoruj */
  }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Upozornenie na novú rezerváciu. Pošle e-mail cez Resend (ak je RESEND_API_KEY) a/alebo
// POST na INQUIRY_WEBHOOK_URL. Bez konfigurácie len zaloguje – rezervácia je aj tak v admine.
async function notifyReservation(env, info) {
  if (env.INQUIRY_WEBHOOK_URL) {
    await fetch(env.INQUIRY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(info),
    }).catch((e) => console.error('webhook', e))
  }
  if (!env.RESEND_API_KEY) {
    console.log('Nová rezervácia (e-mail nenakonfigurovaný):', JSON.stringify(info))
    return
  }
  const html =
    `<h2>Nová rezervácia ubytovania</h2><ul>` +
    `<li><b>${esc(info.roomName)}</b></li>` +
    `<li>Termín: <b>${info.start} → ${info.end}</b> (${info.nights} ${info.nights === 1 ? 'noc' : info.nights < 5 ? 'noci' : 'nocí'})</li>` +
    `<li>Meno: ${esc(info.name)}</li>` +
    `<li>E-mail: ${esc(info.email)}</li>` +
    `<li>Telefón: ${esc(info.phone)}</li>` +
    (info.note ? `<li>Poznámka: ${esc(info.note)}</li>` : '') +
    (info.clash ? `<li><b>Pozor:</b> termín sa prekrýva s existujúcou rezerváciou.</li>` : '') +
    `</ul><p>Termín je v kalendári označený ako <b>rezervovaný</b>. Po kontaktovaní klienta ho v admin → Kalendár potvrďte (zmení sa na obsadený) alebo zamietnite.</p>`
  const payload = {
    from: env.INQUIRY_FROM || 'Štúdiá Podhájska <rezervacie@podhajska.net>',
    to: [env.INQUIRY_TO || 'studiapodhajska@gmail.com'],
    subject: `Rezervácia ${info.start} → ${info.end} · ${info.roomName} · ${info.name}`,
    html,
  }
  if (info.email) payload.reply_to = info.email
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((e) => { console.error('resend', e); return null })
  if (r && !r.ok) console.error('resend', r.status, await r.text().catch(() => ''))
}

const ALLOWED = new Set(['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'blockquote'])
const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i')) || attrs.match(new RegExp(name + "\\s*=\\s*'([^']*)'", 'i'))
  return m ? m[1] : ''
}
function sanitizeHtml(html) {
  if (!html) return ''
  let s = String(html)
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<(script|style|iframe|object|embed|form|input|textarea|link|meta|svg)[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<(script|style|iframe|object|embed|form|input|textarea|link|meta|svg)[^>]*>/gi, '')
  s = s.replace(/<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (m, close, tag, attrs) => {
    tag = tag.toLowerCase()
    if (tag === 'b') tag = 'strong'
    if (tag === 'i') tag = 'em'
    if (tag === 'div') tag = 'p'
    if (!ALLOWED.has(tag)) return ''
    if (close) return `</${tag}>`
    if (tag === 'a') {
      const href = attr(attrs, 'href')
      return /^(https?:|mailto:|\/)/i.test(href)
        ? `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener" target="_blank">`
        : '<a>'
    }
    if (tag === 'img') {
      const src = attr(attrs, 'src')
      if (!/^\/(img|assets)\//.test(src)) return ''
      return `<img src="${src.replace(/"/g, '&quot;')}" alt="${attr(attrs, 'alt').replace(/"/g, '&quot;')}" loading="lazy">`
    }
    return `<${tag}>`
  })
  return s.trim()
}

const bad = (c, msg, code = 400) => c.json({ error: msg }, code)

/* Kategórie fotogalérie – zhodné s filtrom na verejnej stránke. */
// 'clanky' = fotky určené len na vkladanie do článkov; nezobrazujú sa vo verejnej galérii.
const GALLERY_CATS = new Set(['studio', 'wellness', 'exterier', 'clanky'])
const normCat = (v) => (GALLERY_CATS.has(String(v || '')) ? String(v) : 'exterier')

/* Sekcie článkov – 'blog' alebo 'okolie' (Okolie a aktivity). */
const ARTICLE_SECTIONS = new Set(['blog', 'okolie'])
const normSection = (v) => (ARTICLE_SECTIONS.has(String(v || '')) ? String(v) : 'blog')

/* ---------- auth middleware ---------- */

async function requireAuth(c, next) {
  const sess = await readSession(c.env.SESSION_SECRET, getCookie(c, 'pod_session'))
  if (!sess) return bad(c, 'Neprihlásený', 401)
  c.set('uid', sess.uid)
  await next()
}

/* ================= PUBLIC ================= */

app.get('/site', async (c) => {
  const db = c.env.DB
  const [settings, arts, gal] = await Promise.all([
    db.prepare('SELECT key, value FROM settings').all(),
    db
      .prepare(
        "SELECT id, slug, title, excerpt, cover_url, section, published_at FROM articles WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC, id DESC",
      )
      .all(),
    db.prepare("SELECT id, url, alt, category FROM gallery_images WHERE category != 'clanky' ORDER BY sort, id").all(),
  ])
  const s = Object.fromEntries((settings.results || []).map((r) => [r.key, r.value]))
  return c.json({
    theme_css: s.theme_css || '',
    theme_vars: safeJson(s.theme_vars, {}),
    texts: safeJson(s.texts, {}),
    seo: safeJson(s.seo, {}),
    contact: safeJson(s.contact, {}),
    articles: arts.results || [],
    gallery: gal.results || [],
  })
})

app.get('/articles/:slug', async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, slug, title, excerpt, body_html, cover_url, published_at FROM articles WHERE slug = ? AND status='published'",
  )
    .bind(c.req.param('slug'))
    .first()
  if (!row) return bad(c, 'Článok neexistuje', 404)
  return c.json(row)
})

/* ---- kalendár obsadenosti (verejné) ---- */

app.get('/availability', async (c) => {
  maybeSync(c)
  const from = ymd(c.req.query('from')) || todayYmd()
  const to = ymd(c.req.query('to')) || addDays(from, 150)
  const [rooms, busy] = await Promise.all([
    c.env.DB.prepare('SELECT id, name FROM rooms ORDER BY sort, id').all(),
    c.env.DB
      .prepare(
        "SELECT room_id, start_date, end_date, status FROM bookings WHERE status IN ('confirmed','pending') AND end_date > ? AND start_date < ? ORDER BY start_date",
      )
      .bind(from, to)
      .all(),
  ])
  return c.json({ from, to, rooms: rooms.results || [], busy: busy.results || [] })
})

// Klient rezervuje termín – vytvorí sa DRŽANÁ rezervácia (status 'pending' = „rezervované"),
// ktorá hneď blokuje kalendár. Admin ju potom potvrdí (→ 'confirmed' = „obsadené") alebo zamietne.
app.post('/inquiry', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const roomId = Number(b.room_id)
  const start = ymd(b.start_date)
  const end = ymd(b.end_date)
  if (!roomId || !start || !end || end <= start) return bad(c, 'Neplatný termín')
  if (start < todayYmd()) return bad(c, 'Termín je v minulosti')
  const room = await c.env.DB.prepare('SELECT id, name FROM rooms WHERE id = ?').bind(roomId).first()
  if (!room) return bad(c, 'Neplatná izba')
  const name = String(b.name || '').trim().slice(0, 120)
  const email = String(b.email || '').trim().slice(0, 160)
  const phone = String(b.phone || '').trim().slice(0, 60)
  if (!name || !email || !phone) return bad(c, 'Vyplňte meno, e-mail aj telefón')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(c, 'Neplatný e-mail')

  const clash = await c.env.DB.prepare(
    "SELECT status FROM bookings WHERE room_id = ? AND status IN ('confirmed','pending') AND end_date > ? AND start_date < ? LIMIT 1",
  )
    .bind(roomId, start, end)
    .first()
  if (clash) return bad(c, 'Tento termín je už rezervovaný alebo obsadený. Vyberte iný.', 409)

  const nights = Math.round((Date.parse(end) - Date.parse(start)) / 86400000)
  await c.env.DB.prepare(
    `INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, guest_name, guest_email, guest_phone, note)
     VALUES (?, ?, ?, 'inquiry', 'pending', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      roomId,
      start,
      end,
      'inq-' + crypto.randomUUID(),
      'Rezervácia: ' + name,
      name,
      email,
      phone,
      String(b.note || '').trim().slice(0, 1000),
    )
    .run()

  defer(
    c,
    notifyReservation(c.env, { roomId, roomName: room.name, start, end, nights, name, email, phone, note: String(b.note || '').trim() }),
  )
  return c.json({ ok: true, status: 'reserved' })
})

/* ================= AUTH ================= */

app.get('/auth/me', async (c) => {
  const sess = await readSession(c.env.SESSION_SECRET, getCookie(c, 'pod_session'))
  return c.json({ authed: !!sess })
})

app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}))
  if (!username || !password) return bad(c, 'Zadaj meno a heslo')
  const user = await c.env.DB.prepare('SELECT id, password_hash, password_salt FROM admin_users WHERE username = ?')
    .bind(String(username).trim())
    .first()
  const ok = user && (await verifyPassword(password, user.password_hash, user.password_salt))
  if (!ok) return bad(c, 'Nesprávne meno alebo heslo', 401)
  const token = await makeSession(c.env.SESSION_SECRET, user.id)
  setCookie(c, 'pod_session', token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return c.json({ ok: true })
})

app.post('/auth/logout', (c) => {
  deleteCookie(c, 'pod_session', { path: '/' })
  return c.json({ ok: true })
})

app.post('/setup', async (c) => {
  const { username, password, token } = await c.req.json().catch(() => ({}))
  if (!token || token !== c.env.SETUP_TOKEN) return bad(c, 'Neplatný setup token', 403)
  if (!username || !password || String(password).length < 8) return bad(c, 'Heslo musí mať aspoň 8 znakov')
  const { count } = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM admin_users').first()
  if (count > 0) return bad(c, 'Administrátor už existuje', 409)
  const { hash, salt } = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO admin_users (username, password_hash, password_salt) VALUES (?, ?, ?)')
    .bind(String(username).trim(), hash, salt)
    .run()
  return c.json({ ok: true })
})

/* ================= ADMIN ================= */

app.use('/admin/*', requireAuth)

app.post('/admin/password', async (c) => {
  const { current, next } = await c.req.json().catch(() => ({}))
  if (!next || String(next).length < 8) return bad(c, 'Nové heslo musí mať aspoň 8 znakov')
  const user = await c.env.DB.prepare('SELECT password_hash, password_salt FROM admin_users WHERE id = ?')
    .bind(c.get('uid'))
    .first()
  if (!user || !(await verifyPassword(current, user.password_hash, user.password_salt)))
    return bad(c, 'Súčasné heslo nesedí', 403)
  const { hash, salt } = await hashPassword(next)
  await c.env.DB.prepare("UPDATE admin_users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(hash, salt, c.get('uid'))
    .run()
  return c.json({ ok: true })
})

app.put('/admin/theme', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const rows = [
    ['theme_vars', JSON.stringify(body.theme_vars ?? {})],
    ['theme_css', String(body.theme_css ?? '')],
    ['texts', JSON.stringify(body.texts ?? {})],
    ['seo', JSON.stringify(body.seo ?? {})],
    ['contact', JSON.stringify(body.contact ?? {})],
  ]
  const stmt = c.env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  )
  await c.env.DB.batch(rows.map(([k, v]) => stmt.bind(k, v)))
  return c.json({ ok: true })
})

/* ---- články ---- */

app.get('/admin/articles', async (c) => {
  const r = await c.env.DB.prepare(
    'SELECT id, slug, title, excerpt, cover_url, section, status, published_at, sort, updated_at FROM articles ORDER BY sort DESC, id DESC',
  ).all()
  return c.json(r.results || [])
})

app.get('/admin/articles/:id', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(c.req.param('id')).first()
  if (!r) return bad(c, 'Neexistuje', 404)
  return c.json(r)
})

async function uniqueSlug(db, base, ignoreId = 0) {
  let slug = base || 'clanok'
  for (let i = 0; i < 50; i++) {
    const hit = await db.prepare('SELECT id FROM articles WHERE slug = ? AND id != ?').bind(slug, ignoreId).first()
    if (!hit) return slug
    slug = `${base}-${i + 2}`
  }
  return `${base}-${Date.now()}`
}

app.post('/admin/articles', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.title) return bad(c, 'Titulok je povinný')
  const db = c.env.DB
  const slug = await uniqueSlug(db, slugify(b.slug || b.title))
  const status = b.status === 'published' ? 'published' : 'draft'
  const publishedAt = status === 'published' ? b.published_at || new Date().toISOString().slice(0, 19).replace('T', ' ') : null
  const res = await db
    .prepare(
      "INSERT INTO articles (slug, title, excerpt, body_html, cover_url, section, status, published_at, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(slug, b.title, b.excerpt || '', sanitizeHtml(b.body_html), b.cover_url || '', normSection(b.section), status, publishedAt, Number(b.sort) || 0)
    .first()
  return c.json({ ok: true, id: res.id, slug })
})

app.put('/admin/articles/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.json().catch(() => ({}))
  const db = c.env.DB
  const cur = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first()
  if (!cur) return bad(c, 'Neexistuje', 404)
  const title = b.title ?? cur.title
  const slug = b.slug ? await uniqueSlug(db, slugify(b.slug), id) : cur.slug
  const section = ARTICLE_SECTIONS.has(String(b.section)) ? String(b.section) : cur.section
  const status = b.status === 'published' || b.status === 'draft' ? b.status : cur.status
  let publishedAt = cur.published_at
  if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  if (status === 'draft') publishedAt = b.keep_date ? cur.published_at : null
  await db
    .prepare(
      "UPDATE articles SET slug=?, title=?, excerpt=?, body_html=?, cover_url=?, section=?, status=?, published_at=?, sort=?, updated_at=datetime('now') WHERE id=?",
    )
    .bind(
      slug,
      title,
      b.excerpt ?? cur.excerpt,
      b.body_html != null ? sanitizeHtml(b.body_html) : cur.body_html,
      b.cover_url ?? cur.cover_url,
      section,
      status,
      publishedAt,
      b.sort != null ? Number(b.sort) : cur.sort,
      id,
    )
    .run()
  return c.json({ ok: true, slug })
})

app.delete('/admin/articles/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

/* ---- galéria ---- */

app.get('/admin/gallery', async (c) => {
  const r = await c.env.DB.prepare('SELECT id, url, r2_key, alt, category, sort FROM gallery_images ORDER BY sort, id').all()
  return c.json(r.results || [])
})

app.post('/admin/gallery', async (c) => {
  const form = await c.req.formData().catch(() => null)
  const file = form && form.get('file')
  if (!file || typeof file === 'string') return bad(c, 'Chýba súbor')
  if (!/^image\//.test(file.type || '')) return bad(c, 'Povolené sú len obrázky')
  if (file.size > 15 * 1024 * 1024) return bad(c, 'Maximálna veľkosť je 15 MB')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const key = `gallery/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  await c.env.R2.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM gallery_images').first()
  const res = await c.env.DB.prepare(
    'INSERT INTO gallery_images (url, r2_key, alt, category, sort) VALUES (?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(`/img/${key}`, key, String(form.get('alt') || ''), normCat(form.get('category')), (max.m || 0) + 10)
    .first()
  return c.json({ ok: true, id: res.id, url: `/img/${key}` })
})

app.put('/admin/gallery/reorder', async (c) => {
  const { ids } = await c.req.json().catch(() => ({}))
  if (!Array.isArray(ids)) return bad(c, 'Zoznam ID chýba')
  const stmt = c.env.DB.prepare('UPDATE gallery_images SET sort = ? WHERE id = ?')
  await c.env.DB.batch(ids.map((id, i) => stmt.bind((i + 1) * 10, id)))
  return c.json({ ok: true })
})

app.put('/admin/gallery/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const cat = GALLERY_CATS.has(String(b.category)) ? String(b.category) : null
  await c.env.DB.prepare(
    'UPDATE gallery_images SET alt = COALESCE(?, alt), category = COALESCE(?, category), sort = COALESCE(?, sort) WHERE id = ?',
  )
    .bind(b.alt ?? null, cat, b.sort != null ? Number(b.sort) : null, c.req.param('id'))
    .run()
  return c.json({ ok: true })
})

app.delete('/admin/gallery/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT r2_key FROM gallery_images WHERE id = ?').bind(c.req.param('id')).first()
  if (row && row.r2_key) await c.env.R2.delete(row.r2_key)
  await c.env.DB.prepare('DELETE FROM gallery_images WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

/* ---- kalendár obsadenosti (admin) ---- */

app.get('/admin/calendar', async (c) => {
  const from = ymd(c.req.query('from')) || addDays(todayYmd(), -31)
  const to = ymd(c.req.query('to')) || addDays(todayYmd(), 400)
  const [rooms, bookings, pending, lastSync] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, ics_import_url, last_import_at, last_import_msg FROM rooms ORDER BY sort, id').all(),
    c.env.DB
      .prepare(
        "SELECT * FROM bookings WHERE status != 'cancelled' AND end_date > ? AND start_date < ? ORDER BY start_date",
      )
      .bind(from, to)
      .all(),
    c.env.DB.prepare("SELECT * FROM bookings WHERE status = 'pending' ORDER BY created_at DESC").all(),
    c.env.DB.prepare("SELECT value FROM settings WHERE key = 'calendar_last_sync'").first(),
  ])
  return c.json({
    from,
    to,
    rooms: rooms.results || [],
    bookings: bookings.results || [],
    pending: pending.results || [],
    last_sync: lastSync ? lastSync.value : null,
    ics_base: new URL(c.req.url).origin + '/ics/',
  })
})

app.post('/admin/bookings', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const roomId = Number(b.room_id)
  const start = ymd(b.start_date)
  const end = ymd(b.end_date)
  if (!roomId || !start || !end || end <= start) return bad(c, 'Neplatný termín')
  const room = await c.env.DB.prepare('SELECT id FROM rooms WHERE id = ?').bind(roomId).first()
  if (!room) return bad(c, 'Neplatná izba')
  const r = await c.env.DB.prepare(
    `INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, note)
     VALUES (?, ?, ?, 'manual', 'confirmed', ?, ?, ?)`,
  )
    .bind(roomId, start, end, 'man-' + crypto.randomUUID(), String(b.summary || 'Obsadené').slice(0, 120), String(b.note || '').slice(0, 1000))
    .run()
  return c.json({ ok: true, id: r.meta ? r.meta.last_row_id : null })
})

app.patch('/admin/bookings/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const cur = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(c.req.param('id')).first()
  if (!cur) return bad(c, 'Neexistuje', 404)
  const start = b.start_date != null ? ymd(b.start_date) : cur.start_date
  const end = b.end_date != null ? ymd(b.end_date) : cur.end_date
  if (!start || !end || end <= start) return bad(c, 'Neplatný termín')
  const status = ['confirmed', 'pending', 'cancelled'].includes(b.status) ? b.status : cur.status
  await c.env.DB.prepare(
    `UPDATE bookings SET start_date = ?, end_date = ?, status = ?,
       summary = COALESCE(?, summary), note = COALESCE(?, note), updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(start, end, status, b.summary ?? null, b.note ?? null, c.req.param('id'))
    .run()
  return c.json({ ok: true })
})

app.delete('/admin/bookings/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// Uvoľní JEDEN deň z rezervácie: podľa polohy dňa skráti začiatok/koniec,
// alebo (deň uprostred) rozdelí rezerváciu na dve. Zachová source/status/údaje hosťa.
app.post('/admin/bookings/:id/free-day', async (c) => {
  const { day } = await c.req.json().catch(() => ({}))
  const d = ymd(day)
  const b = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(c.req.param('id')).first()
  if (!b) return bad(c, 'Neexistuje', 404)
  if (b.source === 'booking') return bad(c, 'Rezerváciu z Booking.com upravte v Booking.com')
  if (!d || d < b.start_date || d >= b.end_date) return bad(c, 'Deň nie je v rozsahu rezervácie')
  const dayEnd = addDays(d, 1)
  if (b.start_date === d && b.end_date === dayEnd) {
    await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(b.id).run()
    return c.json({ ok: true, removed: true })
  }
  if (b.start_date === d) {
    await c.env.DB.prepare("UPDATE bookings SET start_date = ?, updated_at = datetime('now') WHERE id = ?").bind(dayEnd, b.id).run()
    return c.json({ ok: true })
  }
  if (b.end_date === dayEnd) {
    await c.env.DB.prepare("UPDATE bookings SET end_date = ?, updated_at = datetime('now') WHERE id = ?").bind(d, b.id).run()
    return c.json({ ok: true })
  }
  await c.env.DB.prepare("UPDATE bookings SET end_date = ?, updated_at = datetime('now') WHERE id = ?").bind(d, b.id).run()
  await c.env.DB.prepare(
    `INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, guest_name, guest_email, guest_phone, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(b.room_id, dayEnd, b.end_date, b.source, b.status, 'split-' + crypto.randomUUID(), b.summary, b.guest_name, b.guest_email, b.guest_phone, b.note)
    .run()
  return c.json({ ok: true, split: true })
})

app.put('/admin/rooms/:id', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare('UPDATE rooms SET name = COALESCE(?, name), ics_import_url = COALESCE(?, ics_import_url) WHERE id = ?')
    .bind(b.name ?? null, b.ics_import_url != null ? String(b.ics_import_url).trim() : null, c.req.param('id'))
    .run()
  return c.json({ ok: true })
})

app.post('/admin/calendar/sync', async (c) => {
  const rooms = await syncImports(c.env)
  return c.json({ ok: true, rooms })
})

app.notFound((c) => c.json({ error: 'Neznáma cesta' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Serverová chyba' }, 500)
})

export const onRequest = (context) => app.fetch(context.request, context.env, context)

// Pre lokálny Node harness (scripts/dev-node.mjs). Na Cloudflare sa nepoužíva.
export { app }
