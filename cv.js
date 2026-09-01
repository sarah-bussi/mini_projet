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

    const hospitalityItem = findTimelineItem(
      "Brasserie Le Reef 1830 · EHPAD Mas Marguerites",
    );
    const hospitalityMeta = hospitalityItem?.querySelector(".timeline-meta");
    if (hospitalityMeta) {
      const brasserie = document.createElement("p");
      brasserie.textContent = "2020 - 2021 · Brasserie Le Reef 1830";
      const ehpad = document.createElement("p");
      ehpad.textContent = "2022 · EHPAD Mas Marguerites";
      hospitalityMeta.replaceChildren(brasserie, ehpad);
    }
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
  normalizeDashes(document);
})();
