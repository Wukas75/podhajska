// Minimálny iCal (RFC 5545) parser + generátor – stačí na kalendáre z Booking.com a Airbnb.
// Dátumy sa držia ako 'YYYY-MM-DD'; end_date = deň odchodu = EXKLUZÍVNY (ako iCal DTEND).

function pad(n) { return n < 10 ? '0' + n : '' + n }

export function icsDate(ymd) {
  return String(ymd).slice(0, 10).replace(/-/g, '')
}

export function dtStamp(d = new Date()) {
  return (
    d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  )
}

function unfold(text) {
  // zloží pokračovacie riadky (riadok začínajúci medzerou/tabom)
  return String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function unescapeIcs(s) {
  return String(s)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function toYmd(v) {
  const m = String(v).match(/(\d{4})(\d{2})(\d{2})/) // '20260910' aj '20260910T140000Z'
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function parseIcs(text) {
  const lines = unfold(text).split('\n')
  const events = []
  let cur = null
  for (const raw of lines) {
    const t = raw.trim()
    if (t === 'BEGIN:VEVENT') { cur = {}; continue }
    if (t === 'END:VEVENT') {
      if (cur && cur.start) {
        if (!cur.end || cur.end <= cur.start) cur.end = addDays(cur.start, 1)
        events.push(cur)
      }
      cur = null
      continue
    }
    if (!cur) continue
    const i = t.indexOf(':')
    if (i < 0) continue
    const key = t.slice(0, i).split(';')[0].toUpperCase()
    const val = t.slice(i + 1)
    if (key === 'DTSTART') cur.start = toYmd(val)
    else if (key === 'DTEND') cur.end = toYmd(val)
    else if (key === 'UID') cur.uid = unescapeIcs(val).trim()
    else if (key === 'SUMMARY') cur.summary = unescapeIcs(val).trim()
  }
  return events
}

function escapeIcs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function fold(line) {
  if (line.length <= 74) return line
  const out = []
  let s = line
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74) }
  out.push(s)
  return out.join('\r\n')
}

export function buildIcs({ name = 'Kalendár', prodId = '-//Studia Podhajska//Calendar//SK', events = [] }) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:' + prodId, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  if (name) L.push('X-WR-CALNAME:' + escapeIcs(name))
  const stamp = dtStamp()
  for (const ev of events) {
    L.push('BEGIN:VEVENT')
    L.push('UID:' + escapeIcs(ev.uid || ev.start + '-' + ev.end))
    L.push('DTSTAMP:' + stamp)
    L.push('DTSTART;VALUE=DATE:' + icsDate(ev.start))
    L.push('DTEND;VALUE=DATE:' + icsDate(ev.end))
    L.push('SUMMARY:' + escapeIcs(ev.summary || 'Obsadené'))
    L.push('TRANSP:OPAQUE')
    L.push('END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(fold).join('\r\n') + '\r\n'
}
