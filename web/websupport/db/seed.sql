-- Štúdiá Podhájska – počiatočné dáta (MySQL). Spusti po schema.sql.
-- Zhodné s ../../migrations/0002_seed.sql, len prevedené na MySQL syntax
-- (INSERT IGNORE namiesto ON CONFLICT DO NOTHING, r2_key -> file_key).

SET NAMES utf8mb4;

-- Predvolené hodnoty CSS editora. theme_css je prázdny => použijú sa defaulty
-- z assets/css/theme.default.css. Po prvom uložení v admine sa sem zapíše override.
INSERT IGNORE INTO settings (`key`, value) VALUES
  ('theme_vars', '{"accent":"#1f7a8c","accentDark":"#14566a","bg":"#ffffff","surface":"#f3f7f8","text":"#33403f","heading":"#1b2a2b","muted":"#6b7b7a","fontHeading":"Playfair Display","fontBody":"Poppins","fsBase":17,"fsH1":46,"fsH2":31,"sectionPadY":88,"heroMinH":84,"heroOverlayType":"linear-bottom","heroOverlayIntensity":56,"heroOverlayColor":"#0d2b33","radius":14,"buttonStyle":"rounded"}'),
  ('theme_css', ''),
  ('texts', '{}');

-- Ukážkové publikované články (admin ich potom prepíše / doplní).
INSERT IGNORE INTO articles (slug, title, excerpt, body_html, cover_url, section, status, published_at, sort) VALUES
(
  'wellness-classic-podhajska',
  'Objavte čaro Wellness Classic Podhájska',
  'Nové wellness centrum pri našich štúdiách – fínska sauna, jacuzzi a oddychová zóna v pokojnej súkromnej atmosfére.',
  '<p>Od apríla 2026 majú hostia našich štúdií k dispozícii aj <strong>Wellness Classic Podhájska</strong>. Je to priestor určený na skutočný oddych po dni strávenom na termálnom kúpalisku alebo pri objavovaní krás regiónu.</p><h2>Čo u nás nájdete</h2><ul><li>fínsku saunu</li><li>jacuzzi</li><li>oddychovú zónu</li><li>príjemnú súkromnú atmosféru bez ruchu rodinných rezortov</li></ul><p>Wellness je otvorené denne od 9:00 do 22:00. Cena vstupu je 50,-€ / deň a je ideálny pre páry alebo menšie skupiny hostí.</p><p>Rezervácie a viac informácií na <a href="mailto:info@podhajska.net">info@podhajska.net</a>.</p>',
  '/assets/img/wellness.jpg',
  'blog',
  'published',
  '2026-03-17 08:00:00',
  20
),
(
  'ubytovanie-v-studiach-podhajska',
  'Ubytovanie v štúdiách Podhájska – pokoj pre dospelých',
  'Moderné štúdiá v uzavretom areáli s bazénom a záhradou. Ideálne pre páry a hostí, ktorí hľadajú tichý oddych.',
  '<p>Naše štúdiá v obci Podhájska ponúkajú komfortné ubytovanie pre hostí, ktorí hľadajú pokojný oddych a príjemnú atmosféru. Maximálna kapacita jedného štúdia sú 3 osoby.</p><h2>Vybavenie</h2><ul><li>kompletne zariadená kuchynka</li><li>vlastná kúpeľňa</li><li>klimatizácia a TV so satelitným príjmom</li><li>súkromná terasa</li><li>plynový gril v samostatnom altánku</li><li>bezplatné Wi-Fi v celom objekte</li></ul><p>Bazén je hosťom k dispozícii denne od 9:00 do 19:00. V blízkosti sa nachádza kaviareň, letné kino aj potraviny, parkovanie je priamo pri objekte.</p><p>Ubytovanie je určené výhradne pre dospelých hostí (18+), aby sme zachovali pokojné prostredie na relax.</p>',
  '/assets/img/studio-interier.jpg',
  'blog',
  'published',
  '2024-10-13 09:00:00',
  10
),
(
  'termalne-kupalisko-podhajska',
  'Termálne kúpalisko Podhájska',
  'Liečivá termálna voda s teplotou 38 – 40 °C je len pár minút chôdze od našich štúdií.',
  '<p>Najväčšou atrakciou obce je <strong>termálne kúpalisko Podhájska</strong> s minerálnou vodou, ktorá sa svojím zložením prirovnáva k prameňu vo Vitteli. Areál ponúka viacero bazénov s teplotou od 26 do 40 °C, tobogany aj oddychové zóny.</p><h2>Dobré vedieť</h2><ul><li>od štúdií cca 10 minút pešo</li><li>otvorené celoročne</li><li>v hlavnej sezóne odporúčame prísť skoro ráno</li></ul><p>Aktuálne ceny a otváracie hodiny nájdete na stránke kúpaliska.</p>',
  '',
  'okolie',
  'published',
  '2026-04-01 08:00:00',
  10
);

