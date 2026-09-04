(() => {
  const status = document.getElementById('brief-status');
  const empty = document.getElementById('brief-empty');
  const overview = document.getElementById('brief-overview');
  const storiesSection = document.getElementById('brief-stories-section');
  const toolsSection = document.getElementById('brief-tools-section');
  const actionsSection = document.getElementById('brief-actions-section');
  const storiesGrid = document.getElementById('brief-stories');
  const toolsGrid = document.getElementById('brief-tools');
  const actionsList = document.getElementById('brief-actions');

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const externalLinks = (urls) => (Array.isArray(urls) ? urls : [])
    .filter(Boolean)
    .map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Source ${index + 1}<span class="sr-only"> (nouvel onglet)</span></a>`)
    .join(' · ');

  fetch('weekly-brief.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('HTTP')))
    .then((data) => {
      const brief = data.brief;
      if (!brief || !data.generatedAt) {
        status.textContent = 'Le moteur de brief est prêt mais aucun brief IA n’a encore été généré.';
        empty.hidden = false;
        return;
      }

      const generated = new Date(data.generatedAt).toLocaleString('fr-FR');
      status.textContent = `Dernier brief généré le ${generated}, pour la période du ${data.periodStart || '—'} au ${data.periodEnd || '—'}. Sources analysées : ${data.inputCounts?.articles ?? 0} article(s) et ${data.inputCounts?.detectedTools ?? 0} outil(s) détecté(s).`;

      overview.hidden = false;
      overview.innerHTML = `
        <p class="eyebrow">Synthèse</p>
        <h2 id="brief-headline">${escapeHtml(brief.headline || 'Brief de la semaine')}</h2>
        <p class="brief-summary">${escapeHtml(brief.executiveSummary || '')}</p>
        <p class="brief-model">Généré avec ${escapeHtml(data.model || 'modèle IA')} à partir des données de veille archivées.</p>
      `;

      const stories = Array.isArray(brief.topStories) ? brief.topStories : [];
      storiesGrid.replaceChildren();
      if (stories.length) {
        storiesSection.hidden = false;
        stories.forEach((item) => {
          const article = document.createElement('article');
          article.className = 'watch-card brief-card';
          const audiences = (item.audiences || []).map((audience) => `<span class="domain-badge">${escapeHtml(audience)}</span>`).join('');
          article.innerHTML = `
            <div class="watch-card-top">
              <p class="watch-category">${escapeHtml(item.importance || 'À surveiller')}</p>
            </div>
            <h3>${escapeHtml(item.title)}</h3>
            <div class="domain-row" aria-label="Métiers concernés">${audiences}</div>
            <p>${escapeHtml(item.whyItMatters)}</p>
            <p class="brief-sources">${externalLinks(item.sourceUrls)}</p>
          `;
          storiesGrid.append(article);
        });
      }

      const tools = Array.isArray(brief.toolsToWatch) ? brief.toolsToWatch : [];
      toolsGrid.replaceChildren();
      if (tools.length) {
        toolsSection.hidden = false;
        tools.forEach((item) => {
          const article = document.createElement('article');
          article.className = 'tool-card detected-card';
          article.innerHTML = `
            <div class="tool-card-top">
              <p class="tool-category">${escapeHtml(item.action || 'Surveiller')}</p>
            </div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.reason)}</p>
            ${item.url ? `<p class="tool-link"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Voir le projet<span class="sr-only"> (nouvel onglet)</span></a></p>` : ''}
          `;
          toolsGrid.append(article);
        });
      }

      const actions = Array.isArray(brief.weekActions) ? brief.weekActions : [];
      actionsList.replaceChildren();
      if (actions.length) {
        actionsSection.hidden = false;
        actions.forEach((text) => {
          const li = document.createElement('li');
          li.textContent = text;
          actionsList.append(li);
        });
      }
    })
    .catch(() => {
      status.textContent = 'Impossible de charger le brief hebdomadaire pour le moment.';
      empty.hidden = false;
    });
})();
