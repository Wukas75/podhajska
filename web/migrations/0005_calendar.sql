-- Kalendár obsadenosti izieb + synchronizácia s Booking.com cez .ics
-- Spusti na produkčnú D1:
--   npx wrangler d1 execute podhajska --remote --file migrations/0005_calendar.sql
-- (celé je idempotentné – IF NOT EXISTS / INSERT OR IGNORE)

-- Izby na prenájom (pevne 3).
--   ics_import_url : "export kalendára" URL z Booking.com Extranetu pre danú izbu
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

-- Obsadenosť. end_date = deň odchodu = EXKLUZÍVNY (rovnako ako iCal DTEND).
--   source : 'manual'  – blokácia zadaná adminom
--            'booking' – naimportované z Booking.com (.ics), dedupe podľa uid
--            'inquiry' – dopyt z webu (blokuje až po potvrdení = status 'confirmed')
--   status : 'confirmed' | 'pending' | 'cancelled'
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
