/* Lokálny dev server BEZ wrangler/workerd (ten na tomto Windows padá na "write EOF").
 * Spúšťa reálny Hono router z functions/api s D1 shimom (node:sqlite) a R2 shimom (FS).
 *
 *   node scripts/dev-node.mjs           # http://localhost:8788
 *   node scripts/dev-node.mjs --reset   # zmaže lokálnu DB a fotky a naplní seed nanovo
 *
 * Slúži len na vývoj a kontrolu. Produkcia beží na Cloudflare Pages Functions.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { extname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'

const ROOT = resolve(import.meta.dirname, '..')
const PUB = join(ROOT, 'public')
const STATE = join(ROOT, '.wrangler', 'devnode')
const DB_PATH = join(STATE, 'd1.sqlite')
const R2_DIR = join(STATE, 'r2')
const PORT = 8788

if (process.argv.includes('--reset') && existsSync(STATE)) rmSync(STATE, { recursive: true, force: true })
mkdirSync(R2_DIR, { recursive: true })

/* ---------- D1 shim ---------- */
const sqlite = new DatabaseSync(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL;')
const freshDb = !tableExists('settings')
if (freshDb) {
  sqlite.exec(readFileSync(join(ROOT, 'migrations', '0001_init.sql'), 'utf8'))
  sqlite.exec(readFileSync(join(ROOT, 'migrations', '0002_seed.sql'), 'utf8'))
  console.log('• D1: vytvorená lokálna DB + seed')
}
// Doťahnutie neskorších migrácií na už existujúcu lokálnu DB (dev-node nemá migračný runner).
try {
  sqlite.exec("ALTER TABLE gallery_images ADD COLUMN category TEXT NOT NULL DEFAULT 'exterier'")
  console.log('• D1: pridaný stĺpec gallery_images.category')
} catch {
  /* stĺpec už existuje */
}
try {
  sqlite.exec("ALTER TABLE articles ADD COLUMN section TEXT NOT NULL DEFAULT 'blog'")
  console.log('• D1: pridaný stĺpec articles.section')
} catch {
  /* stĺpec už existuje */
}
try {
  sqlite.exec(readFileSync(join(ROOT, 'migrations', '0005_calendar.sql'), 'utf8')) // idempotentné
} catch (e) {
  console.warn('• D1: 0005_calendar.sql —', e.message)
}
function tableExists(name) {
  try {
    return !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
  } catch {
    return false
  }
}
const clean = (p) => (p === undefined ? null : p)
class D1Stmt {
  constructor(sql, params) { this.sql = sql; this.params = params || [] }
  bind(...p) { return new D1Stmt(this.sql, p.map(clean)) }
  async first(col) {
    const row = sqlite.prepare(this.sql).get(...this.params)
    if (row == null) return null
    return col ? row[col] : row
  }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.params), success: true, meta: {} } }
  async run() {
    const r = sqlite.prepare(this.sql).run(...this.params)
    return { success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }
  }
}
const DB = {
  prepare: (sql) => new D1Stmt(sql),
  async batch(stmts) {
    sqlite.exec('BEGIN')
    try {
      const out = []
      for (const s of stmts) out.push(await s.run())
      sqlite.exec('COMMIT')
      return out
    } catch (e) {
      sqlite.exec('ROLLBACK')
      throw e
    }
  },
}

/* ---------- R2 shim ---------- */
const safeKey = (k) => k.replace(/[^a-zA-Z0-9._/-]/g, '_')
const R2 = {
  async put(key, value, opts) {
    const f = join(R2_DIR, safeKey(key))
    mkdirSync(join(f, '..'), { recursive: true })
    const buf = Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value)
    writeFileSync(f, buf)
    writeFileSync(f + '.meta', JSON.stringify({ contentType: (opts && opts.httpMetadata && opts.httpMetadata.contentType) || 'application/octet-stream', size: buf.length }))
  },
  async get(key) {
    const f = join(R2_DIR, safeKey(key))
    if (!existsSync(f)) return null
    const meta = existsSync(f + '.meta') ? JSON.parse(readFileSync(f + '.meta', 'utf8')) : { contentType: 'application/octet-stream' }
    return {
      body: Readable.toWeb(createReadStream(f)),
      httpEtag: '"' + meta.size + '"',
      writeHttpMetadata(headers) { headers.set('content-type', meta.contentType) },
    }
  },
  async delete(key) {
    for (const ext of ['', '.meta']) {
      const f = join(R2_DIR, safeKey(key)) + ext
      if (existsSync(f)) rmSync(f)
    }
  },
}

