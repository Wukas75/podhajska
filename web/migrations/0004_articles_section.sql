-- Štúdiá Podhájska – sekcia článku (Blog / Okolie a aktivity).
-- Spusti len na už existujúcej DB, ktorá vznikla pred pridaním stĺpca `section`
-- do 0001_init.sql. Nové inštalácie ho majú rovno zo schémy.
--   npx wrangler d1 execute podhajska --remote --file migrations/0004_articles_section.sql
-- (Ak spadne s "duplicate column name: section", stĺpec už existuje – preskoč.)

ALTER TABLE articles ADD COLUMN section TEXT NOT NULL DEFAULT 'blog';
