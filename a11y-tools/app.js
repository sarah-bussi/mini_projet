(() => {
  const tools = Array.isArray(window.A11Y_TOOLS) ? window.A11Y_TOOLS : [];
  const grid = document.getElementById('tools-grid');
  const search = document.getElementById('search');
  const categoryFilter = document.getElementById('category-filter');
  const domainFilter = document.getElementById('domain-filter');
  const priceFilter = document.getElementById('price-filter');
  const priorityFilter = document.getElementById('priority-filter');
  const count = document.getElementById('results-count');
  const linkSummary = document.getElementById('link-check-summary');
  let linkStatus = {};

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const inferDomains = (tool) => {
    if (Array.isArray(tool.domains) && tool.domains.length) return tool.domains;
    const text = normalize([tool.name, tool.category, tool.type, tool.scope].join(' '));
    const domains = new Set();

    if (/android|ios|mobile|flutter|xcode|talkback|voiceover/.test(text)) domains.add('Mobile');
    if (/responsive|viewport|reflow|device mode/.test(text)) domains.add('Responsive web');
    if (/jeu|game|gaming|unity|unreal|xbox|ablegamers/.test(text)) domains.add('Jeux vidéo');
    if (/media|video|audio|subtitle|caption|webvtt|player|sous-titre/.test(text)) domains.add('Médias');
    if (/pdf|epub|document|office|word|powerpoint|excel/.test(text)) domains.add('Documents');
    if (/design|figma|contrast|couleur|color/.test(text)) domains.add('Design');
    if (/ci\b|code|develop|eslint|storybook|jest|cypress|playwright|framework|lint|axe-core/.test(text)) domains.add('Développement');
    if (/screen reader|lecteur d.ecran|nvda|jaws|voiceover|talkback|orca|narrator|switch|voice access|assistive/.test(text)) domains.add('Assistive tech');
    if (/web|browser|chrome|firefox|html|aria|wcag|rgaa|site/.test(text)) domains.add('Web');
    if (!domains.size) domains.add('Web');
    return [...domains];
  };

  tools.forEach((tool) => {
    tool._domains = inferDomains(tool);
  });

  const categories = [...new Set(tools.map((tool) => tool.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });

  const domains = [...new Set(tools.flatMap((tool) => tool._domains))].sort((a, b) => a.localeCompare(b, 'fr'));
  domains.forEach((domain) => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    domainFilter?.append(option);
  });

  const stars = (value) => '★'.repeat(value) + '☆'.repeat(5 - value);

  const knownOpenSource = new Set([
    'axe-core', 'Pa11y', 'Storybook Accessibility Addon', 'eslint-plugin-jsx-a11y',
    'HTML_CodeSniffer', 'Screen Reader Testing Library', 'Accessibility Insights for Web',
  ]);

  const isOpenSource = (tool) => Boolean(tool.openSource || knownOpenSource.has(tool.name));

  const brandSlugs = {
    w3c: 'w3c', github: 'github', chrome: 'googlechrome', firefox: 'firefoxbrowser',
    android: 'android', apple: 'apple', microsoft: 'microsoft', flutter: 'flutter',
    unity: 'unity', unreal: 'unrealengine', xbox: 'xbox', browserstack: 'browserstack',
    ibm: 'ibm', figma: 'figma', storybook: 'storybook', cypress: 'cypress',
    adobe: 'adobeacrobatreader', google: 'google',
  };

  const inferBrand = (tool) => {
    if (tool.brand) return tool.brand;
    const name = normalize(tool.name);
    if (name.includes('ibm')) return 'ibm';
    if (name.includes('chrome') || name.includes('lighthouse')) return 'chrome';
    if (name.includes('firefox')) return 'firefox';
    if (name.includes('android') || name.includes('talkback')) return 'android';
    if (name.includes('voiceover') || name.includes('xcode')) return 'apple';
    if (name.includes('microsoft') || name.includes('narrator')) return 'microsoft';
    if (name.includes('flutter')) return 'flutter';
    if (name.includes('storybook')) return 'storybook';
    if (name.includes('cypress')) return 'cypress';
    if (name.includes('figma')) return 'figma';
    if (name.includes('acrobat')) return 'adobe';
    if (tool.url?.includes('github.com')) return 'github';
    if (tool.url?.includes('w3.org')) return 'w3c';
    return '';
  };

  const logoUrl = (tool) => {
    const brand = inferBrand(tool);
    const slug = brandSlugs[brand];
    if (slug) return `https://cdn.simpleicons.org/${slug}`;
    if (!tool.url) return '';
    try {
      const origin = new URL(tool.url).origin;
      return `${origin}/favicon.ico`;
    } catch {
      return '';
    }
  };

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
    const domain = domainFilter?.value || 'all';
    const price = priceFilter.value;
    const priority = priorityFilter.value;

    const filtered = tools
      .filter((tool) => category === 'all' || tool.category === category)
      .filter((tool) => domain === 'all' || tool._domains.includes(domain))
      .filter((tool) => price === 'all' || normalize(tool.price).includes(normalize(price)))
      .filter((tool) => priority === 'all' || tool.priority === priority)
      .filter((tool) => !q || normalize([
        tool.name, tool.category, tool.type, tool.scope, tool.bestFor,
        tool.limits, tool.price, tool.priority, tool._domains.join(' '),
        isOpenSource(tool) ? 'open source github libre' : '',
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
      const logo = logoUrl(tool);
      const openSourceBadge = isOpenSource(tool) ? '<span class="badge badge-open">Open source</span>' : '';
      const domainBadges = tool._domains.map((item) => `<span class="domain-badge">${item}</span>`).join('');
      article.innerHTML = `
        <div class="tool-card-top">
          <p class="tool-category">${tool.category}</p>
          <div class="badge-row"><span class="badge">${tool.price}</span>${openSourceBadge}</div>
        </div>
        <div class="tool-heading">
          ${logo ? `<span class="tool-logo-wrap"><img class="tool-logo" src="${logo}" alt="" loading="lazy" /></span>` : ''}
          <h3>${tool.name}</h3>
        </div>
        <p class="tool-type">${tool.type} · ${tool.scope}</p>
        <div class="domain-row" aria-label="Périmètres">${domainBadges}</div>
        <dl>
          <div><dt>Priorité</dt><dd>${tool.priority}</dd></div>
          <div><dt>Usage métier</dt><dd><span aria-label="${tool.usage} sur 5">${stars(tool.usage)}</span></dd></div>
          <div><dt>Fiabilité</dt><dd><span aria-label="${tool.reliability} sur 5">${stars(tool.reliability)}</span></dd></div>
        </dl>
        <p><strong>À utiliser pour :</strong> ${tool.bestFor}</p>
        <p class="limits"><strong>À garder en tête :</strong> ${tool.limits}</p>
        ${tool.url ? `<p class="tool-link"><a href="${tool.url}" target="_blank" rel="noopener noreferrer">Site / documentation<span class="sr-only"> (nouvel onglet)</span></a>${linkLabel(tool.url)}</p>` : ''}
      `;
      article.querySelector('.tool-logo')?.addEventListener('error', (event) => {
        event.currentTarget.closest('.tool-logo-wrap')?.remove();
      }, { once: true });
      grid.append(article);
    });

    count.textContent = `${filtered.length} outil${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${tools.length}.`;
  };

  [search, categoryFilter, domainFilter, priceFilter, priorityFilter].filter(Boolean).forEach((control) => {
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
