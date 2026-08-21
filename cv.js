(() => {
  const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2212]/g;
  const normalizeDashes = (root = document) => {
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) node.nodeValue = node.nodeValue.replace(DASHES, '-');
    root.querySelectorAll?.('[aria-label],[title]').forEach((el) => {
      ['aria-label', 'title'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value) el.setAttribute(attr, value.replace(DASHES, '-'));
      });
    });
  };

  const isEnglish = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const printButton = document.getElementById('cv-print');
  printButton?.addEventListener('click', () => window.print());

  const headerInner = document.querySelector('.header-inner');
  if (headerInner && !headerInner.querySelector('.language-switch')) {
    const languageSwitch = document.createElement('a');
    languageSwitch.className = 'button button-secondary language-switch';
    languageSwitch.href = isEnglish ? 'cv.html' : 'cv-en.html';
    languageSwitch.lang = isEnglish ? 'fr' : 'en';
    languageSwitch.hreflang = isEnglish ? 'fr' : 'en';
    languageSwitch.textContent = isEnglish ? 'FR' : 'EN';
    languageSwitch.setAttribute('aria-label', isEnglish ? 'Voir le CV en français' : 'View CV in English');
    headerInner.appendChild(languageSwitch);
  }

  normalizeDashes(document);
})();
