# Štúdiá Podhájska — landing page + admin

Statická landing page (prevzatý obsah z podhajska.net) s admin režimom:
CSS editor (⚙), správa článkov a fotogalérie. Beží celé na **Cloudflare free tier**.

| Vrstva | Služba | Súbor |
|---|---|---|
| Hosting statiky | Cloudflare **Pages** | `public/` |
| API | Pages **Functions** + Hono | `functions/api/[[route]].js` |
| Fotky nahraté adminom | **R2** | `functions/img/[[key]].js` |
| Dáta (články, galéria, téma, admin) | **D1** | `migrations/*.sql` |

Prihlásenie: jeden admin účet, heslo PBKDF2 v D1, session = podpísaná cookie.

---

## Lokálny vývoj

```bash
cd web
npm install
npm run assets     # stiahne obrázky z podhajska.net do public/assets/img (potrebné raz)
npm run dev        # http://localhost:8788
```

`npm run dev` spúšťa **`scripts/dev-node.mjs`** – ľahký Node server, ktorý beží
reálny Hono router z `functions/api` s D1 shimom (`node:sqlite`) a R2 shimom (priečinok).
Lokálnu DB + seed vytvorí sám pri prvom štarte; `npm run dev:reset` ju zmaže a naplní nanovo.

> **Prečo nie `wrangler pages dev`?** Na tomto Windows stroji `wrangler`/`workerd`
> padá na `write EOF` (libuv assertion) – v `d1 execute` aj v `pages dev`, s Node 22 aj 24.
> Skript `npm run dev:cf` ho necháva k dispozícii, keď sa to inde rozbehá; deploy
> cez `wrangler pages deploy` funguje bez problémov (workerd beží v cloude).

Prvé prihlásenie: `http://localhost:8788/admin` → *„Prvé spustenie? Vytvoriť správcu"*
→ meno, heslo (min. 8 znakov), `SETUP_TOKEN` (lokálne default `devnode-setup`, vypíše sa pri štarte).
Po prihlásení sa na hlavnej stránke vpravo dole objavia tlačidlá **⚙ / Články / Foto / odhlásiť**.

---

## Nasadenie na Cloudflare

```bash
npx wrangler login

# 1) D1 databáza – ID vlož do wrangler.toml -> [[d1_databases]].database_id
npx wrangler d1 create podhajska

# 2) R2 bucket na fotky
npx wrangler r2 bucket create podhajska-media

# 3) schéma + seed do produkčnej D1
npx wrangler d1 execute podhajska --remote --file migrations/0001_init.sql
npx wrangler d1 execute podhajska --remote --file migrations/0002_seed.sql
#   Ak aj `--remote` padne na "write EOF": otvor Cloudflare dashboard →
#   Workers & Pages → D1 → podhajska → Console a vlož obsah oboch .sql súborov ručne.

# 4) Pages projekt
npx wrangler pages project create podhajska

# 5) tajomstvá (Pages)
npx wrangler pages secret put SESSION_SECRET --project-name podhajska
npx wrangler pages secret put SETUP_TOKEN   --project-name podhajska

# 6) deploy
npm run deploy
```

Potom `https://<projekt>.pages.dev/admin` → *Vytvoriť správcu* (jednorazovo, kým je tabuľka `admin_users` prázdna).

Alternatíva k `/api/setup` — vložiť admina ručne:

```bash
node scripts/hash-password.mjs "silne-heslo" spravca
# skopíruj vypísané SQL:
npx wrangler d1 execute podhajska --remote --command "INSERT INTO admin_users ..."
```

---

## Ako to funguje

- **CSS editor (⚙)** mení CSS premenné `--pod-*` naživo. *Uložiť* zapíše `theme_vars` +
  vygenerovaný `theme_css` do tabuľky `settings`; `site.js` ho pri načítaní vloží do
  `<style id="pod-theme-overrides">`, takže zmenu vidia všetci návštevníci.
  *Exportovať CSS* stiahne `:root{…}`; *Reset* vráti predvolené hodnoty.
- **Editor textov** (prepínač v paneli) spraví prvky s `data-edit="…"` editovateľné;
  po uložení sa uchovajú v `settings.texts` a aplikujú na verejnej stránke.
- **Články** — WYSIWYG (`wysiwyg.js`), server HTML sanitizuje (allowlist tagov).
  Na webe sa otvárajú ako overlay, deep-link `#clanok/<slug>`.
  Každý článok patrí do sekcie **Blog** alebo **Okolie a aktivity** (stĺpec `articles.section`);
  v admin okne „Články" sú na to prepínače, na webe sa vykreslia do príslušnej sekcie
  (`#article-grid` resp. `#okolie-grid`). Existujúca produkčná D1 sa doplní
  `migrations/0004_articles_section.sql`.
- **Galéria** — upload do R2 (`/img/<key>`), radenie ťahaním alebo ▲▼, alt text, kategória, mazanie.
  Každá fotka patrí do kategórie **Štúdio / Wellness / Exteriér / Články** (stĺpec `gallery_images.category`);
  na verejnej stránke sa nad mriežkou zobrazí filter Všetky / Štúdio 1,2,3 / Wellness / Exteriér.
  Kategória **Články** je úložisko fotiek, ktoré sa vkladajú do článkov (výber „Vybrať z galérie"
  v editore článku aj v hero editore) – vo verejnej galérii sa **nezobrazujú** (`/api/site` ich vynecháva).
  Statické seed fotky (prevzaté z `podhajska.net/galeria/`) sú v `public/assets/img/gallery/`,
  stiahne ich `npm run assets`. Existujúca produkčná D1 sa doplní `migrations/0003_gallery_category.sql`.

## Štruktúra

```
public/            statická stránka (index.html, admin.html, assets/)
functions/api/     Hono router – všetky /api/*
functions/img/     stream fotiek z R2
migrations/        D1 schéma (0001) + seed (0002)
scripts/           fetch-assets.sh, hash-password.mjs
wrangler.toml      bindings DB, R2, vars
```
