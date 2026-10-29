/* global L */
import { GEOCACHE_KEY, searchPlace } from './geo.js';

const WP_LABEL = { onsite: 'In sede', hybrid: 'Ibrido', remote: 'Da remoto', unknown: 'N/D' };
const OSRM = 'https://router.project-osrm.org/table/v1/driving/';
const OSRM_BATCH = 90; // destinazioni per richiesta (il server pubblico accetta al massimo 100 punti)
const OSRM_INTERVAL_MS = 1000; // server dimostrativo: al massimo una richiesta al secondo
const DAY_MS = 86400000;

const DEFAULT_PREFS = {
  q: '',
  wps: ['onsite', 'hybrid', 'remote', 'unknown'],
  regions: [],
  sort: 'newest',
  posted: '',
  show: 'active',
  hidePromoted: false,
  origin: null,
  radiusKm: null,
  maxMin: null,
};

const map = L.map('map', { zoomControl: true }).setView([42.5, 12.5], 6);
// Una pagina chrome-extension:// non invia il Referer: tile.openstreetmap.org risponde 403
// e CARTO restituisce tile "API KEY REQUIRED". Le basemap Esri funzionano senza Referer.
// Basemap grigio neutro (come le superfici di LinkedIn) così i segnaposto blu risaltano.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors · Percorsi &copy; <a href="https://project-osrm.org/">OSRM</a>';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let baseLayers = [];

// Basemap chiara o scura secondo il tema del sistema, anche se cambia a pagina aperta.
function applyBasemap() {
  const tone = darkQuery.matches ? 'Dark' : 'Light';
  baseLayers.forEach(l => l.remove());
  baseLayers = [
    L.tileLayer(`${ESRI}/World_${tone}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      attribution: ATTRIBUTION,
    }),
    L.tileLayer(`${ESRI}/World_${tone}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16 }),
  ];
  baseLayers.forEach(l => l.addTo(map));
}
applyBasemap();
darkQuery.addEventListener('change', applyBasemap);

const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);

const $ = sel => document.querySelector(sel);
const listEl = $('#list');
const statusEl = $('#status');
const searchEl = $('#search');
const wpBoxes = [...document.querySelectorAll('.chips input[value]')];

let state = { jobs: {}, geocache: {}, marks: {}, lastImportAt: null };
let prefs = { ...DEFAULT_PREFS };
let markers = new Map();
let fitted = false;
let picking = false;
let originMarker = null;
let radiusCircle = null;
let openJobId = null; // offerta con il popup aperto, da riaprire dopo ogni ridisegno
let addressNote = null; // esito della ricerca per indirizzo: resta finché il punto non cambia
let redrawing = false;

// Tempi di percorso in minuti per "lat,lon|geoQuery" (null = non raggiungibile in auto).
const travel = new Map();
let travelRun = 0;
let travelBusy = false;
let lastOsrmAt = 0;

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const sleep = ms => new Promise(r => setTimeout(r, ms));

const wpOf = job => job.workplace ?? 'unknown';
const geoOf = job => (job.geoQuery && state.geocache[job.geoQuery]) || null;
const geoPending = job => !!job.geoQuery && !(job.geoQuery in state.geocache);
const coordsOf = job => {
  const g = geoOf(job);
  return g && !g.fail ? [g.lat, g.lon] : null;
};
// Offerta vista per la prima volta durante l'ultima importazione.
const isNew = job => !!state.lastImportAt && job.seenAt >= state.lastImportAt;
const originKey = () => (prefs.origin ? `${prefs.origin.lat.toFixed(4)},${prefs.origin.lon.toFixed(4)}` : '');
const travelOf = job => travel.get(`${originKey()}|${job.geoQuery}`);

// Regione dell'offerta per il filtro: la regione di Nominatim, o "tutto il paese".
function regionOf(job) {
  const g = geoOf(job);
  if (!g || g.fail) return null;
  return g.region ?? `Tutto il paese${g.cc ? ` (${g.cc.toUpperCase()})` : ''}`;
}

