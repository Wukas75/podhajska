-- Štúdiá Podhájska – MySQL schéma pre Websupport hosting.
-- Konverzia z D1/SQLite (../../migrations/0001..0005). Spusti raz cez
-- phpMyAdmin/Adminer (WebAdmin -> Databázy -> Spravovať -> Import), alebo:
--   mysql -h <host> -u <user> -p <db_name> < schema.sql
--
-- Rozdiely oproti D1/SQLite verzii (dôležité pre fázu 4 - PHP API):
--
-- 1) ENUM namiesto CHECK(...) -- CHECK sa v starších MySQL/MariaDB verziách
--    len parsuje, ale nevynucuje; ENUM funguje rovnako spoľahlivo všade.
--
-- 2) TEXT/LONGTEXT stĺpce NEMAJÚ DEFAULT '' -- MySQL/MariaDB (bez najnovšieho
--    8.0.13+ "expression defaults") DEFAULT na BLOB/TEXT odmieta. Appka preto
--    MUSÍ pri INSERTe vždy poslať '' explicitne tam, kde D1 mal DEFAULT ''
--    (presne to už PHP vrstva z fázy 4 robí -- rovnaké miesta ako doteraz
--    v functions/api/[[route]].js, napr. `b.excerpt || ''`).
--
-- 3) `settings`.`key` -- `key` je v MySQL rezervované slovo, v SQL vždy
--    v spätných apostrofoch.
--
-- 4) `gallery_images.r2_key` -> premenované na `file_key`. V D1/R2 to bol
--    kľúč objektu v R2 bucket-e; na Websupporte to bude len názov súboru
--    pod `websupport/uploads/gallery/<file_key>` (NULL pre statické seed
--    fotky, ktoré ostávajú v `public/assets/img/gallery/`).
--
-- 5) `bookings.room_id` má skutočný FOREIGN KEY (D1 mal len REFERENCES bez
--    vynúteného PRAGMA v produkcii) -- vyžaduje `rooms` vytvorené pred
--    `bookings` (poradie tabuliek nižšie to dodržiava).
--
-- 6) UNIQUE na `bookings.uid` necháme ako plný (non-partial) unique index --
--    presne ako v D1 (potrebné pre upsert `ON DUPLICATE KEY UPDATE` pri
--    Booking.com synchronizácii). V appke `uid` NIKDY nie je NULL (vždy
--    'bk-...', 'man-...', 'inq-...' alebo 'split-...' prefix), takže MySQL
--    aj SQLite sa tu správajú zhodne.
--
-- 7) Žiadne `RETURNING id` (MySQL/staršie MariaDB to nepodporuje) -- fáza 4
--    použije `PDO::lastInsertId()` namiesto toho.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Jediný administrátorský účet.
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,   -- base64(PBKDF2-SHA256, 100k it.)
  password_salt VARCHAR(255) NOT NULL,   -- base64(16 B)
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Kľúč-hodnota nastavenia webu (theme_vars, theme_css, texts, seo, contact,
-- calendar_last_sync).
CREATE TABLE IF NOT EXISTS settings (
  `key`      VARCHAR(191) NOT NULL,
  value      LONGTEXT NOT NULL,          -- viď pozn. 2) hore: appka posiela vždy string
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Články. section: 'blog' | 'okolie'. status: 'draft' | 'published'.
CREATE TABLE IF NOT EXISTS articles (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug         VARCHAR(191) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  excerpt      TEXT NOT NULL,                          -- appka posiela '' ak prázdne
  body_html    LONGTEXT NOT NULL,                       -- appka posiela '' ak prázdne
  cover_url    VARCHAR(500) NOT NULL DEFAULT '',
  section      ENUM('blog','okolie') NOT NULL DEFAULT 'blog',
  status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  sort         INT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_articles_slug (slug),
  KEY idx_articles_status (section, status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Fotogaléria (plochý zoznam). url = verejná cesta ("/assets/img/gallery/..."
-- pre statické, alebo "/uploads/gallery/<file_key>" pre adminom nahraté).
CREATE TABLE IF NOT EXISTS gallery_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  url        VARCHAR(500) NOT NULL,
  file_key   VARCHAR(255) NULL,          -- pôvodne r2_key, viď pozn. 4) hore
  alt        VARCHAR(255) NOT NULL DEFAULT '',
  category   ENUM('studio','wellness','exterier','clanky') NOT NULL DEFAULT 'exterier',
  sort       INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gallery_sort (sort, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Izby na prenájom (pevne 3, id sa nastavuje ručne, nie AUTO_INCREMENT).
CREATE TABLE IF NOT EXISTS rooms (
  id              TINYINT UNSIGNED NOT NULL,
  name            VARCHAR(100) NOT NULL,
  ics_import_url  VARCHAR(500) NOT NULL DEFAULT '',
  last_import_at  DATETIME NULL,
  last_import_msg VARCHAR(500) NOT NULL DEFAULT '',
  sort            INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO rooms (id, name, sort) VALUES
  (1, 'Štúdio 1', 1),
  (2, 'Štúdio 2', 2),
  (3, 'Štúdio 3', 3);

-- ---------------------------------------------------------------------------
-- Obsadenosť. end_date = deň odchodu = EXKLUZÍVNY (ako iCal DTEND).
--   source : 'manual' (ručná blokácia) | 'booking' (import z Booking.com,
--            dedupe podľa uid) | 'inquiry' (dopyt/rezervácia z webu)
--   status : 'confirmed' | 'pending' | 'cancelled'
CREATE TABLE IF NOT EXISTS bookings (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id     TINYINT UNSIGNED NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  source      ENUM('manual','booking','inquiry') NOT NULL DEFAULT 'manual',
  status      ENUM('confirmed','pending','cancelled') NOT NULL DEFAULT 'confirmed',
  uid         VARCHAR(191) NULL,          -- appka ho vždy vypĺňa, viď pozn. 6) hore (dĺžka
                                           -- kvôli max. veľkosti UNIQUE indexu na starších InnoDB)
  summary     VARCHAR(255) NOT NULL DEFAULT '',
  guest_name  VARCHAR(191) NOT NULL DEFAULT '',
  guest_email VARCHAR(191) NOT NULL DEFAULT '',
  guest_phone VARCHAR(64) NOT NULL DEFAULT '',
  note        TEXT NOT NULL,               -- appka posiela '' ak prázdne
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_uid (uid),
  KEY idx_bookings_room_dates (room_id, start_date, end_date),
  CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
