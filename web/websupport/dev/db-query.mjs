// Jednorazový SQL dotaz do DB podľa CONFIG (read-only použitie pri diagnostike):
//   CONFIG=config.test.php node db-query.mjs "SELECT …"
import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'

const src = readFileSync(process.env.CONFIG, 'utf8')
const v = (k) => {
  const m = src.match(new RegExp(`'${k}'\\s*=>\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|(\\d+))`))
  return m[1] !== undefined ? m[1].replace(/\\(['\\])/g, '$1') : m[2]
}
const db = await mysql.createConnection({ host: v('host'), port: +v('port'), database: v('name'), user: v('user'), password: v('pass'), dateStrings: true })
const [rows] = await db.query(process.argv[2])
console.table(rows)
await db.end()
