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

-- Články (blog). Na webe sa otvárajú ako overlay (#clanok/<slug>).
CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  body_html    TEXT NOT NULL DEFAULT '',   -- sanitizované na serveri
  cover_url    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles (status, published_at DESC);

-- Fotogaléria (jeden plochý zoznam).
--   url    : "/assets/img/<súbor>" (statické, dodané) alebo "/img/<r2_key>" (nahraté adminom)
--   r2_key : kľúč v R2, NULL pre statické obrázky
CREATE TABLE IF NOT EXISTS gallery_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL,
  r2_key     TEXT,
  alt        TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_images (sort, id);
