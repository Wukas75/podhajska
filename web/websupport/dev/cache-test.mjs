// Overí, či Websupport proxy (openresty) po prepísaní súboru servíruje novú verziu.
//   FTP_HOST=… FTP_USER=… FTP_PASS=… BASE=https://test.podhajska.net node cache-test.mjs
import Sftp from 'ssh2-sftp-client'
import { randomBytes } from 'node:crypto'

const { FTP_HOST, FTP_USER, FTP_PASS, BASE } = process.env
const s = new Sftp()
await s.connect({ host: FTP_HOST, port: 22, username: FTP_USER, password: FTP_PASS })
const get = async (p) => (await (await fetch(BASE + p)).text()).trim()
try {
  for (const ext of ['txt', 'css', 'js']) {
    const name = `/cachetest-${randomBytes(4).toString('hex')}.${ext}`
    await s.put(Buffer.from('v1\n'), name)
    const a = await get(name)
    await s.put(Buffer.from('v2\n'), name)
    const b = await get(name)
    await new Promise((r) => setTimeout(r, 3000))
    const c = await get(name)
    await s.delete(name)
    console.log(`${ext}: prvé=${a} hneď po zmene=${b} po 3 s=${c}`)
  }
} finally {
  await s.end()
}
