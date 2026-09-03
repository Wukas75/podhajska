// API pre Štúdiá Podhájska – Cloudflare Pages Function (Hono).
// Obsluhuje všetky /api/* cesty. Dáta: D1 (binding DB), fotky: R2 (binding R2).

import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

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

app.notFound((c) => c.json({ error: 'Neznáma cesta' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Serverová chyba' }, 500)
})

export const onRequest = (context) => app.fetch(context.request, context.env, context)

// Pre lokálny Node harness (scripts/dev-node.mjs). Na Cloudflare sa nepoužíva.
export { app }
