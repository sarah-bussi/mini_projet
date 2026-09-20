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
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ mode, payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'request_failed');
    return data;
  };

  const callCvAI = async (payload) => {
    const response = await fetch(cvEndpoint, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'cv_request_failed');
    if (!data?.cvPatch || !data?.analysis) throw new Error('invalid_cv_response');
    return data;
  };

  const cleanText = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFDD0-\uFDEF\uFEFF\uFFFC-\uFFFF]/g, '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const claimSafeText = (value) => cleanText(value)
    .replace(/\bProven ability to collaborate with\b/gi, 'Collaborates with')
    .replace(/\bProven ability to work with\b/gi, 'Works with')
    .replace(/\bProven ability to translate\b/gi, 'Translates')
    .replace(/\bProven ability to support\b/gi, 'Supports')
    .replace(/\bProven ability to conduct\b/gi, 'Conducts')
    .replace(/\bProven ability to review\b/gi, 'Reviews')
    .replace(/\bProven ability to test\b/gi, 'Tests')
    .replace(/\bProven ability to validate\b/gi, 'Validates');

  const esc = (value) => claimSafeText(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const text = (node) => cleanText(node?.textContent || '');
  const texts = (root, selector) => Array.from(root?.querySelectorAll(selector) || []).map(text).filter(Boolean);

  const compactDate = (meta) => {
    const value = cleanText(meta);
    const lower = value.toLowerCase();
    if (lower.includes('sncf connect')) return value;
    const years = Array.from(new Set((value.match(/20\d{2}/g) || []))).sort();
    return years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : (years[0] || value);
  };

  const displayRole = (item, isFr) => {
    if (cleanText(item?.employer) === 'Maison Perce-Neige') {
      return isFr ? "Stage d'observation - accompagnement du handicap" : 'Disability support observation placement';
    }
    return cleanText(item?.role || item?.employer || '');
  };

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

    const projects = Array.from(doc.querySelectorAll('#projects article.project-card, #projets article.project-card')).map((article) => ({
      title: text(article.querySelector('h3')),
      summary: text(article.querySelector('.cv-project-summary')) || texts(article, 'p').find(Boolean) || '',
      tags: texts(article.querySelector('.tags'), 'li'),
    }));

    const skillsRoot = doc.querySelector('#skills, #competences');
    const skills = Array.from(skillsRoot?.querySelectorAll('.skill-group') || []).map((group) => {
      const listItems = texts(group, 'li');
      const paragraphItems = texts(group, 'p');
      return {
        title: text(group.querySelector('h3')),
        items: [...listItems, ...paragraphItems],
      };
    });

    const languagesRoot = doc.querySelector('#languages, #langues');
    const languages = Array.from(languagesRoot?.querySelectorAll('.skill-group') || []).map((group) => ({
      title: text(group.querySelector('h3')),
      detail: texts(group, 'p').join(' · '),
    }));

    return { experiences, education, projects, skills, languages };
  };

  const isViaScienceApplication = (payload) => {
    const haystack = [payload?.jobTitle, payload?.company, payload?.offer, payload?.focus].map(cleanText).join(' ').toLowerCase();
    const strongSignals = [
      'veille scientifique', 'veille technologique', 'coopération scientifique', 'cooperation scientifique',
      'service scientifique', 'ambassade', 'sciences de l’ingénieur', "sciences de l'ingenieur",
      'numsi', 'coopération franco-japonaise', 'cooperation franco-japonaise'
    ];
    if (strongSignals.some((signal) => haystack.includes(signal))) return true;
    const scientificSignals = ['recherche documentaire', 'publications scientifiques', 'laboratoires', 'conférences scientifiques', 'innovation', 'robotique', 'intelligence artificielle'];
    return scientificSignals.filter((signal) => haystack.includes(signal)).length >= 3;
  };

  const viaScienceOverrides = (payload, data, patch) => {
    if (!isViaScienceApplication(payload) || payload?.outputLanguage !== 'fr') return { data, patch };

    patch.summary = 'Diplômée d’un Master MIASHS avec des compétences hybrides en intelligence artificielle appliquée, robotique, IHM et accessibilité numérique. Expérience en recherche, analyse documentaire et travail pluridisciplinaire, orientée vers la veille scientifique et technologique.';

    const sncf = data.experiences.find((item) => cleanText(item.employer) === 'SNCF Connect & Tech');
    if (sncf) {
      sncf.bullets = [
        'Analyse de problématiques techniques liées aux produits numériques et formulation de recommandations auprès d’équipes pluridisciplinaires.',
        'Collaboration avec Product Managers, UX Designers, développeurs et équipes QA sur des produits numériques web et mobiles.',
        'Recherche, analyse et synthèse de référentiels techniques et bonnes pratiques ; contribution à leur documentation et diffusion interne.',
        'Participation à des actions de sensibilisation et transmission de connaissances auprès des équipes produit.',
        'Réalisation d’évaluations d’accessibilité et suivi des anomalies jusqu’à validation des corrections.',
      ];
    }

    const a11y = data.projects.find((item) => /^A11y Copilot\b/i.test(cleanText(item.title)));
    if (a11y) {
      a11y.summary = 'Conception et évaluation d’un assistant IA combinant recherche sémantique, RAG et LLM. Recherche bibliographique, benchmark et évaluation auprès de professionnels.';
    }

    const preferredProjects = ['A11y Copilot', 'BRA(S)VO', 'SmartCare Watch', 'Braille-JP', 'SPY'];
    data.projects.sort((a, b) => {
      const rank = (title) => {
        const index = preferredProjects.findIndex((prefix) => cleanText(title).startsWith(prefix));
        return index < 0 ? 999 : index;
      };
      return rank(a.title) - rank(b.title);
    });
    data.projects = data.projects.filter((item) => preferredProjects.some((prefix) => cleanText(item.title).startsWith(prefix)));

    data.skills = [
      { title: 'Recherche, veille & analyse', items: ['Recherche documentaire', 'État de l’art', 'Analyse de publications scientifiques', 'Benchmark', 'Synthèse', 'Rédaction technique', 'RAG', 'Recherche sémantique', 'Bases documentaires'] },
      { title: 'IA & technologies numériques', items: ['Python', 'LLM / IA générative', 'RAG', 'Recherche sémantique', 'IHM', 'UX Research', 'Analyse de données'] },
      { title: 'Robotique & systèmes connectés', items: ['ESP32', 'Arduino', 'BLE', 'Capteurs', 'M5StickC Plus', 'Flutter', 'Kotlin', 'Jetpack Compose'] },
      { title: 'Gestion de projet & collaboration', items: ['Figma', 'Jira', 'Notion', 'Git', 'Agile', 'Documentation', 'Travail pluridisciplinaire', 'Présentation / vulgarisation'] },
      { title: 'Accessibilité numérique', items: ['RGAA', 'WCAG', 'EN 301 549', 'RAAM', 'Technologies d’assistance', 'Audit web / mobile'] },
    ];

    return { data, patch };
  };

  const applyPatchToData = (data, patch) => {
    const expPatch = new Map((patch?.experiences || []).map((item) => [cleanText(item?.employer), item]));
    data.experiences = data.experiences.map((item) => {
      const match = expPatch.get(cleanText(item.employer));
      return match?.bullets?.length ? { ...item, bullets: match.bullets.map(claimSafeText) } : item;
    });
    if (Array.isArray(patch?.experienceOrder) && patch.experienceOrder.length) {
      const rank = new Map(patch.experienceOrder.map((name, index) => [cleanText(name), index]));
      data.experiences.sort((a, b) => (rank.get(cleanText(a.employer)) ?? 999) - (rank.get(cleanText(b.employer)) ?? 999));
    }

    const projectPatch = new Map((patch?.projects || []).map((item) => [cleanText(item?.title), item]));
    data.projects = data.projects.map((item) => {
      const match = projectPatch.get(cleanText(item.title));
      return match ? { ...item, summary: claimSafeText(match.summary || item.summary) } : item;
    });
    if (Array.isArray(patch?.projectOrder) && patch.projectOrder.length) {
      const rank = new Map(patch.projectOrder.map((name, index) => [cleanText(name), index]));
      data.projects.sort((a, b) => (rank.get(cleanText(a.title)) ?? 999) - (rank.get(cleanText(b.title)) ?? 999));
    }
    if (Array.isArray(patch?.selectedProjects) && patch.selectedProjects.length) {
      const selected = new Set(patch.selectedProjects.map(cleanText));
      data.projects = data.projects.filter((item) => selected.has(cleanText(item.title)));
    }
    if (Array.isArray(patch?.skillGroups) && patch.skillGroups.length) {
      data.skills = patch.skillGroups.map((group) => ({
        title: claimSafeText(group?.title || ''),
        items: Array.isArray(group?.items) ? group.items.map(claimSafeText).filter(Boolean) : [],
      })).filter((group) => group.title && group.items.length).slice(0, 5);
    }
    if (Array.isArray(patch?.education) && patch.education.length) {
      const educationPatch = new Map(patch.education.map((item) => [cleanText(item?.title), claimSafeText(item?.emphasis || '')]));
      data.education = data.education.map((item) => {
        const emphasis = educationPatch.get(cleanText(item.title));
        return emphasis ? { ...item, emphasis } : item;
      });
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
    const projects = data.projects.slice(0, 5);
    const skills = data.skills.slice(0, 5);
    const languageNames = isFr
      ? { langFrench: 'Français', langEnglish: 'Anglais', langLsf: 'LSF', langJapanese: 'Japonais' }
      : { langFrench: 'French', langEnglish: 'English', langLsf: 'French Sign Language', langJapanese: 'Japanese' };
    const languages = Object.entries(languageNames)
      .map(([key, title]) => ({ title, detail: cleanText(payload[key] || '') }))
      .filter((item) => item.detail);

    const experienceHtml = `
      <section class="cv-section" aria-labelledby="exp-title"><h2 id="exp-title">${labels.experience}</h2>
        ${primary ? `<article class="exp-primary"><div class="exp-head"><div><h3>${esc(primary.employer)}</h3><p>${esc(primary.role)}</p></div><span>${esc(compactDate(primary.meta))}</span></div><ul>${primary.bullets.slice(0,6).map((b)=>`<li>${esc(b)}</li>`).join('')}</ul></article>` : ''}
        <div class="exp-grid">${secondary.map((item)=>`<article class="exp-mini"><div class="exp-mini-head"><h3>${esc(displayRole(item,isFr))}</h3><span>${esc(compactDate(item.meta))}</span></div><p class="employer">${esc(item.employer)}</p>${item.bullets[0]?`<p class="exp-summary">${esc(item.bullets[0])}</p>`:''}</article>`).join('')}</div>
      </section>`;

    const educationHtml = `<section class="cv-section compact" aria-labelledby="edu-title"><h2 id="edu-title">${labels.education}</h2><div class="education-grid">${data.education.slice(0,5).map((item)=>`<article class="education-item"><h3>${esc(item.title)}</h3>${item.details.length?`<p>${esc(item.details.join(' · '))}</p>`:''}${item.emphasis?`<p class="education-emphasis">${esc(item.emphasis)}</p>`:''}</article>`).join('')}</div></section>`;

    const projectsHtml = `<section class="cv-section" aria-labelledby="projects-title"><h2 id="projects-title">${labels.projects}</h2><div class="projects-grid">${projects.map((item)=>`<article class="project-card"><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p>${item.tags.length?`<p class="tags">${item.tags.map(esc).join(' · ')}</p>`:''}</article>`).join('')}</div></section>`;

    const skillsHtml = `<section class="cv-section" aria-labelledby="skills-title"><h2 id="skills-title">${labels.skills}</h2><div class="skills-grid">${skills.map((group)=>`<section class="skill-group"><h3>${esc(group.title)}</h3><p>${group.items.map(esc).join(' · ')}</p></section>`).join('')}</div>${languages.length?`<p class="languages-line">${languages.map((l)=>`<strong>${esc(l.title)}</strong>${l.detail?` — ${esc(l.detail)}`:''}`).join(' &nbsp; ')}</p>`:''}</section>`;

    return `<!doctype html><html lang="${isFr?'fr':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sarah Bussi — ${esc(patch?.professionalTitle||'')}</title><style>${String(cssText||'').replace(/<\/style/gi,'<\\/style')}</style></head><body><main class="application-sheet"><header class="cv-header-block"><h1>Sarah Bussi</h1><p class="job-title">${esc(patch?.professionalTitle || (isFr?'Consultante en accessibilité numérique':'Digital Accessibility Consultant'))}</p><p class="tagline">${isFr?'UX Inclusive · Technologies numériques · Qualité Produit':'Inclusive UX · Digital Technologies · Product Quality'}</p><p class="contact">Paris, France · +33 7 70 43 15 04 · sarah.bussi2108@gmail.com${payload.linkedinUrl?` · ${esc(payload.linkedinUrl)}`:''}${payload.portfolioUrl?` · ${esc(payload.portfolioUrl)}`:''}</p></header><section class="cv-section profile-section" aria-labelledby="profile-title"><h2 id="profile-title">${labels.profile}</h2><p>${esc(patch?.summary||'')}</p></section>${experienceHtml}${educationHtml}${projectsHtml}${skillsHtml}</main></body></html>`;
  };

  const buildAdaptedCv = async (payload, patch) => {
    const sourceFile = payload.cvSource === 'fr' ? '../cv.html' : '../cv-en.html';
    const [sourceResponse, cssResponse] = await Promise.all([
      fetch(sourceFile, { cache: 'no-store' }),
      fetch('./cv-application.css?v=20260911-4', { cache: 'no-store' }),
    ]);
    if (!sourceResponse.ok) throw new Error('cv_template_failed');
    if (!cssResponse.ok) throw new Error('cv_style_failed');
    const [sourceHtml, cssText] = await Promise.all([sourceResponse.text(), cssResponse.text()]);
    const sourceDoc = new DOMParser().parseFromString(sourceHtml, 'text/html');
    let data = applyPatchToData(parseSourceCv(sourceDoc), patch);
    const overridden = viaScienceOverrides(payload, data, patch);
    data = overridden.data;
    return buildDedicatedTemplate(payload, overridden.patch, data, cssText);
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
      status.textContent = 'Génération en cours…'; result.textContent = '';
      const previewSection = document.getElementById('cv-preview-section'); if (previewSection) previewSection.hidden = true;
      try {
        if (mode === 'cv') {
          const data = await callCvAI(payload);
          result.textContent = renderAnalysis(data.analysis);
          await showCvPreview(payload, data);
        }
        else { const data = await callAI(mode, payload); result.textContent = data.text || data.result || JSON.stringify(data, null, 2); }
        status.textContent = 'Terminé.';
      } catch (error) {
        console.error(error); const message = String(error?.message || '');
        if (message === 'session_missing') status.textContent = 'Session absente. Reconnecte-toi au workspace.';
        else status.textContent = `La génération a échoué${message ? ` (${message})` : ''}.`;
      }
    });
  };

  document.getElementById('cv-print-adapted')?.addEventListener('click', () => {
    const frame = document.getElementById('cv-preview-frame'); frame?.contentWindow?.focus(); frame?.contentWindow?.print();
  });
  document.getElementById('cv-open-adapted')?.addEventListener('click', () => {
    if (!adaptedCvHtml) return; const blob = new Blob([adaptedCvHtml], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  bindForm('cv-builder-form', 'cv-status', 'cv-result', 'cv');
  bindForm('copilot-form', 'copilot-status', 'copilot-result', 'copilot');
})();