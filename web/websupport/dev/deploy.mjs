// Nasadenie na Websupport cez SFTP (default) alebo FTP(S) -- fáza 6.
//
//   cd websupport/dev && npm install
//   FTP_HOST=… FTP_USER=… FTP_PASS=… FTP_DIR=/ CONFIG=config.test.php node deploy.mjs [--with-install] [--dry]
//   voliteľne FTP_PROTO=ftp (FTPS, port 21) -- na Websupporte FTPS padal na
//   "tlsv1 alert decode error" a nechával 0 B súbory, preto default SFTP (port 22).
//
// Poskladá doc root presne ako v .htaccess poznámke: obsah `public/` + z
// `websupport/` priečinky api, lib, cron, db, uploads a súbory .htaccess,
// index.php, ics.php. `lib/config.php` sa berie z CONFIG (lokálny súbor mimo
// gitu). `install.php` sa nahrá len s --with-install. Nahráva len súbory,
// ktorých veľkosť sa na serveri líši (fotky sa neposielajú zakaždým).
// Adminom nahraté fotky na serveri (`uploads/gallery/`) sa nikdy nemažú.

import { Client } from 'basic-ftp'
import SftpClient from 'ssh2-sftp-client'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const WS = resolve(here, '..')
const PUB = resolve(WS, '../public')
const args = new Set(process.argv.slice(2))
const { FTP_HOST, FTP_PROTO = 'sftp', FTP_USER, FTP_PASS, FTP_DIR = '/', CONFIG, FTP_SECURE = '1' } = process.env
const FTP_PORT = process.env.FTP_PORT || (FTP_PROTO === 'sftp' ? '22' : '21')
if (!FTP_HOST || !FTP_USER || !FTP_PASS || !CONFIG) {
  console.error('Chýba FTP_HOST / FTP_USER / FTP_PASS / CONFIG')
  process.exit(1)
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, base, out)
    else out.push(p)
  }
  return out
}

// [lokálna cesta, vzdialená relatívna cesta]
const files = []
for (const f of walk(PUB)) files.push([f, relative(PUB, f)])
for (const d of ['api', 'lib', 'cron', 'db']) {
  for (const f of walk(join(WS, d))) {
    const rel = relative(WS, f)
    if (rel.replace(/\\/g, '/') === 'lib/config.php') continue
    files.push([f, rel])
  }
}
files.push([resolve(here, CONFIG), 'lib/config.php'])
files.push([join(WS, 'uploads/.gitkeep'), 'uploads/.gitkeep'])
for (const f of ['.htaccess', 'index.php', 'ics.php', 'robots.txt', 'sitemap.xml']) files.push([join(WS, f), f])
if (args.has('--with-install')) files.push([join(WS, 'install.php'), 'install.php'])
for (const [f] of files) if (!existsSync(f)) { console.error('Chýba ' + f); process.exit(1) }
// poistky: prázdny súbor (okrem .gitkeep) alebo dve lokálne cesty na ten istý cieľ = chyba
// (Docker raz nechal v public/ prázdne index.php/.htaccess/install.php a deploy ich nahral)
{
  const seen = new Map()
  for (const [f, rel] of files) {
    const key = rel.replace(/\\/g, '/')
    if (seen.has(key)) { console.error(`Duplicitný cieľ ${key}: ${seen.get(key)} aj ${f}`); process.exit(1) }
    seen.set(key, f)
    if (statSync(f).size === 0 && !key.endsWith('.gitkeep')) { console.error(`Prázdny súbor ${f} -- nenahrávam`); process.exit(1) }
  }
}

const remote = (rel) => (FTP_DIR.replace(/\/$/, '') + '/' + rel.replace(/\\/g, '/')).replace(/^\/\//, '/')

// spoločné rozhranie: size(path) -> bajty | -1, mkdirp(dir), put(local, remote), close()
async function connect() {
  if (FTP_PROTO === 'sftp') {
    const c = new SftpClient()
    await c.connect({ host: FTP_HOST, port: Number(FTP_PORT), username: FTP_USER, password: FTP_PASS, readyTimeout: 30_000 })
    const dirs = new Set()
    return {
      size: async (p) => { try { return (await c.stat(p)).size } catch { return -1 } },
      mkdirp: async (d) => { if (d === '/' || dirs.has(d)) return; if (!(await c.exists(d))) await c.mkdir(d, true); dirs.add(d) },
      put: (l, p) => c.fastPut(l, p),
      close: () => c.end(),
    }
  }
  const c = new Client(60_000)
  await c.access({ host: FTP_HOST, port: Number(FTP_PORT), user: FTP_USER, password: FTP_PASS, secure: FTP_SECURE === '1', secureOptions: { rejectUnauthorized: false } })
  return {
    size: (p) => c.size(p).catch(() => -1),
    mkdirp: async (d) => { await c.ensureDir(d); await c.cd('/') },
    put: (l, p) => c.uploadFrom(l, p),
    close: () => c.close(),
  }
}

const client = await connect()
try {
  console.log(`Pripojené (${FTP_PROTO}), cieľ ${FTP_DIR}`)
  let up = 0, skip = 0
  for (const [local, rel] of files) {
    const target = remote(rel)
    const size = statSync(local).size
    const remoteSize = await client.size(target)
    if (remoteSize === size && !rel.endsWith('.php') && rel !== '.htaccess') { skip++; continue }
    if (args.has('--dry')) { console.log('would upload ' + rel); up++; continue }
    await client.mkdirp(dirname(target).replace(/\\/g, '/'))
    // overenie veľkosti po nahratí -- FTPS na Websupporte nechával 0 B súbory
    for (let attempt = 1; ; attempt++) {
      await client.put(local, target)
      const got = await client.size(target)
      if (got === size) break
      if (attempt >= 3) throw new Error(`${rel}: na serveri ${got} B, lokálne ${size} B`)
      console.log(`! ${rel}: ${got} B namiesto ${size} B, opakujem`)
    }
    up++
    console.log('↑ ' + rel)
  }
  console.log(`Hotovo: nahraté ${up}, preskočené ${skip}`)
} finally {
  await client.close()
}
