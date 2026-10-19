# Contribuire a LinkeMap

Grazie per l'interesse! Segnalazioni, idee e pull request sono benvenute.
*English speakers: issues and PRs in English are welcome too.*

## Segnalare un problema

1. Cerca tra le [issue aperte](https://github.com/Mattemn97/linkedin-map-4chrome/issues) se esiste già.
2. Apri una nuova issue con il modello **Bug** e indica: versione di LinkeMap e di Chrome, cosa stavi facendo, il messaggio d'errore nel popup, un'immagine se utile.
3. Errori della console: in `chrome://extensions` premi **Errori** sulla scheda di LinkeMap e copiane il testo.
4. **Non allegare file HAR o cookie**: contengono la tua sessione LinkedIn. Se servono, togli prima gli header `cookie` e `csrf-token`.

## Proporre una modifica

1. Fai un fork e crea un branch dal `main` (`feat/nome-breve` o `fix/nome-breve`).
2. Carica la cartella come estensione non pacchettizzata (`chrome://extensions`, Modalità sviluppatore) e premi ↻ dopo ogni modifica.
3. Prova a mano il flusso completo: importazione da una ricerca classica, mappa, filtri, esportazione CSV.
4. Apri la pull request compilando il modello. Una PR, un argomento.

## Regole del codice

- JavaScript puro, niente bundler né dipendenze npm. Le librerie esterne stanno copiate in `lib/`.
- Testi per l'utente e commenti in italiano.
- Nuovi file dell'estensione vanno aggiunti a `build-files.txt`, altrimenti mancano dagli zip.
- Rispetta i limiti dei servizi esterni: Nominatim e OSRM al massimo una richiesta al secondo, LinkedIn una pagina ogni 1,5 secondi.
- Nuovi permessi in `manifest.json` vanno spiegati nella PR.
- Più dettagli in [AGENTS.md](AGENTS.md).

## Rilascio (solo manutentori)

1. Aumenta `version` in `manifest.json` e aggiorna [CHANGELOG.md](CHANGELOG.md).
2. Crea gli zip: `powershell -ExecutionPolicy Bypass -File build.ps1` (Windows) oppure `sh build.sh` (macOS, Linux).
3. Crea il tag `vX.Y.Z` e la release su GitHub allegando i due zip di `dist/`.

Partecipando accetti il [Codice di condotta](CODE_OF_CONDUCT.md).
