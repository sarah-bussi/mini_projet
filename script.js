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
          <p>Trois recommandations professionnelles prioritaires. Un clic ouvre la lettre intégrale. Les coordonnées directes des signataires ne sont pas publiées dans le code du site.</p>
        </div>
        <div class="recommendations-grid" aria-label="Recommandations professionnelles">
          <article class="recommender-card">
            <p class="recommender-role">Manager directe</p>
            <h3>Management accessibilité & qualité produit</h3>
            <p>Recommandation sur mon travail au quotidien, ma collaboration avec les équipes produit et mon autonomie.</p>
            <button class="project-button" type="button" data-dialog="dialog-rec-manager">Lire la lettre complète</button>
          </article>
          <article class="recommender-card">
            <p class="recommender-role">Expert accessibilité numérique</p>
            <h3>Expertise accessibilité</h3>
            <p>Recommandation centrée sur mes compétences d'audit, de test, d'analyse et d'accompagnement des corrections.</p>
            <button class="project-button" type="button" data-dialog="dialog-rec-expert">Lire la lettre complète</button>
          </article>
          <article class="recommender-card">
            <p class="recommender-role">Responsable N+1</p>
            <h3>Encadrement & vision produit</h3>
            <p>Recommandation portant sur mon positionnement professionnel, mon évolution et ma contribution au collectif.</p>
            <button class="project-button" type="button" data-dialog="dialog-rec-nplus1">Lire la lettre complète</button>
          </article>
        </div>
        <p class="recommendation-note">Les mises en relation sont possibles rapidement par email, téléphone ou LinkedIn, sans afficher publiquement les coordonnées privées des signataires.</p>
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

    const dialogsMarkup = `
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-manager" aria-labelledby="dialog-rec-manager-title">
        <div class="dialog-head"><div><p class="eyebrow">Recommandation professionnelle</p><h2 id="dialog-rec-manager-title">Manager directe</h2></div><button class="dialog-close" type="button" data-close aria-label="Fermer la lettre de la manager directe">×</button></div>
        <div class="letter-body"><h3>Lettre complète</h3><p>Le texte intégral de cette lettre sera affiché ici dès que le document définitif sera intégré au portfolio.</p></div>
        <p class="privacy-note">Coordonnées privées : la mise en relation passe par Sarah afin que l'adresse email, le numéro et l'URL LinkedIn ne soient pas exposés publiquement.</p>
        <div class="recommendation-actions">
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Manager%20directe%20-%20Email">Contact par email</a>
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Manager%20directe%20-%20Téléphone">Contact téléphonique</a>
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Manager%20directe%20-%20LinkedIn">LinkedIn</a>
        </div>
      </dialog>
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-expert" aria-labelledby="dialog-rec-expert-title">
        <div class="dialog-head"><div><p class="eyebrow">Recommandation professionnelle</p><h2 id="dialog-rec-expert-title">Expert accessibilité numérique</h2></div><button class="dialog-close" type="button" data-close aria-label="Fermer la lettre de l'expert accessibilité numérique">×</button></div>
        <div class="letter-body"><h3>Lettre complète</h3><p>Le texte intégral de cette lettre sera affiché ici dès que le document définitif sera intégré au portfolio.</p></div>
        <p class="privacy-note">Coordonnées privées : la mise en relation passe par Sarah afin que l'adresse email, le numéro et l'URL LinkedIn ne soient pas exposés publiquement.</p>
        <div class="recommendation-actions">
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Expert%20accessibilité%20-%20Email">Contact par email</a>
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Expert%20accessibilité%20-%20Téléphone">Contact téléphonique</a>
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Expert%20accessibilité%20-%20LinkedIn">LinkedIn</a>
        </div>
      </dialog>
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-nplus1" aria-labelledby="dialog-rec-nplus1-title">
        <div class="dialog-head"><div><p class="eyebrow">Recommandation professionnelle</p><h2 id="dialog-rec-nplus1-title">Responsable N+1</h2></div><button class="dialog-close" type="button" data-close aria-label="Fermer la lettre du responsable N+1">×</button></div>
        <div class="letter-body"><h3>Lettre complète</h3><p>Le texte intégral de cette lettre sera affiché ici dès que le document définitif sera intégré au portfolio.</p></div>
        <p class="privacy-note">Coordonnées privées : la mise en relation passe par Sarah afin que l'adresse email, le numéro et l'URL LinkedIn ne soient pas exposés publiquement.</p>
        <div class="recommendation-actions">
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Responsable%20N%2B1%20-%20Email">Contact par email</a>
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Responsable%20N%2B1%20-%20Téléphone">Contact téléphonique</a>
          <a class="button button-secondary" href="mailto:sarah.bussi2108@gmail.com?subject=Mise%20en%20relation%20-%20Responsable%20N%2B1%20-%20LinkedIn">LinkedIn</a>
        </div>
      </dialog>`;
    document.body.insertAdjacentHTML('beforeend', dialogsMarkup);
  }

  let opener = null;
  const dialogButtons = [...document.querySelectorAll('[data-dialog]')];
  const dialogs = [...document.querySelectorAll('dialog.project-dialog')];

  dialogButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.dialog);
      if (!(dialog instanceof HTMLDialogElement)) return;
      opener = button;
      dialog.showModal();
      dialog.querySelector('[data-close]')?.focus();
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
      if (opener instanceof HTMLElement) opener.focus();
      opener = null;
    });
  });

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();