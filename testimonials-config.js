window.TESTIMONIALS_CONFIG = Object.freeze({
  // Valeurs publiques fournies dans Supabase > Project Settings > API Keys.
  // La publishable key est conçue pour être exposée côté navigateur avec les règles RLS activées.
  // Ne jamais placer une secret key ou la clé service_role dans le dépôt.
  supabaseUrl: "https://tcblhvvdxbvihteaiylw.supabase.co",
  supabaseAnonKey: "sb_publishable_5VyQuS1rFkLnl6aVRg2JKA_zlBe8L6q",
});

// Ajustements sémantiques partagés entre les pages qui chargent ce fichier.
(() => {
  const isEnglish = (document.documentElement.lang || "")
    .toLowerCase()
    .startsWith("en");

  // Le nom accessible du lien de marque doit contenir son libellé visible.
  const brandLink = document.querySelector(".brand");
  if (brandLink?.hasAttribute("aria-label")) {
    brandLink.removeAttribute("aria-label");
    const homeHint = document.createElement("span");
    homeHint.className = "sr-only";
    homeHint.textContent = isEnglish
      ? ", back to homepage"
      : ", retour à l’accueil";
    brandLink.appendChild(homeHint);
  }

  // Donne un nom unique aux régions <article> à partir de leur premier titre.
  document.querySelectorAll("article").forEach((article, index) => {
    if (
      article.hasAttribute("aria-label") ||
      article.hasAttribute("aria-labelledby")
    )
      return;

    const heading = article.querySelector("h1, h2, h3, h4, h5, h6");
    if (!heading) return;

    if (!heading.id) heading.id = `article-heading-${index + 1}`;
    article.setAttribute("aria-labelledby", heading.id);
  });

  // Le lien d’évitement reste le premier contrôle du bandeau tout en appartenant
  // à un landmark, ce qui évite le signalement IBM "outside landmark".
  const siteHeader = document.querySelector(".site-header");
  const skipLink = document.querySelector(".skip-link");
  if (siteHeader && skipLink && skipLink.parentElement === document.body) {
    siteHeader.prepend(skipLink);
  }
})();