-- Úvodná fotogaléria – prevzaté fotky z podhajska.net/galeria/, roztriedené
-- do kategórií Štúdio / Wellness / Exteriér. Súbory sú v public/assets/img/gallery/
-- (skopírované statickým FTP prenosom, nie cez upload -- file_key preto NULL).
INSERT INTO gallery_images (url, file_key, alt, category, sort) VALUES
  ('/assets/img/gallery/179542530.jpg', NULL, 'Štúdio Podhájska 1', 'studio', 10),
  ('/assets/img/gallery/179542710.jpg', NULL, 'Štúdio Podhájska 2', 'studio', 20),
  ('/assets/img/gallery/179542738.jpg', NULL, 'Štúdio Podhájska 3', 'studio', 30),
  ('/assets/img/gallery/179542770.jpg', NULL, 'Štúdio Podhájska 4', 'studio', 40),
  ('/assets/img/gallery/256963110.jpg', NULL, 'Štúdio Podhájska 5', 'studio', 50),
  ('/assets/img/gallery/256963113.jpg', NULL, 'Štúdio Podhájska 6', 'studio', 60),
  ('/assets/img/gallery/256963115.jpg', NULL, 'Štúdio Podhájska 7', 'studio', 70),
  ('/assets/img/gallery/256963123.jpg', NULL, 'Štúdio Podhájska 8', 'studio', 80),
  ('/assets/img/gallery/img_7044.jpg', NULL, 'Štúdio Podhájska 9', 'studio', 90),
  ('/assets/img/gallery/img_7045.jpg', NULL, 'Štúdio Podhájska 10', 'studio', 100),
  ('/assets/img/gallery/img_7055.jpg', NULL, 'Štúdio Podhájska 11', 'studio', 110),
  ('/assets/img/gallery/img_7064.jpg', NULL, 'Štúdio Podhájska 12', 'studio', 120),
  ('/assets/img/gallery/d1175f5e-6230-4dc8-ba03-292b251d022c.jpg', NULL, 'Wellness Classic Podhájska 1', 'wellness', 130),
  ('/assets/img/gallery/img_3432.jpg', NULL, 'Wellness Classic Podhájska 2', 'wellness', 140),
  ('/assets/img/gallery/img_3448.jpg', NULL, 'Wellness Classic Podhájska 3', 'wellness', 150),
  ('/assets/img/gallery/img_3449.jpg', NULL, 'Wellness Classic Podhájska 4', 'wellness', 160),
  ('/assets/img/gallery/img_3450.jpg', NULL, 'Wellness Classic Podhájska 5', 'wellness', 170),
  ('/assets/img/gallery/img_3451.jpg', NULL, 'Wellness Classic Podhájska 6', 'wellness', 180),
  ('/assets/img/gallery/img_3452.jpg', NULL, 'Wellness Classic Podhájska 7', 'wellness', 190),
  ('/assets/img/gallery/img_3453.jpg', NULL, 'Wellness Classic Podhájska 8', 'wellness', 200),
  ('/assets/img/gallery/img_3454.jpg', NULL, 'Wellness Classic Podhájska 9', 'wellness', 210),
  ('/assets/img/gallery/img_3455.jpg', NULL, 'Wellness Classic Podhájska 10', 'wellness', 220),
  ('/assets/img/gallery/img_3456.jpg', NULL, 'Wellness Classic Podhájska 11', 'wellness', 230),
  ('/assets/img/gallery/img_3457.jpg', NULL, 'Wellness Classic Podhájska 12', 'wellness', 240),
  ('/assets/img/gallery/img_3459.jpg', NULL, 'Wellness Classic Podhájska 13', 'wellness', 250),
  ('/assets/img/gallery/216546663.jpg', NULL, 'Areál Štúdií Podhájska 1', 'exterier', 260),
  ('/assets/img/gallery/7.jpg', NULL, 'Areál Štúdií Podhájska 2', 'exterier', 270),
  ('/assets/img/gallery/img_5042.jpg', NULL, 'Areál Štúdií Podhájska 3', 'exterier', 280),
  ('/assets/img/gallery/img_6943.jpg', NULL, 'Areál Štúdií Podhájska 4', 'exterier', 290),
  ('/assets/img/gallery/img_7035.jpg', NULL, 'Areál Štúdií Podhájska 5', 'exterier', 300),
  ('/assets/img/gallery/img_7036.jpg', NULL, 'Areál Štúdií Podhájska 6', 'exterier', 310),
  ('/assets/img/gallery/img_7037.jpg', NULL, 'Areál Štúdií Podhájska 7', 'exterier', 320),
  ('/assets/img/gallery/img_7040.jpg', NULL, 'Areál Štúdií Podhájska 8', 'exterier', 330),
  ('/assets/img/gallery/img_7041.jpg', NULL, 'Areál Štúdií Podhájska 9', 'exterier', 340),
  ('/assets/img/gallery/img_7043.jpg', NULL, 'Areál Štúdií Podhájska 10', 'exterier', 350),
  ('/assets/img/gallery/img_7049.jpg', NULL, 'Areál Štúdií Podhájska 11', 'exterier', 360),
  ('/assets/img/gallery/img_7050.jpg', NULL, 'Areál Štúdií Podhájska 12', 'exterier', 370),
  ('/assets/img/gallery/img_7051.jpg', NULL, 'Areál Štúdií Podhájska 13', 'exterier', 380),
  ('/assets/img/gallery/img_7053.jpg', NULL, 'Areál Štúdií Podhájska 14', 'exterier', 390),
  ('/assets/img/gallery/img_7057.jpg', NULL, 'Areál Štúdií Podhájska 15', 'exterier', 400),
  ('/assets/img/gallery/img_7059.jpg', NULL, 'Areál Štúdií Podhájska 16', 'exterier', 410);
