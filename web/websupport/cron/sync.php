<?php
declare(strict_types=1);

// Websupport Cron job (WebAdmin -> Cron), odporúčané každých 30-60 minút:
//   php /cesta/k/hostingu/cron/sync.php
// Nahrádza "lazy sync" trik z Cloudflare verzie (tam nebol natívny cron --
// synchronizácia sa spúšťala na pozadí pri návšteve /api/availability,
// ak od poslednej ubehli >2h). Tu beží nezávisle na návštevnosti.
// Ručné tlačidlo "Synchronizovať teraz" v admine (POST /api/admin/calendar/sync)
// volá tú istú `pod_sync_imports()` funkciu.

require __DIR__ . '/../lib/db.php';
require __DIR__ . '/../lib/helpers.php';
require __DIR__ . '/../lib/ical.php';
require __DIR__ . '/../lib/http.php';
require __DIR__ . '/../lib/calendar_sync.php';

$config = pod_config();
$pdo = pod_db();

$result = pod_sync_imports($pdo, $config);

foreach ($result as $r) {
    $line = $r['ok']
        ? "izba {$r['room_id']}: OK, {$r['events']} udalostí"
        : "izba {$r['room_id']}: CHYBA - {$r['error']}";
    fwrite(STDOUT, $line . PHP_EOL);
}