const ENV = { DB, R2, SESSION_SECRET: process.env.SESSION_SECRET || 'devnode-secret-0123456789abcdef', SETUP_TOKEN: process.env.SETUP_TOKEN || 'devnode-setup' }

/* ---------- načítanie Functions ---------- */
const { app } = await import('../functions/api/[[route]].js')
const imgMod = await import('../functions/img/[[key]].js')
const icsMod = await import('../functions/ics/[[room]].js')

/* ---------- statické súbory ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' }
// Zrkadlí functions/_middleware.js (tam beží cez HTMLRewriter na Cloudflare;
// tu je to na známom statickom index.html jednoduchšie – reťazcové náhrady).
function applySeoToHtml(html, seo) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const title = String(seo.title || '').trim()
  const description = String(seo.description || '').trim()
  const ogImage = String(seo.ogImage || '').trim()
  const ogImageAbs = ogImage ? (/^https?:\/\//i.test(ogImage) ? ogImage : 'http://localhost:' + PORT + ogImage) : ''
  if (title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>')
    html = html.replace(/(<meta property="og:title" content=")[^"]*("\s*\/>)/, '$1' + esc(title) + '$2')
  }
  if (description) {
    html = html.replace(/(<meta name="description" content=")[^"]*("\s*\/>)/, '$1' + esc(description) + '$2')
    html = html.replace(/(<meta property="og:description" content=")[^"]*("\s*\/>)/, '$1' + esc(description) + '$2')
  }
  if (ogImageAbs) html = html.replace(/(<meta property="og:image" content=")[^"]*("\s*\/>)/, '$1' + esc(ogImageAbs) + '$2')
  if (seo.noindex) html = html.replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>')
  return html
}

async function serveStatic(pathname, res) {
  let rel = pathname === '/' ? '/index.html' : pathname
  if (!extname(rel)) {
    if (existsSync(join(PUB, rel + '.html'))) rel += '.html'
    else rel = '/index.html' // SPA-ish fallback
  }
  const file = join(PUB, rel)
  if (!file.startsWith(PUB) || !existsSync(file)) { res.writeHead(404); res.end('Not found'); return }
  if (rel === '/index.html') {
    let seo = {}
    try {
      const row = sqlite.prepare("SELECT value FROM settings WHERE key = 'seo'").get()
      if (row && row.value) seo = JSON.parse(row.value)
    } catch { /* necháme statické defaulty */ }
    const html = applySeoToHtml(readFileSync(file, 'utf8'), seo)
    res.writeHead(200, { 'content-type': MIME['.html'] })
    res.end(html)
    return
  }
  const buf = await readFile(file)
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
  res.end(buf)
}

/* ---------- request bridge ---------- */
function toRequest(req) {
  const url = 'http://localhost:' + PORT + req.url
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(',') : v)
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? 'half' : undefined,
  })
}
async function sendResponse(r, res) {
  res.writeHead(r.status, Object.fromEntries(r.headers))
  if (r.body) {
    for await (const chunk of Readable.fromWeb(r.body)) res.write(chunk)
  }
  res.end()
}

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.url.split('?')[0])
    if (pathname.startsWith('/api/')) {
      return void sendResponse(await app.fetch(toRequest(req), ENV, {}), res)
    }
    if (pathname.startsWith('/img/')) {
      const key = pathname.slice(5)
      const ctx = { env: ENV, params: { key }, request: toRequest(req) }
      return void sendResponse(await imgMod.onRequest(ctx), res)
    }
    if (pathname.startsWith('/ics/')) {
      const room = pathname.slice(5)
      const ctx = { env: ENV, params: { room }, request: toRequest(req) }
      return void sendResponse(await icsMod.onRequest(ctx), res)
    }
    await serveStatic(pathname, res)
  } catch (e) {
    console.error(e)
    res.writeHead(500); res.end('dev server error: ' + e.message)
  }
}).listen(PORT, () => {
  console.log('\n  Štúdiá Podhájska (dev-node)  →  http://localhost:' + PORT)
  console.log('  Admin:  http://localhost:' + PORT + '/admin')
  console.log('  Setup token:', ENV.SETUP_TOKEN, '\n')
})
