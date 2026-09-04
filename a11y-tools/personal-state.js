(() => {
  const STORAGE_KEY = 'a11y-hub-personal-state-v1';
  const labels = {
    favorite: 'Favori',
    read: 'Lu',
    readLater: 'À lire',
    important: 'Important',
    toTest: 'À tester',
    dismissed: 'Ignorer',
  };

  const readStore = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  };

  const writeStore = (store) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Le suivi reste simplement indisponible si le stockage local est bloqué.
    }
  };

  const keyFor = (type, id) => `${type}:${id}`;

  const get = (type, id) => {
    const store = readStore();
    return store[keyFor(type, id)] || {};
  };

  const set = (type, id, name, value) => {
    const store = readStore();
    const key = keyFor(type, id);
    const current = store[key] || {};
    current[name] = Boolean(value);
    current.updatedAt = new Date().toISOString();
    store[key] = current;
    writeStore(store);
    window.dispatchEvent(new CustomEvent('a11y-personal-state-change', {
      detail: { type, id, name, value: Boolean(value) },
    }));
    return current;
  };

  const isActive = (type, id, name) => Boolean(get(type, id)[name]);

  const createControls = (type, id, options) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'personal-actions';
    wrapper.setAttribute('aria-label', 'Suivi personnel');

    options.forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'personal-action';
      button.dataset.personalState = name;
      button.textContent = labels[name] || name;

      const refresh = () => {
        const active = isActive(type, id, name);
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active', active);
      };

      button.addEventListener('click', () => {
        set(type, id, name, !isActive(type, id, name));
        refresh();
      });
      refresh();
      wrapper.append(button);
    });

    return wrapper;
  };

  window.A11Y_PERSONAL = Object.freeze({
    get,
    set,
    isActive,
    createControls,
    labels,
    storageKey: STORAGE_KEY,
  });
})();
