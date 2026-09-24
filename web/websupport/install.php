<?php
declare(strict_types=1);

// Jednorazový inštalátor DB (fáza 6) -- náhrada za import cez phpMyAdmin.
// Spustenie: https://<doména>/install.php?token=<setup_token z config.php>
// Spustí db/schema.sql (idempotentné) a db/seed.sql (len keď je galéria
// prázdna). Keď už existuje admin, odmietne bežať. PO INŠTALÁCII ZMAZAŤ.

require __DIR__ . '/lib/db.php';

header('Content-Type: text/plain; charset=utf-8');

function pod_install_run(PDO $pdo, string $file): int
{
    $sql = (string) file_get_contents($file);
    $sql = (string) preg_replace('/^\s*--.*$/m', '', $sql);
    // príkazy končia `;` na konci riadku (schema/seed nemajú `;\n` vnútri reťazcov)
    $n = 0;
    foreach (preg_split('/;\s*$/m', $sql) as $stmt) {
        if (trim($stmt) === '') {
            continue;
        }
        $pdo->exec($stmt);
        $n++;
    }
    return $n;
}

try {
    $config = pod_config();
    $token = (string) ($_GET['token'] ?? '');
    if ($token === '' || !hash_equals((string) $config['setup_token'], $token)) {
        http_response_code(403);
        exit("Neplatný token\n");
    }
    $pdo = pod_db();

    $hasAdmins = false;
    try {
        $hasAdmins = (int) $pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn() > 0;
    } catch (PDOException $e) {
        // tabuľka ešte neexistuje -> čistá inštalácia
    }
    if ($hasAdmins) {
        http_response_code(409);
        exit("Inštalácia je už dokončená (existuje admin). Zmaž install.php.\n");
    }

    echo 'PHP ' . PHP_VERSION . ', DB ' . $pdo->query('SELECT VERSION()')->fetchColumn() . "\n";
    echo 'schema.sql: ' . pod_install_run($pdo, __DIR__ . '/db/schema.sql') . " príkazov\n";

    $gallery = (int) $pdo->query('SELECT COUNT(*) FROM gallery_images')->fetchColumn();
    if ($gallery === 0) {
        echo 'seed.sql: ' . pod_install_run($pdo, __DIR__ . '/db/seed.sql') . " príkazov\n";
    } else {
        echo "seed.sql: preskočené (galéria už má $gallery fotiek)\n";
    }

    foreach (['admin_users', 'settings', 'articles', 'gallery_images', 'rooms', 'bookings'] as $t) {
        echo str_pad($t, 16) . (int) $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn() . "\n";
    }
    $ext = [];
    foreach (['pdo_mysql', 'curl', 'mbstring', 'openssl', 'fileinfo'] as $e) {
        $ext[] = $e . '=' . (extension_loaded($e) ? 'ok' : 'CHÝBA');
    }
    echo 'rozšírenia: ' . implode(', ', $ext) . ', allow_url_fopen=' . (ini_get('allow_url_fopen') ? 'ok' : 'off') . "\n";
    echo 'uploads zapisovateľné: ' . (is_writable((string) $config['uploads_dir']) ? 'áno' : 'NIE') . "\n";
    echo "OK\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo 'CHYBA: ' . $e->getMessage() . "\n";
}
