<?php
declare(strict_types=1);

// Port `functions/_ical.js` -- minimálny RFC 5545 parser + generátor, stačí
// na kalendáre z Booking.com/Airbnb. Dátumy sa držia ako 'YYYY-MM-DD';
// end_date = deň odchodu = EXKLUZÍVNY (ako iCal DTEND).

function pod_ics_date(string $ymd): string
{
    return str_replace('-', '', substr($ymd, 0, 10));
}

function pod_add_days(string $ymd, int $n): string
{
    $d = new DateTimeImmutable($ymd . 'T00:00:00Z');
    $d = $d->modify(($n >= 0 ? '+' : '') . $n . ' days');
    return $d->format('Y-m-d');
}

function pod_ics_unfold(string $text): string
{
    $text = str_replace("\r\n", "\n", $text);
    return preg_replace('/\n[ \t]/', '', $text);
}

function pod_ics_unescape(string $s): string
{
    $s = preg_replace('/\\\\n/i', "\n", $s);
    $s = str_replace('\\,', ',', $s);
    $s = str_replace('\\;', ';', $s);
    $s = str_replace('\\\\', '\\', $s);
    return $s;
}

function pod_ics_to_ymd(string $v): ?string
{
    if (preg_match('/(\d{4})(\d{2})(\d{2})/', $v, $m)) {
        return "{$m[1]}-{$m[2]}-{$m[3]}";
    }
    return null;
}

function pod_parse_ics(string $text): array
{
    $lines = explode("\n", pod_ics_unfold($text));
    $events = [];
    $cur = null;
    foreach ($lines as $raw) {
        $t = trim($raw);
        if ($t === 'BEGIN:VEVENT') {
            $cur = [];
            continue;
        }
        if ($t === 'END:VEVENT') {
            if ($cur !== null && !empty($cur['start'])) {
                if (empty($cur['end']) || $cur['end'] <= $cur['start']) {
                    $cur['end'] = pod_add_days($cur['start'], 1);
                }
                $events[] = $cur;
            }
            $cur = null;
            continue;
        }
        if ($cur === null) {
            continue;
        }
        $i = strpos($t, ':');
        if ($i === false) {
            continue;
        }
        $keyPart = substr($t, 0, $i);
        $key = strtoupper(explode(';', $keyPart)[0]);
        $val = substr($t, $i + 1);
        if ($key === 'DTSTART') {
            $cur['start'] = pod_ics_to_ymd($val);
        } elseif ($key === 'DTEND') {
            $cur['end'] = pod_ics_to_ymd($val);
        } elseif ($key === 'UID') {
            $cur['uid'] = trim(pod_ics_unescape($val));
        } elseif ($key === 'SUMMARY') {
            $cur['summary'] = trim(pod_ics_unescape($val));
        }
    }
    return $events;
}

function pod_ics_escape(string $s): string
{
    $s = str_replace('\\', '\\\\', $s);
    $s = str_replace(';', '\\;', $s);
    $s = str_replace(',', '\\,', $s);
    $s = preg_replace('/\r?\n/', '\\n', $s);
    return $s;
}

function pod_ics_fold(string $line): string
{
    if (strlen($line) <= 74) {
        return $line;
    }
    $out = [];
    $s = $line;
    while (strlen($s) > 74) {
        $out[] = substr($s, 0, 74);
        $s = ' ' . substr($s, 74);
    }
    $out[] = $s;
    return implode("\r\n", $out);
}

// $events = list of ['uid'=>?, 'start'=>'YYYY-MM-DD', 'end'=>'YYYY-MM-DD', 'summary'=>?]
function pod_build_ics(string $name, array $events, string $prodId = '-//Studia Podhajska//Calendar//SK'): string
{
    $L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:' . $prodId, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    if ($name !== '') {
        $L[] = 'X-WR-CALNAME:' . pod_ics_escape($name);
    }
    $stamp = gmdate('Ymd\THis\Z');
    foreach ($events as $ev) {
        $uid = $ev['uid'] ?? ($ev['start'] . '-' . $ev['end']);
        $L[] = 'BEGIN:VEVENT';
        $L[] = 'UID:' . pod_ics_escape($uid);
        $L[] = 'DTSTAMP:' . $stamp;
        $L[] = 'DTSTART;VALUE=DATE:' . pod_ics_date($ev['start']);
        $L[] = 'DTEND;VALUE=DATE:' . pod_ics_date($ev['end']);
        $L[] = 'SUMMARY:' . pod_ics_escape($ev['summary'] ?? 'Obsadené');
        $L[] = 'TRANSP:OPAQUE';
        $L[] = 'END:VEVENT';
    }
    $L[] = 'END:VCALENDAR';
    return implode("\r\n", array_map('pod_ics_fold', $L)) . "\r\n";
}
