import { parseJobCards, mergeJob } from './parser.js';
import { geocodeKey, geocode, GEOCACHE_KEY } from './geo.js';
import {
  buildSearchQuery,
  buildApiUrl,
  isJobSearchUrl,
  DEFAULT_DECORATION,
  PAGE_SIZE,
  MAX_RESULTS,
} from './search.js';

// Storage (chrome.storage.local):
//   jobs:        { [jobId]: job }                       offerte raccolte
//   geocache2:   { ["località|cc"]: {lat, lon, cc, region} | {fail: true} } geocoding già fatto
//   marks:       { [jobId]: 'star' | 'hidden' }          preferite / nascoste (scritte dalla mappa)
//   mapPrefs:    stato dei filtri della mappa
//   importState: { running, fetched, total, added, error, ignored, startedAt, finishedAt }
//   (added: offerte mai viste prima arrivate con questa importazione)
//   (job.seenAt >= importState.startedAt: offerta nuova nell'ultima importazione)

const GEOCODE_INTERVAL_MS = 1100; // policy Nominatim: max 1 richiesta/secondo
const PAGE_DELAY_MS = 1500; // pausa tra una pagina di risultati e la successiva

const sleep = ms => new Promise(r => setTimeout(r, ms));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'import') {
    runImport(msg.tabId, msg.url);
  } else if (msg?.type === 'geocode') {
    geocodePending();
  } else if (msg?.type === 'clear') {
    chrome.storage.local.set({ jobs: {}, importState: null }).then(() => {
      updateBadge(0);
      sendResponse(true);
    });
    return true;
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const { jobs = {} } = await chrome.storage.local.get('jobs');
  updateBadge(Object.keys(jobs).length); // il testo del badge non sopravvive al riavvio di Chrome
  geocodePending();
});

// Il service worker riparte da zero: un'importazione ancora "in corso" nello storage è stata
// interrotta (worker terminato da Chrome) e lascerebbe il pulsante «Importa» disattivato per sempre.
chrome.storage.local.get('importState').then(({ importState }) => {
  if (importState?.running && !importing) {
    chrome.storage.local.set({
      importState: {
        ...importState,
        running: false,
        finishedAt: Date.now(),
        error: 'Importazione interrotta: riprova.',
      },
    });
  }
});

// v0.4.0: chiavi di geocoding con codice paese. Si scarta la cache v1 (senza paese né regione,
// con errori tipo "Italy" negli Stati Uniti) e si ricalcolano le chiavi delle offerte salvate.
chrome.runtime.onInstalled.addListener(async () => {
  const { jobs = {} } = await chrome.storage.local.get('jobs');
  for (const job of Object.values(jobs)) job.geoQuery = geocodeKey(job);
  await chrome.storage.local.set({ jobs });
  await chrome.storage.local.remove('geocache');
  updateBadge(Object.keys(jobs).length);
  geocodePending();
});

// ---------- Importazione di una ricerca ----------

let importing = false;

async function runImport(tabId, pageUrl) {
  if (importing) return;
  importing = true;
  const state = {
    running: true,
    fetched: 0,
    total: null,
    added: 0,
    error: null,
    ignored: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
  const save = () => chrome.storage.local.set({ importState: { ...state } });

  try {
    if (!isJobSearchUrl(pageUrl))
      throw new Error(
        'La scheda attiva non è una ricerca classica di LinkedIn Jobs (linkedin.com/jobs/search/).',
      );

    const cookie = await chrome.cookies.get({ url: 'https://www.linkedin.com', name: 'JSESSIONID' });
    if (!cookie) throw new Error('Non risulti collegato a LinkedIn: accedi e ricarica la pagina.');
    const csrf = cookie.value.replace(/"/g, '');

    const { query, ignored } = buildSearchQuery(pageUrl);
    state.ignored = ignored;
    const decoration = await detectDecoration(tabId);
    await save();

    for (let start = 0; start < MAX_RESULTS; start += PAGE_SIZE) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: fetchInPage,
        args: [buildApiUrl(query, start, decoration), csrf],
      });
      if (result.status !== 200) throw new Error(describeHttpError(result));

      const json = JSON.parse(result.text);
      const { cards, added } = await ingest(json);
      state.total = Math.min(json.data?.paging?.total ?? 0, MAX_RESULTS);
      state.fetched += cards.length;
      state.added += added;
      await save();

      geocodePending();
      if (!cards.length || start + PAGE_SIZE >= state.total) break;
      await sleep(PAGE_DELAY_MS);
    }
  } catch (err) {
    state.error = err.message || String(err);
  } finally {
    state.running = false;
    state.finishedAt = Date.now();
    await save();
    importing = false;
  }
}

