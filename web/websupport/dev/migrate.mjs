// Fáza 7 -- prenos živých dát z Cloudflare (D1 + R2) do MySQL na Websupporte.
// Na Cloudflare sa LEN ČÍTA. Opakovateľné: pred ostrým prepnutím spusti znova
// (čerstvé rezervácie a obsah); cieľová DB sa zakaždým celá prepíše.
//
//   node migrate.mjs export                      # D1 -> migration-data/*.json (wrangler --remote)
//   node migrate.mjs images                      # R2 fotky cez https://podhajska.pages.dev/img/<key>
//   CONFIG=config.test.php node migrate.mjs import   # JSON -> MySQL (z CONFIG), kontrola dĺžok
//   FTP_HOST=… FTP_USER=… FTP_PASS=… FTP_DIR=/ node migrate.mjs upload   # fotky -> /uploads/gallery (SFTP)
//
// Transformácie: r2_key -> file_key (len názov súboru), '/img/gallery/' ->
// '/uploads/gallery/' vo všetkých textoch (url, cover, body_html, settings),
// '/assets/img/' ostáva. Admin sa prenáša s hashom (PBKDF2 je v PHP bitovo
// zhodný) -- heslo ostáva rovnaké ako na Cloudflare.
// migration-data/ je v .gitignore (osobné údaje hostí + hash hesla).

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, 'migration-data')
const IMG_DIR = join(DATA, 'uploads', 'gallery')
const WEB = join(here, '..', '..')
const TABLES = ['admin_users', 'settings', 'articles', 'gallery_images', 'rooms', 'bookings']
const CF_ORIGIN = process.env.CF_ORIGIN || 'https://podhajska.pages.dev'

