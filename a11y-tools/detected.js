(() => {
  const grid = document.getElementById('detected-grid');
  const status = document.getElementById('detected-status');
  const search = document.getElementById('detected-search');
  const personalFilter = document.getElementById('detected-personal-filter');
  const activityFilter = document.getElementById('detected-activity-filter');
  const count = document.getElementById('detected-count');
  const personal = window.A11Y_PERSONAL;
  let items = [];

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const itemId = (item) => item.url || item.fullName || item.name;

  const render = () => {
    const q = normalize(search.value);
    const selectedPersonal = personalFilter.value;
    const days = activityFilter.value === 'all' ? null : Number(activityFilter.value);
    const threshold = days ? Date.now() - days * 86400000 : null;

    const filtered = items
      .filter((item) => !q || normalize([
        item.name, item.fullName, item.description, item.language, item.source,
      ].join(' ')).includes(q))
      .filter((item) => {
        if (selectedPersonal === 'all') return true;
        return personal?.isActive('detected', itemId(item), selectedPersonal);
      })
      .filter((item) => {
        if (!threshold || !item.updatedAt) return true;
        return new Date(item.updatedAt).getTime() >= threshold;
      })
      .sort((a, b) => (b.stars || 0) - (a.stars || 0)
        || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    grid.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Aucun nouvel outil ne correspond aux filtres actuels.';
      grid.append(empty);
    }

    filtered.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'tool-card detected-card';
      const id = itemId(item);
      const updated = item.updatedAt
        ? new Date(item.updatedAt).toLocaleDateString('fr-FR')
        : 'Date inconnue';
      article.innerHTML = `
        <div class="tool-card-top">
          <p class="tool-category">${item.source || 'Détection automatique'}</p>
          <span class="badge">${item.language || 'Langage non précisé'}</span>
        </div>
        <div class="tool-heading">
          <span class="tool-logo-wrap"><img class="tool-logo" src="https://cdn.simpleicons.org/github" alt="" loading="lazy" /></span>
          <h3><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name || item.fullName}<span class="sr-only"> (nouvel onglet)</span></a></h3>
        </div>
        <p class="tool-type">${item.fullName || ''}</p>
        ${item.description ? `<p>${item.description}</p>` : ''}
        <dl>
          <div><dt>Étoiles</dt><dd>${Number(item.stars || 0).toLocaleString('fr-FR')}</dd></div>
          <div><dt>Dernière activité</dt><dd>${updated}</dd></div>
          <div><dt>Détecté le</dt><dd>${item.detectedAt ? new Date(item.detectedAt).toLocaleDateString('fr-FR') : 'Non précisé'}</dd></div>
        </dl>
      `;
      if (personal) {
        article.append(personal.createControls('detected', id, ['favorite', 'important', 'toTest', 'dismissed']));
      }
      grid.append(article);
    });

    count.textContent = `${filtered.length} projet${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${items.length}.`;
  };

  fetch('detected-tools.json', { cache: 'no-store' })
    .then((response) => response.json())
    .then((data) => {
      items = Array.isArray(data.items) ? data.items : [];
      status.textContent = data.updatedAt
        ? `Dernière détection : ${new Date(data.updatedAt).toLocaleString('fr-FR')}. ${items.length} projet(s) en file.`
        : 'La file est prête ; la première détection automatique n’a pas encore été enregistrée.';
      render();
    })
    .catch(() => {
      status.textContent = 'Impossible de charger les nouveaux outils détectés pour le moment.';
    });

  [search, personalFilter, activityFilter].forEach((control) => {
    control.addEventListener(control === search ? 'input' : 'change', render);
  });
  window.addEventListener('a11y-personal-state-change', render);
})();