function distanceKm(job) {
  const c = coordsOf(job);
  if (!c || !prefs.origin) return null;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(c[0] - prefs.origin.lat);
  const dLon = rad(c[1] - prefs.origin.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(prefs.origin.lat)) * Math.cos(rad(c[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function relDate(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / DAY_MS);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return `${days} giorni fa`;
  return new Date(ts).toLocaleDateString('it-IT');
}

const fmtMin = m => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);

function logoHtml(job) {
  return job.logo
    ? `<img class="logo" src="${esc(job.logo)}" alt="" loading="lazy">`
    : '<span class="logo empty"></span>';
}

function metaHtml(job) {
  const km = distanceKm(job);
  const min = travelOf(job);
  return [
    job.location,
    WP_LABEL[wpOf(job)],
    relDate(job.listedAt),
    km != null ? `${Math.round(km)} km` : '',
    min != null ? `${fmtMin(min)} in auto` : '',
    job.promoted ? 'promossa' : '',
  ]
    .filter(Boolean)
    .map(esc)
    .join(' · ');
}

function popupHtml(job) {
  return `<div class="popup">${logoHtml(job)}<div>
    <a href="${esc(job.url)}" target="_blank" rel="noopener">${esc(job.title)}</a>
    <div class="job-company">${esc(job.company)}</div>
    <div class="job-meta">${metaHtml(job)}</div></div></div>`;
}

// ---------- Filtri e ordinamento ----------

function filtered() {
  const q = prefs.q.trim().toLowerCase();
  const wps = new Set(prefs.wps);
  const regions = new Set(prefs.regions);
  const minDate = prefs.posted ? Date.now() - Number(prefs.posted) * DAY_MS : 0;
  const mark = j => state.marks[j.id];

  const jobs = Object.values(state.jobs).filter(j => {
    if (!wps.has(wpOf(j))) return false;
    if (q && !`${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q)) return false;
    if ((prefs.show === 'active' || prefs.show === 'new') && mark(j) === 'hidden') return false;
    if (prefs.show === 'new' && !isNew(j)) return false;
    if (prefs.show === 'star' && mark(j) !== 'star') return false;
    if (prefs.show === 'hidden' && mark(j) !== 'hidden') return false;
    if (prefs.hidePromoted && j.promoted) return false;
    if (minDate && !(j.listedAt >= minDate)) return false;
    if (regions.size && !regions.has(regionOf(j))) return false;
    if (prefs.origin && prefs.radiusKm) {
      const km = distanceKm(j);
      if (km == null || km > prefs.radiusKm) return false;
    }
    if (prefs.origin && prefs.maxMin) {
      if (!coordsOf(j)) return false;
      const min = travelOf(j);
      // Ancora da calcolare: resta visibile finché il tempo non arriva.
      if (min === null || (min !== undefined && min > prefs.maxMin)) return false;
    }
    return true;
  });

  const byText = k => (a, b) => (a[k] ?? '').localeCompare(b[k] ?? '', 'it', { sensitivity: 'base' });
  const byNum = f => (a, b) => (f(a) ?? Infinity) - (f(b) ?? Infinity);
  const sorters = {
    newest: (a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0),
    oldest: byNum(j => j.listedAt),
    company: byText('company'),
    title: byText('title'),
    distance: byNum(distanceKm),
    time: byNum(travelOf),
  };
  return jobs.sort(sorters[prefs.sort] ?? sorters.newest);
}

function renderRegions() {
  const counts = new Map();
  for (const j of Object.values(state.jobs)) {
    const r = regionOf(j);
    if (r) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'it'));
  const selected = new Set(prefs.regions);
  $('#regions-list').innerHTML = names.length
    ? names
        .map(
          r =>
            `<label><input type="checkbox" value="${esc(r)}"${selected.has(r) ? ' checked' : ''}>${esc(r)}<span class="count">${counts.get(r)}</span></label>`,
        )
        .join('')
    : '<p class="empty">Le regioni compaiono man mano che le località vengono trovate.</p>';
  $('#regions-label').textContent = prefs.regions.length ? prefs.regions.join(', ') : 'tutte';
}

function renderOrigin() {
  document.body.classList.toggle('picking', picking);
  $('#pick').textContent = picking
    ? 'Clicca sulla mappa…'
    : prefs.origin
      ? 'Sposta il punto'
      : 'Scegli punto sulla mappa';
  $('#unpick').hidden = !prefs.origin;

  if (prefs.origin) {
    const ll = [prefs.origin.lat, prefs.origin.lon];
    if (!originMarker) {
      originMarker = L.marker(ll, {
        draggable: true,
        icon: L.divIcon({ className: '', html: '<div class="origin-pin"></div>', iconSize: [18, 18] }),
        title: 'Punto di partenza (trascinalo per spostarlo)',
        zIndexOffset: 1000,
      }).addTo(map);
      originMarker.on('dragend', () => {
        const p = originMarker.getLatLng();
        setOrigin(p.lat, p.lng);
      });
    } else originMarker.setLatLng(ll);

    if (prefs.radiusKm) {
      if (!radiusCircle)
        radiusCircle = L.circle(ll, {
          radius: 0,
          color: '#cc1016',
          weight: 1,
          fillOpacity: 0.05,
          interactive: false,
        }).addTo(map);
      radiusCircle.setLatLng(ll).setRadius(prefs.radiusKm * 1000);
    } else if (radiusCircle) {
      radiusCircle.remove();
      radiusCircle = null;
    }
  } else {
    originMarker?.remove();
    originMarker = null;
    radiusCircle?.remove();
    radiusCircle = null;
  }

  const needTravel = prefs.origin && (prefs.maxMin || prefs.sort === 'time');
  $('#origin-status').textContent = addressNote
    ? addressNote
    : !prefs.origin
      ? 'Scegli un punto per filtrare o ordinare per distanza e tempo in auto.'
      : travelBusy && needTravel
        ? 'Calcolo dei tempi in auto in corso…'
        : needTravel
          ? 'Tempi in auto calcolati con OSRM (stima, senza traffico).'
          : "Distanze in linea d'aria dal punto scelto.";
}

function render() {
  const jobs = filtered();
  redrawing = true; // clearLayers chiude il popup aperto: non è l'utente a chiuderlo
  cluster.clearLayers();
  redrawing = false;
  markers = new Map();
  listEl.textContent = '';

  for (const job of jobs) {
    const coords = coordsOf(job);
    if (coords) {
      const icon = L.divIcon({
        className: '',
        html: `<div class="pin" style="background:var(--${wpOf(job)})"></div>`,
        iconSize: [16, 16],
      });
      const m = L.marker(coords, { icon, title: job.title }).bindPopup(() => popupHtml(job));
      m.on('popupopen', () => (openJobId = job.id));
      m.on('popupclose', () => {
        if (!redrawing) openJobId = null;
      });
      markers.set(job.id, m);
      cluster.addLayer(m);
    }

    const mark = state.marks[job.id];
    const li = document.createElement('li');
    li.classList.toggle('nogeo', !coords);
    li.classList.toggle('hidden-job', mark === 'hidden');
    li.innerHTML = `${logoHtml(job)}<div>
      <div class="job-title">${esc(job.title)}${isNew(job) ? '<span class="new-tag">nuova</span>' : ''}</div>
      <div class="job-company">${esc(job.company)}</div>
      <div class="job-meta"><span class="dot ${wpOf(job)}"></span> ${metaHtml(job)}${coords ? '' : ` · ${geoPending(job) ? 'posizione in arrivo…' : 'posizione non trovata'}`}</div></div>
      <div class="mark-btns">
        <button type="button" class="mark${mark === 'star' ? ' on' : ''}" data-mark="star" title="${mark === 'star' ? 'Togli dalle preferite' : 'Aggiungi alle preferite'}">${mark === 'star' ? '★' : '☆'}</button>
        <button type="button" class="mark" data-mark="hidden" title="${mark === 'hidden' ? 'Mostra di nuovo' : 'Nascondi questa offerta'}">${mark === 'hidden' ? '↺' : '✕'}</button>
      </div>`;
    li.addEventListener('click', e => {
      const btn = e.target.closest('[data-mark]');
      if (btn) toggleMark(job.id, btn.dataset.mark);
      else focusJob(job);
    });
    listEl.append(li);
  }

  const all = Object.values(state.jobs);
  const pending = all.filter(geoPending).length;
  const places = new Set(all.map(j => j.geoQuery).filter(Boolean)).size;
  statusEl.textContent = all.length
    ? `${all.length} offerte · ${places} località · ${jobs.length} mostrate` +
      (pending ? ` · ${pending} in geolocalizzazione…` : '')
    : 'Nessuna offerta raccolta.';
  $('#empty').hidden = all.length > 0;

  renderRegions();
  renderOrigin();

  // Durante la geolocalizzazione si ridisegna ogni secondo: il popup aperto resta aperto.
  const open = openJobId && markers.get(openJobId);
  if (open && map.hasLayer(open)) {
    const popup = open.getPopup();
    popup.options.autoPan = false; // senza spostare la mappa che l'utente sta guardando
    open.openPopup();
    popup.options.autoPan = true;
  } else openJobId = null;

  if (!fitted && markers.size) {
    map.fitBounds(cluster.getBounds(), { padding: [40, 40], maxZoom: 10 });
    fitted = true;
  }
}

function focusJob(job) {
  const m = markers.get(job.id);
  if (m) cluster.zoomToShowLayer(m, () => m.openPopup());
  else window.open(job.url, '_blank', 'noopener');
}

async function toggleMark(id, kind) {
  const marks = { ...state.marks };
  if (marks[id] === kind) delete marks[id];
  else marks[id] = kind;
  await chrome.storage.local.set({ marks }); // onChanged aggiorna lo stato e ridisegna
}

// ---------- Tempi di percorso (OSRM) ----------

async function updateTravel() {
  const run = ++travelRun; // ogni chiamata annulla quella in corso
  if (!prefs.origin || !(prefs.maxMin || prefs.sort === 'time')) {
    travelBusy = false;
    return;
  }
  const origin = prefs.origin;
  const key = originKey();
  const todo = new Map(); // geoQuery -> coords
  for (const j of Object.values(state.jobs)) {
    const c = coordsOf(j);
    if (c && !travel.has(`${key}|${j.geoQuery}`)) todo.set(j.geoQuery, c);
  }
  if (!todo.size) {
    // Una chiamata precedente annullata a metà lascerebbe "Calcolo in corso…" per sempre.
    if (travelBusy) {
      travelBusy = false;
      renderOrigin();
    }
    return;
  }

  travelBusy = true;
  renderOrigin();
  const entries = [...todo];
  try {
    for (let i = 0; i < entries.length; i += OSRM_BATCH) {
      if (run !== travelRun) return; // il punto è cambiato: ricomincia la chiamata più recente
      const wait = lastOsrmAt + OSRM_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      if (run !== travelRun) return;
      lastOsrmAt = Date.now();
      const batch = entries.slice(i, i + OSRM_BATCH);
      const coords = [[origin.lat, origin.lon], ...batch.map(([, c]) => c)]
        .map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`)
        .join(';');
      const res = await fetch(`${OSRM}${coords}?sources=0&annotations=duration`);
      if (!res.ok) break; // rate limit o server non disponibile: si riprova al prossimo cambio
      const { durations } = await res.json();
      batch.forEach(([q], k) => {
        const s = durations?.[0]?.[k + 1];
        travel.set(`${key}|${q}`, s == null ? null : s / 60);
      });
      if (run === travelRun) render();
    }
  } catch {
    // rete assente: i tempi mancanti restano "da calcolare"
  } finally {
    if (run === travelRun) {
      travelBusy = false;
      render();
    }
  }
}

function setOrigin(lat, lon) {
  prefs.origin = { lat, lon };
  picking = false;
  addressNote = null;
  savePrefs();
  render();
  updateTravel();
}

// ---------- Preferenze dei filtri ----------

let saveTimer = null;
function savePrefs() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.local.set({ mapPrefs: prefs }), 300);
}

