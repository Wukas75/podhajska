<?php
declare(strict_types=1);

// Port auth časti z [[route]].js -- rovnaký algoritmus ako doteraz
// (PBKDF2-SHA256 100k iterácií pre heslá, HMAC-SHA256 podpísaná session
// cookie), aby prípadný neskorší cross-check bol možný.

function pod_b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function pod_b64url_decode(string $data): string
{
    $data = strtr($data, '-_', '+/');
    $pad = strlen($data) % 4;
    if ($pad) {
        $data .= str_repeat('=', 4 - $pad);
    }
    return base64_decode($data);
}

function pod_hash_password(string $password): array
{
    $salt = random_bytes(16);
    $hash = hash_pbkdf2('sha256', $password, $salt, 100000, 32, true);
    return ['hash' => base64_encode($hash), 'salt' => base64_encode($salt)];
}

function pod_verify_password(string $password, string $hashB64, string $saltB64): bool
{
    $salt = base64_decode($saltB64);
    $hash = hash_pbkdf2('sha256', $password, $salt, 100000, 32, true);
    return hash_equals(base64_encode($hash), $hashB64);
}

function pod_hmac(string $secret, string $data): string
{
    return pod_b64url_encode(hash_hmac('sha256', $data, $secret, true));
}

function pod_make_session(string $secret, int $uid, int $days = 30): string
{
    $exp = (int) round(microtime(true) * 1000) + $days * 86400000;
    $payload = pod_b64url_encode(json_encode(['uid' => $uid, 'exp' => $exp]));
    return $payload . '.' . pod_hmac($secret, $payload);
}

function pod_read_session(string $secret, ?string $token): ?array
{
    if (!$token || strpos($token, '.') === false) {
        return null;
    }
    [$payload, $sig] = explode('.', $token, 2);
    if (!hash_equals(pod_hmac($secret, $payload), $sig)) {
        return null;
    }
    $obj = json_decode(pod_b64url_decode($payload), true);
    if (!is_array($obj) || empty($obj['exp']) || $obj['exp'] < round(microtime(true) * 1000)) {
        return null;
    }
    return $obj;
}

function pod_current_session(array $config): ?array
{
    return pod_read_session($config['session_secret'], $_COOKIE['pod_session'] ?? null);
}

// Vráti session pole, alebo rovno ukončí request s 401 (ako `requireAuth`
// middleware v Hono).
function pod_require_auth(array $config): array
{
    $sess = pod_current_session($config);
    if (!$sess) {
        pod_bad('Neprihlásený', 401);
    }
    return $sess;
}

function pod_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function pod_set_session_cookie(string $token): void
{
    setcookie('pod_session', $token, [
        'expires' => time() + 60 * 60 * 24 * 30,
        'path' => '/',
        'httponly' => true,
        'secure' => pod_is_https(),
        'samesite' => 'Lax',
    ]);
}

function pod_clear_session_cookie(): void
{
    setcookie('pod_session', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'secure' => pod_is_https(),
        'samesite' => 'Lax',
    ]);
}
