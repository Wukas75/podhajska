// Kontrola synchronizácie kalendára (read-only):
//  A) Booking.com -> web: udalosti v Booking feedoch == riadky source='booking' v DB
//  B) web -> Booking.com: /ics/<izba>.ics == manual/inquiry (confirmed+pending) v DB,
//     validné iCal podľa nezávislého parsera (ical.js od Mozilly)
//   CONFIG=config.test.php BASE=https://test.podhajska.net node sync-check.mjs
import mysql from 'mysql2/promise'
import ICAL from 'ical.js'
import { readFileSync } from 'node:fs'

const { CONFIG, BASE = 'https://test.podhajska.net' } = process.env
const src = readFileSync(CONFIG, 'utf8')
const v = (k) => { const m = src.match(new RegExp(`'${k}'\\s*=>\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|(\\d+))`)); return m[1] !== undefined ? m[1].replace(/\\(['\\])/g, '$1') : m[2] }
const db = await mysql.createConnection({ host: v('host'), port: +v('port'), database: v('name'), user: v('user'), password: v('pass'), dateStrings: true })
let fails = 0
const ok = (c, msg, extra) => { console.log((c ? 'OK   ' : 'CHYBA ') + msg + (c || extra === undefined ? '' : '\n      ' + JSON.stringify(extra).slice(0, 600))); if (!c) fails++ }
const ymd = (t) => t.toJSDate ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}` : t
const parse = (text) => new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent').map((e) => {
  const ev = new ICAL.Event(e)
  return { uid: ev.uid, start: ymd(ev.startDate), end: ymd(ev.endDate), summary: ev.summary, dateOnly: ev.startDate.isDate }
})
const today = new Date().toISOString().slice(0, 10)

const [rooms] = await db.query('SELECT id, name, ics_import_url, last_import_at, last_import_msg FROM rooms ORDER BY id')
const [[{ now }]] = await db.query('SELECT NOW() AS now')

console.log('\n== A) Booking.com -> web ==')
for (const r of rooms) {
  ok(!!r.ics_import_url, `izba ${r.id}: má Booking import URL`)
  const ageMin = (new Date(now.replace(' ', 'T')) - new Date(String(r.last_import_at).replace(' ', 'T'))) / 60000
  ok(ageMin >= 0 && ageMin <= 35, `izba ${r.id}: posledný import pred ${Math.round(ageMin)} min (${r.last_import_at}, „${r.last_import_msg}") — cron každých 30 min`)
  const feed = parse(await (await fetch(r.ics_import_url)).text())
  const [rows] = await db.query("SELECT uid, start_date, end_date, status FROM bookings WHERE room_id = ? AND source = 'booking' ORDER BY start_date", [r.id])
  const want = feed.map((e) => `${e.start}→${e.end}`).sort()
  const have = rows.map((b) => `${b.start_date}→${b.end_date}`).sort()
  ok(JSON.stringify(want) === JSON.stringify(have), `izba ${r.id}: Booking feed ${want.length} udalostí == DB ${have.length}`, { booking: want, db: have })
  ok(rows.every((b) => b.status === 'confirmed'), `izba ${r.id}: importované sú „obsadené" (confirmed)`)
}

console.log('\n== B) web -> Booking.com (/ics export) ==')
for (const r of rooms) {
  const res = await fetch(`${BASE}/ics/${r.id}.ics`)
  const text = await res.text()
  ok(res.status === 200 && /^text\/calendar/.test(res.headers.get('content-type') || ''), `izba ${r.id}: ${BASE}/ics/${r.id}.ics -> ${res.status} ${res.headers.get('content-type')}`)
  ok(/^BEGIN:VCALENDAR\r\n/.test(text) && /END:VCALENDAR\r\n?$/.test(text) && !/[^\r]\n/.test(text), `izba ${r.id}: RFC 5545 obal + CRLF riadky`)
  ok(text.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), `izba ${r.id}: riadky ≤ 75 bajtov (folding)`)
  let evs = []
  try { evs = parse(text); ok(true, `izba ${r.id}: ical.js (Mozilla) ho načíta bez chyby, ${evs.length} udalostí`) } catch (e) { ok(false, `izba ${r.id}: ical.js parse`, e.message) }
  const [rows] = await db.query("SELECT uid, start_date, end_date FROM bookings WHERE room_id = ? AND source IN ('manual','inquiry') AND status IN ('confirmed','pending')", [r.id])
  const want = rows.map((b) => `${b.start_date}→${b.end_date}`).sort()
  const have = evs.map((e) => `${e.start}→${e.end}`).sort()
  ok(JSON.stringify(want) === JSON.stringify(have), `izba ${r.id}: export == DB manual/inquiry (${want.length})`, { db: want, ics: have })
  ok(evs.every((e) => e.dateOnly && e.uid && e.end > e.start), `izba ${r.id}: celodenné udalosti (VALUE=DATE), UID, koniec > začiatok`)
  const [bk] = await db.query("SELECT COUNT(*) AS n FROM bookings WHERE room_id = ? AND source = 'booking'", [r.id])
  ok(!evs.some((e) => /^bk-/.test(e.uid)), `izba ${r.id}: Booking udalosti (${bk[0].n}) sa späť NEexportujú (žiadna slučka)`)
}

console.log('\n== C) verejný kalendár na webe ==')
const av = await (await fetch(`${BASE}/api/availability`)).json()
const [busy] = await db.query("SELECT room_id, start_date, end_date, status FROM bookings WHERE status IN ('confirmed','pending') AND end_date > ? ORDER BY room_id, start_date", [today])
const k = (b) => `${b.room_id} ${b.start_date}→${b.end_date} ${b.status}`
const inRange = busy.filter((b) => b.start_date < av.to)
ok(JSON.stringify(inRange.map(k).sort()) === JSON.stringify(av.busy.map(k).sort()), `/api/availability ukazuje všetky obsadené/rezervované termíny (${av.busy.length})`, { db: inRange.map(k), web: av.busy.map(k) })

await db.end()
console.log(fails ? `\n${fails} problémov` : '\nSYNCHRONIZÁCIA OK')
