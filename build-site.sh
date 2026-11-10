#!/usr/bin/env sh
# Crea il sito di presentazione in _site/ (per GitHub Pages): le pagine di site/ più la demo in _site/demo/,
# cioè la map.html vera dell'estensione con chrome-finto.js al posto delle API di Chrome.
# Uso: sh build-site.sh [cartella]    (default _site; su Windows da Git Bash)
set -eu
cd "$(dirname "$0")"
out=${1:-_site}

rm -rf "$out"
mkdir -p "$out"
cp -R site/. "$out/"
cp map.css map.js geo.js "$out/demo/"
cp -R lib icons "$out/demo/"
# map.html diventa la pagina della demo: il modulo finto parte prima di map.js.
sed 's#<script src="lib/leaflet/leaflet.js"></script>#<script type="module" src="chrome-finto.js"></script>\n    <script src="lib/leaflet/leaflet.js"></script>#' \
  map.html > "$out/demo/index.html"
grep -q 'chrome-finto.js' "$out/demo/index.html" || { echo "map.html è cambiata: aggiorna build-site.sh" >&2; exit 1; }
touch "$out/.nojekyll"
echo "Sito pronto in $out/"
