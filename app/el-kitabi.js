// El kitabı dil değiştirici (CSP: harici betik, satır içi yok).
(() => {
  const KEY = 'dora_lang';
  const buttons = Array.from(document.querySelectorAll('[data-lang-btn]'));
  const docs = Array.from(document.querySelectorAll('[data-doc]'));
  if (!docs.length) return;

  function apply(lang) {
    const l = lang === 'en' ? 'en' : 'tr';
    document.documentElement.lang = l;
    for (const d of docs) d.hidden = d.dataset.doc !== l;
    for (const b of buttons) b.classList.toggle('on', b.dataset.langBtn === l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* gizli mod */
    }
  }

  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    saved = null;
  }
  const initial = saved ? saved : (navigator.language || 'tr').toLowerCase().startsWith('en') ? 'en' : 'tr';
  apply(initial);

  for (const b of buttons) {
    b.addEventListener('click', () => apply(b.dataset.langBtn));
  }
})();
