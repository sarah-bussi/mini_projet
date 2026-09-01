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
  const consent = document.getElementById("publication-consent");
  const consentFieldset = consent?.closest("fieldset");
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
        invalid: "Please correct the fields indicated below before submitting.",
        identity: "Choose an identification option before submitting.",
        consent: "Please confirm that you agree to the possible publication of your testimonial.",
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
        invalid: "Corrigez les champs indiqués ci-dessous avant l’envoi.",
        identity: "Choisissez une option d’identification avant l’envoi.",
        consent: "Confirmez que vous autorisez la publication éventuelle de votre témoignage.",
      };

  if (!form) return;

  const fieldDefinitions = isEnglish
    ? [
        {
          id: "full-name",
          example: "Example: Marie Dupont",
          required: "Enter your full name.",
          tooShort: "Enter at least 2 characters.",
        },
        {
          id: "role",
          example: "Example: UX Designer, Project Manager, Accessibility Expert",
          required: "Enter your job title or role.",
          tooShort: "Enter at least 2 characters.",
        },
        {
          id: "organization",
          example: "Example: Company, association or university",
        },
        {
          id: "verification-contact",
          example: "Example: marie.dupont@example.com or linkedin.com/in/marie-dupont",
          required: "Enter an email address or LinkedIn profile for verification.",
          format: "Enter a valid email address or LinkedIn profile URL.",
        },
        {
          id: "collaboration-context",
          example: "Example: We worked together on a digital accessibility audit in 2026.",
          required: "Describe briefly the context in which we worked together.",
          tooShort: "Enter at least 10 characters to describe the context.",
        },
        {
          id: "testimonial",
          example: "Example: Sarah was rigorous, responsive and clear in her recommendations.",
          required: "Write a few words about our collaboration.",
        },
      ]
    : [
        {
          id: "full-name",
          example: "Exemple : Marie Dupont",
          required: "Renseignez votre nom et votre prénom.",
          tooShort: "Saisissez au moins 2 caractères.",
        },
        {
          id: "role",
          example: "Exemple : UX Designer, cheffe de projet, expert accessibilité",
          required: "Renseignez votre poste ou votre fonction.",
          tooShort: "Saisissez au moins 2 caractères.",
        },
        {
          id: "organization",
          example: "Exemple : entreprise, association ou université",
        },
        {
          id: "verification-contact",
          example: "Exemple : marie.dupont@exemple.fr ou linkedin.com/in/marie-dupont",
          required: "Renseignez une adresse e-mail ou un profil LinkedIn pour la vérification.",
          format: "Saisissez une adresse e-mail valide ou l’URL d’un profil LinkedIn.",
        },
        {
          id: "collaboration-context",
          example: "Exemple : Nous avons travaillé ensemble sur un audit d’accessibilité numérique en 2026.",
          required: "Décrivez brièvement le contexte dans lequel nous avons travaillé ensemble.",
          tooShort: "Saisissez au moins 10 caractères pour décrire le contexte.",
        },
        {
          id: "testimonial",
          example: "Exemple : Sarah a été rigoureuse, réactive et claire dans ses recommandations.",
          required: "Écrivez quelques mots sur notre collaboration.",
        },
      ];

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

  const appendDescribedBy = (control, id) => {
    const ids = new Set(
      String(control.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean),
    );
    ids.add(id);
    control.setAttribute("aria-describedby", [...ids].join(" "));
  };

  const fieldMap = new Map();

  fieldDefinitions.forEach((definition) => {
    const control = document.getElementById(definition.id);
    if (!control) return;

    const exampleId = `${definition.id}-example`;
    const errorId = `${definition.id}-error`;
    const field = control.closest(".field");
    const label = form.querySelector(`label[for="${definition.id}"]`);

    if (definition.example && label && !document.getElementById(exampleId)) {
      const example = document.createElement("span");
      example.id = exampleId;
      example.className = "field-example";
      example.textContent = definition.example;
      label.append(example);
    }

    let error = document.getElementById(errorId);
    if (!error) {
      error = document.createElement("p");
      error.id = errorId;
      error.className = "field-error";
      error.hidden = true;
      field?.append(error);
    }
    appendDescribedBy(control, errorId);

    fieldMap.set(control, { definition, error });
  });

  let consentError = document.getElementById("consent-error");
  if (consent && consentFieldset && !consentError) {
    consentError = document.createElement("p");
    consentError.id = "consent-error";
    consentError.className = "field-error";
    consentError.hidden = true;
    consentFieldset.append(consentError);
    appendDescribedBy(consent, "consent-error");
  }

  if (identityError) identityError.textContent = messages.identity;

  const isVerificationContactValid = (value) => {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const linkedin = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w%+./?=&-]+\/?$/i;
    return email.test(value) || linkedin.test(value);
  };

  const clearFieldError = (control) => {
    const entry = fieldMap.get(control);
    if (!entry) return;
    control.removeAttribute("aria-invalid");
    entry.error.hidden = true;
    entry.error.textContent = "";
  };

  const showFieldError = (control, message) => {
    const entry = fieldMap.get(control);
    if (!entry) return;
    control.setAttribute("aria-invalid", "true");
    entry.error.textContent = message;
    entry.error.hidden = false;
  };

  const validateField = (control) => {
    const entry = fieldMap.get(control);
    if (!entry) return true;
    const { definition } = entry;
    const value = String(control.value || "").trim();

    if (control.required && !value) {
      showFieldError(control, definition.required || messages.invalid);
      return false;
    }

    const minLength = Number(control.getAttribute("minlength") || 0);
    if (value && minLength && value.length < minLength) {
      showFieldError(control, definition.tooShort || messages.invalid);
      return false;
    }

    if (control.id === "verification-contact" && value && !isVerificationContactValid(value)) {
      showFieldError(control, definition.format);
      return false;
    }

    clearFieldError(control);
    return true;
  };

  const clearIdentityError = () => {
    identityGroup?.removeAttribute("aria-invalid");
    if (identityError) identityError.hidden = true;
  };

  const showIdentityError = () => {
    identityGroup?.setAttribute("aria-invalid", "true");
    if (identityError) identityError.hidden = false;
  };

  const clearConsentError = () => {
    consent?.removeAttribute("aria-invalid");
    if (consentError) consentError.hidden = true;
  };

  const showConsentError = () => {
    consent?.setAttribute("aria-invalid", "true");
    if (consentError) {
      consentError.textContent = messages.consent;
      consentError.hidden = false;
    }
  };

  fieldMap.forEach((_entry, control) => {
    control.addEventListener("input", () => {
      if (control.hasAttribute("aria-invalid")) validateField(control);
    });
    control.addEventListener("blur", () => {
      if (String(control.value || "").trim()) validateField(control);
    });
  });

  identityRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) clearIdentityError();
    });
  });

  consent?.addEventListener("change", () => {
    if (consent.checked) clearConsentError();
  });

  const getFirstInvalidControl = (fieldInvalid, identityInvalid, consentInvalid) => {
    const candidates = [
      ...fieldInvalid,
      ...(identityInvalid && identityRadios[0] ? [identityRadios[0]] : []),
      ...(consentInvalid && consent ? [consent] : []),
    ];
    return candidates.sort((a, b) => {
      if (a === b) return 0;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    })[0];
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const invalidFields = [];
    fieldMap.forEach((_entry, control) => {
      if (!validateField(control)) invalidFields.push(control);
    });

    const identityInvalid = !identityRadios.some((radio) => radio.checked);
    if (identityInvalid) showIdentityError();
    else clearIdentityError();

    const consentInvalid = Boolean(consent && !consent.checked);
    if (consentInvalid) showConsentError();
    else clearConsentError();

    if (invalidFields.length || identityInvalid || consentInvalid) {
      setStatus(messages.invalid, "error");
      getFirstInvalidControl(
        invalidFields,
        identityInvalid,
        consentInvalid,
      )?.focus();
      return;
    }

    const data = new FormData(form);
    if (String(data.get("website") || "").trim()) {
      form.reset();
      clearIdentityError();
      clearConsentError();
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
      fieldMap.forEach((_entry, control) => clearFieldError(control));
      clearIdentityError();
      clearConsentError();
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
