(() => {
  const root = document.documentElement;
  const isEnglish = (root.lang || '').toLowerCase().startsWith('en');
  const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2212]/g;

  const normalizeDashes = (scope = document) => {
    const walker = document.createTreeWalker(scope.body || scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) node.nodeValue = node.nodeValue.replace(DASHES, '-');
    scope.querySelectorAll?.('[aria-label],[title]').forEach((el) => {
      ['aria-label', 'title'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value) el.setAttribute(attr, value.replace(DASHES, '-'));
      });
    });
  };

  ['modals.css', 'recommandations.css'].forEach((href) => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  });

  const headerInner = document.querySelector('.header-inner');
  if (headerInner && !headerInner.querySelector('.language-switch')) {
    const languageSwitch = document.createElement('a');
    languageSwitch.className = 'button button-secondary language-switch';
    languageSwitch.href = isEnglish ? 'index.html' : 'index-en.html';
    languageSwitch.lang = isEnglish ? 'fr' : 'en';
    languageSwitch.hreflang = isEnglish ? 'fr' : 'en';
    languageSwitch.textContent = isEnglish ? 'FR' : 'EN';
    languageSwitch.setAttribute('aria-label', isEnglish ? 'Voir le portfolio en français' : 'View portfolio in English');
    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) headerInner.insertBefore(languageSwitch, themeButton);
    else headerInner.appendChild(languageSwitch);
  }

  const guidingPrinciple = document.querySelector('.panel-quote');
  if (guidingPrinciple) {
    guidingPrinciple.textContent = isEnglish
      ? '“Start with people, understand the barriers they face, and create solutions that give everyone more choice, autonomy and room to participate.”'
      : '« Partir des personnes, comprendre les obstacles et créer des solutions qui donnent davantage de choix, d’autonomie et de place à chacun. »';
  }

  const recommendationContacts = {
    audrey: { email: '', linkedin: '' },
    expert: { email: '', linkedin: '' },
    nplus1: { email: '', linkedin: '' }
  };

  const contactActions = (contact, label) => {
    const email = contact.email
      ? `<a class="button button-secondary" href="mailto:${contact.email}">${isEnglish ? 'Professional email' : 'Email professionnel'} - ${label}</a>`
      : `<span class="button button-secondary contact-placeholder" aria-disabled="true">${isEnglish ? 'Professional email to be added' : 'Email professionnel à renseigner'}</span>`;
    const linkedin = contact.linkedin
      ? `<a class="button button-secondary" href="${contact.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn - ${label}</a>`
      : `<span class="button button-secondary contact-placeholder" aria-disabled="true">${isEnglish ? 'LinkedIn to be added' : 'LinkedIn à renseigner'}</span>`;
    return `${email}${linkedin}`;
  };

  const audreyLetterFr = `À qui de droit,

C'est avec un enthousiasme sincère et sans la moindre réserve que je recommande aujourd'hui Sarah Bussi, que j'ai eu le privilège d'accompagner en tant que tutrice tout au long de son alternance au sein de notre équipe.

Au cours de ces derniers mois, Sarah s'est révélée être bien plus qu'une simple alternante. Elle a rapidement démontré des qualités professionnelles et humaines remarquables qui lui ont permis de s'imposer comme une collaboratrice de confiance et un véritable atout pour notre équipe.

Dès son arrivée, Sarah a fait preuve d'une capacité d'adaptation exceptionnelle. Grâce à son intelligence, son sens de l'observation et sa remarquable faculté d'apprentissage, elle s'est approprié son environnement de travail et ses missions en un temps extrêmement court. Là où une période d'accompagnement prolongée est souvent nécessaire, Sarah a gagné en autonomie en seulement quelques semaines et a su prendre en charge ses sujets avec une maturité professionnelle impressionnante.

Tout au long de son alternance, elle a réalisé un travail d'une qualité exemplaire. Rigoureuse, méthodique et particulièrement organisée, elle sait analyser les situations avec pertinence, identifier les enjeux importants et proposer des solutions concrètes et efficaces. Sa capacité à produire des livrables fiables et de grande qualité, tout en respectant systématiquement les délais, force le respect.

Sarah possède également une curiosité intellectuelle rare et une véritable envie d'apprendre. Elle ne se contente jamais d'exécuter ce qui lui est demandé : elle cherche à comprendre, à approfondir et à améliorer l'existant. Cette posture lui a permis de monter en compétences à une vitesse remarquable, notamment sur les sujets liés à l'accessibilité numérique, domaine exigeant qui requiert à la fois rigueur, expertise technique et sens de l'analyse.

Au-delà de ses excellentes compétences professionnelles, Sarah se distingue par des qualités humaines exceptionnelles. Toujours positive, souriante et bienveillante, elle crée naturellement des relations de confiance avec ses interlocuteurs. Son écoute, son respect des autres et son esprit collaboratif ont fait d'elle une personne particulièrement appréciée de l'ensemble de l'équipe. Son enthousiasme communicatif et son attitude constructive contribuent chaque jour à créer un environnement de travail agréable et stimulant.

J'ai également été particulièrement impressionnée par sa capacité à prendre en compte les retours qui lui étaient formulés. Sarah accueille les remarques avec intelligence et humilité, les transforme très rapidement en axes de progression et les met en œuvre avec une efficacité remarquable. Cette maturité et cette capacité à se remettre en question constituent selon moi des qualités essentielles pour construire une carrière durable et ambitieuse.

Au fil de son alternance, Sarah a démontré une combinaison rare de compétences : autonomie, professionnalisme, rigueur, esprit d'initiative, sens des responsabilités, capacité d'analyse, adaptabilité et intelligence relationnelle. Elle fait partie de ces profils que l'on rencontre peu et dont on mesure immédiatement la valeur lorsqu'ils rejoignent une équipe.

S'il avait existé une opportunité de recrutement à l'issue de son alternance, je n'aurais eu aucune hésitation à soutenir sa candidature. Malheureusement, nos contraintes budgétaires ne permettent pas aujourd'hui l'ouverture d'un poste. Cette situation ne reflète en rien l'excellence de son travail ni le potentiel exceptionnel qu'elle a démontré.

Je suis convaincue que Sarah saura réussir brillamment dans les responsabilités qui lui seront confiées et qu'elle apportera une réelle valeur ajoutée à toute organisation qui aura la chance de l'accueillir. Son professionnalisme, son engagement, son intelligence et ses qualités humaines lui promettent un très bel avenir professionnel.

C'est donc avec la plus grande conviction et les plus vives recommandations que je vous recommande Sarah. Je suis certaine qu'elle saura dépasser vos attentes comme elle a su dépasser les nôtres.

Je la recommande sans aucune réserve et avec le plus haut niveau de confiance.

Bien cordialement,
Audrey GAMBS
CDP Qualité CX & Accessibilité
SNCF Connect & Tech`;

  const audreyLetterEn = `To whom it may concern,

It is my great pleasure to recommend Sarah Bussi, whom I had the opportunity to mentor throughout her work-study placement within our team.

Sarah quickly stood out for both her professional and interpersonal qualities. She learned complex digital accessibility topics very quickly and reached a remarkable level of autonomy within only a few weeks. Rigorous, organised and reliable, she consistently delivers high-quality work while meeting deadlines.

Beyond her technical abilities, Sarah demonstrates strong professionalism. She is curious, proactive and solution-oriented, and she constantly looks for ways to learn and improve existing practices. She analyses situations thoughtfully, proposes appropriate solutions and turns feedback into concrete progress with speed and maturity.

Sarah is also highly appreciated by colleagues and management for her interpersonal skills, kindness and enthusiasm. Her positive attitude and collaborative approach make her a trusted and valued team member.

If a position had been available at the end of her placement, I would have supported her application without hesitation. Our current budget constraints do not allow us to open such a position and do not reflect the quality of her work or her potential.

I recommend Sarah without reservation and with the highest level of confidence.

Kind regards,
Audrey GAMBS
CDP Qualité CX & Accessibilité
SNCF Connect & Tech`;

  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = themeButton?.querySelector('.theme-toggle-label');
  const savedTheme = localStorage.getItem('portfolio-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const isDark = theme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(isDark));
      themeButton.setAttribute('aria-label', isEnglish
        ? (isDark ? 'Switch to light mode' : 'Switch to dark mode')
        : (isDark ? 'Activer le mode clair' : 'Activer le mode sombre'));
    }
    if (themeLabel) themeLabel.textContent = isEnglish
      ? (isDark ? 'Light mode' : 'Dark mode')
      : (isDark ? 'Contraste clair' : 'Contraste sombre');
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
        filterStatus.textContent = isEnglish
          ? `${visibleCount} project${visibleCount === 1 ? '' : 's'} displayed.`
          : `${visibleCount} projet${visibleCount > 1 ? 's' : ''} affiché${visibleCount > 1 ? 's' : ''}.`;
      }
    });
  });

  const recommendations = document.getElementById('recommandations');
  if (recommendations) {
    const container = recommendations.querySelector('.container');
    if (container) {
      container.innerHTML = isEnglish ? `
        <div class="section-heading">
          <p class="eyebrow">Professional references</p>
          <h2 id="recommendations-title">Recommendation letters</h2>
          <p>Professional recommendations from people who directly supervised or worked with me. Audrey Gambs' recommendation is available below in a concise English version.</p>
        </div>
        <div class="recommendations-grid" aria-label="Professional recommendations">
          <article class="recommender-card"><p class="recommender-role">Work-study mentor</p><h3>Audrey Gambs</h3><p><strong>CDP Qualité CX & Accessibilité - SNCF Connect & Tech</strong></p><p>Recommendation covering autonomy, learning ability, reliability, accessibility expertise and teamwork.</p><button class="project-button" type="button" data-dialog="dialog-rec-manager">Read recommendation</button></article>
          <article class="recommender-card"><p class="recommender-role">Digital accessibility expert</p><h3>Accessibility expertise</h3><p>Recommendation to be added.</p><button class="project-button" type="button" data-dialog="dialog-rec-expert">View details</button></article>
          <article class="recommender-card"><p class="recommender-role">Senior manager</p><h3>Management & product perspective</h3><p>Recommendation to be added.</p><button class="project-button" type="button" data-dialog="dialog-rec-nplus1">View details</button></article>
        </div>
        <p class="recommendation-note">Phone numbers are not published. Professional email and LinkedIn links will only be displayed with each signatory's consent.</p>` : `
        <div class="section-heading">
          <p class="eyebrow">Références professionnelles</p>
          <h2 id="recommendations-title">Lettres de recommandation</h2>
          <p>Des recommandations de personnes ayant directement encadré ou travaillé avec moi. La lettre complète d'Audrey Gambs est disponible ci-dessous.</p>
        </div>
        <div class="recommendations-grid" aria-label="Recommandations professionnelles">
          <article class="recommender-card"><p class="recommender-role">Tutrice d'alternance</p><h3>Audrey Gambs</h3><p><strong>CDP Qualité CX & Accessibilité - SNCF Connect & Tech</strong></p><p>Recommandation portant notamment sur mon autonomie, ma capacité d'apprentissage, ma rigueur, l'accessibilité numérique et mon travail en équipe.</p><button class="project-button" type="button" data-dialog="dialog-rec-manager">Lire la lettre complète</button></article>
          <article class="recommender-card"><p class="recommender-role">Expert accessibilité numérique</p><h3>Expertise accessibilité</h3><p>Recommandation à intégrer.</p><button class="project-button" type="button" data-dialog="dialog-rec-expert">Voir le détail</button></article>
          <article class="recommender-card"><p class="recommender-role">Responsable N+1</p><h3>Encadrement & vision produit</h3><p>Recommandation à intégrer.</p><button class="project-button" type="button" data-dialog="dialog-rec-nplus1">Voir le détail</button></article>
        </div>
        <p class="recommendation-note">Les numéros de téléphone ne sont pas publiés. L'email professionnel et LinkedIn ne seront affichés qu'avec l'accord de chaque signataire.</p>
        <div class="testimonial-subsection"><p class="eyebrow">Témoignages de collègues</p><div class="recommendation-card" data-testimonial-cta><div><h3>Vous avez travaillé avec moi ?</h3><p>Un questionnaire court permet de partager quelques phrases sur notre collaboration. Les coordonnées de vérification restent privées et aucun témoignage n'est publié automatiquement.</p></div><a class="button button-secondary" href="recommandation.html">Laisser un témoignage</a></div></div>`;
    }

    document.body.insertAdjacentHTML('beforeend', `
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-manager" aria-labelledby="dialog-rec-manager-title">
        <div class="dialog-head"><div><p class="eyebrow">${isEnglish ? 'Professional recommendation' : 'Recommandation professionnelle'}</p><h2 id="dialog-rec-manager-title">Audrey Gambs</h2><p>${isEnglish ? 'Work-study mentor' : "Tutrice d'alternance"} - CDP Qualité CX & Accessibilité - SNCF Connect & Tech</p></div><button class="dialog-close" type="button" data-close aria-label="${isEnglish ? 'Close Audrey Gambs recommendation' : "Fermer la lettre d'Audrey Gambs"}">×</button></div>
        <div class="letter-body"><h3>${isEnglish ? 'Concise English version' : 'Lettre complète'}</h3><p>${isEnglish ? audreyLetterEn : audreyLetterFr}</p></div>
        <p class="privacy-note">${isEnglish ? 'Professional contact details will only be published with the signatory’s consent. No phone number is displayed.' : "Les coordonnées professionnelles ne seront publiées qu'avec l'accord de la signataire. Aucun numéro de téléphone n'est affiché."}</p>
        <div class="recommendation-actions">${contactActions(recommendationContacts.audrey, 'Audrey Gambs')}</div>
      </dialog>
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-expert" aria-labelledby="dialog-rec-expert-title"><div class="dialog-head"><div><p class="eyebrow">${isEnglish ? 'Professional recommendation' : 'Recommandation professionnelle'}</p><h2 id="dialog-rec-expert-title">${isEnglish ? 'Digital accessibility expert' : 'Expert accessibilité numérique'}</h2></div><button class="dialog-close" type="button" data-close aria-label="${isEnglish ? 'Close recommendation' : 'Fermer la recommandation'}">×</button></div><div class="letter-body"><p>${isEnglish ? 'Recommendation to be added.' : 'Recommandation à intégrer.'}</p></div></dialog>
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-nplus1" aria-labelledby="dialog-rec-nplus1-title"><div class="dialog-head"><div><p class="eyebrow">${isEnglish ? 'Professional recommendation' : 'Recommandation professionnelle'}</p><h2 id="dialog-rec-nplus1-title">${isEnglish ? 'Senior manager' : 'Responsable N+1'}</h2></div><button class="dialog-close" type="button" data-close aria-label="${isEnglish ? 'Close recommendation' : 'Fermer la recommandation'}">×</button></div><div class="letter-body"><p>${isEnglish ? 'Recommendation to be added.' : 'Recommandation à intégrer.'}</p></div></dialog>`);
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
  normalizeDashes(document);
})();