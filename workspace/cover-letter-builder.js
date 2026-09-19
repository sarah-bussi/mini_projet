(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const endpoint = `${String(config.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/workspace-cover-letter-pdf`;
  const storageKey = 'sb_workspace_session';

  const session = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; }
  };
  const headers = () => {
    const s = session();
    if (!s?.access_token) throw new Error('session_missing');
    return { apikey: config.supabaseAnonKey || '', Authorization: `Bearer ${s.access_token}` };
  };

  const form = document.getElementById('letter-form');
  const status = document.getElementById('letter-status');
  const result = document.getElementById('letter-result');
  const editor = document.getElementById('letter-editor');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Lecture du PDF et génération de la lettre…';
    result.hidden = true;
    const fd = new FormData(form);
    const file = fd.get('cvFile');
    if (!(file instanceof File) || file.type !== 'application/pdf') {
      status.textContent = 'Choisis un CV au format PDF.';
      return;
    }
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: headers(), body: fd });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.letter) throw new Error(data?.error || 'letter_request_failed');
      editor.value = data.letter;
      result.hidden = false;
      status.textContent = `Lettre générée à partir du CV importé${data.cvCharacters ? ` (${data.cvCharacters} caractères de CV analysés)` : ''}.`;
    } catch (error) {
      console.error(error);
      status.textContent = `La génération a échoué (${String(error?.message || 'erreur inconnue')}).`;
    }
  });

  document.getElementById('letter-copy')?.addEventListener('click', async () => {
    if (!editor?.value) return;
    await navigator.clipboard.writeText(editor.value);
    status.textContent = 'Lettre copiée.';
  });

  document.getElementById('letter-print')?.addEventListener('click', () => {
    if (!editor?.value) return;
    const popup = window.open('', '_blank', 'noopener');
    if (!popup) return;
    const safe = editor.value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Lettre de motivation — Sarah Bussi</title><style>@page{size:A4;margin:22mm}body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.55;color:#111;max-width:170mm;margin:auto}</style></head><body>${safe}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  });
})();