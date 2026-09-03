-- Štúdiá Podhájska – kategórie fotogalérie (Štúdio / Wellness / Exteriér).
-- Spusti len na už existujúcej DB, ktorá bola založená pred pridaním stĺpca
-- `category` do 0001_init.sql. Nové inštalácie ho majú rovno zo schémy.
--   npx wrangler d1 execute podhajska --remote --file migrations/0003_gallery_category.sql
-- (Ak spadne s "duplicate column name: category", stĺpec už existuje – preskoč.)

ALTER TABLE gallery_images ADD COLUMN category TEXT NOT NULL DEFAULT 'exterier';
