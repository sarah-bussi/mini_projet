(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const isEnglish = (root.lang || "").toLowerCase().startsWith("en");
  const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2212]/g;

  const normalizeDashes = (scope = document) => {
    const walker = document.createTreeWalker(
      scope.body || scope,
      NodeFilter.SHOW_TEXT,
    );
    let node;
    while ((node = walker.nextNode()))
      node.nodeValue = node.nodeValue.replace(DASHES, "-");
    scope.querySelectorAll?.("[aria-label],[title]").forEach((el) => {
      ["aria-label", "title"].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value) el.setAttribute(attr, value.replace(DASHES, "-"));
      });
    });
  };

  ["modals.css", "recommandations.css?v=20260901-1"].forEach((href) => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  });

  const headerInner = document.querySelector(".header-inner");
  const headerTools = headerInner?.querySelector(".header-tools");
  if (headerInner && !headerInner.querySelector(".language-switch")) {
    const languageSwitch = document.createElement("a");
    languageSwitch.className = "button button-secondary language-switch";
    languageSwitch.href = isEnglish ? "index.html" : "index-en.html";
    languageSwitch.hreflang = isEnglish ? "fr" : "en";
    languageSwitch.textContent = isEnglish ? "FR" : "EN";
    languageSwitch.setAttribute(
      "aria-label",
      isEnglish ? "View portfolio in French" : "Voir le portfolio en anglais",
    );
    if (headerTools) {
      const languageItem = document.createElement("li");
      languageItem.appendChild(languageSwitch);
      headerTools.insertBefore(languageItem, headerTools.firstChild);
    } else {
      const themeButton = document.getElementById("theme-toggle");
      if (themeButton) headerInner.insertBefore(languageSwitch, themeButton);
      else headerInner.appendChild(languageSwitch);
    }
  }

  const siteHeader = document.querySelector(".site-header");
  const updateHeaderOffset = () => {
    if (!siteHeader) return;
    const offset = Math.ceil(siteHeader.getBoundingClientRect().height + 16);
    root.style.setProperty("--header-offset", `${offset}px`);
  };
  if (siteHeader) {
    updateHeaderOffset();
    if ("ResizeObserver" in window) {
      const headerObserver = new ResizeObserver(updateHeaderOffset);
      headerObserver.observe(siteHeader);
    } else {
      window.addEventListener("resize", updateHeaderOffset, { passive: true });
    }
  }

  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  const navToggleIcon = navToggle?.querySelector(".nav-toggle-icon");
  const mobileNavQuery = window.matchMedia("(max-width: 1180px)");

  const arrangeHeaderItems = () => {
    if (!headerInner || !navToggle || !mainNav) return;

    if (headerTools) {
      if (mobileNavQuery.matches) {
        headerInner.appendChild(headerTools);
        headerInner.appendChild(mainNav);
      } else {
        headerInner.insertBefore(mainNav, headerTools);
      }
      updateHeaderOffset();
      return;
    }

    const languageSwitch = headerInner.querySelector(".language-switch");
    const themeButton = document.getElementById("theme-toggle");
    if (mobileNavQuery.matches) {
      if (languageSwitch) headerInner.appendChild(languageSwitch);
      if (themeButton) headerInner.appendChild(themeButton);
      headerInner.appendChild(navToggle);
      headerInner.appendChild(mainNav);
    } else {
      const firstHeaderControl = languageSwitch || themeButton || navToggle;
      headerInner.insertBefore(mainNav, firstHeaderControl);
      if (languageSwitch && themeButton)
        headerInner.insertBefore(languageSwitch, themeButton);
      headerInner.appendChild(navToggle);
    }
    updateHeaderOffset();
  };

  arrangeHeaderItems();

  const setNavOpen = (open, returnFocus = false) => {
    if (!navToggle || !mainNav) return;
    const shouldOpen = mobileNavQuery.matches && open;
    mainNav.classList.toggle("is-open", shouldOpen);
    navToggle.setAttribute("aria-expanded", String(shouldOpen));
    navToggle.setAttribute(
      "aria-label",
      isEnglish
        ? shouldOpen
          ? "Close main menu"
          : "Open main menu"
        : shouldOpen
          ? "Fermer le menu principal"
          : "Ouvrir le menu principal",
    );
    if (navToggleIcon) navToggleIcon.textContent = shouldOpen ? "×" : "☰";
    updateHeaderOffset();
    if (returnFocus) navToggle.focus();
  };

  navToggle?.addEventListener("click", () => {
    setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
  });

  const focusNavDestination = (link) => {
    const targetId = decodeURIComponent(link.hash.slice(1));
    const target = targetId ? document.getElementById(targetId) : null;
    if (!(target instanceof HTMLElement)) {
      navToggle?.focus();
      return;
    }

    const hadTabindex = target.hasAttribute("tabindex");
    if (!hadTabindex) target.setAttribute("tabindex", "-1");
    window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      if (!hadTabindex) {
        target.addEventListener(
          "blur",
          () => target.removeAttribute("tabindex"),
          { once: true },
        );
      }
    });
  };

  mainNav?.querySelectorAll("a").forEach((link) => {
    let keyboardActivation = false;

    link.addEventListener("keydown", (event) => {
      if (event.key === "Enter") keyboardActivation = true;
      if (event.key === " ") {
        event.preventDefault();
        keyboardActivation = true;
        link.click();
      }
    });

    link.addEventListener("click", (event) => {
      if (!mobileNavQuery.matches) return;
      const shouldMoveFocus = keyboardActivation || event.detail === 0;
      keyboardActivation = false;
      setNavOpen(false);
      if (shouldMoveFocus) focusNavDestination(link);
    });

    link.addEventListener("blur", () => {
      keyboardActivation = false;
    });
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      navToggle?.getAttribute("aria-expanded") === "true"
    ) {
      setNavOpen(false, true);
    }
  });

  const syncMobileNav = () => {
    arrangeHeaderItems();
    setNavOpen(false);
  };
  if (typeof mobileNavQuery.addEventListener === "function") {
    mobileNavQuery.addEventListener("change", syncMobileNav);
  } else {
    mobileNavQuery.addListener(syncMobileNav);
  }

  const guidingPrinciple = document.querySelector(".panel-quote");
  if (guidingPrinciple) {
    guidingPrinciple.textContent = isEnglish
      ? "“Start with people, understand the barriers they face, and create solutions that give everyone more choice, autonomy and room to participate.”"
      : "« Partir des personnes, comprendre les obstacles et créer des solutions qui donnent davantage de choix, d’autonomie et de place à chacun. »";
  }

  const recommendationContacts = {
    audrey: { email: "", linkedin: "" },
    yannick: { email: "yannick@breavoine.net", linkedin: "" },
  };

  const contactActions = (contact, label) => {
    const actions = [];
    if (contact.email) {
      actions.push(
        `<a class="button button-secondary" href="mailto:${contact.email}" aria-label="${isEnglish ? "Email" : "Envoyer un e-mail à"} ${label}">${isEnglish ? "Email" : "E-mail"} : ${label}</a>`,
      );
    }
    if (contact.linkedin) {
      actions.push(
        `<a class="button button-secondary" href="${contact.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn : ${label}<span class="sr-only">${isEnglish ? ", opens in a new tab" : ", ouvre un nouvel onglet"}</span></a>`,
      );
    }
    return actions.length
      ? actions.join("")
      : `<p class="contact-unavailable">${isEnglish ? "Direct contact details are available on request." : "Coordonnées directes disponibles sur demande."}</p>`;
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

  const yannickLetterFr = `Madame, Monsieur,

Je suis non-voyant et travaille dans le domaine de l’accessibilité numérique, la formation spécialisée en lien avec la déficience visuelle. A ce titre, je collabore avec SNCF Connect depuis 9 ans notamment en y réalisant de manière hebdomadaire des tests pour vérifier l’utilisabilité du site et des applications.

Depuis un an, nous avons accueilli au sein de notre service Sarah en tant qu’alternante. Après une phase de transfert de connaissances avec sa prédécesseure, elle a rapidement montré des compétences qui nous ont été très utiles. Elle a rapidement été en mesure d’effectuer des tests avec un lecteur d’écran que ce soit sur mobile ou sur PC (NVDA). Lorsque je lui ai remonté des difficultés d’usage, elle a été en mesure d’analyser le code et de rédiger des tickets que les personnes qui ne sont pas expérimentées en accessibilité sont en mesure de comprendre.

Mais là où Sarah a montré ses réelles qualités c’est dans la prise d’initiatives, dans la capacité à travailler en autonomie et dans son envie de porter un sujet qui est difficile à faire accepter au sein d’une grande entreprise. Bien sûr, elle doit encore gagner en confiance pour oser prendre la parole mais nul doute que ses compétences l’aideront dans ce sens.

En résumé, je recommande grandement l’embauche de Sarah qui saura s’intégrer dans un collectif et qui saura faire preuve d’envie de progresser.

Je reste à la disposition de toute personne qui souhaiterait échanger sur une embauche de Sarah qui, selon moi, serait une belle opportunité.

Yannick BREAVOINE`;

  const yannickLetterEn = `Dear Sir or Madam,

I am blind and work in digital accessibility and specialist training related to visual impairment. In this capacity, I have collaborated with SNCF Connect for nine years, notably carrying out weekly tests to assess the usability of its website and applications.

Sarah joined our team as a work-study student one year ago. After a knowledge-transfer period with her predecessor, she quickly demonstrated skills that proved very useful to us. She rapidly became able to carry out screen-reader tests on both mobile and PC using NVDA. When I reported usability difficulties to her, she was able to analyse the code and write tickets that people without accessibility expertise could understand.

Sarah particularly stood out through her initiative, her ability to work independently and her willingness to champion a subject that can be difficult to establish within a large company. She still needs to gain confidence in speaking up, but I have no doubt that her skills will help her progress in this area.

In summary, I strongly recommend hiring Sarah. She will integrate well into a team and will continue to show a strong desire to learn and progress.

I remain available to anyone who would like to discuss Sarah's potential recruitment, which I believe would be an excellent opportunity.

Yannick BREAVOINE`;

  const formatLetter = (letter) =>
    letter
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");

  const themeButton = document.getElementById("theme-toggle");
  const themeLabel = themeButton?.querySelector(".theme-toggle-label");
  const savedTheme = localStorage.getItem("portfolio-theme");
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const isDark = theme === "dark";
    const visibleThemeLabel = isEnglish
      ? isDark
        ? "Light mode"
        : "Dark mode"
      : isDark
        ? "Contraste clair"
        : "Contraste sombre";
    if (themeLabel) themeLabel.textContent = visibleThemeLabel;
    if (themeButton) {
      themeButton.setAttribute(
        "aria-label",
        isEnglish
          ? `${visibleThemeLabel}: switch to ${isDark ? "light" : "dark"} mode`
          : `${visibleThemeLabel} : activer le mode ${isDark ? "clair" : "sombre"}`,
      );
    }
  };

  applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));
  themeButton?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("portfolio-theme", nextTheme);
  });

  const filterButtons = [...document.querySelectorAll(".filter-button")];
  const projectCards = [
    ...document.querySelectorAll(".project-card[data-tags]"),
  ];
  const filterStatus = document.getElementById("filter-status");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;

      const filter = button.dataset.filter || "all";
      const filterLabel = button.textContent.trim();
      filterButtons.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });

      let visibleCount = 0;
      projectCards.forEach((card) => {
        const categories = (card.dataset.tags || "").split(" ");
        const visible = filter === "all" || categories.includes(filter);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      if (filterStatus) {
        filterStatus.textContent = isEnglish
          ? `${filterLabel} selected. ${visibleCount} project${visibleCount === 1 ? "" : "s"} displayed.`
          : `${filterLabel} sélectionné. ${visibleCount} projet${visibleCount > 1 ? "s" : ""} affiché${visibleCount > 1 ? "s" : ""}.`;
      }
    });
  });

  const recommendations = document.getElementById("recommandations");
  if (recommendations) {
    const container = recommendations.querySelector(".container");
    if (container) {
      container.innerHTML = isEnglish
        ? `
        <div class="section-heading">
          <p class="eyebrow">Professional references</p>
          <h2 id="recommendations-title">Recommendation letters</h2>
          <p>Two recommendations from people who directly supervised or worked with me are available here.</p>
        </div>
        <div class="recommendations-grid" aria-label="Professional recommendations">
          <article class="recommender-card"><p class="recommender-role">Work-study mentor</p><h3>Audrey Gambs</h3><p><strong>CDP Qualité CX & Accessibilité, SNCF Connect & Tech</strong></p><p>Recommendation covering autonomy, learning ability, reliability, accessibility expertise and teamwork.</p><button class="project-button" type="button" data-dialog="dialog-rec-manager">Read recommendation<span class="sr-only"> from Audrey Gambs</span></button></article>
          <article class="recommender-card"><p class="recommender-role">Digital accessibility specialist</p><h3>Yannick Breavoine</h3><p><strong>Digital accessibility and specialist training</strong></p><p>Recommendation covering screen-reader testing, code analysis, clear accessibility tickets, initiative and autonomy.</p><button class="project-button" type="button" data-dialog="dialog-rec-yannick">Read recommendation<span class="sr-only"> from Yannick Breavoine</span></button></article>
        </div>
        <div class="testimonial-subsection">
          <p class="eyebrow">Colleague testimonials</p>
          <div class="recommendation-card" data-testimonial-cta><div><h3>Have you worked with me?</h3><p>Your testimonial is stored as pending, reviewed privately and displayed here only after approval. Verification details are never made public.</p></div><a class="button button-secondary" href="recommendation-en.html">Share a testimonial</a></div>
          <section class="testimonials-public" aria-labelledby="approved-testimonials-title"><h3 id="approved-testimonials-title">Approved testimonials</h3><div id="approved-testimonials"><p class="testimonials-empty">No approved colleague testimonials have been published yet.</p></div><div id="testimonials-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></section>
        </div>`
        : `
        <div class="section-heading">
          <p class="eyebrow">Références professionnelles</p>
          <h2 id="recommendations-title">Lettres de recommandation</h2>
          <p>Deux recommandations de personnes ayant directement encadré ou travaillé avec moi sont disponibles ici.</p>
        </div>
        <div class="recommendations-grid" aria-label="Recommandations professionnelles">
          <article class="recommender-card"><p class="recommender-role">Tutrice d'alternance</p><h3>Audrey Gambs</h3><p><strong>CDP Qualité CX & Accessibilité, SNCF Connect & Tech</strong></p><p>Recommandation portant notamment sur mon autonomie, ma capacité d'apprentissage, ma rigueur, l'accessibilité numérique et mon travail en équipe.</p><button class="project-button" type="button" data-dialog="dialog-rec-manager">Lire la lettre complète<span class="sr-only"> d’Audrey Gambs</span></button></article>
          <article class="recommender-card"><p class="recommender-role">Accessibilité numérique</p><h3>Yannick Breavoine</h3><p><strong>Accessibilité numérique et formation spécialisée</strong></p><p>Recommandation portant notamment sur les tests avec lecteur d'écran, l'analyse du code, la rédaction de tickets, la prise d'initiative et l'autonomie.</p><button class="project-button" type="button" data-dialog="dialog-rec-yannick">Lire la lettre complète<span class="sr-only"> de Yannick Breavoine</span></button></article>
        </div>
        <div class="testimonial-subsection">
          <p class="eyebrow">Témoignages de collègues</p>
          <div class="recommendation-card" data-testimonial-cta><div><h3>Vous avez travaillé avec moi ?</h3><p>Le témoignage est enregistré en attente, relu dans un espace privé puis affiché ici uniquement après validation. Les coordonnées de vérification ne sont jamais publiques.</p></div><a class="button button-secondary" href="recommendation.html">Laisser un témoignage</a></div>
          <section class="testimonials-public" aria-labelledby="approved-testimonials-title"><h3 id="approved-testimonials-title">Témoignages validés</h3><div id="approved-testimonials"><p class="testimonials-empty">Aucun témoignage de collègue validé n’est encore publié.</p></div><div id="testimonials-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div></section>
        </div>`;
    }

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-manager" aria-labelledby="dialog-rec-manager-title">
        <div class="dialog-head"><div><p class="eyebrow">${isEnglish ? "Professional recommendation" : "Recommandation professionnelle"}</p><h2 id="dialog-rec-manager-title">Audrey Gambs</h2><p>${isEnglish ? "Work-study mentor" : "Tutrice d'alternance"} - CDP Qualité CX & Accessibilité, SNCF Connect & Tech</p></div><button class="dialog-close" type="button" data-close aria-label="${isEnglish ? "Close Audrey Gambs recommendation" : "Fermer la lettre d'Audrey Gambs"}">×</button></div>
        <div class="letter-body"><h3>${isEnglish ? "Concise English version" : "Lettre complète"}</h3>${formatLetter(isEnglish ? audreyLetterEn : audreyLetterFr)}</div>
        <div class="recommendation-actions">${contactActions(recommendationContacts.audrey, "Audrey Gambs")}</div>
      </dialog>
      <dialog class="project-dialog recommender-dialog" id="dialog-rec-yannick" aria-labelledby="dialog-rec-yannick-title">
        <div class="dialog-head"><div><p class="eyebrow">${isEnglish ? "Professional recommendation - 1 September 2026" : "Recommandation professionnelle - 1er septembre 2026"}</p><h2 id="dialog-rec-yannick-title">Yannick Breavoine</h2><p>${isEnglish ? "Digital accessibility and specialist training" : "Accessibilité numérique et formation spécialisée"}</p></div><button class="dialog-close" type="button" data-close aria-label="${isEnglish ? "Close Yannick Breavoine recommendation" : "Fermer la lettre de Yannick Breavoine"}">×</button></div>
        <div class="letter-body"><h3>${isEnglish ? "English version" : "Lettre complète"}</h3>${formatLetter(isEnglish ? yannickLetterEn : yannickLetterFr)}</div>
        <div class="recommendation-actions">${contactActions(recommendationContacts.yannick, "Yannick Breavoine")}</div>
      </dialog>`,
    );
  }

  const dialogOpeners = new WeakMap();
  const dialogHeadings = new WeakMap();
  const dialogButtons = [...document.querySelectorAll("[data-dialog]")];
  const dialogs = [...document.querySelectorAll("dialog.project-dialog")];
  const dialogFocusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  const getDialogFocusableElements = (dialog) =>
    [...dialog.querySelectorAll(dialogFocusableSelector)].filter(
      (element) =>
        element.tabIndex >= 0 &&
        element.getAttribute("aria-hidden") !== "true" &&
        !element.closest("[hidden]") &&
        element.getClientRects().length > 0,
    );

  const focusDialogHeading = (dialog) => {
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const heading = labelledBy ? document.getElementById(labelledBy) : null;
    if (!(heading instanceof HTMLElement)) {
      getDialogFocusableElements(dialog)[0]?.focus({ preventScroll: true });
      return;
    }

    const hadTabindex = heading.hasAttribute("tabindex");
    dialogHeadings.set(dialog, { heading, hadTabindex });
    if (!hadTabindex) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };

  dialogButtons.forEach((button) => {
    const dialog = document.getElementById(button.dataset.dialog);
    if (!(dialog instanceof HTMLDialogElement)) return;

    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", dialog.id);
    button.addEventListener("click", (event) => {
      const trigger = event.currentTarget;
      if (!(trigger instanceof HTMLElement) || dialog.open) return;
      dialogOpeners.set(dialog, trigger);
      dialog.showModal();
      window.requestAnimationFrame(() => {
        if (dialog.open) focusDialogHeading(dialog);
      });
    });
  });

  dialogs.forEach((dialog) => {
    const closeButton = dialog.querySelector("[data-close]");
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.removeAttribute("autofocus");
      closeButton.addEventListener("click", () => dialog.close());
    }

    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;

      const focusableElements = getDialogFocusableElements(dialog);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements.at(-1);
      if (!firstFocusable || !lastFocusable) return;

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    });

    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      const isBackdrop =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (isBackdrop) dialog.close();
    });

    dialog.addEventListener("close", () => {
      const headingState = dialogHeadings.get(dialog);
      dialogHeadings.delete(dialog);
      if (
        headingState?.heading instanceof HTMLElement &&
        !headingState.hadTabindex
      ) {
        headingState.heading.removeAttribute("tabindex");
      }

      const trigger = dialogOpeners.get(dialog);
      dialogOpeners.delete(dialog);
      window.requestAnimationFrame(() => {
        if (
          trigger instanceof HTMLElement &&
          trigger.isConnected &&
          !document.querySelector("dialog[open]")
        ) {
          trigger.focus();
        }
      });
    });
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
  normalizeDashes(document);
})();