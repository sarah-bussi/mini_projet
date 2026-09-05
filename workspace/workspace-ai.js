(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const endpoint = String(config.aiEndpoint || '').trim();
  const storageKey = 'sb_workspace_session';
  let adaptedCvHtml = '';

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
    if (!response.ok) throw new Error(data?.error || 'request_failed');
    return data;
  };

  const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const replaceList = (list, items) => {
    if (!list || !Array.isArray(items) || !items.length) return;
    list.replaceChildren(...items.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
  };

  const reorderArticles = (container, articles, order, headingSelector) => {
    if (!container || !Array.isArray(order) || !order.length) return;
    const byName = new Map(articles.map((article) => [normalise(article.querySelector(headingSelector)?.textContent), article]));
    const ordered = [];
    order.forEach((name) => {
      const article = byName.get(normalise(name));
      if (article && !ordered.includes(article)) ordered.push(article);
    });
    articles.forEach((article) => { if (!ordered.includes(article)) ordered.push(article); });
    ordered.forEach((article) => container.appendChild(article));
  };

  const buildAdaptedCv = async (payload, patch) => {
    const sourceFile = payload.cvSource === 'fr' ? '../cv.html' : '../cv-en.html';
    const response = await fetch(sourceFile, { cache: 'no-store' });
    if (!response.ok) throw new Error('cv_template_failed');
    const sourceHtml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(sourceHtml, 'text/html');

    doc.querySelectorAll('script').forEach((node) => node.remove());
    doc.querySelectorAll('.sr-only').forEach((node) => node.remove());

    const base = doc.createElement('base');
    base.href = '../';
    doc.head.prepend(base);

    if (patch?.professionalTitle) {
      const title = doc.querySelector('.hero-copy strong');
      if (title) title.textContent = patch.professionalTitle;
    }

    if (patch?.summary) {
      const heroCopies = doc.querySelectorAll('.hero .hero-copy');
      const summary = heroCopies[heroCopies.length - 1];
      if (summary) summary.textContent = patch.summary;
    }

    const experienceArticles = Array.from(doc.querySelectorAll('#experience article.timeline-item'));
    const experienceByEmployer = new Map(
      experienceArticles.map((article) => [normalise(article.querySelector('h3')?.textContent), article])
    );
    (patch?.experiences || []).forEach((item) => {
      const article = experienceByEmployer.get(normalise(item?.employer));
      if (!article) return;
      replaceList(article.querySelector('ul.experience-list'), item?.bullets);
    });
    const experienceContainer = experienceArticles[0]?.parentElement;
    reorderArticles(experienceContainer, experienceArticles, patch?.experienceOrder, 'h3');

    const projectArticles = Array.from(doc.querySelectorAll('#projects article.project-card'));
    const projectByTitle = new Map(
      projectArticles.map((article) => [normalise(article.querySelector('h3')?.textContent), article])
    );
    (patch?.projects || []).forEach((item) => {
      const article = projectByTitle.get(normalise(item?.title));
      if (!article) return;
      const summary = article.querySelector('.cv-project-summary');
      if (summary && item?.summary) summary.textContent = item.summary;
      replaceList(article.querySelector('.cv-project-highlights'), item?.highlights);
    });
    const projectContainer = projectArticles[0]?.parentElement;
    reorderArticles(projectContainer, projectArticles, patch?.projectOrder, 'h3');

    const printButton = doc.getElementById('cv-print');
    if (printButton) printButton.closest('.cv-actions')?.remove();
    doc.querySelector('.site-header')?.remove();

    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  };

  const showCvPreview = async (payload, data) => {
    const section = document.getElementById('cv-preview-section');
    const frame = document.getElementById('cv-preview-frame');
    if (!section || !frame || !data?.cvPatch) return;
    adaptedCvHtml = await buildAdaptedCv(payload, data.cvPatch);
    frame.srcdoc = adaptedCvHtml;
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bindForm = (formId, statusId, resultId, mode) => {
    const form = document.getElementById(formId);
    const status = document.getElementById(statusId);
    const result = document.getElementById(resultId);
    if (!form || !status || !result) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      status.textContent = 'Génération en cours…';
      result.textContent = '';
      const previewSection = document.getElementById('cv-preview-section');
      if (previewSection) previewSection.hidden = true;
      try {
        const data = await callAI(mode, payload);
        result.textContent = data.text || data.result || JSON.stringify(data, null, 2);
        if (mode === 'cv' && data.cvPatch) await showCvPreview(payload, data);
        status.textContent = 'Terminé.';
      } catch (error) {
        console.error(error);
        if (String(error?.message || '') === 'session_missing') {
          status.textContent = 'Session absente. Reconnecte-toi au workspace.';
          return;
        }
        status.textContent = 'La génération a échoué. Vérifie la fonction Supabase et la clé API IA.';
      }
    });
  };

  document.getElementById('cv-print-adapted')?.addEventListener('click', () => {
    const frame = document.getElementById('cv-preview-frame');
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  });

  document.getElementById('cv-open-adapted')?.addEventListener('click', () => {
    if (!adaptedCvHtml) return;
    const blob = new Blob([adaptedCvHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  bindForm('cv-builder-form', 'cv-status', 'cv-result', 'cv');
  bindForm('copilot-form', 'copilot-status', 'copilot-result', 'copilot');
})();
