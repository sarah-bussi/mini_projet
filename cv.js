(() => {
  const root = document.documentElement;
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
    scope.querySelectorAll?.("[aria-label],[title]").forEach((element) => {
      ["aria-label", "title"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, value.replace(DASHES, "-"));
      });
    });
  };

  const findTimelineItem = (headingText) =>
    [...document.querySelectorAll(".timeline-item")].find(
      (item) => item.querySelector("h3")?.textContent.trim() === headingText,
    );

  const cleanExperienceMetadata = () => {
    const sncfItem = findTimelineItem("SNCF Connect & Tech");
    const sncfMeta = sncfItem?.querySelector(".timeline-meta");
    if (sncfMeta) {
      const paragraphs = [...sncfMeta.querySelectorAll("p")];
      paragraphs.slice(1).forEach((paragraph) => paragraph.remove());
    }
  };

  const fixProfileCopy = () => {
    document.querySelectorAll(".hero-copy").forEach((paragraph) => {
      paragraph.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = node.nodeValue.replace(
            /MIASHStechnologies/g,
            "MIASHS technologies",
          );
        }
      });
    });
  };

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

  const syncRecommendations = () => {
    const section = document.getElementById("references");
    const container = section?.querySelector(".cv-recommendations");
    const intro = section?.querySelector(".section-heading > p:last-child");
    if (!container) return;

    if (intro) {
      intro.textContent = isEnglish
        ? "The verified recommendations from Audrey Gambs and Yannick Breavoine can be read directly below."
        : "Les recommandations vérifiées d’Audrey Gambs et de Yannick Breavoine peuvent être consultées directement ci-dessous.";
    }

    container
      .querySelectorAll(".recommendation-pending")
      .forEach((element) => element.remove());

    if (!container.querySelector("#cv-rec-yannick")) {
      const details = document.createElement("details");
      details.className = "recommendation-details";
      details.id = "cv-rec-yannick";
      details.innerHTML = `
        <summary>
          <span>
            <strong>Yannick Breavoine</strong>
            <span>${
              isEnglish
                ? "Digital accessibility expert · Specialist in visual impairment"
                : "Expert en accessibilité numérique · Spécialiste de la déficience visuelle"
            }</span>
          </span>
        </summary>
        <div class="recommendation-details-body">
          ${formatLetter(isEnglish ? yannickLetterEn : yannickLetterFr)}
        </div>`;
      container.appendChild(details);
    }
  };

  const fixCvSemantics = () => {
    const brandLink = document.querySelector(".brand");
    if (brandLink?.hasAttribute("aria-label")) {
      brandLink.removeAttribute("aria-label");
      if (!brandLink.querySelector(".brand-destination-hint")) {
        const hint = document.createElement("span");
        hint.className = "sr-only brand-destination-hint";
        hint.textContent = isEnglish
          ? ", back to portfolio"
          : ", retour au portfolio";
        brandLink.appendChild(hint);
      }
    }

    const siteHeader = document.querySelector(".site-header");
    const skipLink = document.querySelector(".skip-link");
    if (siteHeader && skipLink && skipLink.parentElement === document.body) {
      siteHeader.prepend(skipLink);
    }

    document.querySelectorAll("article").forEach((article, index) => {
      if (
        article.hasAttribute("aria-label") ||
        article.hasAttribute("aria-labelledby")
      )
        return;

      const heading = article.querySelector("h1, h2, h3, h4, h5, h6");
      if (!heading) return;
      if (!heading.id) heading.id = `cv-article-heading-${index + 1}`;
      article.setAttribute("aria-labelledby", heading.id);
    });

    document
      .querySelectorAll(".recommendation-details-body[aria-label]")
      .forEach((element) => element.removeAttribute("aria-label"));
  };

  document
    .getElementById("cv-print")
    ?.addEventListener("click", () => window.print());

  const themeButton = document.getElementById("theme-toggle");
  const themeLabel = themeButton?.querySelector(".theme-toggle-label");
  const savedTheme = localStorage.getItem("portfolio-theme");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  const initialTheme =
    savedTheme === "dark" || savedTheme === "light" ? savedTheme : systemTheme;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const isDark = theme === "dark";
    const visibleLabel = isEnglish
      ? isDark
        ? "Light mode"
        : "Dark mode"
      : isDark
        ? "Contraste clair"
        : "Contraste sombre";
    if (themeLabel) themeLabel.textContent = visibleLabel;
    if (themeButton) {
      themeButton.setAttribute(
        "aria-label",
        isEnglish
          ? `${visibleLabel}: switch to ${isDark ? "light" : "dark"} mode`
          : `${visibleLabel} : activer le mode ${isDark ? "clair" : "sombre"}`,
      );
    }
  };

  applyTheme(initialTheme);
  themeButton?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("portfolio-theme", nextTheme);
  });

  cleanExperienceMetadata();
  fixProfileCopy();
  syncRecommendations();
  fixCvSemantics();
  normalizeDashes(document);
})();
