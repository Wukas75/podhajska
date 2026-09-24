<?php
declare(strict_types=1);

// Port sekcií "AUTH" + `/admin/password` z [[route]].js.

function h_auth_me(PDO $pdo, array $config, array $params): void
{
    $sess = pod_current_session($config);
    pod_json(['authed' => (bool) $sess]);
}

function h_auth_login(PDO $pdo, array $config, array $params): void
{
    $b = pod_body();
    $username = trim((string) ($b['username'] ?? ''));
    $password = (string) ($b['password'] ?? '');
    if (!$username || !$password) {
        pod_bad('Zadaj meno a heslo');
    }

    $stmt = $pdo->prepare('SELECT id, password_hash, password_salt FROM admin_users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    $ok = $user && pod_verify_password($password, $user['password_hash'], $user['password_salt']);
    if (!$ok) {
        pod_bad('Nesprávne meno alebo heslo', 401);
    }

    $token = pod_make_session($config['session_secret'], (int) $user['id']);
    pod_set_session_cookie($token);
    pod_json(['ok' => true]);
}

function h_auth_logout(PDO $pdo, array $config, array $params): void
{
    pod_clear_session_cookie();
    pod_json(['ok' => true]);
}

function h_setup(PDO $pdo, array $config, array $params): void
{
    $b = pod_body();
    $token = (string) ($b['token'] ?? '');
    if (!$token || !hash_equals((string) $config['setup_token'], $token)) {
        pod_bad('Neplatný setup token', 403);
    }

    $username = trim((string) ($b['username'] ?? ''));
    $password = (string) ($b['password'] ?? '');
    if (!$username || !$password || strlen($password) < 8) {
        pod_bad('Heslo musí mať aspoň 8 znakov');
    }

    $count = (int) $pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
    if ($count > 0) {
        pod_bad('Administrátor už existuje', 409);
    }

    $h = pod_hash_password($password);
    $ins = $pdo->prepare('INSERT INTO admin_users (username, password_hash, password_salt) VALUES (?, ?, ?)');
    $ins->execute([$username, $h['hash'], $h['salt']]);
    pod_json(['ok' => true]);
}

function h_admin_password(PDO $pdo, array $config, array $params, array $sess): void
{
    $b = pod_body();
    $current = (string) ($b['current'] ?? '');
    $next = (string) ($b['next'] ?? '');
    if (!$next || strlen($next) < 8) {
        pod_bad('Nové heslo musí mať aspoň 8 znakov');
    }

    $stmt = $pdo->prepare('SELECT password_hash, password_salt FROM admin_users WHERE id = ?');
    $stmt->execute([$sess['uid']]);
    $user = $stmt->fetch();
    if (!$user || !pod_verify_password($current, $user['password_hash'], $user['password_salt'])) {
        pod_bad('Súčasné heslo nesedí', 403);
    }

    $h = pod_hash_password($next);
    $upd = $pdo->prepare('UPDATE admin_users SET password_hash = ?, password_salt = ? WHERE id = ?');
    $upd->execute([$h['hash'], $h['salt'], $sess['uid']]);
    pod_json(['ok' => true]);
}
