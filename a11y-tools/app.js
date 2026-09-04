(() => {
  const tools = Array.isArray(window.A11Y_TOOLS) ? window.A11Y_TOOLS : [];
  const grid = document.getElementById('tools-grid');
  const search = document.getElementById('search');
  const categoryFilter = document.getElementById('category-filter');
  const priceFilter = document.getElementById('price-filter');
  const priorityFilter = document.getElementById('priority-filter');
  const count = document.getElementById('results-count');
  const linkSummary = document.getElementById('link-check-summary');
  let linkStatus = {};

  const categories = [...new Set(tools.map((tool) => tool.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });

  const stars = (value) => '★'.repeat(value) + '☆'.repeat(5 - value);
  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const linkLabel = (url) => {
    const status = linkStatus[url];
    if (!status) return '';
    const labels = {
      ok: 'Lien vérifié',
      redirected: 'Lien redirigé mais valide',
      blocked: 'Vérification bloquée par le site',
      broken: 'Lien à vérifier',
    };
    return `<span class="link-status link-status-${status.state}">${labels[status.state] || 'État inconnu'}${status.code ? ` · HTTP ${status.code}` : ''}</span>`;
  };

  const render = () => {
    const q = normalize(search.value);
    const category = categoryFilter.value;
    const price = priceFilter.value;
    const priority = priorityFilter.value;

    const filtered = tools
      .filter((tool) => category === 'all' || tool.category === category)
      .filter((tool) => price === 'all' || tool.price === price)
      .filter((tool) => priority === 'all' || tool.priority === priority)
      .filter((tool) => !q || normalize([
        tool.name, tool.category, tool.type, tool.scope, tool.bestFor,
        tool.limits, tool.price, tool.priority,
      ].join(' ')).includes(q))
      .sort((a, b) => {
        const priorityOrder = { Indispensable: 0, 'Très utile': 1, Complémentaire: 2 };
        return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
          || b.usage - a.usage
          || b.reliability - a.reliability
          || a.name.localeCompare(b.name, 'fr');
      });

    grid.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Aucun outil ne correspond aux filtres actuels.';
      grid.append(empty);
    }

    filtered.forEach((tool) => {
      const article = document.createElement('article');
      article.className = 'tool-card';
      article.innerHTML = `
        <div class="tool-card-top">
          <p class="tool-category">${tool.category}</p>
          <span class="badge">${tool.price}</span>
        </div>
        <h3>${tool.name}</h3>
        <p class="tool-type">${tool.type} · ${tool.scope}</p>
        <dl>
          <div><dt>Priorité</dt><dd>${tool.priority}</dd></div>
          <div><dt>Usage métier</dt><dd><span aria-label="${tool.usage} sur 5">${stars(tool.usage)}</span></dd></div>
          <div><dt>Fiabilité</dt><dd><span aria-label="${tool.reliability} sur 5">${stars(tool.reliability)}</span></dd></div>
        </dl>
        <p><strong>À utiliser pour :</strong> ${tool.bestFor}</p>
        <p class="limits"><strong>À garder en tête :</strong> ${tool.limits}</p>
        ${tool.url ? `<p class="tool-link"><a href="${tool.url}" target="_blank" rel="noopener noreferrer">Site / documentation officielle<span class="sr-only"> (nouvel onglet)</span></a>${linkLabel(tool.url)}</p>` : ''}
      `;
      grid.append(article);
    });

    count.textContent = `${filtered.length} outil${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${tools.length}.`;
  };

  [search, categoryFilter, priceFilter, priorityFilter].forEach((control) => {
    control.addEventListener(control === search ? 'input' : 'change', render);
  });

  fetch('link-status.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      if (!data) return;
      linkStatus = data.links || {};
      if (linkSummary && data.checkedAt) {
        const broken = Object.values(linkStatus).filter((item) => item.state === 'broken').length;
        linkSummary.textContent = `Dernier contrôle automatique des liens : ${new Date(data.checkedAt).toLocaleString('fr-FR')}. ${broken ? `${broken} lien(s) à vérifier.` : 'Aucun lien cassé détecté.'}`;
      }
      render();
    })
    .catch(() => {});

  render();
})();
