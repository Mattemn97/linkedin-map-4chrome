# Changelog

Tutte le modifiche rilevanti di LinkeMap. Formato [Keep a Changelog](https://keepachangelog.com/it/1.1.0/),
versioni [Semantic Versioning](https://semver.org/lang/it/).

## [Non rilasciato]

## [0.5.0] - 2026-10-29

### Aggiunto
- **Punto di partenza da indirizzo**: scrivi un indirizzo o una città e premi «Cerca», senza dover cliccare sulla mappa.
- **Offerte nuove**: etichetta «nuova» sulle offerte viste per la prima volta nell'ultima importazione e voce «Nuove dell'ultima importazione» nel menu «Mostra».
- La mappa segue il tema chiaro/scuro del sistema anche se cambia a pagina aperta.
- `Esc` annulla la scelta del punto sulla mappa.
- Il popup dell'estensione indica quante offerte nuove ha portato l'importazione.
- Configurazione di Prettier ed ESLint; tutto il codice è formattato con Prettier.

### Corretto
- Se Chrome terminava il service worker durante un'importazione, il pulsante «Importa» restava disattivato per sempre: ora l'importazione risulta interrotta e si può ripetere.
- Lo stato «Calcolo dei tempi in auto in corso…» poteva restare bloccato dopo aver spostato il punto durante un calcolo.
- Il numero di offerte sul badge dell'icona torna dopo il riavvio di Chrome e dopo un aggiornamento dell'estensione.
- Il popup di un'offerta aperto sulla mappa non si chiude più da solo mentre le località vengono geolocalizzate.
- Il parametro `origin` della ricerca viene codificato come gli altri valori Rest.li.

## [0.4.0] - 2026-10-19

### Aggiunto
- **Filtro per regione**: menu a scelta multipla con il numero di offerte per regione.
- **Filtro per distanza**: scegli un punto sulla mappa (trascinabile) e un raggio in km in linea d'aria; il cerchio compare sulla mappa.
- **Filtro per tempo di percorso**: tempo in auto dal punto scelto (servizio OSRM), con limite in minuti.
- **Ordinamento**: più recenti, meno recenti, azienda, titolo, distanza, tempo di percorso.
- **Filtri per riordinare**: data di pubblicazione (24 ore, settimana, mese), nascondi promosse, preferite (★) e nascoste (✕), pulsante «Azzera filtri».
- I filtri della mappa restano salvati alla chiusura della pagina.
- Il CSV esporta anche regione, promossa, preferita o nascosta, distanza e tempo in auto.
- **Avviso sulla ricerca con AI** nel popup, con un pulsante che riapre la stessa ricerca in modalità classica.
- `build.sh` per creare gli zip su macOS e Linux; elenco dei file condiviso in `build-files.txt`.
- Licenza MIT, guida ai contributi, codice di condotta, policy di sicurezza, modelli di issue e pull request.

### Corretto
- **Geocoding**: il paese della località (o della ricerca) vincola ora Nominatim, così "Italy" non finisce più negli Stati Uniti. Un paese da solo viene cercato come paese. La cache delle posizioni viene rifatta all'aggiornamento.
- L'importazione rifiuta in modo chiaro le pagine di ricerca con AI invece di inviare richieste sbagliate.

### Modificato
- `dist/` non è più versionata: gli zip sono allegati alle release.

## [0.3.0]

- Prima versione pubblica: importazione delle ricerche LinkedIn Jobs, mappa con cluster, lista filtrabile, esportazione CSV.

[Non rilasciato]: https://github.com/Mattemn97/linkedin-map-4chrome/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/Mattemn97/linkedin-map-4chrome/releases/tag/v0.5.0
[0.4.0]: https://github.com/Mattemn97/linkedin-map-4chrome/releases/tag/v0.4.0
