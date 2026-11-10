// Demo del sito: sostituisce le API di Chrome che usa map.js con uno storage in memoria pieno di offerte
// inventate. build-site.sh lo copia accanto a map.js e geo.js e lo carica come modulo prima di map.js
// (i moduli girano nell'ordine della pagina).
// window.demoImporta(avanzamento) rifà l'importazione davanti agli occhi: pagine da 25, poi le posizioni.
import { geocodeKey, GEOCACHE_KEY } from './geo.js';
import { LUOGHI, OFFERTE, PAESI, SENZA_POSIZIONE } from './dati.js';

const DAY_MS = 86400000;
const PAGE_SIZE = 25; // come l'estensione
const PAGINA_MS = 700; // l'estensione aspetta 1,5 s: nella demo si accorcia
const LUOGO_MS = 120; // l'estensione geolocalizza una località al secondo
const WORKPLACE = { 'In sede': 'onsite', Ibrido: 'hybrid', 'Da remoto': 'remote' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const now = Date.now();
const offerte = [...OFFERTE, ...SENZA_POSIZIONE].map(([title, company, location, wp, days, promoted], i) => {
  const job = {
    id: String(4100000000 + i * 7919),
    title,
    company,
    companyUrl: null,
    location,
    searchGeo: 'Italia',
    workplaceLabel: wp,
    workplace: WORKPLACE[wp] ?? null,
    logo: null,
    listedAt: now - days * DAY_MS - (i % 9) * 3600000,
    promoted,
    url: 'offerta.html',
    seenAt: now - DAY_MS,
  };
  job.geoQuery = geocodeKey(job);
  return job;
});

function cacheDi(job) {
  const [loc, cc] = job.geoQuery.split('|');
  const hit = LUOGHI[loc] ?? PAESI[job.geoQuery];
  if (!hit) return { fail: true };
  return { lat: hit[0], lon: hit[1], cc: cc ?? null, region: hit[2] };
}

const tutteLeCache = Object.fromEntries(offerte.map(j => [j.geoQuery, cacheDi(j)]));

// Le ultime otto offerte risultano "nuove dell'ultima importazione".
const inizioImport = now - DAY_MS / 2;
offerte.slice(-8).forEach(j => (j.seenAt = inizioImport + 1000));

const store = {
  jobs: Object.fromEntries(offerte.map(j => [j.id, j])),
  [GEOCACHE_KEY]: tutteLeCache,
  marks: { [offerte[0].id]: 'star', [offerte[33].id]: 'star', [offerte[20].id]: 'hidden' },
  importState: { running: false, startedAt: inizioImport, finishedAt: inizioImport + 60000 },
};
const listeners = new Set();
const copia = v => (v === undefined ? undefined : structuredClone(v));

function scrivi(values) {
  const changes = {};
  for (const [k, v] of Object.entries(values)) {
    changes[k] = { oldValue: copia(store[k]), newValue: copia(v) };
    store[k] = copia(v);
  }
  // Come Chrome: l'evento arriva dopo, non dentro la chiamata.
  setTimeout(() => listeners.forEach(fn => fn(changes, 'local')), 0);
}

window.chrome = {
  storage: {
    local: {
      async get(keys) {
        const list = keys == null ? Object.keys(store) : [].concat(keys);
        return Object.fromEntries(list.filter(k => k in store).map(k => [k, copia(store[k])]));
      },
      async set(values) {
        scrivi(values);
      },
      async remove(keys) {
        scrivi(Object.fromEntries([].concat(keys).map(k => [k, undefined])));
      },
    },
    onChanged: { addListener: fn => listeners.add(fn) },
  },
  runtime: {
    async sendMessage(msg) {
      if (msg?.type === 'clear') scrivi({ jobs: {}, importState: null });
      return true;
    },
  },
};

let importando = false;

/** Rifà l'importazione: svuota, scarica a pagine, poi trova le località una alla volta. */
window.demoImporta = async function demoImporta(avanzamento = () => {}) {
  if (importando) return;
  importando = true;
  const startedAt = Date.now();
  const total = offerte.length;
  const jobs = {};
  const cache = {};
  scrivi({ jobs: {}, [GEOCACHE_KEY]: {}, importState: { running: true, fetched: 0, total, startedAt } });
  avanzamento({ fase: 'pagine', fatte: 0, totale: total });
  for (let start = 0; start < total; start += PAGE_SIZE) {
    await sleep(PAGINA_MS);
    for (const j of offerte.slice(start, start + PAGE_SIZE)) jobs[j.id] = { ...j, seenAt: startedAt + 1 };
    const fetched = Math.min(start + PAGE_SIZE, total);
    scrivi({ jobs, importState: { running: true, fetched, total, startedAt } });
    avanzamento({ fase: 'pagine', fatte: fetched, totale: total });
  }
  scrivi({ importState: { running: false, fetched: total, total, startedAt, finishedAt: Date.now() } });
  const luoghi = Object.keys(tutteLeCache);
  for (const [i, key] of luoghi.entries()) {
    await sleep(LUOGO_MS);
    cache[key] = tutteLeCache[key];
    scrivi({ [GEOCACHE_KEY]: cache });
    avanzamento({ fase: 'luoghi', fatte: i + 1, totale: luoghi.length });
  }
  avanzamento({ fase: 'fine', fatte: total, totale: total });
  importando = false;
};
