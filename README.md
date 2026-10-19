# LinkeMap · le offerte di LinkedIn Jobs su una mappa

[![Release](https://img.shields.io/github/v/release/Mattemn97/linkedin-map-4chrome)](https://github.com/Mattemn97/linkedin-map-4chrome/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)

Estensione per Google Chrome (Manifest V3) che importa le offerte di una ricerca **LinkedIn Jobs** e le mostra
su una **mappa interattiva**, con filtri per **regione**, **distanza in km** e **tempo di percorso in auto**
da un punto a tua scelta. Funziona anche su Edge e Brave.

> **English**: LinkeMap is a Chrome extension that imports the results of a LinkedIn Jobs search and plots them
> on an interactive map (Leaflet + OpenStreetMap geocoding), with filters by region, straight line distance and
> driving time from any point, sorting, favourites and CSV export. The UI is in Italian; issues and PRs in English are welcome.

## Funzioni

- Importa tutte le pagine di una ricerca LinkedIn Jobs (fino a 1000 offerte), anche a popup chiuso.
- Mappa con segnaposto raggruppati, colorati per modalità (in sede, ibrido, da remoto).
- Posizioni corrette per paese e regione (geocoding Nominatim vincolato al paese).
- Filtri: testo, modalità, **regione**, data di pubblicazione, offerte promosse.
- **Vicino a un punto**: clicca sulla mappa, poi filtra per raggio in km o per minuti in auto (OSRM).
- Ordina per data, azienda, titolo, distanza o tempo di percorso.
- Segna le offerte come **preferite** o **nascoste** per mettere ordine.
- Esporta in CSV (per Excel) le offerte filtrate, con distanze e tempi.
- I dati restano nel tuo browser: nessun server, nessun account.

## Installazione

**Dalla release (consigliato)**: scarica `LinkeMap-<versione>-test.zip` dall'[ultima release](https://github.com/Mattemn97/linkedin-map-4chrome/releases/latest),
estrailo e segui `LEGGIMI.txt`.

**Dal codice**:
1. Apri `chrome://extensions` e attiva **Modalità sviluppatore** (in alto a destra).
2. **Carica estensione non pacchettizzata** e seleziona questa cartella. Dopo ogni modifica premi ↻ sulla scheda dell'estensione.
3. Fissa l'icona: menu del puzzle 🧩 nella barra di Chrome, poi la puntina accanto a LinkeMap.

## Uso

1. Apri `https://www.linkedin.com/jobs/search/` da collegato e imposta parole chiave, località e filtri.
   **Usa la ricerca classica**: se è attiva la ricerca con AI di LinkedIn (indirizzo diverso da `/jobs/search/`),
   il popup te lo segnala e ti offre un pulsante per riaprire la ricerca in modalità classica.
2. Con quella scheda in primo piano clicca l'icona di LinkeMap e premi **«Importa le offerte di questa ricerca»**.
   L'estensione scarica 25 offerte ogni 1,5 secondi (massimo 1000).
3. Premi **«Apri la mappa»**. Le offerte compaiono subito nella lista; i segnaposto arrivano man mano
   che le località vengono geolocalizzate (una al secondo, poi restano in cache).
4. Per cercare vicino a casa: **«Scegli punto sulla mappa»**, clicca il punto, poi imposta «Entro km» o «Entro minuti in auto».

Ripetendo l'importazione con altre ricerche le offerte si sommano. «Svuota» le cancella.

## Come funziona

| File | Ruolo |
|---|---|
| `popup.html/.js` | Riconosce la ricerca classica o con AI nella scheda attiva, avvia l'importazione, mostra l'avanzamento. |
| `search.js` | Traduce l'URL della ricerca (`keywords`, `geoId`, `f_E`, `f_WT`, …) nella query dell'API `voyagerJobsDashJobCards`. |
| `background.js` | Esegue le richieste **dentro la scheda LinkedIn** (stessa origine, tua sessione, header `csrf-token` dal cookie `JSESSIONID`), salva le offerte e le geolocalizza. |
| `parser.js` | Estrae da `included[]` le `JobPostingCard`: titolo, azienda, località, modalità, logo, data. |
| `geo.js` | Normalizza i nomi dei paesi (italiano e inglese) e cerca le località su Nominatim vincolate al paese, con la regione. |
| `map.html/.js` | Mappa Leaflet con cluster, filtri, ordinamento, distanza e tempi in auto (OSRM), esportazione CSV. Tile Esri (OSM e CARTO rifiutano le pagine `chrome-extension://`). |

Servizi esterni: LinkedIn (con il tuo account), [Nominatim](https://nominatim.org/) per le coordinate,
[OSRM](https://project-osrm.org/) per i tempi in auto (solo se usi quel filtro), Esri per le immagini della mappa.

## Creare lo zip da distribuire

1. Aumenta `version` in `manifest.json` e aggiorna `CHANGELOG.md`.
2. Esegui `powershell -ExecutionPolicy Bypass -File build.ps1` (Windows) oppure `sh build.sh` (macOS, Linux). In `dist/` trovi:
   - `LinkeMap-<versione>-test.zip`: cartella pronta da estrarre più `LEGGIMI.txt`, da mandare ai tester;
   - `LinkeMap-<versione>-store.zip`: `manifest.json` alla radice, da caricare sul Chrome Web Store.

I file inclusi sono elencati in `build-files.txt`. Le icone in `icons/` sono generate da `icons/icon.svg`.

## Problemi comuni

- **«LinkedIn ha rifiutato la richiesta (401/403)»**: ricarica la scheda di LinkedIn e verifica di essere collegato.
- **«Richiesta non accettata (400)»**: LinkedIn ha probabilmente cambiato l'API; serve un nuovo log HAR per aggiornare `search.js`/`parser.js`.
- **«Questa è la ricerca con AI di LinkedIn»**: premi «Apri questa ricerca in modalità classica» e importa da lì.
- **«Filtri non supportati e ignorati: f_…»**: quei filtri dell'URL non vengono applicati, quindi l'importazione restituisce più risultati del previsto.
- **Offerta in lista ma non sulla mappa**: la località non è stata trovata da Nominatim (la riga appare sbiadita).
- **Tempi in auto che non arrivano**: il server pubblico OSRM a volte è lento o limitato; riprova tra poco.

## Limiti

- La posizione è la **località dell'offerta** indicata da LinkedIn, non l'indirizzo della sede.
- Le offerte "Da remoto" con località generica ("Italia") finiscono al centro del paese.
- Il tempo di percorso è una stima in auto senza traffico; a piedi, in bici e con i mezzi non sono supportati.
- L'importazione fa richieste automatiche all'API interna di LinkedIn con il tuo account: i Termini di Servizio
  di LinkedIn vietano lo scraping automatico. Usala con moderazione. Progetto non affiliato a LinkedIn.

## Contribuire

Leggi [CONTRIBUTING.md](CONTRIBUTING.md). Le novità di ogni versione sono in [CHANGELOG.md](CHANGELOG.md).
Licenza [MIT](LICENSE).
