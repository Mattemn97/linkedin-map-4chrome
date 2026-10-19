#!/usr/bin/env sh
# Crea i pacchetti di rilascio in dist/ (stesso risultato di build.ps1, per macOS e Linux):
#   LinkeMap-<versione>-test.zip   cartella LinkeMap-<versione>/ + LEGGIMI.txt, da mandare ai tester
#   LinkeMap-<versione>-store.zip  manifest.json alla radice, da caricare sul Chrome Web Store
# Uso: sh build.sh    (richiede zip)
set -eu
cd "$(dirname "$0")"

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
folder="LinkeMap-$version"
files=$(grep -v '^#' build-files.txt | sed '/^[[:space:]]*$/d')

for f in $files; do [ -e "$f" ] || { echo "File mancante: $f" >&2; exit 1; }; done

mkdir -p dist
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/$folder"
for f in $files; do mkdir -p "$tmp/$folder/$(dirname "$f")"; cp -R "$f" "$tmp/$folder/$(dirname "$f")/"; done
cp LEGGIMI.txt "$tmp/$folder/"

rm -f "dist/$folder-test.zip" "dist/$folder-store.zip"
(cd "$tmp" && zip -qr -X "$OLDPWD/dist/$folder-test.zip" "$folder")
(cd "$tmp/$folder" && zip -qr -X "$OLDPWD/dist/$folder-store.zip" . -x LEGGIMI.txt)

echo "Versione $version"
ls -l "dist/$folder-test.zip" "dist/$folder-store.zip"
