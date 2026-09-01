(() => {
  const config = window.TESTIMONIALS_CONFIG || {};
  const apiUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const isConfigured = Boolean(
    apiUrl &&
    anonKey &&
    !apiUrl.includes("YOUR_") &&
    !anonKey.includes("YOUR_"),
  );
  const setupMessage = document.getElementById("admin-setup-message");
  const loginSection = document.getElementById("admin-login-section");
  const loginForm = document.getElementById("admin-login-form");
  const loginStatus = document.getElementById("admin-login-status");
  const dashboard = document.getElementById("moderation-dashboard");
  const moderationList = document.getElementById("moderation-list");
  const moderationStatus = document.getElementById("moderation-status");
  const identity = document.getElementById("admin-identity");
  const logoutButton = document.getElementById("admin-logout");
  const filterButtons = [...document.querySelectorAll("[data-status-filter]")];
  const sessionKey = "sarah-testimonials-admin-session";
  let session = null;
  let activeStatus = "pending";

  const setText = (element, message, state = "") => {
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  };

  const request = async (path, options = {}, useSession = false) => {
    const headers = {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    headers.Authorization = `Bearer ${useSession ? session?.access_token : anonKey}`;
    return fetch(`${apiUrl}${path}`, { ...options, headers });
  };

  const storeSession = (value) => {
    session = value;
    if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value));
    else sessionStorage.removeItem(sessionKey);
  };

  const restoreSession = () => {
    try {
      const value = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
      if (value?.access_token && value.expires_at > Date.now() + 60000)
        session = value;
      else storeSession(null);
    } catch {
      storeSession(null);
    }
  };

  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "";

  const identityLabels = {
    full: "Nom complet + fonction",
    first: "Prénom + fonction",
    initials: "Initiales + fonction",
    role: "Fonction uniquement",
  };

  const createRow = (label, value) => {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value || "Non renseigné";
    wrapper.append(term, description);
    return wrapper;
  };

  const moderate = async (id, nextStatus, name) => {
    const actionLabel = nextStatus === "approved" ? "publication" : "refus";
    setText(moderationStatus, `Validation du ${actionLabel} pour ${name}…`);

    try {
      const now = new Date().toISOString();
      const response = await request(
        `/rest/v1/testimonials?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: nextStatus,
            moderated_at: now,
            approved_at: nextStatus === "approved" ? now : null,
            verification_contact: null,
          }),
        },
        true,
      );
      if (!response.ok)
        throw new Error(`Moderation failed: ${response.status}`);
      setText(
        moderationStatus,
        nextStatus === "approved"
          ? `Le témoignage de ${name} est maintenant publié.`
          : `Le témoignage de ${name} a été refusé.`,
        "success",
      );
      await loadRows();
    } catch {
      setText(
        moderationStatus,
        "La décision n’a pas pu être enregistrée. Vérifiez vos droits puis réessayez.",
        "error",
      );
    }
  };

  const removeTestimonial = async (id, name) => {
    const confirmed = window.confirm(
      `Supprimer définitivement le témoignage de ${name} ? Cette action est irréversible.`,
    );
    if (!confirmed) return;

    setText(moderationStatus, `Suppression du témoignage de ${name}…`);

    try {
      const response = await request(
        `/rest/v1/testimonials?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { Prefer: "return=minimal" },
        },
        true,
      );
      if (!response.ok)
        throw new Error(`Deletion failed: ${response.status}`);

      setText(
        moderationStatus,
        `Le témoignage de ${name} a été supprimé définitivement.`,
        "success",
      );
      await loadRows();
    } catch {
      setText(
        moderationStatus,
        "La suppression n’a pas pu être effectuée. Vérifiez vos droits puis réessayez.",
        "error",
      );
    }
  };

  const renderRows = (rows) => {
    moderationList.replaceChildren();

    if (!rows.length) {
      const item = document.createElement("li");
      item.className = "moderation-empty";
      item.textContent = "Aucun témoignage dans cette catégorie.";
      moderationList.appendChild(item);
      return;
    }

    rows.forEach((row) => {
      const item = document.createElement("li");
      const article = document.createElement("article");
      article.className = "moderation-card";

      const heading = document.createElement("h3");
      heading.textContent = row.full_name;

      const meta = document.createElement("p");
      meta.className = "moderation-meta";
      meta.textContent = `${row.role}${row.organization ? ` · ${row.organization}` : ""} · reçu le ${formatDate(row.created_at)}`;

      const quote = document.createElement("blockquote");
      const quoteText = document.createElement("p");
      quoteText.textContent = row.testimonial;
      quote.appendChild(quoteText);

      const data = document.createElement("dl");
      data.className = "moderation-data";
      data.append(
        createRow("Contact de vérification", row.verification_contact),
        createRow("Contexte", row.collaboration_context),
        createRow(
          "Identification publique",
          identityLabels[row.identity_mode] || row.identity_mode,
        ),
        createRow(
          "Points mis en avant",
          Array.isArray(row.strengths) ? row.strengths.join(", ") : "",
        ),
      );

      const actions = document.createElement("div");
      actions.className = "moderation-actions";

      if (row.status !== "approved") {
        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "button button-primary";
        approve.textContent = "Publier";
        approve.setAttribute(
          "aria-label",
          `Publier le témoignage de ${row.full_name}`,
        );
        approve.addEventListener("click", () =>
          moderate(row.id, "approved", row.full_name),
        );
        actions.appendChild(approve);
      }

      if (row.status !== "rejected") {
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "button button-secondary";
        reject.textContent =
          row.status === "approved" ? "Retirer du site" : "Refuser";
        reject.setAttribute(
          "aria-label",
          row.status === "approved"
            ? `Retirer du site le témoignage de ${row.full_name}`
            : `Refuser le témoignage de ${row.full_name}`,
        );
        reject.addEventListener("click", () =>
          moderate(row.id, "rejected", row.full_name),
        );
        actions.appendChild(reject);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-secondary moderation-delete";
      remove.textContent = "Supprimer définitivement";
      remove.setAttribute(
        "aria-label",
        `Supprimer définitivement le témoignage de ${row.full_name}`,
      );
      remove.addEventListener("click", () =>
        removeTestimonial(row.id, row.full_name),
      );
      actions.appendChild(remove);

      article.append(heading, meta, quote, data, actions);
      item.appendChild(article);
      moderationList.appendChild(item);
    });
  };

  const loadRows = async () => {
    if (!session) return;
    setText(moderationStatus, "Chargement des témoignages…");
    const fields =
      "id,full_name,role,organization,verification_contact,collaboration_context,testimonial,strengths,identity_mode,consent,status,submission_language,created_at,approved_at";
    try {
      const response = await request(
        `/rest/v1/testimonials?select=${fields}&status=eq.${activeStatus}&order=created_at.asc`,
        {},
        true,
      );
      if (response.status === 401 || response.status === 403) {
        storeSession(null);
        showLogin("Ce compte ne dispose pas des droits de modération.");
        return;
      }
      if (!response.ok) throw new Error(`Loading failed: ${response.status}`);
      const rows = await response.json();
      renderRows(rows);
      setText(
        moderationStatus,
        `${rows.length} témoignage${rows.length > 1 ? "s" : ""} dans cette catégorie.`,
      );
    } catch {
      setText(
        moderationStatus,
        "Impossible de charger les témoignages.",
        "error",
      );
    }
  };

  const showDashboard = () => {
    loginSection.hidden = true;
    dashboard.hidden = false;
    identity.textContent = session?.email
      ? `Connectée : ${session.email}`
      : "Session administratrice active";
    loadRows();
  };

  const showLogin = (message = "") => {
    dashboard.hidden = true;
    loginSection.hidden = false;
    if (message) setText(loginStatus, message, "error");
  };

  if (!isConfigured) {
    setupMessage.hidden = false;
    loginSection.hidden = true;
    return;
  }

  setupMessage.hidden = true;
  restoreSession();
  if (session) showDashboard();
  else showLogin();

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const data = new FormData(loginForm);
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    setText(loginStatus, "Connexion en cours…");

    try {
      const response = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({
          email: String(data.get("email") || "").trim(),
          password: String(data.get("password") || ""),
        }),
      });
      if (!response.ok) throw new Error("Authentication failed");
      const auth = await response.json();
      storeSession({
        access_token: auth.access_token,
        email: auth.user?.email || "",
        expires_at:
          Date.now() + Math.max(0, Number(auth.expires_in || 3600) - 30) * 1000,
      });
      loginForm.reset();
      setText(loginStatus, "");
      showDashboard();
    } catch {
      setText(
        loginStatus,
        "Connexion impossible. Vérifiez l’adresse, le mot de passe et le rôle moderator.",
        "error",
      );
    } finally {
      submit.disabled = false;
    }
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = button.dataset.statusFilter;
      filterButtons.forEach((candidate) =>
        candidate.setAttribute("aria-pressed", String(candidate === button)),
      );
      loadRows();
    });
  });

  logoutButton?.addEventListener("click", () => {
    storeSession(null);
    showLogin("Vous êtes déconnectée.");
  });
})();
