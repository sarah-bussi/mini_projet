(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const loginPanel = document.getElementById('login-panel');
  const workspaceMain = document.querySelector('.workspace-main');
  const form = document.getElementById('login-form');
  const message = document.getElementById('login-message');
  const logoutButton = document.getElementById('logout-button');
  const userStatus = document.getElementById('user-status');

  const endpoint = (path) => `${String(config.supabaseUrl || '').replace(/\/$/, '')}${path}`;
  const headers = (token) => ({
    apikey: config.supabaseAnonKey || '',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const storageKey = 'sb_workspace_session';
  const saveSession = (session) => localStorage.setItem(storageKey, JSON.stringify(session));
  const clearSession = () => localStorage.removeItem(storageKey);
  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  };

  const isAuthorizedUser = (user) => {
    const allowed = Array.isArray(config.allowedUserIds) ? config.allowedUserIds : [];
    return Boolean(user?.id && allowed.includes(user.id));
  };

  const showWorkspace = (email) => {
    loginPanel.hidden = true;
    workspaceMain.hidden = false;
    logoutButton.hidden = false;
    if (userStatus) userStatus.textContent = email ? `Connectée avec ${email}.` : 'Connectée.';
  };

  const showLogin = (status = '') => {
    loginPanel.hidden = false;
    workspaceMain.hidden = true;
    logoutButton.hidden = true;
    if (status && message) message.textContent = status;
  };

  const validateSession = async () => {
    const session = readSession();
    if (!session?.access_token) return showLogin();
    try {
      const response = await fetch(endpoint('/auth/v1/user'), { headers: headers(session.access_token) });
      if (!response.ok) throw new Error('session');
      const user = await response.json();
      if (!isAuthorizedUser(user)) {
        clearSession();
        return showLogin('Ce compte n’est pas autorisé à accéder au workspace.');
      }
      showWorkspace(user.email || '');
    } catch {
      clearSession();
      showLogin('Ta session a expiré. Reconnecte-toi.');
    }
  };

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = 'Connexion…';
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    if (!email || !password) {
      message.textContent = 'Renseigne ton e-mail et ton mot de passe.';
      return;
    }
    try {
      const response = await fetch(endpoint('/auth/v1/token?grant_type=password'), {
        method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.access_token || !payload.user) {
        throw new Error(payload?.msg || 'Connexion impossible');
      }
      if (!isAuthorizedUser(payload.user)) {
        clearSession();
        message.textContent = 'Ce compte n’est pas autorisé à accéder au workspace.';
        return;
      }
      saveSession(payload);
      form.reset();
      message.textContent = '';
      showWorkspace(payload.user.email || email);
    } catch {
      clearSession();
      message.textContent = 'Connexion impossible. Vérifie tes identifiants.';
    }
  });

  logoutButton?.addEventListener('click', () => {
    clearSession();
    showLogin('Déconnectée.');
  });

  validateSession();
})();
