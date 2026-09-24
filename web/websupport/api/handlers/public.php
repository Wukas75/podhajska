<?php
declare(strict_types=1);

// Verejné endpointy -- port sekcie "PUBLIC" z [[route]].js.
// Signatúra handlera: (PDO $pdo, array $config, array $params[, array $sess]).

function h_get_site(PDO $pdo, array $config, array $params): void
{
    $settingsRows = $pdo->query('SELECT `key`, value FROM settings')->fetchAll();
    $s = [];
    foreach ($settingsRows as $r) {
        $s[$r['key']] = $r['value'];
    }

    $articles = $pdo->query(
        "SELECT id, slug, title, excerpt, cover_url, section, published_at FROM articles
         WHERE status = 'published'
         ORDER BY COALESCE(published_at, created_at) DESC, id DESC"
    )->fetchAll();

    $gallery = $pdo->query(
        "SELECT id, url, alt, category FROM gallery_images WHERE category != 'clanky' ORDER BY sort, id"
    )->fetchAll();

    pod_json([
        'theme_css' => $s['theme_css'] ?? '',
        'theme_vars' => pod_safe_json($s['theme_vars'] ?? null, (object) []),
        'texts' => pod_safe_json($s['texts'] ?? null, (object) []),
        'seo' => pod_safe_json($s['seo'] ?? null, (object) []),
        'contact' => pod_safe_json($s['contact'] ?? null, (object) []),
        'articles' => $articles,
        'gallery' => $gallery,
    ]);
}

function h_get_article(PDO $pdo, array $config, array $params): void
{
    $stmt = $pdo->prepare(
        "SELECT id, slug, title, excerpt, body_html, cover_url, published_at FROM articles
         WHERE slug = ? AND status = 'published'"
    );
    $stmt->execute([$params[0]]);
    $row = $stmt->fetch();
    if (!$row) {
        pod_bad('Článok neexistuje', 404);
    }
    pod_json($row);
}

/* ---- kalendár obsadenosti (verejné) ---- */

function h_get_availability(PDO $pdo, array $config, array $params): void
{
    $from = pod_ymd($_GET['from'] ?? null) ?? pod_today_ymd();
    $to = pod_ymd($_GET['to'] ?? null) ?? pod_add_days($from, 150);

    $rooms = $pdo->query('SELECT id, name FROM rooms ORDER BY sort, id')->fetchAll();

    $stmt = $pdo->prepare(
        "SELECT room_id, start_date, end_date, status FROM bookings
         WHERE status IN ('confirmed','pending') AND end_date > ? AND start_date < ?
         ORDER BY start_date"
    );
    $stmt->execute([$from, $to]);
    $busy = $stmt->fetchAll();

    pod_json(['from' => $from, 'to' => $to, 'rooms' => $rooms, 'busy' => $busy]);
}

// Klient rezervuje termín -- vytvorí sa DRŽANÁ rezervácia (status 'pending' =
// "rezervované"), ktorá hneď blokuje kalendár. Admin ju potom potvrdí
// (-> 'confirmed' = "obsadené") alebo zamietne.
function h_post_inquiry(PDO $pdo, array $config, array $params): void
{
    $b = pod_body();
    $roomId = (int) ($b['room_id'] ?? 0);
    $start = pod_ymd($b['start_date'] ?? null);
    $end = pod_ymd($b['end_date'] ?? null);
    if (!$roomId || !$start || !$end || $end <= $start) {
        pod_bad('Neplatný termín');
    }
    if ($start < pod_today_ymd()) {
        pod_bad('Termín je v minulosti');
    }

    $roomStmt = $pdo->prepare('SELECT id, name FROM rooms WHERE id = ?');
    $roomStmt->execute([$roomId]);
    $room = $roomStmt->fetch();
    if (!$room) {
        pod_bad('Neplatná izba');
    }

    $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 120);
    $email = mb_substr(trim((string) ($b['email'] ?? '')), 0, 160);
    $phone = mb_substr(trim((string) ($b['phone'] ?? '')), 0, 60);
    if (!$name || !$email || !$phone) {
        pod_bad('Vyplňte meno, e-mail aj telefón');
    }
    if (!preg_match('/^[^@\s]+@[^@\s]+\.[^@\s]+$/', $email)) {
        pod_bad('Neplatný e-mail');
    }

    $clashStmt = $pdo->prepare(
        "SELECT status FROM bookings WHERE room_id = ? AND status IN ('confirmed','pending')
         AND end_date > ? AND start_date < ? LIMIT 1"
    );
    $clashStmt->execute([$roomId, $start, $end]);
    if ($clashStmt->fetch()) {
        pod_bad('Tento termín je už rezervovaný alebo obsadený. Vyberte iný.', 409);
    }

    $nights = (int) round((strtotime($end) - strtotime($start)) / 86400);
    $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 1000);

    $ins = $pdo->prepare(
        "INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, guest_name, guest_email, guest_phone, note)
         VALUES (?, ?, ?, 'inquiry', 'pending', ?, ?, ?, ?, ?, ?)"
    );
    $ins->execute([
        $roomId, $start, $end, 'inq-' . pod_uuid(), 'Rezervácia: ' . $name, $name, $email, $phone, $note,
    ]);

    // Odpovedz hneď, e-mail/webhook nech dobehne na pozadí (ak PHP-FPM
    // podporuje fastcgi_finish_request -- inak klient krátko počká).
    pod_respond_async(['ok' => true, 'status' => 'reserved']);
    pod_notify_reservation($config, [
        'roomId' => $roomId, 'roomName' => $room['name'], 'start' => $start, 'end' => $end,
        'nights' => $nights, 'name' => $name, 'email' => $email, 'phone' => $phone, 'note' => $note,
    ]);
    exit;
}

// GET /api/cron/sync?token=<cron_token> -- pre Websupport Cron typu „Návšteva URL
// adresy (wget)"; to isté ako cron/sync.php z CLI alebo tlačidlo v admine.
// Bez `cron_token` v configu je endpoint vypnutý (404).
function h_cron_sync(PDO $pdo, array $config, array $params): void
{
    $expected = (string) ($config['cron_token'] ?? '');
    if ($expected === '') {
        pod_json(['error' => 'Neznáma cesta'], 404);
    }
    if (!hash_equals($expected, (string) ($_GET['token'] ?? ''))) {
        pod_json(['error' => 'Neplatný token'], 403);
    }
    pod_json(['ok' => true, 'rooms' => pod_sync_imports($pdo, $config)]);
}
