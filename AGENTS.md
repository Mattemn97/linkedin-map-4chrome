# LinkeMap

Estensione Chrome (Manifest V3) che importa le offerte di una ricerca LinkedIn Jobs e le mostra su una mappa.

## Stack

- **Language / Runtime**: JavaScript puro (ES modules nel service worker), Chrome Manifest V3
- **Framework**: nessuno, niente bundler né transpiler: i file in radice sono caricati così come sono
- **Key dependencies**: Leaflet e Leaflet.markercluster (copie locali in `lib/`), API interna LinkedIn `voyagerJobsDashJobCards`, geocoding Nominatim, tempi in auto OSRM, tile Esri
- **Package manager**: nessuno (nessun `package.json`)

## Build approach

Tracer Bullet (ogni funzione costruita da capo a fondo, piccola ma completa). Workflow Prototype, niente test in CI/CD. Scope in `docs/scope/scope.md`.

## Commands

```bash
# Install / dev: chrome://extensions, Modalità sviluppatore, "Carica estensione non pacchettizzata" su questa cartella.
# Dopo ogni modifica premi ↻ sulla scheda dell'estensione.

# Build (pacchetti di rilascio in dist/, prima aumenta "version" in manifest.json)
powershell -ExecutionPolicy Bypass -File build.ps1   # Windows
sh build.sh                                        # macOS, Linux

# Formattazione e lint (Node richiesto, nessuna installazione nel progetto)
npx prettier --write .
npx eslint .

# Test: nessun test automatico al momento
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- Testi per l'utente, commenti e messaggi d'errore sono in italiano.
- Codice formattato con Prettier (`.prettierrc.json`) e controllato con ESLint (`eslint.config.js`, senza dipendenze); `lib/` è esclusa.
- Stato condiviso solo in `chrome.storage.local` (`jobs`, `geocache2`, `importState`, `marks`, `mapPrefs`, schema in testa a `background.js`). Popup e mappa si aggiornano ascoltando `chrome.storage.onChanged`, non tramite messaggi.
- Le richieste a LinkedIn partono dentro la scheda LinkedIn (`chrome.scripting.executeScript` con `fetchInPage`), con header `csrf-token` preso dal cookie `JSESSIONID`. Non spostarle nel service worker.
- Rispetta i ritmi: Nominatim e OSRM al massimo 1 richiesta al secondo, pagine LinkedIn ogni 1,5 s (`PAGE_DELAY_MS`), massimo 1000 risultati.
- Il geocoding passa sempre da `geo.js`: la chiave è `località|cc` e il codice paese vincola Nominatim. Se cambi il formato della cache, cambia `GEOCACHE_KEY` e migra in `onInstalled`.
- Unire le offerte sempre con `mergeJob`: un campo vuoto non deve sovrascrivere un valore già noto.
- Nella mappa ogni testo inserito in HTML passa da `esc()`.
- Un nuovo file dell'estensione va aggiunto a `build-files.txt` (letto da `build.ps1` e `build.sh`), altrimenti manca dagli zip.
- Ogni rilascio aggiorna `version` in `manifest.json` e `CHANGELOG.md`.

## Gotchas

- `popup.js` e `map.js` sono moduli ES; Leaflet resta uno script classico caricato prima (`L` globale).
- Solo la ricerca classica `/jobs/search/` è importabile; le altre `/jobs/search…` sono la ricerca con AI (`isAiJobSearchUrl`).
- Le tile OSM e CARTO rifiutano le pagine `chrome-extension://` (niente Referer): per questo si usano le basemap Esri.
- Se LinkedIn cambia l'API (errore 400) servono un nuovo log HAR e l'aggiornamento di `search.js`/`parser.js`.
- `dist/` è ignorata da git: gli zip si allegano alle release GitHub.

## Agent skills

Skill di workflow in `.claude/skills/` (`jsmastery-pro/skills`, versioni in `skills-lock.json`): `/scope`, `/architect`, `/develop`, `/check`, `/test`, `/debug`, `/document`, `/sync`, `/audit`.

Declined: ricerca di Agent Skills e MCP per lo stack (Chrome MV3, Leaflet, Nominatim)

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
