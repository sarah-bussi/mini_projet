(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const aiEndpoint = String(config.aiEndpoint || '').trim();
  const cvEndpoint = `${String(config.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/workspace-cv`;
  const storageKey = 'sb_workspace_session';
  let adaptedCvHtml = '';

  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  };

  const authHeaders = () => {
    const session = readSession();
    if (!session?.access_token) throw new Error('session_missing');
    return {
      'Content-Type': 'application/json',
      apikey: config.supabaseAnonKey || '',
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  const callAI = async (mode, payload) => {
    if (!aiEndpoint) throw new Error('endpoint_missing');
    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode, payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'request_failed');
    return data;
  };

  const callCvAI = async (payload) => {
    const response = await fetch(cvEndpoint, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'cv_request_failed');
    if (!data?.cvPatch || !data?.analysis) throw new Error('invalid_cv_response');
    return data;
  };

  const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const replaceList = (doc, list, items) => {
    if (!list || !Array.isArray(items) || !items.length) return;
    list.replaceChildren(...items.map((text) => {
      const li = doc.createElement('li');
      li.textContent = String(text || '').trim();
      return li;
    }));
  };

  const reorderArticles = (container, articles, order) => {
    if (!container || !Array.isArray(order) || !order.length) return;
    const byName = new Map(articles.map((article) => [normalise(article.querySelector('h3')?.textContent), article]));
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
    const doc = new DOMParser().parseFromString(sourceHtml, 'text/html');
    doc.querySelectorAll('script').forEach((node) => node.remove());

    const base = doc.createElement('base');
    base.href = '../';
    doc.head.prepend(base);

    if (patch?.professionalTitle) {
      const title = doc.querySelector('.hero-copy strong');
      if (title) title.textContent = patch.professionalTitle;
    }

    if (patch?.summary) {
      const copies = doc.querySelectorAll('.hero .hero-copy');
      const summary = copies[copies.length - 1];
      if (summary) summary.textContent = patch.summary;
    }

    const skillsList = doc.querySelector('#skills ul');
    replaceList(doc, skillsList, patch?.prioritySkills);

    const experienceArticles = Array.from(doc.querySelectorAll('#experience article.timeline-item'));
    const experienceByEmployer = new Map(
      experienceArticles.map((article) => [normalise(article.querySelector('h3')?.textContent), article])
    );
    (patch?.experiences || []).forEach((item) => {
      const article = experienceByEmployer.get(normalise(item?.employer));
      if (article) replaceList(doc, article.querySelector('ul.experience-list'), item?.bullets);
    });
    reorderArticles(experienceArticles[0]?.parentElement, experienceArticles, patch?.experienceOrder);

    const projectArticles = Array.from(doc.querySelectorAll('#projects article.project-card'));
    const projectByTitle = new Map(
      projectArticles.map((article) => [normalise(article.querySelector('h3')?.textContent), article])
    );
    (patch?.projects || []).forEach((item) => {
      const article = projectByTitle.get(normalise(item?.title));
      if (!article) return;
      const summary = article.querySelector('.cv-project-summary');
      if (summary && item?.summary) summary.textContent = item.summary;
      replaceList(doc, article.querySelector('.cv-project-highlights'), item?.highlights);
    });
    reorderArticles(projectArticles[0]?.parentElement, projectArticles, patch?.projectOrder);

    const printButton = doc.getElementById('cv-print');
    if (printButton) printButton.closest('.cv-actions')?.remove();
    doc.querySelector('.site-header')?.remove();

    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  };

  const renderAnalysis = (analysis) => {
    const parts = [];
    if (analysis?.verdict) parts.push(`Verdict\n${analysis.verdict}`);
    if (analysis?.strengths?.length) parts.push(`Points forts\n- ${analysis.strengths.join('\n- ')}`);
    if (analysis?.gaps?.length) parts.push(`Écarts à ne pas inventer\n- ${analysis.gaps.join('\n- ')}`);
    if (analysis?.atsKeywords?.length) parts.push(`Mots-clés ATS justifiés\n- ${analysis.atsKeywords.join('\n- ')}`);
    return parts.join('\n\n');
  };

  const showCvPreview = async (payload, data) => {
    const section = document.getElementById('cv-preview-section');
    const frame = document.getElementById('cv-preview-frame');
    if (!section || !frame) throw new Error('preview_missing');
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
        if (mode === 'cv') {
          const data = await callCvAI(payload);
          result.textContent = renderAnalysis(data.analysis);
          await showCvPreview(payload, data);
        } else {
          const data = await callAI(mode, payload);
          result.textContent = data.text || data.result || JSON.stringify(data, null, 2);
        }
        status.textContent = 'Terminé.';
      } catch (error) {
        console.error(error);
        const message = String(error?.message || '');
        if (message === 'session_missing') status.textContent = 'Session absente. Reconnecte-toi au workspace.';
        else if (message === 'cv_template_failed') status.textContent = 'Le CV a été adapté mais le template HTML n’a pas pu être chargé.';
        else status.textContent = 'La génération a échoué. Vérifie le déploiement de workspace-cv.';
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
