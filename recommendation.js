(() => {
  const root = document.documentElement;
  const isEnglish = (root.lang || "").toLowerCase().startsWith("en");
  const form = document.getElementById("recommendation-form");
  const status = document.getElementById("form-status");
  const submitButton = form?.querySelector('button[type="submit"]');
  const identityGroup = form?.querySelector(".publication-options");
  const identityRadios = Array.from(
    form?.querySelectorAll('input[name="identity_mode"]') || [],
  );
  const identityError = document.getElementById("identity-error");
  const loadedAt = Date.now();
  const config = window.TESTIMONIALS_CONFIG || {};
  const apiUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const anonKey = String(config.supabaseAnonKey || "");
  const isConfigured = Boolean(
    apiUrl &&
    anonKey &&
    !apiUrl.includes("YOUR_") &&
    !anonKey.includes("YOUR_"),
  );

  const messages = isEnglish
    ? {
        sending: "Sending…",
        submit: "Submit my testimonial for review",
        success:
          "Thank you. Your testimonial has been received and is awaiting review. Nothing has been published automatically.",
        unavailable:
          "The testimonial service is not configured yet. Please try again later.",
        error:
          "The testimonial could not be sent. Please check your connection and try again.",
        invalid: "Please check the required fields before submitting.",
      }
    : {
        sending: "Envoi en cours…",
        submit: "Envoyer mon témoignage pour validation",
        success:
          "Merci. Votre témoignage a bien été reçu et attend maintenant une validation. Rien n’a été publié automatiquement.",
        unavailable:
          "Le service de témoignages n’est pas encore configuré. Merci de réessayer ultérieurement.",
        error:
          "Le témoignage n’a pas pu être envoyé. Vérifiez votre connexion puis réessayez.",
        invalid: "Vérifiez les champs obligatoires avant l’envoi.",
      };

  const setStatus = (message, type = "") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type;
  };

  const setBusy = (busy) => {
    if (!submitButton) return;
    submitButton.disabled = busy;
    submitButton.setAttribute("aria-disabled", String(busy));
    submitButton.textContent = busy ? messages.sending : messages.submit;
  };

  if (!form) return;

  const clearIdentityError = () => {
    identityGroup?.removeAttribute("aria-invalid");
    if (identityError) identityError.hidden = true;
  };

  const showIdentityError = () => {
    identityGroup?.setAttribute("aria-invalid", "true");
    if (identityError) identityError.hidden = false;
  };

  const getFirstNativeInvalid = () =>
    Array.from(form.elements).find(
      (control) => control.willValidate && !control.validity.valid,
    );

  identityRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) clearIdentityError();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const hasIdentitySelection = identityRadios.some(
      (radio) => radio.checked,
    );
    if (hasIdentitySelection) clearIdentityError();
    else showIdentityError();

    const firstNativeInvalid = getFirstNativeInvalid();
    const identityComesFirst =
      !firstNativeInvalid ||
      Boolean(
        identityRadios[0]?.compareDocumentPosition(firstNativeInvalid) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );

    if (!hasIdentitySelection || firstNativeInvalid) {
      setStatus(messages.invalid, "error");
      if (!hasIdentitySelection && identityComesFirst) {
        identityRadios[0]?.focus();
      } else {
        firstNativeInvalid?.reportValidity();
      }
      return;
    }

    const data = new FormData(form);
    if (String(data.get("website") || "").trim()) {
      form.reset();
      clearIdentityError();
      setStatus(messages.success, "success");
      return;
    }

    if (Date.now() - loadedAt < 1800) {
      setStatus(messages.error, "error");
      return;
    }

    if (!isConfigured) {
      setStatus(messages.unavailable, "error");
      return;
    }

    const payload = {
      full_name: String(data.get("full_name") || "").trim(),
      role: String(data.get("role") || "").trim(),
      organization: String(data.get("organization") || "").trim() || null,
      verification_contact: String(
        data.get("verification_contact") || "",
      ).trim(),
      collaboration_context: String(
        data.get("collaboration_context") || "",
      ).trim(),
      testimonial: String(data.get("testimonial") || "").trim(),
      strengths: data.getAll("strength").map((value) => String(value)),
      identity_mode: String(data.get("identity_mode") || ""),
      consent: data.get("consent") === "true",
      submission_language: isEnglish ? "en" : "fr",
    };

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setBusy(true);

    try {
      const response = await fetch(`${apiUrl}/rest/v1/testimonials`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error(`Submission failed: ${response.status}`);

      form.reset();
      clearIdentityError();
      setStatus(messages.success, "success");
      status?.focus({ preventScroll: false });
    } catch {
      setStatus(messages.error, "error");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  });
})();
