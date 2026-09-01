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
          <p>Des recommandations professionnelles de personnes avec qui j’ai travaillé, consultables directement dans le portfolio.</p>
        </div>

        <div class="recommendations-grid">
          <article class="recommender-card">
            <p class="recommender-role">Accessibilité numérique</p>
            <h3>Yannick Breavoine</h3>
            <p>Professionnel de l’accessibilité numérique et de la formation spécialisée, en collaboration régulière avec SNCF Connect.</p>
            <button class="project-button" type="button" data-dialog="dialog-rec-yannick">Lire la recommandation</button>
          </article>
        </div>

        <p class="recommendation-note">Les coordonnées personnelles des signataires ne sont pas publiées. Une mise en relation peut être transmise sur demande.</p>

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

    const recommendationDialog = `
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-yannick" aria-labelledby="dialog-rec-yannick-title">
        <div class="dialog-head">
          <div>
            <p class="eyebrow">Recommandation professionnelle · 1er septembre 2026</p>
            <h2 id="dialog-rec-yannick-title">Yannick Breavoine</h2>
            <p>Accessibilité numérique et formation spécialisée</p>
          </div>
          <button class="dialog-close" type="button" data-close aria-label="Fermer la recommandation de Yannick Breavoine">×</button>
        </div>

        <div class="letter-body">
          <p><strong>Madame, Monsieur,</strong></p>
          <p>Depuis un an, nous avons accueilli au sein de notre service Sarah en tant qu’alternante. Après une phase de transfert de connaissances avec sa prédécesseure, elle a rapidement montré des compétences qui nous ont été très utiles. Elle a rapidement été en mesure d’effectuer des tests avec un lecteur d’écran que ce soit sur mobile ou sur PC (NVDA). Lorsque je lui ai remonté des difficultés d’usage, elle a été en mesure d’analyser le code et de rédiger des tickets que les personnes qui ne sont pas expérimentées en accessibilité sont en mesure de comprendre.</p>
          <p>Mais là où Sarah a montré ses réelles qualités c’est dans la prise d’initiatives, dans la capacité à travailler en autonomie et dans son envie de porter un sujet qui est difficile à faire accepter au sein d’une grande entreprise. Bien sûr, elle doit encore gagner en confiance pour oser prendre la parole mais nul doute que ses compétences l’aideront dans ce sens.</p>
          <p>En résumé, je recommande grandement l’embauche de Sarah qui saura s’intégrer dans un collectif et qui saura faire preuve d’envie de progresser.</p>
          <p>Je reste à la disposition de toute personne qui souhaiterait échanger sur une embauche de Sarah qui, selon moi, serait une belle opportunité.</p>
          <p class="letter-signature"><strong>Yannick Breavoine</strong></p>
        </div>

        <p class="recommendation-note">Version publique : coordonnées personnelles retirées. Référence professionnelle disponible sur demande.</p>
      </dialog>`;

    document.body.insertAdjacentHTML('beforeend', recommendationDialog);
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