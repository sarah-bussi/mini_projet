(() => {
  const grid = document.getElementById('research-grid');
  const status = document.getElementById('research-status');
  const count = document.getElementById('research-count');
  const search = document.getElementById('research-search');
  const domain = document.getElementById('research-domain');
  const type = document.getElementById('research-type');
  const period = document.getElementById('research-period');
  const personalFilter = document.getElementById('research-personal-filter');
  const personal = window.A11Y_PERSONAL;
  let items = [];

  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const itemId = (item) => item.url || `${item.source}:${item.title}`;

  const fill = (select, values) => {
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  };

  const matchesPersonal = (item, selected) => {
    if (selected === 'all') return true;
    const id = itemId(item);
    if (selected === 'unread') return !personal?.isActive('research', id, 'read');
    return personal?.isActive('research', id, selected);
  };

  const render = () => {
    const q = normalize(search.value);
    const selectedDomain = domain.value;
    const selectedType = type.value;
    const selectedPersonal = personalFilter.value;
    const days = period.value === 'all' ? null : Number(period.value);
    const threshold = days ? Date.now() - days * 86400000 : null;

    const filtered = items
      .filter((item) => selectedDomain === 'all' || (item.domains || []).includes(selectedDomain))
      .filter((item) => selectedType === 'all' || item.type === selectedType)
      .filter((item) => matchesPersonal(item, selectedPersonal))
      .filter((item) => !threshold || !item.published || new Date(item.published).getTime() >= threshold)
      .filter((item) => !q || normalize([item.title, item.summary, item.source, item.type, ...(item.domains || []), ...(item.keywords || [])].join(' ')).includes(q))
      .sort((a,b) => new Date(b.published || 0) - new Date(a.published || 0));

    grid.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Aucun contenu ne correspond aux filtres actuels.';
      grid.append(empty);
    }

    filtered.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'watch-card research-card';
      const id = itemId(item);
      if (personal?.isActive('research', id, 'read')) article.dataset.read = 'true';
      const date = item.published ? new Date(item.published).toLocaleDateString('fr-FR') : 'Date non fournie';
      const domains = (item.domains || []).map((value) => `<span class="domain-badge">${value}</span>`).join('');
      article.innerHTML = `
        <div class="watch-card-top">
          <p class="watch-category">${item.type || 'Ressource'}</p>
          <span class="badge watch-date">${date}</span>
        </div>
        <h3><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}<span class="sr-only"> (nouvel onglet)</span></a></h3>
        <p class="watch-meta">${item.source || 'Source non précisée'}</p>
        <div class="research-meta" aria-label="Domaines">${domains}</div>
        ${item.summary ? `<p class="watch-summary">${item.summary}</p>` : ''}
      `;
      if (personal) article.append(personal.createControls('research', id, ['favorite','read','readLater','important']));
      grid.append(article);
    });
    count.textContent = `${filtered.length} élément${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${items.length}.`;
  };

  fetch('research-data.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('HTTP')))
    .then((data) => {
      items = Array.isArray(data.items) ? data.items : [];
      const domains = [...new Set(items.flatMap((item) => item.domains || []))].sort((a,b) => a.localeCompare(b,'fr'));
      const types = [...new Set(items.map((item) => item.type).filter(Boolean))].sort((a,b) => a.localeCompare(b,'fr'));
      fill(domain, domains);
      fill(type, types);
      status.textContent = data.updatedAt
        ? `Dernière mise à jour : ${new Date(data.updatedAt).toLocaleString('fr-FR')} · ${items.length} élément(s) en base.`
        : `Base initialisée · ${items.length} élément(s).`;
      render();
    })
    .catch(() => {
      status.textContent = 'Impossible de charger les données de veille scientifique.';
    });

  [search, domain, type, period, personalFilter].forEach((control) => {
    control.addEventListener(control === search ? 'input' : 'change', render);
  });
  window.addEventListener('a11y-personal-state-change', render);
})();