<?php
declare(strict_types=1);

// Minimálny HTTP klient pre odchádzajúce volania (Booking.com .ics import,
// Resend e-mail API, voliteľný webhook). Preferuje cURL (bežne dostupné aj
// na zdieľanom hostingu), padá na `file_get_contents` ak cURL chýba --
// vtedy ale musí byť zapnuté `allow_url_fopen` v php.ini.

function pod_http_get(string $url, int $timeout = 20): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_USERAGENT => 'StudiaPodhajska-Calendar/1.0',
        ]);
        $body = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($body === false) {
            throw new RuntimeException('cURL: ' . $err);
        }
        if ($code >= 400) {
            throw new RuntimeException('HTTP ' . $code);
        }
        return $body;
    }

    $ctx = stream_context_create([
        'http' => [
            'header' => "User-Agent: StudiaPodhajska-Calendar/1.0\r\n",
            'timeout' => $timeout,
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) {
        throw new RuntimeException('Nepodarilo sa stiahnuť URL (chýba cURL aj allow_url_fopen?)');
    }
    return $body;
}

// $headers = list of raw header lines, napr. ['Authorization: Bearer xyz'].
function pod_http_post_json(string $url, array $payload, array $headers = [], int $timeout = 15): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $allHeaders = array_merge(['Content-Type: application/json'], $headers);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $allHeaders,
            CURLOPT_TIMEOUT => $timeout,
        ]);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        return ['ok' => $resp !== false && $code < 400, 'status' => $code, 'body' => $resp, 'error' => $err];
    }

    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $allHeaders) . "\r\n",
            'content' => $body,
            'ignore_errors' => true,
            'timeout' => $timeout,
        ],
    ]);
    $resp = @file_get_contents($url, false, $ctx);
    return ['ok' => $resp !== false, 'status' => 0, 'body' => $resp, 'error' => null];
}