function applyPrefsToControls() {
  searchEl.value = prefs.q;
  wpBoxes.forEach(b => {
    b.checked = prefs.wps.includes(b.value);
  });
  $('#sort').value = prefs.sort;
  $('#posted').value = prefs.posted;
  $('#show').value = prefs.show;
  $('#hide-promoted').checked = prefs.hidePromoted;
  $('#radius').value = prefs.radiusKm ?? '';
  $('#maxmin').value = prefs.maxMin ?? '';
}

const onPref =
  (fn, { travelToo = false } = {}) =>
  () => {
    fn();
    savePrefs();
    render();
    if (travelToo) updateTravel();
  };
const numOrNull = el => (Number(el.value) > 0 ? Number(el.value) : null);

searchEl.addEventListener(
  'input',
  onPref(() => {
    prefs.q = searchEl.value;
  }),
);
wpBoxes.forEach(b =>
  b.addEventListener(
    'change',
    onPref(() => {
      prefs.wps = wpBoxes.filter(x => x.checked).map(x => x.value);
    }),
  ),
);
$('#sort').addEventListener(
  'change',
  onPref(
    () => {
      prefs.sort = $('#sort').value;
    },
    { travelToo: true },
  ),
);
$('#posted').addEventListener(
  'change',
  onPref(() => {
    prefs.posted = $('#posted').value;
  }),
);
$('#show').addEventListener(
  'change',
  onPref(() => {
    prefs.show = $('#show').value;
  }),
);
$('#hide-promoted').addEventListener(
  'change',
  onPref(() => {
    prefs.hidePromoted = $('#hide-promoted').checked;
  }),
);
$('#radius').addEventListener(
  'input',
  onPref(() => {
    prefs.radiusKm = numOrNull($('#radius'));
  }),
);
$('#maxmin').addEventListener(
  'change',
  onPref(
    () => {
      prefs.maxMin = numOrNull($('#maxmin'));
    },
    { travelToo: true },
  ),
);
$('#regions-list').addEventListener(
  'change',
  onPref(() => {
    prefs.regions = [...document.querySelectorAll('#regions-list input:checked')].map(b => b.value);
  }),
);
document.addEventListener('click', e => {
  if (!e.target.closest('#regions')) $('#regions').open = false;
});

