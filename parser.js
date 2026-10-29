// Converte la risposta "normalized" di voyagerJobsDashJobCards in una lista di offerte.

const CARD_TYPE = 'com.linkedin.voyager.dash.jobs.JobPostingCard';
const GEO_TYPE = 'com.linkedin.voyager.dash.common.Geo';

const WORKPLACE = {
  'in sede': 'onsite',
  'on-site': 'onsite',
  ibrido: 'hybrid',
  hybrid: 'hybrid',
  'da remoto': 'remote',
  remote: 'remote',
};

export function parseJobCards(json) {
  const included = Array.isArray(json?.included) ? json.included : [];
  const byUrn = new Map(included.map(o => [o.entityUrn, o]));
  const searchGeo = included.find(o => o.$type === GEO_TYPE)?.fullLocalizedName ?? null;

  return included
    .filter(o => o.$type === CARD_TYPE && o.title?.text && o['*jobPosting'])
    .map(card => {
      const id = card['*jobPosting'].split(':').pop();
      const rawLoc = (card.secondaryDescription?.text ?? '').trim();
      const wpMatch = rawLoc.match(/\s*\(([^)]*)\)\s*$/);
      const wpLabel = wpMatch?.[1] ?? null;
      const location = wpMatch ? rawLoc.slice(0, wpMatch.index).trim() : rawLoc;

      const companyUrn = card.logo?.attributes?.[0]?.detailDataUnion?.companyLogo;
      const company = companyUrn ? byUrn.get(companyUrn) : null;

      return {
        id,
        title: card.title.text.trim(),
        company: card.primaryDescription?.text?.trim() ?? '',
        companyUrl: card.logo?.actionTarget ?? null,
        location,
        searchGeo,
        workplaceLabel: wpLabel,
        workplace: WORKPLACE[wpLabel?.toLowerCase()] ?? null,
        logo: pickLogo(company?.logo?.vectorImage),
        listedAt: card.footerItems?.find(f => f.type === 'LISTED_DATE')?.timeAt ?? null,
        promoted: !!card.footerItems?.some(f => f.type === 'PROMOTED'),
        url: `https://www.linkedin.com/jobs/view/${id}/`,
      };
    });
}

// La variante "Lite" della stessa API restituisce card senza luogo né logo:
// un campo vuoto non deve mai sovrascrivere un valore già noto.
export function mergeJob(prev, next) {
  if (!prev) return next;
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  }
  return out;
}

function pickLogo(img) {
  if (!img?.rootUrl || !img.artifacts?.length) return null;
  const art =
    [...img.artifacts].sort((a, b) => a.width - b.width).find(a => a.width >= 100) ?? img.artifacts[0];
  return img.rootUrl + art.fileIdentifyingUrlPathSegment;
}