const load = (t) => JSON.parse(readFileSync(join(DATA, t + '.json'), 'utf8'))
// + jediný kontaktný e-mail webu (user 2026-09-23): gmail -> info@podhajska.net aj v obsahu (články, nastavenia)
const fixUrl = (s) => (typeof s === 'string'
  ? s.replace(/(?<!assets)\/img\/gallery\//g, '/uploads/gallery/').replace(/studiapodhajska@gmail\.com/gi, 'info@podhajska.net')
  : s)
const fileKey = (r2) => (r2 ? basename(r2) : null)

async function cmdExport() {
  mkdirSync(DATA, { recursive: true })
  for (const t of TABLES) {
    // shell: true (npx na Windows) -> dotaz v úvodzovkách, inak sa rozdelí na slová
    const out = execSync(`npx wrangler d1 execute podhajska --remote --json --command "SELECT * FROM ${t}"`, {
      cwd: WEB, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20,
    })
    const rows = JSON.parse(out)[0].results
    writeFileSync(join(DATA, t + '.json'), JSON.stringify(rows, null, 1))
    console.log(`${t}: ${rows.length}`)
  }
}

async function cmdImages() {
  mkdirSync(IMG_DIR, { recursive: true })
  for (const g of load('gallery_images').filter((x) => x.r2_key)) {
    const dest = join(IMG_DIR, fileKey(g.r2_key))
    if (existsSync(dest) && statSync(dest).size > 0) continue
    const r = await fetch(`${CF_ORIGIN}/img/${g.r2_key}`)
    if (!r.ok) throw new Error(`${g.r2_key}: HTTP ${r.status}`)
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    console.log('↓ ' + g.r2_key)
  }
  console.log(`fotky: ${readdirSync(IMG_DIR).length} v ${IMG_DIR}`)
}

function phpConfig(file) {
  const src = readFileSync(join(here, file), 'utf8')
  const get = (k) => (src.match(new RegExp(`'${k}'\\s*=>\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|(\\d+))`)) || [])
  const val = (k) => { const m = get(k); return m[1] !== undefined ? m[1].replace(/\\(['\\])/g, '$1') : m[2] }
  return { host: val('host'), port: Number(val('port') || 3306), database: val('name'), user: val('user'), password: val('pass') }
}

// riadky pre MySQL + kontrola limitov stĺpcov (MySQL by inak orezal/odmietol)
function buildRows() {
  const s = (v) => (v == null ? '' : String(v))
  const rows = {
    admin_users: load('admin_users').map((a) => ({ id: a.id, username: a.username, password_hash: a.password_hash, password_salt: a.password_salt, created_at: a.created_at, updated_at: a.updated_at })),
    settings: load('settings').map((x) => ({ key: x.key, value: fixUrl(s(x.value)), updated_at: x.updated_at })),
    articles: load('articles').map((a) => ({
      id: a.id, slug: a.slug, title: a.title, excerpt: fixUrl(s(a.excerpt)), body_html: fixUrl(s(a.body_html)), cover_url: fixUrl(s(a.cover_url)),
      section: a.section || 'blog', status: a.status || 'draft', published_at: a.published_at || null, sort: a.sort ?? 0, created_at: a.created_at, updated_at: a.updated_at,
    })),
    gallery_images: load('gallery_images').map((g) => ({ id: g.id, url: fixUrl(g.url), file_key: fileKey(g.r2_key), alt: s(g.alt), category: g.category || 'exterier', sort: g.sort ?? 0, created_at: g.created_at })),
    rooms: load('rooms').map((r) => ({ id: r.id, name: r.name, ics_import_url: s(r.ics_import_url), last_import_at: r.last_import_at || null, last_import_msg: s(r.last_import_msg).slice(0, 500), sort: r.sort ?? 0 })),
    bookings: load('bookings').map((b) => ({
      id: b.id, room_id: b.room_id, start_date: b.start_date, end_date: b.end_date, source: b.source, status: b.status, uid: b.uid || null,
      summary: s(b.summary), guest_name: s(b.guest_name), guest_email: s(b.guest_email), guest_phone: s(b.guest_phone), note: s(b.note), created_at: b.created_at, updated_at: b.updated_at,
    })),
  }
  const limits = {
    admin_users: { username: 191, password_hash: 255, password_salt: 255 },
    articles: { slug: 191, title: 255, cover_url: 500 },
    gallery_images: { url: 500, file_key: 255, alt: 255 },
    rooms: { name: 100, ics_import_url: 500 },
    bookings: { uid: 191, summary: 255, guest_name: 191, guest_email: 191, guest_phone: 64 },
    settings: { key: 191 },
  }
  const problems = []
  for (const [t, cols] of Object.entries(limits)) {
    for (const r of rows[t]) for (const [c, max] of Object.entries(cols)) if (r[c] != null && [...String(r[c])].length > max) problems.push(`${t}#${r.id ?? r.key}.${c} má ${[...String(r[c])].length} > ${max}`)
  }
  const left = JSON.stringify(rows).match(/(?<!assets)\/img\/gallery\//g)
  if (left) problems.push(`ostali odkazy /img/gallery/: ${left.length}`)
  // len obsah webu -- e-maily hostí v rezerváciách ostávajú, aké sú
  if (/studiapodhajska@gmail\.com/i.test(JSON.stringify([rows.settings, rows.articles]))) problems.push('ostal e-mail studiapodhajska@gmail.com')
  if (problems.length) throw new Error('Nevhodné dáta:\n' + problems.join('\n'))
  return rows
}

async function cmdImport() {
  if (!process.env.CONFIG) throw new Error('Chýba CONFIG=config.xxx.php')
  const rows = buildRows()
  const { default: mysql } = await import('mysql2/promise')
  const db = await mysql.createConnection({ ...phpConfig(process.env.CONFIG), charset: 'utf8mb4', dateStrings: true })
  try {
    await db.query('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginTransaction()
    for (const t of ['bookings', 'gallery_images', 'articles', 'settings', 'admin_users', 'rooms']) await db.query(`DELETE FROM \`${t}\``)
    for (const t of ['rooms', 'admin_users', 'settings', 'articles', 'gallery_images', 'bookings']) {
      for (const r of rows[t]) {
        const cols = Object.keys(r)
        await db.execute(`INSERT INTO \`${t}\` (${cols.map((c) => '`' + c + '`').join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => r[c]))
      }
      console.log(`${t}: ${rows[t].length}`)
    }
    await db.commit()
  } catch (e) {
    await db.rollback().catch(() => {})
    throw e
  } finally {
    await db.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {})
    await db.end()
  }
  // kontrola: počty v cieli == zdroj
  const db2 = await mysql.createConnection({ ...phpConfig(process.env.CONFIG), charset: 'utf8mb4' })
  for (const t of TABLES) {
    const [[{ n }]] = await db2.query(`SELECT COUNT(*) AS n FROM \`${t}\``)
    if (n !== rows[t].length) throw new Error(`${t}: v DB ${n}, očakávané ${rows[t].length}`)
  }
  await db2.end()
  console.log('import OK, počty sedia')
}

async function cmdUpload() {
  const { FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR = '/' } = process.env
  const { default: Sftp } = await import('ssh2-sftp-client')
  const c = new Sftp()
  await c.connect({ host: FTP_HOST, port: 22, username: FTP_USER, password: FTP_PASS, readyTimeout: 30_000 })
  try {
    const dir = (FTP_DIR.replace(/\/$/, '') + '/uploads/gallery').replace(/^\/\//, '/')
    if (!(await c.exists(dir))) await c.mkdir(dir, true)
    for (const f of readdirSync(IMG_DIR)) {
      const local = join(IMG_DIR, f), target = dir + '/' + f, size = statSync(local).size
      const got = await c.stat(target).then((s) => s.size, () => -1)
      if (got === size) continue
      await c.fastPut(local, target)
      if ((await c.stat(target)).size !== size) throw new Error(f + ': veľkosť nesedí')
      console.log('↑ ' + f)
    }
    console.log(`fotky na serveri: ${(await c.list(dir)).length}`)
  } finally {
    await c.end()
  }
}

const cmd = process.argv[2]
const cmds = { export: cmdExport, images: cmdImages, import: cmdImport, upload: cmdUpload }
if (!cmds[cmd]) { console.error('Použitie: node migrate.mjs export|images|import|upload'); process.exit(1) }
await cmds[cmd]()
