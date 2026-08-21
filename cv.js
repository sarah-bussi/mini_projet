(() => {
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
})();
