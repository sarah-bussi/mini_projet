(() => {
  const root = document.documentElement;
  const isEnglish = (root.lang || "").toLowerCase().startsWith("en");
  const container = document.getElementById("approved-testimonials");
  const liveStatus = document.getElementById("testimonials-status");
  if (!container) return;

  const recommendationContacts = [
    {
      dialogId: "dialog-rec-manager",
      name: "Audrey Gambs",
      email: "Audrey_GAMBS@connect-tech.sncf",
      linkedin: "https://www.linkedin.com/in/audrey-gambs-46278a137",
    },
    {
      dialogId: "dialog-rec-yannick",
      name: "Yannick Breavoine",
      email: "yannick@breavoine.net",
      linkedin: "https://www.linkedin.com/in/yannick-breavoine-83533551",
    },
  ];

  const createContactLink = ({ href, text, newTab = false }) => {
    const link = document.createElement("a");
    link.className = "button button-secondary";
    link.href = href;
    link.textContent = text;
    if (newTab) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const newTabText = document.createElement("span");
      newTabText.className = "sr-only";
      newTabText.textContent = isEnglish
        ? ", opens in a new tab"
        : ", ouvre un nouvel onglet";
      link.appendChild(newTabText);
    }
    return link;
  };

  const updateRecommendationContacts = () => {
    let updated = 0;

    recommendationContacts.forEach((contact) => {
      const dialog = document.getElementById(contact.dialogId);
      const actions = dialog?.querySelector(".recommendation-actions");
      if (!(actions instanceof HTMLElement)) return;

      const emailLink = createContactLink({
        href: `mailto:${contact.email}`,
        text: isEnglish
          ? `Email ${contact.name}`
          : `Contacter ${contact.name} par e-mail`,
      });
      const linkedinLink = createContactLink({
        href: contact.linkedin,
        text: isEnglish
          ? `View ${contact.name}'s LinkedIn profile`
          : `Voir le profil LinkedIn de ${contact.name}`,
        newTab: true,
      });

      actions.replaceChildren(emailLink, linkedinLink);
      updated += 1;
    });

    return updated;
  };

  if (updateRecommendationContacts() < recommendationContacts.length) {
    const observer = new MutationObserver(() => {
      if (updateRecommendationContacts() === recommendationContacts.length) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
  }

  const config = window.TESTIMONIALS_CONFIG || {};
  const apiUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const isConfigured = Boolean(
    apiUrl &&
    anonKey &&
    !apiUrl.includes("YOUR_") &&
    !anonKey.includes("YOUR_"),
  );

  const copy = isEnglish
    ? {
        empty: "No approved colleague testimonials have been published yet.",
        error: "Approved testimonials are temporarily unavailable.",
        loaded: (count) =>
          `${count} approved testimonial${count === 1 ? "" : "s"} loaded.`,
        context: "Collaboration context",
        organisationSeparator: " · ",
      }
    : {
        empty: "Aucun témoignage de collègue validé n’est encore publié.",
        error: "Les témoignages validés sont temporairement indisponibles.",
        loaded: (count) =>
          `${count} témoignage${count > 1 ? "s" : ""} validé${count > 1 ? "s" : ""} chargé${count > 1 ? "s" : ""}.`,
        context: "Contexte de collaboration",
        organisationSeparator: " · ",
      };

  const showMessage = (message) => {
    container.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.className = "testimonials-empty";
    paragraph.textContent = message;
    container.appendChild(paragraph);
  };

  const render = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      showMessage(copy.empty);
      if (liveStatus) liveStatus.textContent = copy.loaded(0);
      return;
    }

    const list = document.createElement("ul");
    list.className = "testimonial-list";

    items.forEach((item, index) => {
      const listItem = document.createElement("li");
      const article = document.createElement("article");
      article.className = "testimonial-card";

      const quote = document.createElement("blockquote");
      const quoteText = document.createElement("p");
      quoteText.textContent = item.testimonial;
      quote.appendChild(quoteText);

      const footer = document.createElement("footer");
      const author = document.createElement("cite");
      const authorName = document.createElement("strong");
      authorName.id = `testimonial-author-${index + 1}`;
      authorName.textContent = item.display_name;
      article.setAttribute("aria-labelledby", authorName.id);
      author.appendChild(authorName);

      const details = [item.public_role, item.organization].filter(Boolean);
      if (details.length) {
        const meta = document.createElement("span");
        meta.textContent = details.join(copy.organisationSeparator);
        author.appendChild(meta);
      }

      footer.appendChild(author);
      article.append(quote, footer);

      if (item.collaboration_context) {
        const context = document.createElement("p");
        context.className = "testimonial-context";
        const label = document.createElement("span");
        label.textContent = `${copy.context} : `;
        const value = document.createTextNode(item.collaboration_context);
        context.append(label, value);
        article.appendChild(context);
      }

      listItem.appendChild(article);
      list.appendChild(listItem);
    });

    container.replaceChildren(list);
    if (liveStatus) liveStatus.textContent = copy.loaded(items.length);
  };

  const loadTestimonials = async () => {
    if (!isConfigured) {
      showMessage(copy.empty);
      return;
    }

    try {
      const response = await fetch(
        `${apiUrl}/rest/v1/rpc/get_published_testimonials`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (!response.ok) throw new Error(`Loading failed: ${response.status}`);
      render(await response.json());
    } catch {
      showMessage(copy.error);
      if (liveStatus) liveStatus.textContent = copy.error;
    }
  };

  loadTestimonials();
})();