function describeHttpError({ status, error }) {
  if (status === 0) return `Richiesta fallita: ${error ?? 'errore di rete'}`;
  if (status === 401 || status === 403)
    return `LinkedIn ha rifiutato la richiesta (${status}): ricarica la pagina di LinkedIn e verifica di essere collegato.`;
  if (status === 429) return 'Troppe richieste (429): attendi qualche minuto e riprova.';
  if (status === 400) return 'Richiesta non accettata (400): LinkedIn potrebbe aver cambiato la sua API.';
  return `Errore HTTP ${status} da LinkedIn.`;
}

// Usa la stessa versione di "decorationId" che la pagina ha appena usato, se visibile.
async function detectDecoration(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const re =
          /decorationId=(com\.linkedin\.voyager\.dash\.deco\.jobs\.search\.JobSearchCardsCollection-\d+)/;
        const names = performance
          .getEntriesByType('resource')
          .map(e => e.name)
          .reverse();
        for (const n of names) {
          const m = n.match(re);
          if (m) return m[1];
        }
        return null;
      },
    });
    return result || DEFAULT_DECORATION;
  } catch {
    return DEFAULT_DECORATION;
  }
}

// Eseguita dentro la scheda LinkedIn: richiesta same-origin con la sessione dell'utente.
async function fetchInPage(url, csrf) {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'csrf-token': csrf,
        accept: 'application/vnd.linkedin.normalized+json+2.1',
        'x-restli-protocol-version': '2.0.0',
      },
    });
    return { status: res.status, text: res.ok ? await res.text() : '' };
  } catch (e) {
    return { status: 0, error: String(e) };
  }
}

// Salva le offerte di una pagina; ritorna le card lette e quante non erano già salvate.
async function ingest(json) {
  const parsed = parseJobCards(json);
  if (!parsed.length) return { cards: parsed, added: 0 };

  const { jobs = {} } = await chrome.storage.local.get('jobs');
  const now = Date.now();
  let added = 0;
  for (const job of parsed) {
    if (!jobs[job.id]) added++;
    const merged = mergeJob(jobs[job.id], job);
    merged.geoQuery = geocodeKey(merged);
    merged.seenAt ??= now;
    jobs[job.id] = merged;
  }
  await chrome.storage.local.set({ jobs });
  updateBadge(Object.keys(jobs).length);
  return { cards: parsed, added };
}

function updateBadge(n) {
  chrome.action.setBadgeBackgroundColor({ color: '#0a66c2' });
  chrome.action.setBadgeText({ text: n ? String(n) : '' });
}

// ---------- Geocoding ----------

let geocoding = false;

async function geocodePending() {
  if (geocoding) return;
  geocoding = true;
  try {
    for (;;) {
      const { jobs = {}, [GEOCACHE_KEY]: geocache = {} } = await chrome.storage.local.get([
        'jobs',
        GEOCACHE_KEY,
      ]);
      const query = Object.values(jobs)
        .map(j => j.geoQuery)
        .find(q => q && !(q in geocache));
      if (!query) break;

      const result = await geocode(query, () => sleep(GEOCODE_INTERVAL_MS));
      if (result === undefined) break; // errore di rete / rate limit: riprova più tardi

      const { [GEOCACHE_KEY]: fresh = {} } = await chrome.storage.local.get(GEOCACHE_KEY);
      fresh[query] = result;
      await chrome.storage.local.set({ [GEOCACHE_KEY]: fresh });
      await sleep(GEOCODE_INTERVAL_MS);
    }
  } finally {
    geocoding = false;
  }
}
