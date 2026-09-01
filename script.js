(() => {
  const root = document.documentElement;

  ['modals.css', 'recommandations.css'].forEach((href) => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  });

  const guidingPrinciple = document.querySelector('.panel-quote');
  if (guidingPrinciple) {
    guidingPrinciple.textContent = '« Partir des personnes, comprendre les obstacles et créer des solutions qui donnent davantage de choix, d’autonomie et de place à chacun. »';
  }

  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = themeButton?.querySelector('.theme-toggle-label');
  const savedTheme = localStorage.getItem('portfolio-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const isDark = theme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(isDark));
      themeButton.setAttribute('aria-label', isDark ? 'Activer le mode clair' : 'Activer le mode sombre');
    }
    if (themeLabel) themeLabel.textContent = isDark ? 'Contraste clair' : 'Contraste sombre';
  };

  applyTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'));

  themeButton?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem('portfolio-theme', nextTheme);
  });

  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const projectCards = [...document.querySelectorAll('.project-card[data-tags]')];
  const filterStatus = document.getElementById('filter-status');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter || 'all';
      filterButtons.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });

      let visibleCount = 0;
      projectCards.forEach((card) => {
        const tags = (card.dataset.tags || '').split(' ');
        const visible = filter === 'all' || tags.includes(filter);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      if (filterStatus) {
        filterStatus.textContent = `${visibleCount} projet${visibleCount > 1 ? 's' : ''} affiché${visibleCount > 1 ? 's' : ''}.`;
      }
    });
  });

  const recommendations = document.getElementById('recommandations');
  if (recommendations) {
    const container = recommendations.querySelector('.container');
    if (container) {
      container.innerHTML = `
        <div class="section-heading">
          <p class="eyebrow">Références professionnelles</p>
          <h2 id="recommendations-title">Lettres de recommandation</h2>
          <p>Les recommandations sont ajoutées individuellement après accord de leur signataire. Chaque lettre pourra être lue directement dans une version HTML accessible, avec le document original proposé séparément lorsqu'il est disponible.</p>
        </div>
        <div class="recommendation-card">
          <div>
            <h3>Recommandations professionnelles</h3>
            <p>Les premières lettres sont en cours d’intégration. Aucune coordonnée personnelle ou téléphonique des signataires n’est publiée sur le portfolio.</p>
          </div>
        </div>
        <div class="testimonial-subsection">
          <p class="eyebrow">Témoignages de collègues</p>
          <div class="recommendation-card" data-testimonial-cta>
            <div>
              <h3>Vous avez travaillé avec moi ?</h3>
              <p>Un questionnaire court permet de partager quelques phrases sur notre collaboration. Les coordonnées de vérification restent privées et aucun témoignage n'est publié automatiquement.</p>
            </div>
            <a class="button button-secondary" href="recommandation.html">Laisser un témoignage</a>
          </div>
        </div>`;
    }
  }

  let opener = null;
  const dialogButtons = [...document.querySelectorAll('[data-dialog]')];
  const dialogs = [...document.querySelectorAll('dialog.project-dialog')];

  const focusDialogHeading = (dialog) => {
    const labelledBy = dialog.getAttribute('aria-labelledby');
    const heading = labelledBy ? document.getElementById(labelledBy) : dialog.querySelector('h1, h2, h3');

    if (heading instanceof HTMLElement) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
      return;
    }

    const firstFocusable = dialog.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable instanceof HTMLElement) firstFocusable.focus();
  };

  dialogButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.dialog);
      if (!(dialog instanceof HTMLDialogElement)) return;
      opener = button;
      dialog.showModal();
      focusDialogHeading(dialog);
    });
  });

  dialogs.forEach((dialog) => {
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      const isBackdrop = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (isBackdrop) dialog.close();
    });

    dialog.addEventListener('close', () => {
      const labelledBy = dialog.getAttribute('aria-labelledby');
      const heading = labelledBy ? document.getElementById(labelledBy) : null;
      if (heading instanceof HTMLElement) heading.removeAttribute('tabindex');

      if (opener instanceof HTMLElement) opener.focus();
      opener = null;
    });
  });

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();