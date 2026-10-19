import { isJobSearchUrl, isAiJobSearchUrl, classicSearchUrl } from './search.js';

const $ = id => document.getElementById(id);

let activeTab = null;

async function init() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onSearch = isJobSearchUrl(activeTab?.url);
  const onAi = isAiJobSearchUrl(activeTab?.url);
  $('search').hidden = !onSearch;
  $('ai-search').hidden = !onAi;
  $('not-search').hidden = onSearch || onAi;

  const { jobs = {}, importState = null } = await chrome.storage.local.get(['jobs', 'importState']);
  renderCount(jobs);
  renderImport(importState);
}

function renderCount(jobs) {
  const n = Object.keys(jobs ?? {}).length;
  $('count').textContent = n ? `${n} offerte salvate.` : 'Nessuna offerta salvata finora.';
}

function renderImport(s) {
  $('progress').hidden = !s;
  $('error').hidden = !s?.error;
  $('warning').hidden = !s?.ignored?.length;
  $('import').disabled = !!s?.running;
  if (!s) return;

  $('bar').max = s.total || 1;
  $('bar').value = s.total ? s.fetched : 0;
  $('progress-text').textContent = s.running
    ? `Importazione in corso… ${s.fetched}${s.total ? ` / ${s.total}` : ''} offerte`
    : `Ultima importazione: ${s.fetched} offerte lette${s.total ? ` su ${s.total}` : ''}.`;
  $('error').textContent = s.error ?? '';
  $('warning').textContent = s.ignored?.length
    ? `Filtri non supportati e ignorati: ${s.ignored.join(', ')}.`
    : '';
}

$('import').addEventListener('click', () => {
  $('import').disabled = true;
  chrome.runtime.sendMessage({ type: 'import', tabId: activeTab.id, url: activeTab.url });
});

$('open-classic').addEventListener('click', async () => {
  await chrome.tabs.update(activeTab.id, { url: classicSearchUrl(activeTab.url) });
  window.close();
});

$('open-map').addEventListener('click', async () => {
  const url = chrome.runtime.getURL('map.html');
  const [tab] = await chrome.tabs.query({ url });
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
  window.close();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.jobs) renderCount(changes.jobs.newValue);
  if (changes.importState) renderImport(changes.importState.newValue);
});

init();
