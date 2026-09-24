#!/usr/bin/env bash
# Stiahne obrázky z podhajska.net do public/assets/img/.
# podhajska.net blokuje "holé" requesty – treba UA + Referer hlavičku.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/assets/img"
mkdir -p "$DIR"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
REF="https://www.google.com/"

get() { # get <url> <cieľový-názov> (názov môže obsahovať podpriečinok, napr. gallery/x.jpg)
  echo "  -> $2"
  mkdir -p "$DIR/$(dirname "$2")"
  curl -sSL --compressed -A "$UA" -H "Referer: $REF" "$1" -o "$DIR/$2"
}

B="https://www.podhajska.net/wp-content/uploads"
# reálne fotky areálu (rev_slider_carousel* a 082927FB* na zdroji sú len stock/logo, preto ich neťaháme)
get "$B/2026/03/Detail-bazena-s-virivymi-tryskami-pre-dokonaly-relax.jpg"                    "bazen-trysky.jpg"
get "$B/elementor/thumbs/Vonkajsi-bazen-s-virivymi-tryskami-v-sukromnom-areali-pre-hosti-rkn921nnylxgjjvq5u3llerjfzm6j5qd2jdpkv1ec0.jpg" "hero-bazen.jpg"
get "$B/2026/03/interior_final.jpg"                                                          "studio-interier.jpg"
get "$B/2026/03/IMG_3446.jpeg"                                                               "studio-1.jpg"
get "$B/2024/10/IMG_7064-scaled.jpeg"                                                        "studio-2.jpg"
get "$B/2026/03/ChatGPT-Image-17.-3.-2026-14_46_02.jpg"                                      "wellness.jpg"
get "$B/2019/07/classic_wellness_white.png"                                                  "wellness-logo.png"
get "$B/2026/03/cropped-FCA38CE2-55CE-4F3A-86CE-49862354F148-1-2.jpg"                        "logo.jpg"
# logo.png (priehľadné pozadie) je odvodený asset – regeneruj z logo.jpg:
#   node scripts/make-logo.mjs

# --- Fotogaléria: všetky fotky z podhajska.net/galeria/, poradie = kategórie ---
# Štúdio 1,2,3
get "$B/2024/10/179542530.jpg"          "gallery/179542530.jpg"
get "$B/2024/10/179542710.jpg"          "gallery/179542710.jpg"
get "$B/2024/10/179542738.jpg"          "gallery/179542738.jpg"
get "$B/2024/10/179542770.jpg"          "gallery/179542770.jpg"
get "$B/2024/10/256963110.jpg"          "gallery/256963110.jpg"
get "$B/2024/10/256963113.jpg"          "gallery/256963113.jpg"
get "$B/2024/10/256963115.jpg"          "gallery/256963115.jpg"
get "$B/2024/10/256963123.jpg"          "gallery/256963123.jpg"
get "$B/2024/10/IMG_7044-scaled.jpeg"   "gallery/img_7044.jpg"
get "$B/2024/10/IMG_7045-scaled.jpeg"   "gallery/img_7045.jpg"
get "$B/2024/10/IMG_7055-scaled.jpeg"   "gallery/img_7055.jpg"
get "$B/2024/10/IMG_7064-scaled.jpeg"   "gallery/img_7064.jpg"
# Wellness
get "$B/2026/03/D1175F5E-6230-4DC8-BA03-292B251D022C.jpg" "gallery/d1175f5e-6230-4dc8-ba03-292b251d022c.jpg"
get "$B/2026/03/IMG_3432.jpeg"          "gallery/img_3432.jpg"
get "$B/2026/03/IMG_3448.jpeg"          "gallery/img_3448.jpg"
get "$B/2026/03/IMG_3449.jpeg"          "gallery/img_3449.jpg"
get "$B/2026/03/IMG_3450.jpeg"          "gallery/img_3450.jpg"
get "$B/2026/03/IMG_3451.jpeg"          "gallery/img_3451.jpg"
get "$B/2026/03/IMG_3452.jpeg"          "gallery/img_3452.jpg"
get "$B/2026/03/IMG_3453.jpeg"          "gallery/img_3453.jpg"
get "$B/2026/03/IMG_3454.jpeg"          "gallery/img_3454.jpg"
get "$B/2026/03/IMG_3455.jpeg"          "gallery/img_3455.jpg"
get "$B/2026/03/IMG_3456.jpeg"          "gallery/img_3456.jpg"
get "$B/2026/03/IMG_3457.jpeg"          "gallery/img_3457.jpg"
get "$B/2026/03/IMG_3459.jpeg"          "gallery/img_3459.jpg"
# Exteriér
get "$B/2024/10/216546663.jpg"          "gallery/216546663.jpg"
get "$B/2024/10/7.jpg"                  "gallery/7.jpg"
get "$B/2024/10/IMG_5042-scaled.jpeg"   "gallery/img_5042.jpg"
get "$B/2024/10/IMG_6943-scaled.jpeg"   "gallery/img_6943.jpg"
get "$B/2024/10/IMG_7035-scaled.jpeg"   "gallery/img_7035.jpg"
get "$B/2024/10/IMG_7036-scaled.jpeg"   "gallery/img_7036.jpg"
get "$B/2024/10/IMG_7037-scaled.jpeg"   "gallery/img_7037.jpg"
get "$B/2024/10/IMG_7040-scaled.jpeg"   "gallery/img_7040.jpg"
get "$B/2024/10/IMG_7041-scaled.jpeg"   "gallery/img_7041.jpg"
get "$B/2024/10/IMG_7043-scaled.jpeg"   "gallery/img_7043.jpg"
get "$B/2024/10/IMG_7049-scaled.jpeg"   "gallery/img_7049.jpg"
get "$B/2024/10/IMG_7050-scaled.jpeg"   "gallery/img_7050.jpg"
get "$B/2024/10/IMG_7051-scaled.jpeg"   "gallery/img_7051.jpg"
get "$B/2024/10/IMG_7053-scaled.jpeg"   "gallery/img_7053.jpg"
get "$B/2024/10/IMG_7057-scaled.jpeg"   "gallery/img_7057.jpg"
get "$B/2024/10/IMG_7059-scaled.jpeg"   "gallery/img_7059.jpg"

echo "Hotovo. Súbory v: $DIR"
ls -la "$DIR"
