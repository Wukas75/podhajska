<?php
declare(strict_types=1);

// E-mail o novej rezervácii (+ voliteľný webhook). Port `notifyReservation`
// z [[route]].js, rozšírený o doručovanie priamo z Websupportu.
//
// Spôsob odoslania sa vyberie automaticky podľa config.php:
//   1) 'smtp_host' vyplnený -> SMTP cez schránku na podhajska.net
//      (Websupport: smtp.m1.websupport.sk, 465/ssl) -- najlepšia doručiteľnosť
//   Odosielateľ musí byť EXISTUJÚCA schránka na podhajska.net -- s neexistujúcou
//   rezervacie@ Gmail mail() správy ticho zahodil (test 2026-09-23).
//   2) 'resend_api_key' vyplnený -> Resend REST API (ako na Cloudflare)
//   3) inak PHP mail() -- sendmail na hostingu, funguje bez nastavenia
// 'mail_enabled' => false vypne e-maily úplne (rezervácia je aj tak v admine).
//
// Pôvodný JS mal aj vetvu pre `info.clash`, ktorú ale volajúci kód
// (`/api/inquiry`) nikdy nenapĺňal -- mŕtvy kód, v tomto porte vynechaný.

function pod_notify_reservation(array $config, array $info): void
{
    if (!empty($config['inquiry_webhook_url'])) {
        try {
            pod_http_post_json($config['inquiry_webhook_url'], $info);
        } catch (Throwable $e) {
            error_log('inquiry webhook: ' . $e->getMessage());
        }
    }

    if (($config['mail_enabled'] ?? true) === false) {
        error_log('Nová rezervácia (e-maily vypnuté): ' . json_encode($info, JSON_UNESCAPED_UNICODE));
        return;
    }

    $nights = (int) ($info['nights'] ?? 0);
    $nightsWord = $nights === 1 ? 'noc' : ($nights < 5 ? 'noci' : 'nocí');
    $fmt = fn ($ymd) => preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string) $ymd, $m) ? ((int) $m[3]) . '. ' . ((int) $m[2]) . '. ' . $m[1] : (string) $ymd;
    $start = $fmt($info['start'] ?? '');
    $end = $fmt($info['end'] ?? '');

    $html = '<h2>Nová rezervácia ubytovania</h2><ul>'
        . '<li><b>' . pod_esc($info['roomName'] ?? '') . '</b></li>'
        . '<li>Termín: <b>' . pod_esc($start) . ' → ' . pod_esc($end) . '</b> (' . $nights . ' ' . $nightsWord . ')</li>'
        . '<li>Meno: ' . pod_esc($info['name'] ?? '') . '</li>'
        . '<li>E-mail: <a href="mailto:' . pod_esc($info['email'] ?? '') . '">' . pod_esc($info['email'] ?? '') . '</a></li>'
        . '<li>Telefón: <a href="tel:' . pod_esc(preg_replace('/[^0-9+]/', '', (string) ($info['phone'] ?? ''))) . '">' . pod_esc($info['phone'] ?? '') . '</a></li>'
        . (!empty($info['note']) ? '<li>Poznámka: ' . nl2br(pod_esc($info['note'])) . '</li>' : '')
        . '</ul><p>Termín je v kalendári označený ako <b>rezervovaný</b>. '
        . 'Po kontaktovaní klienta ho v admin → Kalendár potvrďte (zmení sa na obsadené) alebo zamietnite.</p>'
        . '<p style="color:#888;font-size:12px">Na tento e-mail môžete priamo odpovedať — odpoveď pôjde hosťovi.</p>';

    $mail = [
        'from' => (string) (($config['inquiry_from'] ?? '') ?: 'Bungalovy Classic <info@podhajska.net>'),
        'to' => (string) (($config['inquiry_to'] ?? '') ?: 'info@podhajska.net'),
        'subject' => "Rezervácia {$start} → {$end} · " . ($info['roomName'] ?? '') . ' · ' . ($info['name'] ?? ''),
        'html' => $html,
        'reply_to' => filter_var($info['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: null,
    ];

    try {
        $via = pod_mail_send($config, $mail);
        error_log("rezervácia: e-mail odoslaný ($via) na {$mail['to']}");
    } catch (Throwable $e) {
        error_log('rezervácia: e-mail zlyhal: ' . $e->getMessage());
    }
}

/**
 * Odošle HTML e-mail. $mail = [from, to, subject, html, reply_to?].
 * Vráti názov použitého spôsobu, pri chybe hodí výnimku.
 */
function pod_mail_send(array $config, array $mail): string
{
    if (!empty($config['smtp_host'])) {
        pod_smtp_send($config, $mail);
        return 'smtp';
    }
    if (!empty($config['resend_api_key'])) {
        $payload = ['from' => $mail['from'], 'to' => [$mail['to']], 'subject' => $mail['subject'], 'html' => $mail['html']];
        if ($mail['reply_to']) {
            $payload['reply_to'] = $mail['reply_to'];
        }
        $res = pod_http_post_json('https://api.resend.com/emails', $payload, ['Authorization: Bearer ' . $config['resend_api_key']]);
        if (!$res['ok']) {
            throw new RuntimeException('resend ' . $res['status'] . ' ' . ($res['body'] ?? ''));
        }
        return 'resend';
    }

    [$headers, $body] = pod_mime_message($mail, false);
    $envelope = pod_mail_addr($mail['from']);
    $ok = mail(
        pod_mail_addr($mail['to']),
        pod_mime_header($mail['subject']),
        $body,
        implode("\r\n", $headers),
        $envelope ? '-f' . $envelope : ''
    );
    if (!$ok) {
        throw new RuntimeException('mail() vrátil false');
    }
    return 'mail()';
}

// "Meno <a@b.c>" -> "a@b.c"
function pod_mail_addr(string $s): string
{
    return preg_match('/<([^<>\s]+@[^<>\s]+)>/', $s, $m) ? $m[1] : trim($s);
}

// RFC 2047 (UTF-8 base64) pre hlavičky s diakritikou
function pod_mime_header(string $s): string
{
    $s = str_replace(["\r", "\n"], ' ', $s);
    return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

// "Meno <a@b.c>" s zakódovaným menom
function pod_mime_address(string $s): string
{
    $addr = pod_mail_addr($s);
    $name = trim((string) preg_replace('/<[^>]*>/', '', $s), " \t\"");
    return $name !== '' && $name !== $addr ? pod_mime_header($name) . " <$addr>" : $addr;
}

/**
 * Hlavičky + telo. $full = true pridá aj To/Subject (pre SMTP; mail() ich
 * dostane ako parametre).
 */
function pod_mime_message(array $mail, bool $full): array
{
    $domain = substr((string) strrchr(pod_mail_addr($mail['from']), '@'), 1) ?: 'localhost';
    $headers = [
        'From: ' . pod_mime_address($mail['from']),
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    if (!empty($mail['reply_to'])) {
        $headers[] = 'Reply-To: ' . pod_mail_addr((string) $mail['reply_to']);
    }
    if ($full) {
        array_unshift($headers, 'To: ' . pod_mime_address($mail['to']), 'Subject: ' . pod_mime_header($mail['subject']));
    }
    $html = '<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif">' . $mail['html'] . '</body></html>';
    return [$headers, rtrim(chunk_split(base64_encode($html), 76, "\r\n"))];
}

// Minimálny SMTP klient (AUTH LOGIN, SSL 465 alebo STARTTLS 587), bez knižníc.
function pod_smtp_send(array $config, array $mail): void
{
    $host = (string) $config['smtp_host'];
    $port = (int) ($config['smtp_port'] ?? 465);
    $secure = (string) ($config['smtp_secure'] ?? ($port === 465 ? 'ssl' : 'tls'));
    $ctx = stream_context_create(['ssl' => ['SNI_enabled' => true, 'peer_name' => $host]]);
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . "$host:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        throw new RuntimeException("SMTP spojenie $host:$port: $errstr");
    }
    stream_set_timeout($fp, 20);

    $read = function () use ($fp): array {
        $data = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return [(int) substr($data, 0, 3), trim($data)];
    };
    $cmd = function (string $c, array $expect, bool $secret = false) use ($fp, $read): string {
        if ($c !== '') {
            fwrite($fp, $c . "\r\n");
        }
        [$code, $resp] = $read();
        if (!in_array($code, $expect, true)) {
            $shown = $secret ? '[prihlasovacie údaje]' : substr($c, 0, 60);
            throw new RuntimeException("SMTP '$shown' -> $resp");
        }
        return $resp;
    };

    try {
        $cmd('', [220]);
        $ehlo = 'EHLO ' . (gethostname() ?: 'localhost');
        $cmd($ehlo, [250]);
        if ($secure === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('SMTP STARTTLS zlyhal');
            }
            $cmd($ehlo, [250]);
        }
        if (!empty($config['smtp_user'])) {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode((string) $config['smtp_user']), [334], true);
            $cmd(base64_encode((string) ($config['smtp_pass'] ?? '')), [235], true);
        }
        $cmd('MAIL FROM:<' . pod_mail_addr($mail['from']) . '>', [250]);
        $cmd('RCPT TO:<' . pod_mail_addr($mail['to']) . '>', [250, 251]);
        $cmd('DATA', [354]);
        [$headers, $body] = pod_mime_message($mail, true);
        // dot-stuffing: riadok začínajúci "." zdvojiť (base64 telo "." nemá, hlavičky pre istotu)
        $data = preg_replace('/^\./m', '..', implode("\r\n", $headers) . "\r\n\r\n" . $body);
        $cmd($data . "\r\n.", [250]);
        $cmd('QUIT', [221]);
    } finally {
        fclose($fp);
    }
}
