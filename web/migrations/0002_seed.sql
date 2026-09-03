-- Štúdiá Podhájska – počiatočné dáta
-- Spusti po 0001_init.sql.

-- Predvolené hodnoty CSS editora. theme_css je prázdny => použijú sa defaulty
-- z assets/css/theme.default.css. Po prvom uložení v admine sa sem zapíše override.
INSERT INTO settings (key, value) VALUES
  ('theme_vars', '{"accent":"#1f7a8c","accentDark":"#14566a","bg":"#ffffff","surface":"#f3f7f8","text":"#33403f","heading":"#1b2a2b","muted":"#6b7b7a","fontHeading":"Playfair Display","fontBody":"Poppins","fsBase":17,"fsH1":46,"fsH2":31,"sectionPadY":88,"heroMinH":84,"heroOverlayType":"linear-bottom","heroOverlayIntensity":56,"heroOverlayColor":"#0d2b33","radius":14,"buttonStyle":"rounded"}'),
  ('theme_css', ''),
  ('texts', '{}')
ON CONFLICT(key) DO NOTHING;

-- Ukážkové publikované články (admin ich potom prepíše / doplní).
INSERT INTO articles (slug, title, excerpt, body_html, cover_url, status, published_at, sort) VALUES
(
  'wellness-classic-podhajska',
  'Objavte čaro Wellness Classic Podhájska',
  'Nové wellness centrum pri našich štúdiách – fínska sauna, jacuzzi a oddychová zóna v pokojnej súkromnej atmosfére.',
  '<p>Od apríla 2026 majú hostia našich štúdií k dispozícii aj <strong>Wellness Classic Podhájska</strong>. Je to priestor určený na skutočný oddych po dni strávenom na termálnom kúpalisku alebo pri objavovaní krás regiónu.</p><h2>Čo u nás nájdete</h2><ul><li>fínsku saunu</li><li>jacuzzi</li><li>oddychovú zónu</li><li>príjemnú súkromnú atmosféru bez ruchu rodinných rezortov</li></ul><p>Wellness je otvorené denne od 9:00 do 22:00. Cena vstupu je 50,-€ / deň a je ideálny pre páry alebo menšie skupiny hostí.</p><p>Rezervácie a viac informácií na <a href="mailto:studiapodhajska@gmail.com">studiapodhajska@gmail.com</a>.</p>',
  '/assets/img/wellness.jpg',
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
  'published',
  '2024-10-13 09:00:00',
  10
)
ON CONFLICT(slug) DO NOTHING;

-- Úvodná fotogaléria zo stiahnutých statických obrázkov.
INSERT INTO gallery_images (url, r2_key, alt, sort) VALUES
  ('/assets/img/bazen-trysky.jpg',    NULL, 'Bazén s vírivými tryskami', 10),
  ('/assets/img/hero-bazen.jpg',      NULL, 'Uzavretý areál s bazénom', 20),
  ('/assets/img/studio-interier.jpg', NULL, 'Interiér štúdia', 30),
  ('/assets/img/studio-1.jpg',        NULL, 'Wellness – sauna a jacuzzi', 40),
  ('/assets/img/studio-2.jpg',        NULL, 'Exteriér ubytovania', 50),
  ('/assets/img/wellness.jpg',        NULL, 'Terasa a záhrada', 60);
