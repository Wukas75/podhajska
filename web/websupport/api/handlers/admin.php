<?php
declare(strict_types=1);

// Port sekcie "ADMIN" z [[route]].js (theme, články, galéria, kalendár,
// rezervácie, izby). Všetky funkcie tu bežia až po `pod_require_auth()`
// (viď api/index.php), dostávajú aj `$sess` (obsahuje 'uid').

function h_admin_theme_put(PDO $pdo, array $config, array $params, array $sess): void
{
    // telo dekódované ako objekty -- aby sa {} uložilo ako {}, nie [] (viď pod_safe_json)
    $b = json_decode((string) file_get_contents('php://input'));
    if (!$b instanceof stdClass) {
        $b = new stdClass();
    }
    $enc = fn ($v) => json_encode($v ?? new stdClass(), JSON_UNESCAPED_UNICODE);
    $rows = [
        ['theme_vars', $enc($b->theme_vars ?? null)],
        ['theme_css', is_scalar($b->theme_css ?? null) ? (string) $b->theme_css : ''],
        ['texts', $enc($b->texts ?? null)],
        ['seo', $enc($b->seo ?? null)],
        ['contact', $enc($b->contact ?? null)],
    ];
    $stmt = $pdo->prepare(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)'
    );
    $pdo->beginTransaction();
    try {
        foreach ($rows as [$k, $v]) {
            $stmt->execute([$k, $v]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    pod_json(['ok' => true]);
}

/* ---- články ---- */

function h_admin_articles_list(PDO $pdo, array $config, array $params, array $sess): void
{
    $rows = $pdo->query(
        'SELECT id, slug, title, excerpt, cover_url, section, status, published_at, sort, updated_at
         FROM articles ORDER BY sort DESC, id DESC'
    )->fetchAll();
    pod_json($rows);
}

function h_admin_article_get(PDO $pdo, array $config, array $params, array $sess): void
{
    $stmt = $pdo->prepare('SELECT * FROM articles WHERE id = ?');
    $stmt->execute([$params[0]]);
    $row = $stmt->fetch();
    if (!$row) {
        pod_bad('Neexistuje', 404);
    }
    pod_json($row);
}

function h_admin_article_post(PDO $pdo, array $config, array $params, array $sess): void
{
    $b = pod_body();
    if (empty($b['title'])) {
        pod_bad('Titulok je povinný');
    }

    $slug = pod_unique_slug($pdo, pod_slugify((string) ($b['slug'] ?? $b['title'])));
    $status = ($b['status'] ?? '') === 'published' ? 'published' : 'draft';
    $publishedAt = $status === 'published'
        ? ((string) ($b['published_at'] ?? '') ?: gmdate('Y-m-d H:i:s'))
        : null;

    $ins = $pdo->prepare(
        'INSERT INTO articles (slug, title, excerpt, body_html, cover_url, section, status, published_at, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
        $slug,
        $b['title'],
        (string) ($b['excerpt'] ?? ''),
        pod_sanitize_html((string) ($b['body_html'] ?? '')),
        (string) ($b['cover_url'] ?? ''),
        pod_norm_section($b['section'] ?? null),
        $status,
        $publishedAt,
        (int) ($b['sort'] ?? 0),
    ]);
    pod_json(['ok' => true, 'id' => (int) $pdo->lastInsertId(), 'slug' => $slug]);
}

function h_admin_article_put(PDO $pdo, array $config, array $params, array $sess): void
{
    $id = (int) $params[0];
    $b = pod_body();

    $curStmt = $pdo->prepare('SELECT * FROM articles WHERE id = ?');
    $curStmt->execute([$id]);
    $cur = $curStmt->fetch();
    if (!$cur) {
        pod_bad('Neexistuje', 404);
    }

    $title = $b['title'] ?? $cur['title'];
    $slug = !empty($b['slug']) ? pod_unique_slug($pdo, pod_slugify((string) $b['slug']), $id) : $cur['slug'];
    $section = in_array($b['section'] ?? null, ARTICLE_SECTIONS, true) ? $b['section'] : $cur['section'];
    $status = in_array($b['status'] ?? null, ['published', 'draft'], true) ? $b['status'] : $cur['status'];

    $publishedAt = $cur['published_at'];
    if ($status === 'published' && !$publishedAt) {
        $publishedAt = gmdate('Y-m-d H:i:s');
    }
    if ($status === 'draft') {
        $publishedAt = !empty($b['keep_date']) ? $cur['published_at'] : null;
    }

    $upd = $pdo->prepare(
        'UPDATE articles SET slug=?, title=?, excerpt=?, body_html=?, cover_url=?, section=?, status=?, published_at=?, sort=?
         WHERE id=?'
    );
    $upd->execute([
        $slug,
        $title,
        array_key_exists('excerpt', $b) ? $b['excerpt'] : $cur['excerpt'],
        array_key_exists('body_html', $b) ? pod_sanitize_html((string) $b['body_html']) : $cur['body_html'],
        array_key_exists('cover_url', $b) ? $b['cover_url'] : $cur['cover_url'],
        $section,
        $status,
        $publishedAt,
        array_key_exists('sort', $b) ? (int) $b['sort'] : $cur['sort'],
        $id,
    ]);
    pod_json(['ok' => true, 'slug' => $slug]);
}

function h_admin_article_delete(PDO $pdo, array $config, array $params, array $sess): void
{
    $pdo->prepare('DELETE FROM articles WHERE id = ?')->execute([$params[0]]);
    pod_json(['ok' => true]);
}

/* ---- galéria ---- */

function h_admin_gallery_list(PDO $pdo, array $config, array $params, array $sess): void
{
    $rows = $pdo->query('SELECT id, url, file_key, alt, category, sort FROM gallery_images ORDER BY sort, id')->fetchAll();
    pod_json($rows);
}

function h_admin_gallery_upload(PDO $pdo, array $config, array $params, array $sess): void
{
    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        pod_bad('Chýba súbor');
    }
    $file = $_FILES['file'];

    $type = '';
    if (function_exists('mime_content_type')) {
        $type = (string) (@mime_content_type($file['tmp_name']) ?: '');
    }
    if ($type === '') {
        $type = (string) ($file['type'] ?? '');
    }
    if (strpos($type, 'image/') !== 0) {
        pod_bad('Povolené sú len obrázky');
    }
    if ($file['size'] > 15 * 1024 * 1024) {
        pod_bad('Maximálna veľkosť je 15 MB');
    }

    // Prípona podľa zisteného MIME (allowlist), nikdy z mena súboru od klienta --
    // inak by GIF/PHP polyglot "x.php" prešiel kontrolou a uložil sa ako .php.
    $exts = [
        'image/jpeg' => 'jpg', 'image/pjpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif',
        'image/webp' => 'webp', 'image/avif' => 'avif', 'image/heic' => 'heic', 'image/heif' => 'heif',
    ];
    $ext = $exts[strtolower($type)] ?? null;
    if ($ext === null) {
        pod_bad('Nepodporovaný formát obrázka (JPG, PNG, GIF, WebP, AVIF, HEIC)');
    }
    $fileKey = time() . '-' . substr(pod_uuid(), 0, 8) . '.' . $ext;

    $dir = rtrim((string) $config['uploads_dir'], '/') . '/gallery';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        pod_bad('Nepodarilo sa vytvoriť adresár na fotky', 500);
    }
    $dest = $dir . '/' . $fileKey;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        pod_bad('Nepodarilo sa uložiť súbor', 500);
    }

    $url = rtrim((string) $config['uploads_url'], '/') . '/gallery/' . $fileKey;
    $max = (float) $pdo->query('SELECT COALESCE(MAX(sort), 0) FROM gallery_images')->fetchColumn();

    $ins = $pdo->prepare('INSERT INTO gallery_images (url, file_key, alt, category, sort) VALUES (?, ?, ?, ?, ?)');
    $ins->execute([$url, $fileKey, (string) ($_POST['alt'] ?? ''), pod_norm_cat($_POST['category'] ?? null), $max + 10]);

    pod_json(['ok' => true, 'id' => (int) $pdo->lastInsertId(), 'url' => $url]);
}

