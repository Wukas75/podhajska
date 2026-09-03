// Vygeneruje PBKDF2 hash hesla (rovnaké parametre ako API) na ručné vloženie
// admina do D1. Použi len ak nechceš POST /api/setup.
//
//   node scripts/hash-password.mjs "moje-heslo"
//
// Výstup je SQL INSERT, ktorý spustíš cez:
//   npx wrangler d1 execute podhajska --remote --command "<SQL>"

import { webcrypto as crypto } from 'node:crypto'

const password = process.argv[2]
const username = process.argv[3] || 'admin'
if (!password) {
  console.error('Použitie: node scripts/hash-password.mjs "<heslo>" [používateľské-meno]')
  process.exit(1)
}

const enc = new TextEncoder()
const b64 = (buf) => Buffer.from(buf).toString('base64')

const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
  key,
  256,
)

const hash = b64(bits)
const saltB64 = b64(salt)

console.log('\nusername      :', username)
console.log('password_hash :', hash)
console.log('password_salt :', saltB64)
console.log('\nSQL:')
console.log(
  `INSERT INTO admin_users (username, password_hash, password_salt) VALUES ('${username.replace(/'/g, "''")}', '${hash}', '${saltB64}');`,
)
