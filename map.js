/* global L */
const WP_LABEL = { onsite: 'In sede', hybrid: 'Ibrido', remote: 'Da remoto', unknown: 'N/D' };

const map = L.map('map', { zoomControl: true }).setView([42.5, 12.5], 6);
// Una pagina chrome-extension:// non invia il Referer: tile.openstreetmap.org risponde 403
// e CARTO restituisce tile "API KEY REQUIRED". Le basemap Esri funzionano senza Referer.
// Basemap grigio neutro (come le superfici di LinkedIn) così i segnaposto blu risaltano.
const tone = matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
L.tileLayer(`${ESRI}/World_${tone}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
  maxZoom: 16,
  attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
}).addTo(map);
L.tileLayer(`${ESRI}/World_${tone}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16 }).addTo(map);

const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);

const $ = sel => document.querySelector(sel);
const listEl = $('#list');
const statusEl = $('#status');
const searchEl = $('#search');
const wpBoxes = [...document.querySelectorAll('.chips input')];

let state = { jobs: {}, geocache: {} };
let markers = new Map();
let fitted = false;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const wpOf = job => job.workplace ?? 'unknown';
const geoPending = job => !!job.geoQuery && !(job.geoQuery in state.geocache);
const coordsOf = job => {
  const g = job.geoQuery && state.geocache[job.geoQuery];
  return g && !g.fail ? [g.lat, g.lon] : null;
};

function relDate(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return `${days} giorni fa`;
  return new Date(ts).toLocaleDateString('it-IT');
}

function logoHtml(job) {
  return job.logo
    ? `<img class="logo" src="${esc(job.logo)}" alt="" loading="lazy">`
    : '<span class="logo empty"></span>';
}

function metaHtml(job) {
  return [job.location, WP_LABEL[wpOf(job)], relDate(job.listedAt)].filter(Boolean).map(esc).join(' · ');
}

function popupHtml(job) {
  return `<div class="popup">${logoHtml(job)}<div>
    <a href="${esc(job.url)}" target="_blank" rel="noopener">${esc(job.title)}</a>
    <div class="job-company">${esc(job.company)}</div>
    <div class="job-meta">${metaHtml(job)}</div></div></div>`;
}

function filtered() {
  const q = searchEl.value.trim().toLowerCase();
  const wps = new Set(wpBoxes.filter(b => b.checked).map(b => b.value));
  return Object.values(state.jobs)
    .filter(j => wps.has(wpOf(j)))
    .filter(j => !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q))
    .sort((a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0));
}

function render() {
  const jobs = filtered();
  cluster.clearLayers();
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
      const m = L.marker(coords, { icon, title: job.title }).bindPopup(popupHtml(job));
      markers.set(job.id, m);
      cluster.addLayer(m);
    }

    const li = document.createElement('li');
    if (!coords) li.className = 'nogeo';
    li.innerHTML = `${logoHtml(job)}<div>
      <div class="job-title">${esc(job.title)}</div>
      <div class="job-company">${esc(job.company)}</div>
      <div class="job-meta"><span class="dot ${wpOf(job)}"></span> ${metaHtml(job)}${coords ? '' : ` · ${geoPending(job) ? 'posizione in arrivo…' : 'posizione non trovata'}`}</div></div>`;
    li.addEventListener('click', () => focusJob(job));
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

async function load() {
  const { jobs = {}, geocache = {} } = await chrome.storage.local.get(['jobs', 'geocache']);
  state = { jobs, geocache };
  render();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.jobs) state.jobs = changes.jobs.newValue ?? {};
  if (changes.geocache) state.geocache = changes.geocache.newValue ?? {};
  render();
});

searchEl.addEventListener('input', render);
wpBoxes.forEach(b => b.addEventListener('change', render));

$('#clear').addEventListener('click', async () => {
  if (!confirm('Eliminare tutte le offerte raccolte? (la cache delle posizioni resta)')) return;
  fitted = false;
  await chrome.runtime.sendMessage({ type: 'clear' });
});

$('#export').addEventListener('click', () => {
  const cols = ['id', 'title', 'company', 'location', 'workplaceLabel', 'listedAt', 'lat', 'lon', 'url'];
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = filtered().map(j => {
    const c = coordsOf(j) ?? [];
    const r = { ...j, listedAt: j.listedAt ? new Date(j.listedAt).toISOString().slice(0, 10) : '', lat: c[0], lon: c[1] };
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

load();
chrome.runtime.sendMessage({ type: 'geocode' }).catch(() => {});
