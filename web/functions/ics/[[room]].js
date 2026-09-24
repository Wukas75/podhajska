// Verejný .ics kalendár obsadenosti jednej izby – toto URL sa vkladá do Booking.com.
// Cesta: /ics/1.ics  (aj /ics/1). Exportuje ručné blokácie + rezervácie z webu (aj držané
// „rezervované", aby si ich Booking tiež zablokoval) – rezervácie naimportované z Bookingu
// (source='booking') sa späť neexportujú (aby nevznikla slučka).
import { buildIcs } from '../_ical.js'

export async function onRequest(context) {
  const { env, params } = context
  const raw = Array.isArray(params.room) ? params.room[0] : params.room
  const id = Number(String(raw || '').replace(/\.ics$/i, ''))
  if (!id) return new Response('Not found', { status: 404 })

  const room = await env.DB.prepare('SELECT id, name FROM rooms WHERE id = ?').bind(id).first()
  if (!room) return new Response('Not found', { status: 404 })

  const rows =
    (
      await env.DB.prepare(
        `SELECT start_date, end_date, uid, summary, status FROM bookings
         WHERE room_id = ? AND status IN ('confirmed','pending') AND source IN ('manual','inquiry')
           AND end_date >= date('now', '-2 day')
         ORDER BY start_date`,
      )
        .bind(id)
        .all()
    ).results || []

  const body = buildIcs({
    name: 'Štúdiá Podhájska – ' + room.name,
    events: rows.map((r) => ({
      uid: (r.uid || r.start_date + '-' + r.end_date) + '@podhajska',
      start: r.start_date,
      end: r.end_date,
      summary: r.status === 'pending' ? 'Rezervované (predbežne)' : r.summary || 'Obsadené',
    })),
  })

  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `inline; filename="studio-${id}.ics"`,
      'cache-control': 'public, max-age=900',
    },
  })
}
