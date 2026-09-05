(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const endpoint = String(config.aiEndpoint || '').trim();
  const storageKey = 'sb_workspace_session';

  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  };

  const callAI = async (mode, payload) => {
    if (!endpoint) throw new Error('endpoint_missing');
    const session = readSession();
    if (!session?.access_token) throw new Error('session_missing');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey || '',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mode, payload }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data?.detail || data?.error || 'request_failed');
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const humanError = (error) => {
    const message = String(error?.message || '');
    const status = Number(error?.status || 0);
    if (message === 'session_missing' || status === 401) return 'Ta session a expiré. Reconnecte-toi au workspace.';
    if (status === 429 || message.startsWith('groq_429')) return 'La limite IA temporaire est atteinte. Attends quelques secondes puis relance l’analyse.';
    if (message.startsWith('retrieval_')) return 'Le corpus accessibilité n’a pas pu être interrogé. Réessaie dans un instant.';
    if (message.startsWith('groq_400')) return 'La réponse IA structurée n’a pas pu être générée. Réessaie ou précise davantage la situation.';
    if (message === 'endpoint_missing') return 'Le service IA du workspace n’est pas configuré.';
    return 'La génération a échoué. Réessaie dans quelques instants.';
  };

  const bindForm = (formId, statusId, resultId, mode) => {
    const form = document.getElementById(formId);
    const status = document.getElementById(statusId);
    const result = document.getElementById(resultId);
    if (!form || !status || !result) return;

    let pending = false;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending) return;

      const submitButton = form.querySelector('button[type="submit"]');
      const payload = Object.fromEntries(new FormData(form).entries());
      pending = true;
      if (submitButton) submitButton.disabled = true;
      status.textContent = mode === 'copilot' ? 'Analyse en cours…' : 'Génération en cours…';
      result.textContent = '';

      try {
        const data = await callAI(mode, payload);
        result.textContent = data.text || data.result || JSON.stringify(data, null, 2);
        status.textContent = 'Terminé.';
        if (typeof result.focus === 'function') result.focus();
      } catch (error) {
        status.textContent = humanError(error);
      } finally {
        pending = false;
        if (submitButton) submitButton.disabled = false;
      }
    });
  };

  bindForm('cv-builder-form', 'cv-status', 'cv-result', 'cv');
  bindForm('copilot-form', 'copilot-status', 'copilot-result', 'copilot');
})();