function h_admin_gallery_reorder(PDO $pdo, array $config, array $params, array $sess): void
{
    $b = pod_body();
    $ids = $b['ids'] ?? null;
    if (!is_array($ids)) {
        pod_bad('Zoznam ID chýba');
    }

    $stmt = $pdo->prepare('UPDATE gallery_images SET sort = ? WHERE id = ?');
    $pdo->beginTransaction();
    try {
        foreach (array_values($ids) as $i => $id) {
            $stmt->execute([($i + 1) * 10, $id]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    pod_json(['ok' => true]);
}

function h_admin_gallery_put(PDO $pdo, array $config, array $params, array $sess): void
{
    $b = pod_body();
    $cat = in_array($b['category'] ?? null, GALLERY_CATS, true) ? $b['category'] : null;
    $upd = $pdo->prepare(
        'UPDATE gallery_images SET alt = COALESCE(?, alt), category = COALESCE(?, category), sort = COALESCE(?, sort) WHERE id = ?'
    );
    $upd->execute([
        array_key_exists('alt', $b) ? $b['alt'] : null,
        $cat,
        array_key_exists('sort', $b) && $b['sort'] !== null ? (int) $b['sort'] : null,
        $params[0],
    ]);
    pod_json(['ok' => true]);
}

function h_admin_gallery_delete(PDO $pdo, array $config, array $params, array $sess): void
{
    $stmt = $pdo->prepare('SELECT file_key FROM gallery_images WHERE id = ?');
    $stmt->execute([$params[0]]);
    $row = $stmt->fetch();
    if ($row && $row['file_key']) {
        $path = rtrim((string) $config['uploads_dir'], '/') . '/gallery/' . $row['file_key'];
        if (is_file($path)) {
            @unlink($path);
        }
    }
    $pdo->prepare('DELETE FROM gallery_images WHERE id = ?')->execute([$params[0]]);
    pod_json(['ok' => true]);
}

/* ---- kalendár obsadenosti (admin) ---- */

function h_admin_calendar_get(PDO $pdo, array $config, array $params, array $sess): void
{
    $from = pod_ymd($_GET['from'] ?? null) ?? pod_add_days(pod_today_ymd(), -31);
    $to = pod_ymd($_GET['to'] ?? null) ?? pod_add_days(pod_today_ymd(), 400);

    $rooms = $pdo->query(
        'SELECT id, name, ics_import_url, last_import_at, last_import_msg FROM rooms ORDER BY sort, id'
    )->fetchAll();

    $bStmt = $pdo->prepare(
        "SELECT * FROM bookings WHERE status != 'cancelled' AND end_date > ? AND start_date < ? ORDER BY start_date"
    );
    $bStmt->execute([$from, $to]);
    $bookings = $bStmt->fetchAll();

    $pending = $pdo->query("SELECT * FROM bookings WHERE status = 'pending' ORDER BY created_at DESC")->fetchAll();

    $lastSync = $pdo->query("SELECT value FROM settings WHERE `key` = 'calendar_last_sync'")->fetchColumn();

    $origin = (pod_is_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');

    pod_json([
        'from' => $from,
        'to' => $to,
        'rooms' => $rooms,
        'bookings' => $bookings,
        'pending' => $pending,
        'last_sync' => $lastSync !== false ? $lastSync : null,
        'ics_base' => $origin . '/ics/',
    ]);
}

function h_admin_booking_post(PDO $pdo, array $config, array $params, array $sess): void
{
    $b = pod_body();
    $roomId = (int) ($b['room_id'] ?? 0);
    $start = pod_ymd($b['start_date'] ?? null);
    $end = pod_ymd($b['end_date'] ?? null);
    if (!$roomId || !$start || !$end || $end <= $start) {
        pod_bad('Neplatný termín');
    }

    $roomStmt = $pdo->prepare('SELECT id FROM rooms WHERE id = ?');
    $roomStmt->execute([$roomId]);
    if (!$roomStmt->fetch()) {
        pod_bad('Neplatná izba');
    }

    $ins = $pdo->prepare(
        "INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, note)
         VALUES (?, ?, ?, 'manual', 'confirmed', ?, ?, ?)"
    );
    $ins->execute([
        $roomId,
        $start,
        $end,
        'man-' . pod_uuid(),
        mb_substr((string) ($b['summary'] ?? 'Obsadené'), 0, 120),
        mb_substr((string) ($b['note'] ?? ''), 0, 1000),
    ]);
    pod_json(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
}

function h_admin_booking_patch(PDO $pdo, array $config, array $params, array $sess): void
{
    $id = (int) $params[0];
    $b = pod_body();

    $curStmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
    $curStmt->execute([$id]);
    $cur = $curStmt->fetch();
    if (!$cur) {
        pod_bad('Neexistuje', 404);
    }

    $start = array_key_exists('start_date', $b) ? pod_ymd($b['start_date']) : $cur['start_date'];
    $end = array_key_exists('end_date', $b) ? pod_ymd($b['end_date']) : $cur['end_date'];
    if (!$start || !$end || $end <= $start) {
        pod_bad('Neplatný termín');
    }

    $status = in_array($b['status'] ?? null, ['confirmed', 'pending', 'cancelled'], true) ? $b['status'] : $cur['status'];

    $upd = $pdo->prepare(
        'UPDATE bookings SET start_date = ?, end_date = ?, status = ?,
           summary = COALESCE(?, summary), note = COALESCE(?, note)
         WHERE id = ?'
    );
    $upd->execute([
        $start,
        $end,
        $status,
        array_key_exists('summary', $b) ? $b['summary'] : null,
        array_key_exists('note', $b) ? $b['note'] : null,
        $id,
    ]);
    pod_json(['ok' => true]);
}

function h_admin_booking_delete(PDO $pdo, array $config, array $params, array $sess): void
{
    $pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([$params[0]]);
    pod_json(['ok' => true]);
}

// Uvoľní JEDEN deň z rezervácie: podľa polohy dňa skráti začiatok/koniec,
// alebo (deň uprostred) rozdelí rezerváciu na dve. Zachová source/status/
// údaje hosťa.
function h_admin_booking_freeday(PDO $pdo, array $config, array $params, array $sess): void
{
    $id = (int) $params[0];
    $b = pod_body();
    $d = pod_ymd($b['day'] ?? null);

    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $bk = $stmt->fetch();
    if (!$bk) {
        pod_bad('Neexistuje', 404);
    }
    if ($bk['source'] === 'booking') {
        pod_bad('Rezerváciu z Booking.com upravte v Booking.com');
    }
    if (!$d || $d < $bk['start_date'] || $d >= $bk['end_date']) {
        pod_bad('Deň nie je v rozsahu rezervácie');
    }

    $dayEnd = pod_add_days($d, 1);

    if ($bk['start_date'] === $d && $bk['end_date'] === $dayEnd) {
        $pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([$id]);
        pod_json(['ok' => true, 'removed' => true]);
    }
    if ($bk['start_date'] === $d) {
        $pdo->prepare('UPDATE bookings SET start_date = ? WHERE id = ?')->execute([$dayEnd, $id]);
        pod_json(['ok' => true]);
    }
    if ($bk['end_date'] === $dayEnd) {
        $pdo->prepare('UPDATE bookings SET end_date = ? WHERE id = ?')->execute([$d, $id]);
        pod_json(['ok' => true]);
    }

    $pdo->prepare('UPDATE bookings SET end_date = ? WHERE id = ?')->execute([$d, $id]);
    $ins = $pdo->prepare(
        'INSERT INTO bookings (room_id, start_date, end_date, source, status, uid, summary, guest_name, guest_email, guest_phone, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
        $bk['room_id'], $dayEnd, $bk['end_date'], $bk['source'], $bk['status'], 'split-' . pod_uuid(),
        $bk['summary'], $bk['guest_name'], $bk['guest_email'], $bk['guest_phone'], $bk['note'],
    ]);
    pod_json(['ok' => true, 'split' => true]);
}

function h_admin_room_put(PDO $pdo, array $config, array $params, array $sess): void
{
    $b = pod_body();
    $upd = $pdo->prepare(
        'UPDATE rooms SET name = COALESCE(?, name), ics_import_url = COALESCE(?, ics_import_url) WHERE id = ?'
    );
    $upd->execute([
        array_key_exists('name', $b) ? $b['name'] : null,
        array_key_exists('ics_import_url', $b) && $b['ics_import_url'] !== null ? trim((string) $b['ics_import_url']) : null,
        $params[0],
    ]);
    pod_json(['ok' => true]);
}

function h_admin_calendar_sync(PDO $pdo, array $config, array $params, array $sess): void
{
    $rooms = pod_sync_imports($pdo, $config);
    pod_json(['ok' => true, 'rooms' => $rooms]);
}
