(() => {
  const grid = document.getElementById('watch-grid');
  const sourceList = document.getElementById('source-list');
  const status = document.getElementById('watch-status');
  const search = document.getElementById('watch-search');
  const category = document.getElementById('watch-category');
  const source = document.getElementById('watch-source');
  const period = document.getElementById('watch-period');
  const personalFilter = document.getElementById('watch-personal-filter');
  const count = document.getElementById('watch-count');
  const personal = window.A11Y_PERSONAL;
  let archive = [];
  let sources = [];

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const itemId = (item) => item.url || `${item.source}:${item.title}`;

  const fillSelect = (select, values) => {
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  };

  const renderSources = () => {
    sourceList.replaceChildren();
    sources.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong><a href="${item.site}" target="_blank" rel="noopener noreferrer">${item.name}<span class="sr-only"> (nouvel onglet)</span></a></strong><p>${item.description}</p>`;
      sourceList.append(li);
    });
  };

  const matchesPersonal = (item, selected) => {
    if (selected === 'all') return true;
    const id = itemId(item);
    if (selected === 'unread') return !personal?.isActive('watch', id, 'read');
    return personal?.isActive('watch', id, selected);
  };

  const render = () => {
    const q = normalize(search.value);
    const selectedCategory = category.value;
    const selectedSource = source.value;
    const selectedPersonal = personalFilter?.value || 'all';
    const days = period.value === 'all' ? null : Number(period.value);
    const threshold = days ? Date.now() - days * 86400000 : null;

    const filtered = archive
      .filter((item) => selectedCategory === 'all' || item.category === selectedCategory)
      .filter((item) => selectedSource === 'all' || item.source === selectedSource)
      .filter((item) => matchesPersonal(item, selectedPersonal))
      .filter((item) => !threshold || !item.published || new Date(item.published).getTime() >= threshold)
      .filter((item) => !q || normalize([item.title, item.summary, item.source, item.category].join(' ')).includes(q))
      .sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));

    grid.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Aucun contenu ne correspond aux filtres actuels.';
      grid.append(empty);
    }

    filtered.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'watch-card';
      if (item.pinned) article.dataset.pinned = 'true';
      const id = itemId(item);
      if (personal?.isActive('watch', id, 'read')) article.dataset.read = 'true';
      const date = item.published ? new Date(item.published).toLocaleDateString('fr-FR') : 'Date non fournie';
      article.innerHTML = `
        <div class="watch-card-top">
          <p class="watch-category">${item.category || 'Général'}</p>
          <span class="badge watch-date">${date}</span>
        </div>
        <h3><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}<span class="sr-only"> (nouvel onglet)</span></a></h3>
        <p class="watch-meta">${item.source}</p>
        ${item.summary ? `<p class="watch-summary">${item.summary}</p>` : ''}
      `;
      if (personal) article.append(personal.createControls('watch', id, ['favorite', 'read', 'readLater', 'important']));
      grid.append(article);
    });

    count.textContent = `${filtered.length} élément${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${archive.length}.`;
  };

  Promise.all([
    fetch('veille-data.json', { cache: 'no-store' }).then((response) => response.json()),
    fetch('sources.json', { cache: 'no-store' }).then((response) => response.json()),
  ])
    .then(([watchData, sourceData]) => {
      archive = Array.isArray(watchData.items) ? watchData.items : [];
      sources = Array.isArray(sourceData.sources) ? sourceData.sources : [];
      if (status) {
        status.textContent = watchData.updatedAt
          ? `Dernière synchronisation : ${new Date(watchData.updatedAt).toLocaleString('fr-FR')}. ${archive.length} contenu(s) archivé(s).`
          : 'La veille est prête ; aucune synchronisation automatique n’a encore été enregistrée.';
      }
      fillSelect(category, [...new Set(archive.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')));
      fillSelect(source, [...new Set(archive.map((item) => item.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')));
      renderSources();
      render();
    })
    .catch(() => {
      if (status) status.textContent = 'Impossible de charger les données de veille pour le moment.';
    });

  [search, category, source, period, personalFilter].filter(Boolean).forEach((control) => {
    control.addEventListener(control === search ? 'input' : 'change', render);
  });
  window.addEventListener('a11y-personal-state-change', render);
})();
