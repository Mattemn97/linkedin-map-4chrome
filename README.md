# LinkeMap

Estensione Chrome (Manifest V3) che importa le offerte di una ricerca LinkedIn Jobs e le mostra su una mappa.

## Installazione

1. Apri `chrome://extensions` e attiva **Modalità sviluppatore** (in alto a destra).
2. **Carica estensione non pacchettizzata** → seleziona questa cartella.
   Dopo ogni modifica ai file premi l'icona ↻ sulla scheda dell'estensione.
3. Fissa l'icona: menu del puzzle 🧩 nella barra di Chrome → spillo accanto a LinkeMap.

## Uso

1. Apri `https://www.linkedin.com/jobs/search/` da collegato e imposta parole chiave, località e filtri.
2. Con quella scheda in primo piano clicca l'icona di LinkeMap.
3. Premi **«Importa le offerte di questa ricerca»**: l'estensione scarica tutte le pagine dei risultati
   (25 per volta, una ogni 1,5 s, massimo 1000) e mostra l'avanzamento nel popup.
   Puoi chiudere il popup: l'importazione continua.
4. Premi **«Apri la mappa»**. Le offerte compaiono subito nella lista; i segnaposto arrivano man mano
   che le località vengono geolocalizzate (una al secondo, poi restano in cache).

Ripetendo l'importazione con altre ricerche le offerte si sommano. «Svuota» nella mappa le cancella.

## Come funziona

| File | Ruolo |
|---|---|
| `popup.html/.js` | Rileva se la scheda attiva è una ricerca LinkedIn, avvia l'importazione, mostra l'avanzamento. |
| `search.js` | Traduce l'URL della ricerca (`keywords`, `geoId`, `f_E`, `f_WT`, …) nella query dell'API `voyagerJobsDashJobCards`. |
| `background.js` | Esegue le richieste **dentro la scheda LinkedIn** (stessa origine, tua sessione, header `csrf-token` dal cookie `JSESSIONID`), salva le offerte e le geolocalizza con Nominatim. |
| `parser.js` | Estrae da `included[]` le `JobPostingCard`: titolo, azienda, località, modalità, logo, data. |
| `map.html/.js` | Mappa Leaflet con cluster, lista filtrabile, esportazione CSV. Tile Esri (le tile OSM e CARTO rifiutano le pagine `chrome-extension://`, che non inviano il Referer). |

## Rilascio

1. Aumenta `version` in `manifest.json`.
2. Esegui `powershell -ExecutionPolicy Bypass -File build.ps1`. In `dist/` trovi:
   - `LinkeMap-<versione>-test.zip`: cartella pronta da estrarre più `LEGGIMI.txt` con le istruzioni, da mandare ai tester;
   - `LinkeMap-<versione>-store.zip`: `manifest.json` alla radice, da caricare sul Chrome Web Store.

Le icone in `icons/` sono generate da `icons/icon.svg`.

## Problemi comuni

- **«LinkedIn ha rifiutato la richiesta (401/403)»**: ricarica la scheda di LinkedIn e verifica di essere collegato.
- **«Richiesta non accettata (400)»**: LinkedIn ha probabilmente cambiato l'API; serve un nuovo log HAR per aggiornare `search.js`/`parser.js`.
- **«Filtri non supportati e ignorati: f_…»**: quei filtri dell'URL non vengono applicati, quindi l'importazione restituisce più risultati del previsto.
- **Offerta in lista ma non sulla mappa**: la località non è stata trovata da Nominatim (la riga appare sbiadita).

## Limiti

- La posizione è la **località dell'offerta** indicata da LinkedIn, non l'indirizzo della sede aziendale.
- Le offerte "Da remoto" con località generica ("Italia") finiscono al centro del paese.
- L'importazione fa richieste automatiche all'API interna di LinkedIn con il tuo account: i Termini di Servizio
  di LinkedIn vietano lo scraping automatico. Usala con moderazione.
