-- Štúdiá Podhájska – schéma D1
-- Spusti: npx wrangler d1 execute podhajska --local  --file migrations/0001_init.sql
--         npx wrangler d1 execute podhajska --remote --file migrations/0001_init.sql

PRAGMA foreign_keys = ON;

-- Jediný administrátorský účet (tabuľka je generická, prakticky jeden riadok).
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- base64(PBKDF2-SHA256, 100k it.)
  password_salt TEXT NOT NULL,          -- base64(16 B)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kľúč-hodnota nastavenia webu.
--   theme_vars : JSON hodnôt z CSS editora
--   theme_css  : vygenerovaný ":root{...}" override, ktorý sa vkladá návštevníkom
--   texts      : JSON { "<data-edit id>": "<html>" } z inline editovania textov
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Články. Na webe sa otvárajú ako overlay (#clanok/<slug>).
--   section : do ktorej sekcie článok patrí – 'blog' alebo 'okolie' (Okolie a aktivity)
CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  body_html    TEXT NOT NULL DEFAULT '',   -- sanitizované na serveri
  cover_url    TEXT NOT NULL DEFAULT '',
  section      TEXT NOT NULL DEFAULT 'blog' CHECK (section IN ('blog','okolie')),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (section, status, published_at DESC);

-- Fotogaléria (jeden plochý zoznam).
--   url    : "/assets/img/<súbor>" (statické, dodané) alebo "/img/<r2_key>" (nahraté adminom)
--   r2_key : kľúč v R2, NULL pre statické obrázky
CREATE TABLE IF NOT EXISTS gallery_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL,
  r2_key     TEXT,
  alt        TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'exterier'
             CHECK (category IN ('studio','wellness','exterier','clanky')),
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_images (sort, id);

-- Kalendár obsadenosti (viď migrations/0005_calendar.sql pre popis stĺpcov).
CREATE TABLE IF NOT EXISTS rooms (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  ics_import_url  TEXT NOT NULL DEFAULT '',
  last_import_at  TEXT,
  last_import_msg TEXT NOT NULL DEFAULT '',
  sort            INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO rooms (id, name, sort) VALUES
  (1, 'Štúdio 1', 1),
  (2, 'Štúdio 2', 2),
  (3, 'Štúdio 3', 3);

CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     INTEGER NOT NULL REFERENCES rooms(id),
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual'    CHECK (source IN ('manual','booking','inquiry')),
  status      TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','cancelled')),
  uid         TEXT,
  summary     TEXT NOT NULL DEFAULT '',
  guest_name  TEXT NOT NULL DEFAULT '',
  guest_email TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings (room_id, start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_uid ON bookings (uid);
