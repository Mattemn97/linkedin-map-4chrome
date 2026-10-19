// Ricostruisce la chiamata voyagerJobsDashJobCards a partire dall'URL della ricerca
// (https://www.linkedin.com/jobs/search/?keywords=...&geoId=...&f_E=3,4&...).

export const DEFAULT_DECORATION = 'com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-221';
export const PAGE_SIZE = 25;
export const MAX_RESULTS = 1000; // LinkedIn non restituisce risultati oltre i primi 1000

// Parametro dell'URL della pagina -> nome del filtro nell'API.
const FILTERS = {
  f_E: 'experience',
  f_F: 'function',
  f_I: 'industry',
  f_JT: 'jobType',
  f_T: 'title',
  f_TPR: 'timePostedRange',
  f_WT: 'workplaceType',
  f_C: 'company',
  f_PP: 'populatedPlace',
  f_SB2: 'salaryBucketV2',
  f_AL: 'applyWithLinkedin',
  f_JIYN: 'earlyApplicant',
};

const parseUrl = url => { try { return new URL(url); } catch { return null; } };
const onLinkedIn = u => u?.hostname === 'www.linkedin.com';

// Ricerca classica: è l'unica che l'importazione sa tradurre nella chiamata API.
export function isJobSearchUrl(url) {
  const u = parseUrl(url);
  return onLinkedIn(u) && /^\/jobs\/search\/?$/.test(u.pathname);
}

// Ricerca con AI di LinkedIn (es. /jobs/search-results/): altro indirizzo, altra API.
export function isAiJobSearchUrl(url) {
  const u = parseUrl(url);
  return onLinkedIn(u) && u.pathname.startsWith('/jobs/search') && !isJobSearchUrl(url);
}

// La stessa ricerca riaperta in modalità classica, tenendo i parametri che la classica capisce.
export function classicSearchUrl(url) {
  const src = parseUrl(url)?.searchParams ?? new URLSearchParams();
  const out = new URLSearchParams();
  for (const [k, v] of src) {
    if (['keywords', 'geoId', 'location', 'distance', 'sortBy'].includes(k) || k.startsWith('f_')) out.set(k, v);
  }
  return `https://www.linkedin.com/jobs/search/?${out}`;
}

// Codifica un valore stringa per Rest.li 2.0: tutto ciò che non è alfanumerico va in %XX.
const enc = v => encodeURIComponent(v).replace(/[()'!*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const list = values => `List(${values.map(enc).join(',')})`;

// Ritorna { query, ignored } dove query è il valore Rest.li del parametro "query"
// e ignored elenca i filtri dell'URL che non sappiamo tradurre.
export function buildSearchQuery(pageUrl) {
  const params = new URL(pageUrl).searchParams;
  const parts = [`origin:${params.get('origin') || 'JOB_SEARCH_PAGE_JOB_FILTER'}`];
  const ignored = [];

  const keywords = params.get('keywords')?.trim();
  if (keywords) parts.push(`keywords:${enc(keywords)}`);

  const geoId = params.get('geoId');
  if (geoId) parts.push(`locationUnion:(geoId:${enc(geoId)})`);

  const filters = [];
  filters.push(`sortBy:${list([params.get('sortBy') || 'R'])}`);
  const distance = params.get('distance');
  if (distance) filters.push(`distance:${list([distance])}`);

  for (const [key, value] of params) {
    if (!key.startsWith('f_')) continue;
    const name = FILTERS[key];
    const values = value.split(',').map(s => s.trim()).filter(Boolean);
    if (!name) ignored.push(key);
    else if (values.length) filters.push(`${name}:${list(values)}`);
  }
  parts.push(`selectedFilters:(${filters.join(',')})`, 'spellCorrectionEnabled:true');

  return { query: `(${parts.join(',')})`, ignored };
}

export function buildApiUrl(query, start, decoration = DEFAULT_DECORATION) {
  return 'https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards' +
    `?decorationId=${decoration}&count=${PAGE_SIZE}&q=jobSearch&query=${query}&start=${start}`;
}
