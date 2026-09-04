(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const storageKey = 'sb_workspace_session';
  const allowed = Array.isArray(config.allowedUserIds) ? config.allowedUserIds : [];

  const redirectToLogin = () => {
    window.location.replace('index.html');
  };

  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  };

  const validate = async () => {
    const session = readSession();
    if (!session?.access_token) return redirectToLogin();

    try {
      const base = String(config.supabaseUrl || '').replace(/\/$/, '');
      const response = await fetch(`${base}/auth/v1/user`, {
        headers: {
          apikey: config.supabaseAnonKey || '',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('session');
      const user = await response.json();
      if (!user?.id || !allowed.includes(user.id)) throw new Error('forbidden');
      document.documentElement.dataset.workspaceAuthorized = 'true';
    } catch {
      localStorage.removeItem(storageKey);
      redirectToLogin();
    }
  };

  validate();
})();
