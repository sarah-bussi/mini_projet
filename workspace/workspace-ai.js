(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const endpoint = String(config.aiEndpoint || '').trim();

  const callAI = async (mode, payload) => {
    if (!endpoint) throw new Error('endpoint_missing');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'request_failed');
    return data;
  };

  const bindForm = (formId, statusId, resultId, mode) => {
    const form = document.getElementById(formId);
    const status = document.getElementById(statusId);
    const result = document.getElementById(resultId);
    if (!form || !status || !result) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!endpoint) {
        status.textContent = 'Endpoint IA non connecté pour le moment.';
        return;
      }
      status.textContent = 'Génération en cours…';
      result.textContent = '';
      try {
        const data = await callAI(mode, payload);
        result.textContent = data.text || data.result || JSON.stringify(data, null, 2);
        status.textContent = 'Terminé.';
      } catch {
        status.textContent = 'La génération a échoué. Vérifie la configuration de l’endpoint privé.';
      }
    });
  };

  bindForm('cv-builder-form', 'cv-status', 'cv-result', 'cv');
  bindForm('copilot-form', 'copilot-status', 'copilot-result', 'copilot');
})();
