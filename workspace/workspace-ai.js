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
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const text = (node) => normalise(node?.textContent || '');
  const texts = (root, selector) => Array.from(root?.querySelectorAll(selector) || []).map(text).filter(Boolean);

  const parseSourceCv = (doc) => {
    const experiences = Array.from(doc.querySelectorAll('#experience article.timeline-item')).map((article) => ({
      employer: text(article.querySelector('h3')),
      role: text(article.querySelector('.role')),
      meta: texts(article.querySelector('.timeline-meta'), 'p').join(' · '),
      bullets: texts(article, 'ul.experience-list li'),
    }));

    const educationRoot = doc.querySelector('#education, #formation');
    const education = Array.from(educationRoot?.querySelectorAll('.skill-group') || []).map((group) => ({
      title: text(group.querySelector('h3')),
      details: texts(group, 'p'),
    }));

    const projects = Array.from(doc.querySelectorAll('#projects article.project-card')).map((article) => ({
      title: text(article.querySelector('h3')),
      summary: text(article.querySelector('.cv-project-summary')),
      tags: texts(article.querySelector('.tags'), 'li'),
    }));

    const skillsRoot = doc.querySelector('#skills, #competences');
    const skills = Array.from(skillsRoot?.querySelectorAll('.skill-group') || []).map((group) => ({
      title: text(group.querySelector('h3')),
      items: texts(group, 'li'),
    }));

    const languagesRoot = doc.querySelector('#languages, #langues');
    const languages = Array.from(languagesRoot?.querySelectorAll('.skill-group') || []).map((group) => ({
      title: text(group.querySelector('h3')),
      detail: texts(group, 'p').join(' · '),
    }));

    return { experiences, education, projects, skills, languages };
  };

  const applyPatchToData = (data, patch) => {
    const expPatch = new Map((patch?.experiences || []).map((item) => [normalise(item?.employer), item]));
    data.experiences = data.experiences.map((item) => {
      const match = expPatch.get(normalise(item.employer));
      return match?.bullets?.length ? { ...item, bullets: match.bullets } : item;
    });

    if (Array.isArray(patch?.experienceOrder) && patch.experienceOrder.length) {
      const rank = new Map(patch.experienceOrder.map((name, index) => [normalise(name), index]));
      data.experiences.sort((a, b) => (rank.get(normalise(a.employer)) ?? 999) - (rank.get(normalise(b.employer)) ?? 999));
    }

    const projectPatch = new Map((patch?.projects || []).map((item) => [normalise(item?.title), item]));
    data.projects = data.projects.map((item) => {
      const match = projectPatch.get(normalise(item.title));
      return match ? { ...item, summary: match.summary || item.summary } : item;
    });

    if (Array.isArray(patch?.projectOrder) && patch.projectOrder.length) {
      const rank = new Map(patch.projectOrder.map((name, index) => [normalise(name), index]));
      data.projects.sort((a, b) => (rank.get(normalise(a.title)) ?? 999) - (rank.get(normalise(b.title)) ?? 999));
    }

    return data;
  };

  const buildDedicatedTemplate = (payload, patch, data, cssText) => {
    const isFr = payload.outputLanguage === 'fr';
    const labels = isFr
      ? { profile: 'PROFIL', experience: 'EXPÉRIENCES PROFESSIONNELLES', education: 'FORMATION', projects: 'PROJETS ACADÉMIQUES & RÉALISATIONS', skills: 'COMPÉTENCES ET TECHNOLOGIES' }
      : { profile: 'PROFILE', experience: 'PROFESSIONAL EXPERIENCE', education: 'EDUCATION', projects: 'ACADEMIC PROJECTS & ACHIEVEMENTS', skills: 'SKILLS & TECHNOLOGIES' };

    const primary = data.experiences[0];
    const secondary = data.experiences.slice(1, 6);
    const projects = data.projects.slice(0, 6);
    const skills = data.skills.slice(0, 5);
    const languages = data.languages.slice(0, 3);

    const experienceHtml = `
      <section class="cv-section" aria-labelledby="exp-title">
        <h2 id="exp-title">${labels.experience}</h2>
        ${primary ? `
          <article class="exp-primary">
            <div class="exp-head">
              <div><h3>${esc(primary.employer)}</h3><p>${esc(primary.role)}</p></div>
              <span>${esc(primary.meta)}</span>
            </div>
            <ul>${primary.bullets.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          </article>` : ''}
        <div class="exp-grid">
          ${secondary.map((item) => `
            <article class="exp-mini">
              <div class="exp-mini-head"><h3>${esc(item.employer)}</h3><span>${esc(item.meta)}</span></div>
              <p class="role">${esc(item.role)}</p>
              ${item.bullets[0] ? `<p>${esc(item.bullets[0])}</p>` : ''}
            </article>`).join('')}
        </div>
      </section>`;

    const educationHtml = `
      <section class="cv-section compact" aria-labelledby="edu-title">
        <h2 id="edu-title">${labels.education}</h2>
        <p class="education-line">${data.education.map((item) => {
          const details = item.details.length ? ` · ${item.details.join(' · ')}` : '';
          return `<strong>${esc(item.title)}</strong>${esc(details)}`;
        }).join(' &nbsp; ')}</p>
      </section>`;

    const projectsHtml = `
      <section class="cv-section" aria-labelledby="projects-title">
        <h2 id="projects-title">${labels.projects}</h2>
        <div class="projects-grid">
          ${projects.map((item) => `
            <article class="project-card">
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.summary)}</p>
              ${item.tags.length ? `<p class="tags">${item.tags.map(esc).join(' · ')}</p>` : ''}
            </article>`).join('')}
        </div>
      </section>`;

    const skillsHtml = `
      <section class="cv-section" aria-labelledby="skills-title">
        <h2 id="skills-title">${labels.skills}</h2>
        <div class="skills-grid">
          ${skills.map((group) => `
            <section class="skill-group"><h3>${esc(group.title)}</h3><p>${group.items.map(esc).join(' · ')}</p></section>`).join('')}
        </div>
        ${languages.length ? `<p class="languages-line">${languages.map((l) => `<strong>${esc(l.title)}</strong>${l.detail ? ` — ${esc(l.detail)}` : ''}`).join(' &nbsp; ')}</p>` : ''}
      </section>`;

    return `<!doctype html>
<html lang="${isFr ? 'fr' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sarah Bussi — ${esc(patch?.professionalTitle || '')}</title>
  <style>${String(cssText || '').replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
  <main class="application-sheet">
    <header class="cv-header-block">
      <h1>Sarah Bussi</h1>
      <p class="job-title">${esc(patch?.professionalTitle || (isFr ? 'Consultante en accessibilité numérique' : 'Digital Accessibility Consultant'))}</p>
      <p class="tagline">${isFr ? 'UX Inclusive · Technologies numériques · Qualité Produit' : 'Inclusive UX · Digital Technologies · Product Quality'}</p>
      <p class="contact">Paris, France · +33 7 70 43 15 04 · sarah.bussi2108@gmail.com · linkedin.com/in/sarahbussi</p>
    </header>

    <section class="cv-section profile-section" aria-labelledby="profile-title">
      <h2 id="profile-title">${labels.profile}</h2>
      <p>${esc(patch?.summary || '')}</p>
    </section>

    ${experienceHtml}
    ${educationHtml}
    ${projectsHtml}
    ${skillsHtml}
  </main>
</body>
</html>`;
  };

  const buildAdaptedCv = async (payload, patch) => {
    const sourceFile = payload.cvSource === 'fr' ? '../cv.html' : '../cv-en.html';
    const [sourceResponse, cssResponse] = await Promise.all([
      fetch(sourceFile, { cache: 'no-store' }),
      fetch('./cv-application.css', { cache: 'no-store' }),
    ]);
    if (!sourceResponse.ok) throw new Error('cv_template_failed');
    if (!cssResponse.ok) throw new Error('cv_style_failed');

    const [sourceHtml, cssText] = await Promise.all([
      sourceResponse.text(),
      cssResponse.text(),
    ]);
    const sourceDoc = new DOMParser().parseFromString(sourceHtml, 'text/html');
    const data = applyPatchToData(parseSourceCv(sourceDoc), patch);
    return buildDedicatedTemplate(payload, patch, data, cssText);
  };

  const renderAnalysis = (analysis) => {
    const parts = [];
    if (analysis?.verdict) parts.push(`Verdict\n${analysis.verdict}`);
    if (analysis?.matchedStrengths?.length) parts.push(`Points forts\n- ${analysis.matchedStrengths.join('\n- ')}`);
    else if (analysis?.strengths?.length) parts.push(`Points forts\n- ${analysis.strengths.join('\n- ')}`);
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
    frame.style.minHeight = '1123px';
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
        else if (message === 'cv_template_failed') status.textContent = 'Le CV source n’a pas pu être chargé.';
        else if (message === 'cv_style_failed') status.textContent = 'Le style A4 du CV n’a pas pu être chargé.';
        else status.textContent = `La génération a échoué (${message || 'erreur inconnue'}).`;
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
