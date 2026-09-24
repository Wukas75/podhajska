<?php
declare(strict_types=1);

// Port `syncImports` z [[route]].js. Pôvodne sa spúšťalo "lažy" pri každej
// návšteve /api/availability (žiadny natívny cron na Cloudflare Pages) --
// tu to nahrádza skutočný Websupport Cron job (websupport/cron/sync.php),
// plus rovnaké ručné tlačidlo "Synchronizovať teraz" v admine
// (POST /api/admin/calendar/sync), viď api/handlers/admin.php.
function pod_sync_imports(PDO $pdo, array $config): array
{
    $rooms = $pdo->query("SELECT id, ics_import_url FROM rooms WHERE ics_import_url != ''")->fetchAll();
    $out = [];

    $upsert = $pdo->prepare(
        "INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, note)
         VALUES (:room_id, :start, :end, 'booking', 'confirmed', :uid, :summary, '')
         ON DUPLICATE KEY UPDATE
           start_date = VALUES(start_date), end_date = VALUES(end_date),
           summary = VALUES(summary), status = 'confirmed'"
    );
    $touchRoom = $pdo->prepare('UPDATE rooms SET last_import_at = NOW(), last_import_msg = ? WHERE id = ?');

    foreach ($rooms as $room) {
        try {
            $text = pod_http_get($room['ics_import_url']);
            $events = pod_parse_ics($text);
            $uids = [];

            foreach ($events as $ev) {
                if (empty($ev['start']) || empty($ev['end'])) {
                    continue;
                }
                $uid = 'bk-' . $room['id'] . '-' . ($ev['uid'] ?? ($ev['start'] . '_' . $ev['end']));
                $uids[] = $uid;
                $upsert->execute([
                    ':room_id' => $room['id'],
                    ':start' => $ev['start'],
                    ':end' => $ev['end'],
                    ':uid' => $uid,
                    ':summary' => mb_substr((string) ($ev['summary'] ?? 'Booking.com'), 0, 120),
                ]);
            }

            // zmaž importované, ktoré už v Booking kalendári nie sú (zrušené rezervácie)
            if ($uids) {
                $placeholders = implode(',', array_fill(0, count($uids), '?'));
                $del = $pdo->prepare(
                    "DELETE FROM bookings WHERE room_id = ? AND source = 'booking' AND uid NOT IN ({$placeholders})"
                );
                $del->execute(array_merge([$room['id']], $uids));
            } else {
                $pdo->prepare("DELETE FROM bookings WHERE room_id = ? AND source = 'booking'")->execute([$room['id']]);
            }

            $touchRoom->execute([count($events) . ' udalostí', $room['id']]);
            $out[] = ['room_id' => (int) $room['id'], 'ok' => true, 'events' => count($events)];
        } catch (Throwable $e) {
            $touchRoom->execute(['Chyba: ' . mb_substr($e->getMessage(), 0, 160), $room['id']]);
            $out[] = ['room_id' => (int) $room['id'], 'ok' => false, 'error' => $e->getMessage()];
        }
    }

    $pdo->prepare(
        "INSERT INTO settings (`key`, value) VALUES ('calendar_last_sync', NOW())
         ON DUPLICATE KEY UPDATE value = NOW()"
    )->execute();

    return $out;
}
