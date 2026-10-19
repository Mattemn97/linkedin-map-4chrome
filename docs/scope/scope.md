# Scope: LinkeMap

Estensione Chrome che importa le offerte di una ricerca LinkedIn Jobs e le mostra su una mappa, per chi cerca lavoro e vuole capire subito dove sono le offerte.

**Build approach:** Tracer Bullet (ogni funzione costruita da capo a fondo, piccola ma completa e funzionante).
**Workflow:** Prototype (dopo `/develop` nessun passaggio obbligatorio; un controllo leggero del codice con un modello economico prima del rilascio). Niente test in CI/CD.

_Sono raccomandazioni per tenere ordinato il lavoro, non obblighi. Salta quello che non ti serve._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Importazione ricerca LinkedIn | Existing | existing |
| B | Mappa con cluster, lista, CSV | Existing | existing |
| C | Pacchetti zip di rilascio (`build.ps1`) | Existing | existing |
| 1 | Geocoding corretto per paese e regione | Slice 1 | done |
| 2 | Filtro per regione | Slice 1 | done |
| 3 | Filtro per distanza in linea d'aria | Slice 2 | done |
| 4 | Filtro per tempo di percorso | Slice 2 | done |
| 5 | Ordinamento e filtri per riordinare le offerte | Slice 2 | done |
| 6 | Avviso ricerca classica nel popup | Slice 1 | done |
| 7 | Repo pronta per contributi esterni | Slice 3 | done |
| 8 | Script zip multipiattaforma | Slice 3 | done |
| 9 | Release con changelog | Slice 3 | done |

## Existing

### A. Importazione ricerca LinkedIn · existing
Popup, API `voyagerJobsDashJobCards`, salvataggio in `chrome.storage.local`. code in `background.js`, `search.js`, `parser.js`, `popup.*`

### B. Mappa con cluster, lista, CSV · existing
Mappa Leaflet, lista filtrabile per testo e modalità, esportazione CSV. code in `map.*`

### C. Pacchetti zip di rilascio · existing
`build.ps1` crea lo zip per i tester e quello per il Chrome Web Store. code in `build.ps1`

## Slice 1: Posizioni corrette

### 1. Geocoding corretto per paese e regione · done
"Italy" finiva in una città degli Stati Uniti. Il paese della località (o della ricerca) diventa un codice ISO che vincola Nominatim; un paese da solo si cerca come paese.
**Done when:** "Italy", "Italia", "Milan, Lombardy, Italy" e "Brescia" (ricerca in Italia) finiscono in Italia; la cache vecchia viene rifatta.
- [x] Design it (spec): spec 0001
- [x] Build it: `/develop geocoding`
Spec 0001 · code in `geo.js`, `background.js`

### 2. Filtro per regione · done
Scegli una o più regioni (dati da Nominatim) per vedere solo le offerte lì.
**Done when:** il menu elenca le regioni presenti con il numero di offerte e filtra lista e mappa.
- [x] Build it: `/develop filtro regione`
Spec 0001 · code in `map.js`

### 6. Avviso ricerca classica nel popup · done
La ricerca con AI di LinkedIn usa un altro indirizzo che l'importazione non sa leggere: il popup lo riconosce e spiega come tornare alla ricerca classica.
**Done when:** su una ricerca AI il popup mostra l'avviso e un pulsante che apre la stessa ricerca in modalità classica; l'avviso generale è sempre visibile.
- [x] Build it: `/develop avviso ricerca classica`
Spec 0001 · code in `popup.*`, `search.js`

## Slice 2: Filtri e ordine

### 3. Filtro per distanza in linea d'aria · done
Scegli un punto sulla mappa e un raggio in km.
**Done when:** il cerchio appare sulla mappa, lista e segnaposto rispettano il raggio, la distanza compare su ogni offerta.
- [x] Build it: `/develop filtro distanza`
Spec 0001 · code in `map.js`

### 4. Filtro per tempo di percorso · done
Dal punto scelto, tempo in auto verso ogni località (servizio OSRM pubblico), con un limite in minuti.
**Done when:** i tempi arrivano a blocchi, restano in cache per punto, le offerte oltre il limite spariscono.
- [x] Build it: `/develop filtro tempo`
Spec 0001 · code in `map.js`

### 5. Ordinamento e filtri per riordinare le offerte · done
Ordina per data, azienda, titolo, distanza o tempo; filtra per data di pubblicazione; preferite e nascoste; nascondi promosse.
**Done when:** le scelte si combinano, valgono anche per l'export CSV e restano dopo la chiusura della pagina.
- [x] Build it: `/develop ordinamento`
Spec 0001 · code in `map.js`

## Slice 3: Repo e rilascio

### 7. Repo pronta per contributi esterni · done
Licenza, guida ai contributi, codice di condotta, sicurezza, template di issue e PR, descrizione e topic su GitHub.
**Done when:** un estraneo sa come segnalare un problema e proporre una modifica; la repo è trovabile per topic.
- [x] Build it: `/develop repo community`

### 8. Script zip multipiattaforma · done
`build.ps1` per Windows e `build.sh` per macOS e Linux generano gli stessi zip.
**Done when:** entrambi gli script producono gli zip in `dist/`, che non è più versionata.
- [x] Build it: `/develop build`

### 9. Release con changelog · done
Versione 0.4.0 con `CHANGELOG.md` e zip allegati alla release GitHub.
**Done when:** il tag `v0.4.0` e la release esistono con le note e gli zip.
- [x] Build it: `/develop release`

## Deferred
- **Tempo di percorso a piedi, in bici o con i mezzi**: il servizio pubblico gratuito copre solo l'auto · needs a decision
- **Pubblicazione sul Chrome Web Store** · needs a decision

## Legend

- **Status** `planned` → `in-progress` → `done`, più `existing` (prima del workflow) e `dropped`.
- **needs a decision** = prima `/architect`, poi `/develop`.
- I compiti di dettaglio stanno nello spec, non qui.
