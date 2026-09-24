<?php
declare(strict_types=1);

// Verejný .ics kalendár obsadenosti jednej izby -- toto URL sa vkladá do
// Booking.com. Cesta: /ics/1.ics (aj /ics/1), viď websupport/.htaccess.
// Port `functions/ics/[[room]].js`. Exportuje ručné blokácie + rezervácie
// z webu (aj držané "rezervované", aby si ich Booking tiež zablokoval) --
// rezervácie naimportované z Bookingu (source='booking') sa späť
// neexportujú (aby nevznikla slučka).

require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/ical.php';

$id = (int) ($_GET['room'] ?? 0);
if (!$id) {
    http_response_code(404);
    exit('Not found');
}

$pdo = pod_db();

$roomStmt = $pdo->prepare('SELECT id, name FROM rooms WHERE id = ?');
$roomStmt->execute([$id]);
$room = $roomStmt->fetch();
if (!$room) {
    http_response_code(404);
    exit('Not found');
}

$stmt = $pdo->prepare(
    "SELECT start_date, end_date, uid, summary, status FROM bookings
     WHERE room_id = ? AND status IN ('confirmed','pending') AND source IN ('manual','inquiry')
       AND end_date >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
     ORDER BY start_date"
);
$stmt->execute([$id]);
$rows = $stmt->fetchAll();

$events = array_map(static function (array $r): array {
    return [
        'uid' => ($r['uid'] ?: ($r['start_date'] . '-' . $r['end_date'])) . '@podhajska',
        'start' => $r['start_date'],
        'end' => $r['end_date'],
        'summary' => $r['status'] === 'pending' ? 'Rezervované (predbežne)' : ($r['summary'] ?: 'Obsadené'),
    ];
}, $rows);

$body = pod_build_ics('Štúdiá Podhájska – ' . $room['name'], $events);

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: inline; filename="studio-' . $id . '.ics"');
header('Cache-Control: public, max-age=900');
echo $body;
