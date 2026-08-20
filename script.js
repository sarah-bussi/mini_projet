(() => {
  const root = document.documentElement;

  if (!document.querySelector('link[href="modals.css"]')) {
    const modalStyles = document.createElement('link');
    modalStyles.rel = 'stylesheet';
    modalStyles.href = 'modals.css';
    document.head.appendChild(modalStyles);
  }

  const themeButton = document.getElementById('theme-toggle');
  const themeLabel = themeButton?.querySelector('.theme-toggle-label');
  const savedTheme = localStorage.getItem('portfolio-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const isDark = theme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(isDark));
      themeButton.setAttribute('aria-label', isDark ? 'Activer le mode clair' : 'Activer le mode sombre');
    }
    if (themeLabel) themeLabel.textContent = isDark ? 'Contraste clair' : 'Contraste sombre';
  };

  applyTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'));

  themeButton?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem('portfolio-theme', nextTheme);
  });

  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const projectCards = [...document.querySelectorAll('.project-card[data-tags]')];
  const filterStatus = document.getElementById('filter-status');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter || 'all';
      filterButtons.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });

      let visibleCount = 0;
      projectCards.forEach((card) => {
        const tags = (card.dataset.tags || '').split(' ');
        const visible = filter === 'all' || tags.includes(filter);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      if (filterStatus) {
        filterStatus.textContent = `${visibleCount} projet${visibleCount > 1 ? 's' : ''} affiché${visibleCount > 1 ? 's' : ''}.`;
      }
    });
  });

  let opener = null;
  const dialogButtons = [...document.querySelectorAll('[data-dialog]')];
  const dialogs = [...document.querySelectorAll('dialog.project-dialog')];

  dialogButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.dialog);
      if (!(dialog instanceof HTMLDialogElement)) return;
      opener = button;
      dialog.showModal();
      dialog.querySelector('[data-close]')?.focus();
    });
  });

  dialogs.forEach((dialog) => {
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', (event) => {
      const rect = dialog.getBoundingClientRect();
      const isBackdrop = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (isBackdrop) dialog.close();
    });

    dialog.addEventListener('close', () => {
      if (opener instanceof HTMLElement) opener.focus();
      opener = null;
    });
  });

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();