$('#pick').addEventListener('click', () => {
  picking = !picking;
  addressNote = null;
  renderOrigin();
});
$('#unpick').addEventListener(
  'click',
  onPref(
    () => {
      prefs.origin = null;
      picking = false;
      addressNote = null;
    },
    { travelToo: true },
  ),
);
map.on('click', e => {
  if (picking) setOrigin(e.latlng.lat, e.latlng.lng);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && picking) {
    picking = false;
    renderOrigin();
  }
});

$('#address-form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('#address').value.trim();
  if (!text) return;
  const btn = $('#address-form button');
  btn.disabled = true;
  // renderOrigin() gira a ogni ridisegno (ogni secondo durante la geolocalizzazione): il
  // messaggio passa da addressNote, altrimenti verrebbe sovrascritto subito.
  addressNote = "Ricerca dell'indirizzo…";
  renderOrigin();
  const hit = await searchPlace(text);
  btn.disabled = false;
  if (!hit) {
    addressNote =
      hit === null
        ? 'Indirizzo non trovato: prova ad aggiungere la città.'
        : 'Ricerca non riuscita (rete o troppe richieste): riprova tra poco.';
    renderOrigin();
    return;
  }
  setOrigin(hit.lat, hit.lon);
  map.setView([hit.lat, hit.lon], Math.max(map.getZoom(), 10));
});

