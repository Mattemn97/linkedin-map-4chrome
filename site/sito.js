// Sito di presentazione: il finto popup rilancia l'importazione nella demo e le scorciatoie impostano i
// filtri della mappa come farebbe l'utente (stessa origine: si usano i controlli veri dentro l'iframe).
const app = document.getElementById('demo-app');
const importa = document.getElementById('demo-importa');
const barra = document.getElementById('demo-barra');
const avanzamento = document.getElementById('demo-avanzamento');

const doc = () => app.contentDocument;
const campo = sel => doc()?.querySelector(sel);

function imposta(sel, valore, evento) {
  const el = campo(sel);
  if (!el) return;
  el.value = valore;
  el.dispatchEvent(new Event(evento, { bubbles: true }));
}

function spunta(el, acceso) {
  if (el.checked === acceso) return;
  el.checked = acceso;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function vicinoA(indirizzo, { km = '', minuti = '', ordine = 'distance' } = {}) {
  imposta('#radius', km, 'input');
  imposta('#maxmin', minuti, 'change');
  imposta('#sort', ordine, 'change');
  imposta('#address', indirizzo, 'input');
  campo('#address-form')?.requestSubmit();
}

const prove = {
  milano: () => vicinoA('Milano', { minuti: '45', ordine: 'time' }),
  bologna: () => vicinoA('Bologna', { km: '60' }),
  remoto: () =>
    doc()
      .querySelectorAll('.chips input[value]')
      .forEach(b => spunta(b, b.value === 'remote')),
  emilia: () => {
    const box = [...doc().querySelectorAll('#regions-list input')].find(b => b.value === 'Emilia-Romagna');
    if (box) spunta(box, true);
    campo('#regions').open = true;
  },
  settimana: () => imposta('#posted', '7', 'change'),
  azzera: () => {
    campo('#reset')?.click();
    if (campo('#unpick') && !campo('#unpick').hidden) campo('#unpick').click();
  },
};

document.querySelectorAll('[data-prova]').forEach(b =>
  b.addEventListener('click', () => {
    if (!doc()?.querySelector('#map')) return;
    prove[b.dataset.prova]();
    app.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }),
);

const testi = {
  pagine: (f, t) => `Scaricate ${f} offerte su ${t}…`,
  luoghi: (f, t) => `Offerte salvate. Località trovate: ${f} su ${t}…`,
  fine: () => 'Fatto: tutte le offerte sono sulla mappa.',
};

importa.addEventListener('click', async () => {
  const demo = app.contentWindow;
  if (!demo?.demoImporta) return;
  importa.disabled = true;
  barra.hidden = false;
  app.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await demo.demoImporta(({ fase, fatte, totale }) => {
    barra.value = totale ? fatte / totale : 0;
    avanzamento.textContent = testi[fase](fatte, totale);
  });
  importa.disabled = false;
});
