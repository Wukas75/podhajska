# Websupport verzia (PHP + MySQL) — fázy 3-7 (beží na test.podhajska.net)

Cieľ: kompletný funkčný náhradník za Cloudflare Pages/Functions/D1/R2 verziu
(`../public`, `../functions`), spustiteľný na bežnom Websupport PHP/MySQL
hostingu pre `podhajska.net`. Rozsah = všetko (CMS, galéria, kalendár +
Booking.com sync, e-mail notifikácie).

## Čo je hotové (fáza 3)

- **`db/schema.sql`** — kompletná MySQL schéma, konverzia z
  `../migrations/0001..0005_*.sql`. Konsoliduje všetky D1 migrácie do
  jedného spustenia (žiadne postupné ALTER kroky ako na D1). Rozdiely
  oproti D1 sú okomentované priamo v súbore (ENUM namiesto CHECK, TEXT/BLOB
  bez DEFAULT, `key` v spätných apostrofoch, `r2_key`→`file_key`, reálny
  FOREIGN KEY na `rooms`, skrátený `uid` na VARCHAR(191) kvôli limitu
  veľkosti indexu na starších InnoDB konfiguráciách).
- **`db/seed.sql`** — počiatočné dáta (3 ukážkové články + 41 fotiek s
  kategóriami), 1:1 preklad `../migrations/0002_seed.sql`. **Toto je len
  seed pre čistú/testovaciu inštaláciu** — reálny obsah, ktorý je teraz
  v produkčnej D1 (skutočné publikované články, nahraté fotky, existujúce
  rezervácie, admin účet), sa ním nenahrádza. Export/prevod živých dát z D1
  je samostatný krok pred ostrým prepnutím (fáza 6/7), nie súčasť fázy 3.
- **`lib/db.php`** + **`lib/config.example.php`** — minimálna PDO
  connection vrstva (náhrada za `env.DB` binding). `config.php` (so
  skutočnými prístupovými údajmi) je v `.gitignore`, do repa sa necommitne.
- **`uploads/`** — náhrada za R2 bucket; sem budú PHP endpointy ukladať
  adminom nahraté fotky galérie (podadresár `uploads/gallery/`).

