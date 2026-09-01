(() => {
  const root = document.documentElement;
  const isEnglish = (root.lang || "").toLowerCase().startsWith("en");
  const container = document.getElementById("approved-testimonials");
  const liveStatus = document.getElementById("testimonials-status");
  if (!container) return;

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

    items.forEach((item) => {
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
      authorName.textContent = item.display_name;
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
    }
  };

  loadTestimonials();
})();
