import { parseJobCards, mergeJob, geocodeQuery } from './parser.js';
import {
  buildSearchQuery, buildApiUrl, isJobSearchUrl, DEFAULT_DECORATION, PAGE_SIZE, MAX_RESULTS,
} from './search.js';

// Storage (chrome.storage.local):
//   jobs:        { [jobId]: job }                       offerte raccolte
//   geocache:    { [query]: {lat, lon} | {fail: true} } geocoding già fatto
//   importState: { running, fetched, total, added, error, ignored, finishedAt }

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const GEOCODE_INTERVAL_MS = 1100; // policy Nominatim: max 1 richiesta/secondo
const PAGE_DELAY_MS = 1500;       // pausa tra una pagina di risultati e la successiva

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

chrome.runtime.onStartup.addListener(() => geocodePending());

// ---------- Importazione di una ricerca ----------

let importing = false;

async function runImport(tabId, pageUrl) {
  if (importing) return;
  importing = true;
  const state = { running: true, fetched: 0, total: null, added: 0, error: null, ignored: [], finishedAt: null };
  const save = () => chrome.storage.local.set({ importState: { ...state } });

  try {
    if (!isJobSearchUrl(pageUrl)) throw new Error('La scheda attiva non è una ricerca di LinkedIn Jobs.');

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
      const cards = await ingest(json);
      state.total = Math.min(json.data?.paging?.total ?? 0, MAX_RESULTS);
      state.fetched += cards.length;
      state.added = Object.keys((await chrome.storage.local.get('jobs')).jobs ?? {}).length;
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
  if (status === 401 || status === 403) return `LinkedIn ha rifiutato la richiesta (${status}): ricarica la pagina di LinkedIn e verifica di essere collegato.`;
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
        const re = /decorationId=(com\.linkedin\.voyager\.dash\.deco\.jobs\.search\.JobSearchCardsCollection-\d+)/;
        const names = performance.getEntriesByType('resource').map(e => e.name).reverse();
        for (const n of names) { const m = n.match(re); if (m) return m[1]; }
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

async function ingest(json) {
  const parsed = parseJobCards(json);
  if (!parsed.length) return parsed;

  const { jobs = {} } = await chrome.storage.local.get('jobs');
  const now = Date.now();
  for (const job of parsed) {
    const merged = mergeJob(jobs[job.id], job);
    merged.geoQuery = geocodeQuery(merged);
    merged.seenAt ??= now;
    jobs[job.id] = merged;
  }
  await chrome.storage.local.set({ jobs });
  updateBadge(Object.keys(jobs).length);
  return parsed;
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
      const { jobs = {}, geocache = {} } = await chrome.storage.local.get(['jobs', 'geocache']);
      const query = Object.values(jobs).map(j => j.geoQuery).find(q => q && !(q in geocache));
      if (!query) break;

      const result = await geocode(query);
      if (result === undefined) break; // errore di rete / rate limit: riprova più tardi

      const { geocache: fresh = {} } = await chrome.storage.local.get('geocache');
      fresh[query] = result;
      await chrome.storage.local.set({ geocache: fresh });
      await sleep(GEOCODE_INTERVAL_MS);
    }
  } finally {
    geocoding = false;
  }
}

// Ritorna {lat, lon}, {fail: true} se il luogo non esiste, undefined se la richiesta è fallita.
// "Città, Regione, Paese" va cercato in forma strutturata: in testo libero Nominatim
// restituisce spesso la provincia omonima (es. Brescia -> centro della provincia).
async function geocode(query) {
  const parts = query.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const structured = { city: parts[0], country: parts.at(-1) };
    if (parts.length >= 3) structured.state = parts[1];
    const hit = await nominatim(structured);
    if (hit === undefined || hit) return hit;
    await sleep(GEOCODE_INTERVAL_MS);
  }
  const hit = await nominatim({ q: query });
  return hit === undefined ? undefined : hit ?? { fail: true };
}

// Ritorna {lat, lon}, null se nessun risultato, undefined se la richiesta è fallita.
async function nominatim(params) {
  const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', 'accept-language': 'it', ...params });
  try {
    const res = await fetch(`${NOMINATIM}?${qs}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return undefined;
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
  } catch {
    return undefined;
  }
}