`schema.sql` + `seed.sql` sú overené na MariaDB 10.6 (Docker, viď
„Lokálny test" nižšie) — importujú sa bez chýb.

## Čo je hotové (fáza 4)

Kompletný prepis `../functions/api/[[route]].js` (Hono router, 697 riadkov)
do PHP, endpoint po endpointe, plus `../functions/_ical.js` a
`../functions/ics/[[room]].js`. `../functions/img/[[key]].js` (R2 proxy)
netreba — `/uploads/` teraz servíruje priamo webserver ako statické súbory.

- **`api/index.php`** — front-controller: jedna routovacia tabuľka (metóda +
  regex + handler + vyžaduje-auth?), presne tých istých 20 route-ov ako
  pôvodný Hono router. `.htaccess` naň presmeruje všetko z `/api/*`.
- **`api/handlers/public.php`** — `/site`, `/articles/:slug`,
  `/availability`, `/inquiry`.
- **`api/handlers/auth.php`** — `/auth/me`, `/auth/login`, `/auth/logout`,
  `/setup`, `/admin/password`.
- **`api/handlers/admin.php`** — `/admin/theme`, články CRUD, galéria
  CRUD+upload+reorder, `/admin/calendar`, rezervácie CRUD+`free-day`,
  `/admin/rooms/:id`, `/admin/calendar/sync`.
- **`ics.php`** — verejný `/ics/<izba>.ics` export (Booking.com import).
- **`lib/auth.php`** — PBKDF2-SHA256 (100k it.) + HMAC-SHA256 session cookie,
  **rovnaký algoritmus/formát** ako v JS (zámerne — `hash_pbkdf2()` a
  `hash_hmac()` v PHP počítajú bitovo identický výsledok).
- **`lib/ical.php`** — 1:1 port parseru/generátora `.ics`.
- **`lib/http.php`** — odchádzajúce HTTP volania (cURL, fallback na
  `file_get_contents`) pre Booking.com import a Resend e-mail.
- **`lib/mailer.php`** — `notifyReservation` (Resend REST API + voliteľný
  webhook).
- **`lib/calendar_sync.php`** — `pod_sync_imports()`, zdieľané medzi ručným
  tlačidlom v admine a `cron/sync.php`.
- **`cron/sync.php`** — nahrádza "lazy sync pri návšteve" trik (žiadny
  natívny cron na Cloudflare Pages) — na Websupporte je skutočný Cron
  dostupný, treba ho len nastaviť vo WebAdmine (fáza 6).
- **`.htaccess`** — rewrite `/api/*` a `/ics/*`, zablokovaný priamy prístup
  k `lib/`, `db/`, `cron/`.

### Zmeny oproti Cloudflare verzii (zámerné, nie chyby)

- **Žiadny lazy-sync trigger v `/api/availability`** — nahradený reálnym
  cronom (fáza 6) + nezmeneným ručným tlačidlom v admine.
- **`/api/inquiry` odpovedá cez `fastcgi_finish_request()`** (ak ho PHP-FPM
  podporuje) a e-mail/webhook posiela až potom — napodobňuje pôvodný
  Cloudflare `waitUntil` (nečakať na e-mail pred odpoveďou klientovi). Bez
  PHP-FPM klient krátko počká, kým Resend/webhook dobehne.
- **`sanitizeHtml()` img/a allowlist** zmenená z `/(img|assets)/` na
  `/(uploads|assets)/` — zodpovedá novej `/uploads/` ceste namiesto R2 `/img/`.
- Mŕtva vetva `info.clash` v pôvodnom `notifyReservation` (nikdy sa
  nenapĺňala) v porte vynechaná.

- **Upload fotiek**: prípona súboru sa odvodzuje zo zisteného MIME typu
  (allowlist jpg/png/gif/webp/avif/heic), nie z mena súboru od klienta —
  inak by sa GIF/PHP polyglot `x.php` uložil ako spustiteľné PHP.

## Lokálny test (`dev/`)

Docker stack, ktorý napodobňuje doc root na Websupporte (Apache + PHP 8.2 +
`mod_rewrite` + `.htaccess`, MariaDB 10.6 so `schema.sql`+`seed.sql`):

```
cd websupport/dev
docker compose up -d --build     # web na http://localhost:8088
node e2e.mjs                     # 68 end-to-end kontrol (API + SEO)
docker compose down -v           # zmaže aj DB
```

`e2e.mjs` prejde setup/login/heslo, tému+SEO+kontakt (s diakritikou),
články (slug, sanitizácia, draft), galériu (upload, reorder, delete),
rezervácie (409 prekryv, split cez `free-day`), `.ics` export a import
(sync izby 3 z vlastného `/ics/2.ics`) a odhlásenie — **všetko prechádza**.
Overené aj: `php -l` na všetkých súboroch, `cron/sync.php` z CLI, blokovanie
`lib/`/`cron/` (403), a vykreslenie `index.html` v headless Chrome proti PHP
API. Test na čistej DB — po behu `docker compose down -v`.

Opravené vďaka testu: `.htaccess` obsahoval `<Directory>`, ktorý v
`.htaccess` nie je povolený → Apache vracal 500 na **celom** webe.

Stále neoverené: Resend e-mail (bez API kľúča), reálny Booking.com feed
(test použil vlastný export), `fastcgi_finish_request` (Docker image
beží mod_php, nie FPM).

## Čo je hotové (fáza 5) — SEO meta server-side

- **`index.php`** (ide do doc rootu vedľa `index.html`) — náhrada za
  `../functions/_middleware.js`. Načíta statický `index.html` a podľa
  `settings.seo` prepíše `<title>`, `meta description`, `og:title`,
  `og:description`, `og:image` (relatívnu cestu doplní na absolútnu URL
  vrátane `https` za proxy cez `X-Forwarded-Proto`) a pri `noindex` pridá
  `<meta name="robots" content="noindex, nofollow">`. Prázdne pole = statický
  default. Hodnoty sú HTML-escapované (`"<>&`) — originálny Node dev shim
  (`../scripts/dev-node.mjs`) neescapuje `"`, na Cloudflare to rieši
  HTMLRewriter.
- **`.htaccess`** — `DirectoryIndex index.php index.html` +
  `/index.html` → `index.php`, takže crawler dostane upravené meta na oboch
  adresách. `index.html` ostáva nezmenený zdroj (žiadna duplicita s
  `public/`).
- Keď DB nejde, pošle sa `index.html` bez zmeny (overené — byte-identický,
  chyba ide do error logu), nikdy 500.
- `Cache-Control: no-cache`, aby zmena SEO v admine platila hneď.
- `dev/e2e.mjs` rozšírený na **68 kontrol** (escapovanie vrát. `$1`,
  absolútny og:image, noindex práve raz v `<head>`, čiastočné SEO, prázdne
  SEO = byte-identický `index.html`) — všetko prechádza.

## Fáza 6 — pripravené nástroje na nasadenie

- **`install.php`** — jednorazový inštalátor DB namiesto phpMyAdmin:
  `https://<doména>/install.php?token=<setup_token>`. Spustí `db/schema.sql`
  (idempotentné), `db/seed.sql` len na prázdnu galériu, vypíše počty riadkov,
  verziu PHP/DB, chýbajúce rozšírenia a či je `uploads/` zapisovateľné. Keď
  už existuje admin, odmietne bežať (409). **Po inštalácii zmazať.**
  Otestované v Dockeri na prázdnej DB → následne celý `e2e.mjs` PASS.
- **`dev/deploy.mjs`** (FTP/FTPS, `npm install` v `dev/`):
  ```
  FTP_HOST=… FTP_USER=… FTP_PASS=… FTP_DIR=/sub/test CONFIG=config.test.php \
    node deploy.mjs --with-install
  ```
  Poskladá doc root (`public/` + `api lib cron db uploads .htaccess
  index.php ics.php`), `lib/config.php` z lokálneho `CONFIG` súboru
  (`dev/config.*.php` sú v `.gitignore`), statické súbory s rovnakou
  veľkosťou preskočí, po každom uploade overí veľkosť na serveri.
  V Git Bash spúšťať s `MSYS_NO_PATHCONV=1`, inak sa `/sub/test` prepíše na
  Windows cestu. Otestované proti lokálnemu vsftpd.
- test.podhajska.net už existuje (DNS → 37.9.175.197, platný HTTPS cez
  openresty proxy).

### Stav nasadenia na test.podhajska.net (2026-09-22) — BEŽÍ

- Server: **PHP 8.5.9 (php-fpm)**, **MySQL 8.4.10** na `db.r6.websupport.sk:3317`.
  Doc root `/data/<hosting-id>/podhajska.net/sub/test`
  = koreň SFTP účtu `wukas.podhajska.net` (overené probe súborom — živý
  podhajska.net tento účet nevidí).
- Nasadzuje sa **SFTP** (`deploy.mjs`, default). FTPS na Websupporte padal na
  `tlsv1 alert decode error` a nechával 0 B súbory.
- DB nainštalovaná, `install.php` zmazaný, admin `admin` vytvorený.
- `E2E_BASE=https://test.podhajska.net … node e2e.mjs` → **74/74 PASS** proti
  živému serveru (vrátane uploadu, SEO, `.ics` sync cez HTTPS); test po sebe
  uprace (téma, rezervácie, import URL). Headless Chrome: 41 fotiek + kalendár.
- Lokálny test pre verziu na serveri: `docker compose -f compose.php85.yml`
  (PHP 8.5 + MySQL 8.4, `E_ALL`) — 74/74 PASS, 0 warningov.

Opravy nájdené pri nasadení:
- `curl_close()` je v PHP 8.5 deprecated → výpis pred hlavičkami rozbil JSON
  `/admin/calendar/sync`. Odstránené (od PHP 8.0 nič nerobí).
- Websupport má `display_errors=on` → `lib/db.php` ho vypína (chyby len do logu).
- Prázdne `{}` nastavenia sa vracali/ukladali ako `[]` (PHP assoc polia) —
  admin.js by do `[]` zapisoval kľúče a `JSON.stringify` ich zahodil →
  `/api/site` aj `PUT /admin/theme` teraz pracujú s objektmi.
- `lib/db.php` podporuje `port` v configu.

**Cron (spraviť vo WebAdmine):** každých 30 min
`php /data/<hosting-id>/podhajska.net/sub/test/cron/sync.php`

## Ďalšie kroky (nespustené, čakajú na fázu 6+)

- **Fáza 6** — nastaviť skutočný Websupport Cron job vo WebAdmine, ktorý
  spúšťa `cron/sync.php` (kód už hotový z fázy 4, viď vyššie) každých
  30–60 min namiesto pôvodného "lazy sync" triku. Overiť PHP verziu/
  rozšírenia (`pdo_mysql`, `curl` alebo aspoň `allow_url_fopen`, `intl`
  voliteľne) a naimportovať `db/schema.sql` + `db/seed.sql` cez
  phpMyAdmin/Adminer. Nasadiť `public/` + `websupport/{api,ics.php,index.php,lib,
  uploads,cron,.htaccess}` (bez `websupport/` predpony, viď poznámka v
  `.htaccess`) na testovaciu subdoménu/priečinok a otestovať všetky
  endpointy naživo.
- **Fáza 7** — reálny prevod produkčných dát z D1 (export cez
  `wrangler d1 execute --remote`, transformácia INSERT-ov na MySQL syntax
  podľa premenovaných stĺpcov vyššie) a test na `test.podhajska.net`/
  testovacom priečinku pred DNS cutoverom (len A/AAAA/CNAME, MX zostáva).

## Fáza 7 — migrácia živých dát (2026-09-22, len na test.podhajska.net)

`dev/migrate.mjs` (opakovateľné; na Cloudflare len číta):
```
node migrate.mjs export                              # D1 --remote -> dev/migration-data/*.json
node migrate.mjs images                              # 11 R2 fotiek cez https://podhajska.pages.dev/img/<key>
CONFIG=config.test.php node migrate.mjs import       # prepíše CELÚ cieľovú DB, overí počty
FTP_HOST=podhajska.net FTP_USER=… FTP_PASS=… node migrate.mjs upload   # fotky -> /uploads/gallery (SFTP)
node compare.mjs https://test.podhajska.net          # verejné API cieľa vs. Cloudflare
```
Prenesené: 1 admin (s hashom — **heslo rovnaké ako na Cloudflare**, PBKDF2 overený
JS→PHP aj s diakritikou), 6 nastavení, 4 články, 52 fotiek (11 z R2), 3 izby
s Booking import URL, 13 rezervácií. `/img/gallery/` → `/uploads/gallery/`
(len gallery url + 2 obálky článkov). `compare.mjs`: `/api/site`,
`/api/availability`, všetky 4 články a `/ics/1-3` **zhodné** s Cloudflare;
54 obrázkov 200; SEO head rovnaký (PHP naviac escapuje `&` → `&amp;`).

`config.test.php` má `'noindex' => true` → test subdoména sa neindexuje
(index.php to vynúti bez ohľadu na SEO v admine).

**Nález na živom Cloudflare:** Booking import tam naposledy prebehol
2026-09-14 (`rooms.last_import_at`), hoci `calendar_last_sync` sa posúva —
lazy `maybeSync` zapíše čas pred importom a samotný import cez `waitUntil`
zjavne nedobehne (chyby sa ticho zahodia). Podhájska.net preto ukazuje
8 dní starú obsadenosť. PHP verzia s cronom stiahla aktuálne dáta
(overené priamo proti Booking feedom). Dočasne: v CF admine „Synchronizovať teraz".

**Pred ostrým prepnutím** (až po teste usera): znova `export` → `images` →
`import` (s configom pre produkciu) → `upload`, aby sa preniesli rezervácie
vzniknuté medzitým. Dovtedy dopyty cez test.podhajska.net idú len do test DB.

### Oprava po teste usera: `/admin` → 404
Cloudflare Pages servíruje „pekné" URL (`/admin` → `admin.html`), Apache nie —
odkaz „Prihlásenie správcu" v pätičke viedol na 404. `.htaccess` teraz kopíruje
Pages: `/x` → `x.html`, `/x.html` a `/x/` → 301 `/x`, `/index.html` → 301 `/`,
neznáma cesta bez prípony → hlavná stránka (SPA fallback), chýbajúce súbory
s príponou ostávajú 404. `e2e.mjs` to kontroluje (82 kontrol, PASS).

### Cron cez URL (Websupport „Návšteva URL adresy (wget)")
`GET /api/cron/sync?token=<cron_token>` — to isté ako `cron/sync.php`/tlačidlo
v admine. Bez správneho tokenu 403, bez `cron_token` v configu vypnuté (404).
Odporúčaný interval 30 min. Test subdoména má token v `dev/config.test.php`;
pre produkciu treba pri prepnutí nový token a nový cron na podhajska.net.

### E-mail o rezervácii (2026-09-22)
`lib/mailer.php`: e-mail na `inquiry_to` (studiapodhajska@gmail.com), Reply-To
= hosť. Spôsob podľa configu: SMTP (`smtp_*`, vlastný klient bez knižníc,
465/ssl alebo 587/STARTTLS) → Resend → PHP `mail()` (default, na Websupporte
`/usr/apachebin/sendmail`, overené probe-om). Lokálne: `compose.php85.yml`
má Mailpit (UI http://localhost:8025, mail() cez msmtp); `e2e.mjs` kontroluje
adresáta, Reply-To, predmet s diakritikou a escapovanú poznámku (91 PASS).
SMTP cesta overená proti Mailpitu. Ak by maily padali do spamu: vytvoriť
schránku napr. rezervacie@podhajska.net a vyplniť `smtp_*` v configu.

### 2026-09-23: e-mail na info@, mobil, cache
- E-mail o rezervácii: `inquiry_from` aj `inquiry_to` = **info@podhajska.net**.
  S neexistujúcim odosielateľom `rezervacie@` Gmail správu z `mail()` ticho
  zahodil (rezervácia #379 v DB bola, e-mail neprišiel).
- Mobil: kalendár aj pätička pretekali doprava (`repeat(7, 1fr)` / `1fr 1fr`
  nepustí stĺpec pod šírku obsahu). Teraz `minmax(0,1fr)`, menšie čipy izieb
  a pätička v 1 stĺpci pod 560 px. Overené Playwrightom na 320/360/390/414 px
  (žiadne pretečenie), desktop/tablet bez zmeny.
- **Websupport proxy (openresty) cachuje statické súbory** — po nasadení
  ostal starý `base.css`. `.htaccess` posiela Cache-Control (kód no-cache,
  obrázky 7 dní; overené `dev/cache-test.mjs`: zmena viditeľná hneď) a
  `index.php` pridáva k CSS/JS `?v=<mtime>`. `e2e.mjs` 93 PASS.
- Jediný kontaktný e-mail webu = **info@podhajska.net** (aj odosielateľ
  rezervačných e-mailov, meno „Bungalovy Classic"). `studiapodhajska@gmail.com`
  nahradený v `public/index.html` (topbar, Kontakt, pätička, JSON-LD),
  `llms.txt`, placeholder v admin.js, `seed.sql`; v DB v článku
  „Wellness Classic Podhájska" a `migrate.mjs` ho nahrádza v obsahu pri každom
  prenose (e-maily hostí v rezerváciách nemení).

## PREPNUTÉ NA www.podhajska.net — 2026-09-23 11:47 UTC

- Hosting: `/podhajska.net/web` = nová stránka (PHP 8.2 na hlavnej doméne!),
  starý WordPress **premenovaný** na `/podhajska.net/web-wordpress-2026-09-23`
  (nezmazaný; DB WordPressu nedotknutá). Návrat = premenovať späť (SFTP rename).
- Deploy produkcie: `FTP_DIR=/podhajska.net/web CONFIG=config.prod.php node deploy.mjs`
  (SFTP účet `wukas.podhajska.net` má teraz koreň celého hostingu; test =
  `FTP_DIR=/podhajska.net/sub/test`). Logy: `/podhajska.net/logs/error_log`.
- Produkcia a test.podhajska.net **zdieľali DB** → test subdoménu zrušiť.
- Pred swapom: čerstvý `migrate.mjs export/images/import/upload`; po swape
  Booking sync, `sync-check.mjs` OK, 54 obrázkov 200, mobil bez pretečenia,
  žiadne nové rezervácie na Cloudflare počas prepnutia.
- `.htaccess`: podhajska.net → 301 www (MUSÍ byť prvé pravidlo, inak /ics →
  ics.php), staré WP URL → 301 na sekcie, wp-admin/wp-login → /admin,
  `robots.txt` + `sitemap.xml`.
- Wordfence `.user.ini` (auto_prepend na web/wordfence-waf.php) — pri swape
  dočasný stub, zmazaný; 7 min monitoring bez chýb.
- **Na userovi:** Cron URL → `https://www.podhajska.net/api/cron/sync?token=<cron_token z config.prod.php>`;
  Booking Extranet import → `https://www.podhajska.net/ics/{1,2,3}.ics`.
- 2026-09-23: **test.podhajska.net vypnutá** — súbory zmazané (vr. config.php), ostal len `.htaccess` s 301 na www.podhajska.net. Subdoménu a test cron môže user zmazať vo WebAdmine.
- 2026-09-23: **podhajska.pages.dev presmerované** (Cloudflare Pages deploy len s
  `_redirects`: `/* https://www.podhajska.net/:splat 301`, bez Functions) na
  branch `master` aj `web-admin-gallery-articles`. Na novom webe
  `/img/gallery/*` → 301 `/uploads/gallery/*` (staré R2 odkazy fotiek).
  Staré jednotlivé deploymenty (`<hash>.podhajska.pages.dev`) stále bežia so
  starou appkou + D1 — nikde nie sú zverejnené; zmazať spolu s D1/R2 neskôr.