$('#reset').addEventListener(
  'click',
  onPref(() => {
    prefs = { ...DEFAULT_PREFS, origin: prefs.origin };
    applyPrefsToControls();
  }),
);

$('#clear').addEventListener('click', async () => {
  if (!confirm('Eliminare tutte le offerte raccolte? (la cache delle posizioni resta)')) return;
  fitted = false;
  await chrome.runtime.sendMessage({ type: 'clear' });
});

$('#export').addEventListener('click', () => {
  const cols = [
    'id',
    'title',
    'company',
    'location',
    'region',
    'workplaceLabel',
    'listedAt',
    'promoted',
    'mark',
    'lat',
    'lon',
    'distanceKm',
    'driveMin',
    'url',
  ];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = filtered().map(j => {
    const c = coordsOf(j) ?? [];
    const km = distanceKm(j);
    const min = travelOf(j);
    const r = {
      ...j,
      region: regionOf(j),
      listedAt: j.listedAt ? new Date(j.listedAt).toISOString().slice(0, 10) : '',
      promoted: j.promoted ? 'sì' : '',
      mark: { star: 'preferita', hidden: 'nascosta' }[state.marks[j.id]] ?? '',
      lat: c[0],
      lon: c[1],
      distanceKm: km != null ? Math.round(km) : '',
      driveMin: min != null ? Math.round(min) : '',
    };
    return cols.map(k => cell(r[k])).join(';');
  });
  const blob = new Blob(['﻿' + [cols.join(';'), ...rows].join('\r\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `linkemap-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Avvio e aggiornamenti dallo storage ----------

async function load() {
  const data = await chrome.storage.local.get(['jobs', GEOCACHE_KEY, 'marks', 'mapPrefs', 'importState']);
  state = {
    jobs: data.jobs ?? {},
    geocache: data[GEOCACHE_KEY] ?? {},
    marks: data.marks ?? {},
    lastImportAt: data.importState?.startedAt ?? null,
  };
  prefs = { ...DEFAULT_PREFS, ...data.mapPrefs };
  applyPrefsToControls();
  render();
  updateTravel();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const importStart = changes.importState?.newValue?.startedAt ?? null;
  const newImport = !!changes.importState && importStart !== state.lastImportAt;
  if (!changes.jobs && !changes[GEOCACHE_KEY] && !changes.marks && !newImport) return; // mapPrefs: già applicate
  if (newImport) state.lastImportAt = importStart;
  if (changes.jobs) state.jobs = changes.jobs.newValue ?? {};
  if (changes[GEOCACHE_KEY]) state.geocache = changes[GEOCACHE_KEY].newValue ?? {};
  if (changes.marks) state.marks = changes.marks.newValue ?? {};
  render();
  if (changes[GEOCACHE_KEY]) updateTravel();
});

load();
chrome.runtime.sendMessage({ type: 'geocode' }).catch(() => {});
