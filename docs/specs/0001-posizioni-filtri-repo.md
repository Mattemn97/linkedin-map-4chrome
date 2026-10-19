# 0001 · Posizioni corrette, filtri e repo aperta ai contributi

Status: Accepted (decisioni prese in automatico su richiesta dell'autore)

## Decisioni

1. **Geocoding** (`geo.js`, condiviso da `background.js` e `map.js`)
   - Una tabella di nomi di paese (italiano e inglese) porta ogni nome a un codice ISO a due lettere.
   - Il codice viene dall'ultima parte della località, altrimenti dall'ultima parte della località della ricerca (`searchGeo`).
   - La chiave di cache (`geoQuery`) è `località|cc`. A Nominatim si passa sempre `countrycodes=cc`, così "Italy" non può più finire negli Stati Uniti.
   - Una località che è solo un paese si cerca con `featureType=country`. Con due o più parti si prova prima la ricerca strutturata (città, regione), poi il testo libero, sempre con il vincolo del paese.
   - `addressdetails=1` restituisce regione (`state`) e paese. La cache salva `{lat, lon, cc, region}`.
   - La chiave di storage passa da `geocache` a `geocache2`: la cache vecchia (senza regione e con errori) viene ignorata e cancellata.
2. **Regione**: un menu a scelta multipla costruito dalle regioni in cache, con il conteggio delle offerte. Le offerte senza regione (un paese intero) finiscono sotto "Tutto il paese".
3. **Distanza in linea d'aria**: "Scegli punto" e poi un clic sulla mappa (marker trascinabile). Raggio in km, formula di Haversine, cerchio disegnato.
4. **Tempo di percorso**: servizio pubblico OSRM (`router.project-osrm.org`, profilo auto, servizio `table`). Al massimo 90 destinazioni per richiesta e una richiesta al secondo. Cache in memoria per punto. Limite in minuti. Le località senza tempo restano visibili finché il calcolo non finisce.
5. **Ordine**: ordinamento (più recenti, meno recenti, azienda, titolo, distanza, tempo); data di pubblicazione (24 ore, 7 giorni, 30 giorni); "nascondi promosse"; preferite e nascoste (stella e occhio su ogni offerta, chiave `marks` nello storage). Lo stato dei filtri si salva in `chrome.storage.local` (`mapPrefs`).
6. **Ricerca con AI**: la ricerca classica ha percorso `/jobs/search/`. Ogni altro percorso `/jobs/search…` (per esempio `/jobs/search-results/`) è trattato come ricerca AI: il popup mostra l'avviso e un pulsante che riapre `keywords`, `geoId` e `location` su `/jobs/search/`. `popup.js` diventa un modulo e importa le funzioni da `search.js`.
7. **Repo**: licenza MIT, CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1), SECURITY, template di issue (bug e richiesta) e di PR, `.gitignore` con `dist/`, `.editorconfig`. Nessun workflow di CI.
8. **Build**: `build.ps1` e `build.sh` leggono lo stesso elenco di file, `build-files.txt`.

## Build plan

- [x] `geo.js` + `background.js` (geocoding, migrazione della cache)
- [x] `map.html/.css/.js` (filtri e ordinamento)
- [x] `popup.*` + `search.js` (avviso AI)
- [x] File della community, script di build, release 0.4.0
