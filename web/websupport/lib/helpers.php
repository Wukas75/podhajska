<?php
declare(strict_types=1);

// Spoločné pomocné funkcie -- port `functions/api/[[route]].js` sekcie
// "pomocné: rôzne" + sanitizeHtml + kategórie/sekcie konštanty.

function pod_json($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function pod_bad(string $msg, int $code = 400): void
{
    pod_json(['error' => $msg], $code);
}

// Odošle JSON odpoveď a (ak to PHP-FPM dovolí) hneď ukončí spojenie s klientom,
// aby volajúci kód mohol pokračovať na pozadí (napr. odoslanie e-mailu) bez
// toho, aby na to návštevník čakal -- náhrada za Cloudflare `waitUntil`.
function pod_respond_async($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    header('Content-Length: ' . strlen($body));
    echo $body;
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        // Bez PHP-FPM niet spôsobu, ako odpovedať a pokračovať na pozadí --
        // klient počká, kým dobehne aj odoslanie e-mailu.
        if (ob_get_level() > 0) {
            @ob_end_flush();
        }
        @flush();
    }
}

function pod_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw !== false ? $raw : '', true);
    return is_array($data) ? $data : [];
}

// Náhrada za JS JSON.parse s fallbackom pri chybe/prázdnom reťazci.
function pod_safe_json(?string $str, $fallback)
{
    if (!$str) {
        return $fallback;
    }
    // ako objekty (nie assoc polia), inak sa prázdne {} vráti klientovi ako []
    // a admin.js by doň zapisoval kľúče, ktoré JSON.stringify([]) zahodí
    $v = json_decode($str);
    return $v === null && json_last_error() !== JSON_ERROR_NONE ? $fallback : $v;
}

function pod_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// Diakritika -> ASCII slug. Skúša `intl` rozšírenie (transliterator/Normalizer),
// bez neho padá na ručnú mapu -- Websupport shared hosting nemusí mať `intl`.
function pod_slugify(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    if (function_exists('transliterator_transliterate')) {
        $t = @transliterator_transliterate('Any-Latin; Latin-ASCII', $s);
        if ($t !== false && $t !== null) {
            $s = $t;
        }
    } elseif (class_exists('Normalizer')) {
        $n = Normalizer::normalize($s, Normalizer::FORM_D);
        if ($n !== false) {
            $s = preg_replace('/[\x{0300}-\x{036f}]/u', '', $n);
        }
    } else {
        static $map = [
            'á' => 'a', 'ä' => 'a', 'č' => 'c', 'ď' => 'd', 'é' => 'e', 'ě' => 'e', 'í' => 'i',
            'ľ' => 'l', 'ĺ' => 'l', 'ň' => 'n', 'ó' => 'o', 'ô' => 'o', 'ŕ' => 'r', 'š' => 's',
            'ť' => 't', 'ú' => 'u', 'ů' => 'u', 'ý' => 'y', 'ž' => 'z',
        ];
        $s = strtr($s, $map);
    }
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim($s, '-');
    return mb_substr($s, 0, 80);
}

const POD_YMD_RE = '/^\d{4}-\d{2}-\d{2}$/';

function pod_ymd($v): ?string
{
    $v = (string) ($v ?? '');
    return preg_match(POD_YMD_RE, $v) ? $v : null;
}

function pod_today_ymd(): string
{
    return gmdate('Y-m-d');
}

// Rovnaké escapovanie ako JS `esc()` -- & < > " (nie jednoduchú úvodzovku),
// používa sa len v HTML e-mailových šablónach.
function pod_esc(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_COMPAT, 'UTF-8');
}

const GALLERY_CATS = ['studio', 'wellness', 'exterier', 'clanky'];

function pod_norm_cat($v): string
{
    $v = (string) $v;
    return in_array($v, GALLERY_CATS, true) ? $v : 'exterier';
}

const ARTICLE_SECTIONS = ['blog', 'okolie'];

function pod_norm_section($v): string
{
    $v = (string) $v;
    return in_array($v, ARTICLE_SECTIONS, true) ? $v : 'blog';
}

function pod_unique_slug(PDO $pdo, string $base, int $ignoreId = 0): string
{
    $base = $base !== '' ? $base : 'clanok';
    $slug = $base;
    $stmt = $pdo->prepare('SELECT id FROM articles WHERE slug = ? AND id != ?');
    for ($i = 0; $i < 50; $i++) {
        $stmt->execute([$slug, $ignoreId]);
        if (!$stmt->fetch()) {
            return $slug;
        }
        $slug = $base . '-' . ($i + 2);
    }
    return $base . '-' . time();
}

// Port `sanitizeHtml` z [[route]].js -- allowlist tagov pre WYSIWYG obsah
// článkov. `img`/`a` src-y teraz smerujú na /uploads/ (nahraté fotky) alebo
// /assets/ (statické), nie na pôvodné Cloudflare /img/.
const POD_ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'blockquote'];

function pod_attr(string $attrs, string $name): string
{
    if (preg_match('/' . preg_quote($name, '/') . '\s*=\s*"([^"]*)"/i', $attrs, $m)) {
        return $m[1];
    }
    if (preg_match('/' . preg_quote($name, '/') . "\\s*=\\s*'([^']*)'/i", $attrs, $m)) {
        return $m[1];
    }
    return '';
}

function pod_sanitize_html(string $html): string
{
    if ($html === '') {
        return '';
    }
    $s = $html;
    $s = preg_replace('/<!--.*?-->/s', '', $s);
    $s = preg_replace('/<(script|style|iframe|object|embed|form|input|textarea|link|meta|svg)[\s\S]*?<\/\1>/i', '', $s);
    $s = preg_replace('/<(script|style|iframe|object|embed|form|input|textarea|link|meta|svg)[^>]*>/i', '', $s);
    $s = preg_replace_callback(
        '/<(\/?)([a-zA-Z0-9]+)((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>/',
        function (array $m): string {
            [, $close, $tag, $attrs] = $m;
            $tag = strtolower($tag);
            if ($tag === 'b') {
                $tag = 'strong';
            }
            if ($tag === 'i') {
                $tag = 'em';
            }
            if ($tag === 'div') {
                $tag = 'p';
            }
            if (!in_array($tag, POD_ALLOWED_TAGS, true)) {
                return '';
            }
            if ($close) {
                return "</{$tag}>";
            }
            if ($tag === 'a') {
                $href = pod_attr($attrs, 'href');
                if (preg_match('#^(https?:|mailto:|/)#i', $href)) {
                    return '<a href="' . str_replace('"', '&quot;', $href) . '" rel="noopener" target="_blank">';
                }
                return '<a>';
            }
            if ($tag === 'img') {
                $src = pod_attr($attrs, 'src');
                if (!preg_match('#^/(uploads|assets)/#', $src)) {
                    return '';
                }
                $alt = pod_attr($attrs, 'alt');
                return '<img src="' . str_replace('"', '&quot;', $src) . '" alt="' . str_replace('"', '&quot;', $alt) . '" loading="lazy">';
            }
            return "<{$tag}>";
        },
        $s
    );
    return trim($s);
}
