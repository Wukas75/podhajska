<?php
declare(strict_types=1);

// Fáza 5 -- SEO meta server-side. Náhrada za ../functions/_middleware.js
// (Cloudflare HTMLRewriter). .htaccess sem presmeruje `/` a `/index.html`;
// tento wrapper načíta statický index.html (z `public/`, leží vedľa v doc
// roote) a ak má admin uložené settings.seo, prepíše <title>, meta
// description, og:title/description/image a pridá robots noindex -- aby
// vyhľadávače a social crawlery (bez JS) dostali správne meta tagy.
// Pri akejkoľvek chybe DB/JSON sa pošle statický index.html bez zmeny.

require __DIR__ . '/lib/db.php';

function pod_seo_esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

// Nastaví `content` na <meta ATTR="NAME" ...>, nezávisle od poradia atribútov.
function pod_seo_meta(string $html, string $attr, string $name, string $value): string
{
    $re = '#<meta\b(?=[^>]*\b' . $attr . '\s*=\s*["\']' . preg_quote($name, '#') . '["\'])[^>]*>#i';
    return (string) preg_replace_callback($re, function (array $m) use ($value): string {
        $tag = (string) preg_replace('#\scontent\s*=\s*("[^"]*"|\'[^\']*\')#i', '', $m[0]);
        // callback, nie replacement string -- "$1" v hodnote nesmie byť backreferencia
        return (string) preg_replace_callback('#\s*/?>$#', fn () => ' content="' . pod_seo_esc($value) . '" />', $tag, 1);
    }, $html, 1);
}

function pod_seo_origin(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
        || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function pod_seo_apply(string $html, array $seo): string
{
    $title = trim((string) ($seo['title'] ?? ''));
    $description = trim((string) ($seo['description'] ?? ''));
    $ogImage = trim((string) ($seo['ogImage'] ?? ''));
    if ($ogImage !== '' && !preg_match('#^https?://#i', $ogImage)) {
        $ogImage = pod_seo_origin() . '/' . ltrim($ogImage, '/');
    }

    if ($title !== '') {
        $html = (string) preg_replace_callback('#<title>.*?</title>#is', fn () => '<title>' . pod_seo_esc($title) . '</title>', $html, 1);
        $html = pod_seo_meta($html, 'property', 'og:title', $title);
    }
    if ($description !== '') {
        $html = pod_seo_meta($html, 'name', 'description', $description);
        $html = pod_seo_meta($html, 'property', 'og:description', $description);
    }
    if ($ogImage !== '') {
        $html = pod_seo_meta($html, 'property', 'og:image', $ogImage);
    }
    if (!empty($seo['noindex'])) {
        $html = (string) preg_replace('#</head>#i', "  <meta name=\"robots\" content=\"noindex, nofollow\" />\n</head>", $html, 1);
    }
    return $html;
}

$html = (string) file_get_contents(__DIR__ . '/index.html');

try {
    $raw = pod_db()->query("SELECT value FROM settings WHERE `key` = 'seo'")->fetchColumn();
    $seo = $raw ? json_decode((string) $raw, true) : null;
    $seo = is_array($seo) ? $seo : [];
    // config 'noindex' => true (napr. test.podhajska.net) -- nikdy neindexovať, bez ohľadu na admin SEO
    if (!empty(pod_config()['noindex'])) {
        $seo['noindex'] = true;
    }
    if ($seo) {
        $html = pod_seo_apply($html, $seo);
    }
} catch (Throwable $e) {
    error_log('seo: ' . $e->getMessage()); // necháme statické defaulty
}

// /assets/*.css|js -> ?v=<mtime>: Websupport proxy držal starý base.css aj po
// nasadení; nová URL po každej zmene súboru obíde akúkoľvek cache.
$html = (string) preg_replace_callback(
    '#((?:href|src)=")(/assets/[^"?]+\.(?:css|js))"#',
    function (array $m): string {
        $mtime = @filemtime(__DIR__ . $m[2]);
        return $m[1] . $m[2] . ($mtime ? '?v=' . $mtime : '') . '"';
    },
    $html
);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;
