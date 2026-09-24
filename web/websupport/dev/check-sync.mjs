// Vypíše rooms.last_import_at z DB podľa CONFIG (či beží cron):
//   CONFIG=config.test.php node check-sync.mjs
import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'

const src = readFileSync(process.env.CONFIG, 'utf8')
const v = (k) => {
  const m = src.match(new RegExp(`'${k}'\\s*=>\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|(\\d+))`))
  return m[1] !== undefined ? m[1].replace(/\\(['\\])/g, '$1') : m[2]
}
const db = await mysql.createConnection({ host: v('host'), port: +v('port'), database: v('name'), user: v('user'), password: v('pass'), dateStrings: true })
const [rows] = await db.query('SELECT id, last_import_at, last_import_msg FROM rooms ORDER BY id')
const [[now]] = await db.query('SELECT NOW() AS now')
console.log(JSON.stringify({ now: now.now, rooms: rows }))
await db.end()
