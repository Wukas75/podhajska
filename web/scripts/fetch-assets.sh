#!/usr/bin/env bash
# Stiahne obrázky z podhajska.net do public/assets/img/.
# podhajska.net blokuje "holé" requesty – treba UA + Referer hlavičku.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/public/assets/img"
mkdir -p "$DIR"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
REF="https://www.google.com/"

get() { # get <url> <cieľový-názov>
  echo "  -> $2"
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

echo "Hotovo. Súbory v: $DIR"
ls -la "$DIR"
