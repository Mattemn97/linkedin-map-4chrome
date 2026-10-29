// Località delle offerte -> chiave di geocoding "località|cc" e ricerca su Nominatim.
// Il codice paese ISO vincola Nominatim: senza, "Italy" può finire in Italy, Texas.

export const GEOCACHE_KEY = 'geocache2'; // v2: {lat, lon, cc, region}; "geocache" (v1) va scartata

// Nomi di paese in italiano e inglese -> codice ISO 3166-1 alpha-2.
const COUNTRIES = {
  it: ['italia', 'italy'],
  sm: ['san marino'],
  va: ['città del vaticano', 'vatican city'],
  ch: ['svizzera', 'switzerland', 'schweiz', 'suisse'],
  fr: ['francia', 'france'],
  de: ['germania', 'germany', 'deutschland'],
  at: ['austria', 'österreich'],
  es: ['spagna', 'spain', 'españa'],
  pt: ['portogallo', 'portugal'],
  gb: [
    'regno unito',
    'united kingdom',
    'uk',
    'inghilterra',
    'england',
    'scotland',
    'scozia',
    'wales',
    'galles',
  ],
  ie: ['irlanda', 'ireland'],
  nl: ['paesi bassi', 'olanda', 'netherlands', 'the netherlands', 'nederland'],
  be: ['belgio', 'belgium', 'belgië', 'belgique'],
  lu: ['lussemburgo', 'luxembourg'],
  dk: ['danimarca', 'denmark'],
  se: ['svezia', 'sweden'],
  no: ['norvegia', 'norway'],
  fi: ['finlandia', 'finland'],
  is: ['islanda', 'iceland'],
  pl: ['polonia', 'poland'],
  cz: ['repubblica ceca', 'czechia', 'czech republic'],
  sk: ['slovacchia', 'slovakia'],
  hu: ['ungheria', 'hungary'],
  si: ['slovenia'],
  hr: ['croazia', 'croatia'],
  ro: ['romania'],
  bg: ['bulgaria'],
  gr: ['grecia', 'greece'],
  mt: ['malta'],
  cy: ['cipro', 'cyprus'],
  ee: ['estonia'],
  lv: ['lettonia', 'latvia'],
  lt: ['lituania', 'lithuania'],
  rs: ['serbia'],
  al: ['albania'],
  ua: ['ucraina', 'ukraine'],
  tr: ['turchia', 'turkey', 'türkiye'],
  us: ['stati uniti', "stati uniti d'america", 'united states', 'united states of america', 'usa'],
  ca: ['canada'],
  mx: ['messico', 'mexico'],
  br: ['brasile', 'brazil'],
  ar: ['argentina'],
  au: ['australia'],
  nz: ['nuova zelanda', 'new zealand'],
  in: ['india'],
  cn: ['cina', 'china'],
  jp: ['giappone', 'japan'],
  sg: ['singapore'],
  ae: ['emirati arabi uniti', 'united arab emirates', 'uae'],
  il: ['israele', 'israel'],
  za: ['sudafrica', 'south africa'],
  eg: ['egitto', 'egypt'],
  ma: ['marocco', 'morocco'],
};
const BY_NAME = new Map(Object.entries(COUNTRIES).flatMap(([cc, names]) => names.map(n => [n, cc])));

export const countryCode = name =>
  BY_NAME.get(
    String(name ?? '')
      .trim()
      .toLowerCase(),
  ) ?? null;

const lastPart = s =>
  String(s ?? '')
    .split(',')
    .at(-1)
    .trim();

// Chiave di cache e di ricerca: toglie "Area metropolitana di" e simili, aggiunge il paese
// (della località o, se manca, della ricerca) come codice ISO dopo "|".
export function geocodeKey(job) {
  const loc = String(job.location ?? '')
    .replace(/^(Area metropolitana di|Grande|Greater)\s+/i, '')
    .replace(/\s+(Metropolitan Area|Area)$/i, '')
    .trim();
  if (!loc) return null;
  const cc = countryCode(lastPart(loc)) ?? countryCode(lastPart(job.searchGeo));
  return cc ? `${loc}|${cc}` : loc;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Ritorna {lat, lon, cc, region}, {fail: true} se il luogo non esiste, undefined se una richiesta
// è fallita (rete o rate limit: si riprova più tardi). `pause` separa le richieste (policy 1/s).
export async function geocode(key, pause) {
  const [loc, cc = null] = key.split('|');
  const parts = loc
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (countryCode(parts.at(-1))) parts.pop(); // il paese è già in cc
  const base = cc ? { countrycodes: cc } : {};

  const attempts = [];
  if (!parts.length) attempts.push({ ...base, q: loc, featureType: 'country' });
  else {
    // "Città, Regione": in testo libero Nominatim restituisce spesso la provincia omonima.
    if (parts.length >= 2) attempts.push({ ...base, city: parts[0], state: parts.at(-1) });
    attempts.push({ ...base, city: parts[0] });
    attempts.push({ ...base, q: parts.join(', ') });
  }

  for (const [i, params] of attempts.entries()) {
    if (i) await pause();
    const hit = await nominatim(params);
    if (hit !== null) return hit; // trovato, oppure undefined = errore
  }
  return { fail: true };
}

// Indirizzo scritto dall'utente (punto di partenza della mappa) -> {lat, lon, label}.
// Ritorna null se non trovato, undefined se la richiesta è fallita.
export async function searchPlace(text) {
  const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', 'accept-language': 'it', q: text });
  try {
    const res = await fetch(`${NOMINATIM}?${qs}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return undefined;
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name } : null;
  } catch {
    return undefined;
  }
}

async function nominatim(params) {
  const qs = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    'accept-language': 'it',
    ...params,
  });
  try {
    const res = await fetch(`${NOMINATIM}?${qs}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return undefined;
    const [hit] = await res.json();
    if (!hit) return null;
    const a = hit.address ?? {};
    return {
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      cc: a.country_code ?? null,
      region: hit.addresstype === 'country' ? null : (a.state ?? a.region ?? a.province ?? null),
    };
  } catch {
    return undefined;
  }
}
