// Porovná verejné API Cloudflare (zdroj) a PHP verzie (cieľ) po migrácii.
//   node compare.mjs [cieľ=http://localhost:8088] [zdroj=https://podhajska.pages.dev]
const DST = process.argv[2] || 'http://localhost:8088'
const SRC = process.argv[3] || 'https://podhajska.pages.dev'
let fails = 0
const norm = (v) => JSON.parse(JSON.stringify(v).replace(/(?<!assets)\/img\/gallery\//g, '/uploads/gallery/'))
// porovnanie hodnôt bez ohľadu na poradie kľúčov; čísla vs. reťazce čísel sú rovnaké
function diff(a, b, path = '') {
  if (a === b || (a != null && b != null && typeof a !== 'object' && String(a) === String(b))) return []
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return [`${path}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`]
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: pole vs objekt`]
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].flatMap((k) => diff(a[k], b[k], path + '.' + k))
}
async function cmp(label, path, pick = (x) => x) {
  const [s, d] = await Promise.all([SRC, DST].map((o) => fetch(o + path).then(async (r) => ({ st: r.status, t: await r.text() }))))
  let out
  try { out = diff(norm(pick(JSON.parse(s.t))), pick(JSON.parse(d.t))) } catch { out = s.t === d.t ? [] : ['text sa líši'] }
  if (s.st !== d.st) out.unshift(`status ${s.st} ≠ ${d.st}`)
  console.log((out.length ? 'DIFF ' : 'SAME ') + label + (out.length ? '\n  ' + out.slice(0, 8).join('\n  ') : ''))
  if (out.length) fails++
}
await cmp('/api/site', '/api/site')
await cmp('/api/availability (busy)', '/api/availability', (j) => ({ rooms: j.rooms, busy: j.busy }))
const site = await (await fetch(SRC + '/api/site')).json()
for (const a of site.articles) await cmp('/api/articles/' + a.slug, '/api/articles/' + a.slug)
// .ics: porovnaj len VEVENT-y (DTSTAMP sa mení s časom)
for (const n of [1, 2, 3]) {
  const ev = async (o) => ((await (await fetch(`${o}/ics/${n}.ics`)).text()).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []).map((e) => e.replace(/\r?\nDTSTAMP:[^\r\n]*/, '').replace(/\r\n/g, '\n')).sort()
  const [a, b] = await Promise.all([ev(SRC), ev(DST)])
  const same = JSON.stringify(a) === JSON.stringify(b)
  console.log((same ? 'SAME ' : 'DIFF ') + `/ics/${n}.ics (${a.length} vs ${b.length} udalostí)`)
  if (!same) { fails++; console.log('  src:', a[0]?.slice(0, 300), '\n  dst:', b[0]?.slice(0, 300)) }
}
console.log(fails ? `\n${fails} rozdielov` : '\nZHODA')
