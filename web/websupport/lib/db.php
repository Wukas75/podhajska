<?php
declare(strict_types=1);

// Websupport má display_errors=on -- warning by sa vypísal návštevníkovi a
// rozbil JSON odpovede API. Chyby len do logu. (db.php includuje každý vstupný bod.)
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Minimálna konfiguračná + PDO vrstva pre PHP/MySQL verziu (náhrada za D1
// binding z Cloudflare). Fáza 4 (API endpointy) na toto naviaže.

function pod_config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) {
            throw new RuntimeException(
                'Chýba websupport/lib/config.php -- skopíruj config.example.php a vyplň prístupové údaje.'
            );
        }
        $config = require $path;
    }
    return $config;
}

function pod_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = pod_config()['db'];
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $c['host'],
            $c['name'],
            $c['charset'] ?? 'utf8mb4'
        );
        if (!empty($c['port'])) {
            $dsn .= ';port=' . (int) $c['port']; // Websupport: db.r6.websupport.sk:3317
        }
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
