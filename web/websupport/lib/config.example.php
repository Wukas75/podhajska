<?php
// Skopíruj na config.php (mimo gitu, viď websupport/.gitignore) a vyplň
// skutočné údaje z Websupport WebAdmin -> Databázy / Hosting.
return [
    'db' => [
        'host'    => '127.0.0.1',
        'port'    => 3306,        // Websupport ukazuje napr. db.r6.websupport.sk : 3317
        'name'    => 'db_nazov',
        'user'    => 'db_pouzivatel',
        'pass'    => 'db_heslo',
        'charset' => 'utf8mb4',
    ],

    // Dlhý náhodný reťazec pre podpisovanie session cookie (ako SESSION_SECRET
    // na Cloudflare) -- vygeneruj napr. cez `openssl rand -hex 32`.
    'session_secret' => 'zmen-ma-na-dlhy-nahodny-retazec',

    // Jednorazový token na vytvorenie prvého admina (ako SETUP_TOKEN).
    'setup_token' => 'zmen-ma',

    // Kam sa ukladajú adminom nahraté fotky (náhrada za R2).
    'uploads_dir' => __DIR__ . '/../uploads',
    'uploads_url' => '/uploads',

    // E-mail notifikácie o rezervácii (Resend REST API) -- nechaj prázdne,
    // kým nie je overená doména na resend.com.
    'resend_api_key' => '',
    'inquiry_from'   => 'Bungalovy Classic <info@podhajska.net>',   // musí byť existujúca schránka na podhajska.net
    'inquiry_to'     => 'info@podhajska.net',
    'inquiry_webhook_url' => '',

    // E-mail o rezervácii ide na 'inquiry_to'. Spôsob odoslania (viď lib/mailer.php):
    // SMTP ak je vyplnený smtp_host, inak Resend ak je kľúč, inak PHP mail().
    // Websupport schránka: smtp.m1.websupport.sk, 465, ssl, celá adresa ako user.
    'mail_enabled' => true,
    'smtp_host'   => '',
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl',   // 'ssl' (465) | 'tls' (587, STARTTLS) | 'none' (len lokálny test)
    'smtp_user'   => '',
    'smtp_pass'   => '',

    // Token pre Websupport Cron „Návšteva URL adresy (wget)":
    //   https://<doména>/api/cron/sync?token=<cron_token>   (prázdne = vypnuté)
    'cron_token' => '',

    // true = stránka sa nikdy neindexuje (testovacia subdoména), bez ohľadu na SEO v admine
    'noindex' => false,
];
