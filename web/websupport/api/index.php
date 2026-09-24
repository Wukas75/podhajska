<?php
declare(strict_types=1);

// Jeden PHP front-controller pre všetky /api/* cesty -- náhrada za Hono
// router z ../../functions/api/[[route]].js. .htaccess v koreni hostingu
// sem presmeruje /api/*, viď websupport/.htaccess.

require __DIR__ . '/../lib/db.php';
require __DIR__ . '/../lib/helpers.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/ical.php';
require __DIR__ . '/../lib/http.php';
require __DIR__ . '/../lib/mailer.php';
require __DIR__ . '/../lib/calendar_sync.php';
require __DIR__ . '/handlers/public.php';
require __DIR__ . '/handlers/auth.php';
require __DIR__ . '/handlers/admin.php';

try {
    $config = pod_config();
    $pdo = pod_db();

    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = preg_replace('#^/api#', '', $path);
    if ($path === '') {
        $path = '/';
    }

    // [metóda, regex, handler, vyžaduje auth?]
    $routes = [
        ['GET', '#^/site$#', 'h_get_site', false],
        ['GET', '#^/articles/([^/]+)$#', 'h_get_article', false],
        ['GET', '#^/availability$#', 'h_get_availability', false],
        ['POST', '#^/inquiry$#', 'h_post_inquiry', false],
        ['GET', '#^/cron/sync$#', 'h_cron_sync', false], // Websupport Cron „Návšteva URL (wget)", chránené cron_token

        ['GET', '#^/auth/me$#', 'h_auth_me', false],
        ['POST', '#^/auth/login$#', 'h_auth_login', false],
        ['POST', '#^/auth/logout$#', 'h_auth_logout', false],
        ['POST', '#^/setup$#', 'h_setup', false],

        ['POST', '#^/admin/password$#', 'h_admin_password', true],
        ['PUT', '#^/admin/theme$#', 'h_admin_theme_put', true],

        ['GET', '#^/admin/articles$#', 'h_admin_articles_list', true],
        ['GET', '#^/admin/articles/(\d+)$#', 'h_admin_article_get', true],
        ['POST', '#^/admin/articles$#', 'h_admin_article_post', true],
        ['PUT', '#^/admin/articles/(\d+)$#', 'h_admin_article_put', true],
        ['DELETE', '#^/admin/articles/(\d+)$#', 'h_admin_article_delete', true],

        ['GET', '#^/admin/gallery$#', 'h_admin_gallery_list', true],
        ['POST', '#^/admin/gallery$#', 'h_admin_gallery_upload', true],
        ['PUT', '#^/admin/gallery/reorder$#', 'h_admin_gallery_reorder', true],
        ['PUT', '#^/admin/gallery/(\d+)$#', 'h_admin_gallery_put', true],
        ['DELETE', '#^/admin/gallery/(\d+)$#', 'h_admin_gallery_delete', true],

        ['GET', '#^/admin/calendar$#', 'h_admin_calendar_get', true],
        ['POST', '#^/admin/bookings$#', 'h_admin_booking_post', true],
        ['PATCH', '#^/admin/bookings/(\d+)$#', 'h_admin_booking_patch', true],
        ['DELETE', '#^/admin/bookings/(\d+)$#', 'h_admin_booking_delete', true],
        ['POST', '#^/admin/bookings/(\d+)/free-day$#', 'h_admin_booking_freeday', true],
        ['PUT', '#^/admin/rooms/(\d+)$#', 'h_admin_room_put', true],
        ['POST', '#^/admin/calendar/sync$#', 'h_admin_calendar_sync', true],
    ];

    foreach ($routes as [$m, $re, $handler, $needsAuth]) {
        if ($m !== $method || !preg_match($re, $path, $matches)) {
            continue;
        }
        array_shift($matches);
        $sess = $needsAuth ? pod_require_auth($config) : null;
        $handler($pdo, $config, $matches, $sess);
        exit;
    }

    pod_json(['error' => 'Neznáma cesta'], 404);
} catch (Throwable $e) {
    error_log((string) $e);
    pod_json(['error' => 'Serverová chyba'], 500);
}
