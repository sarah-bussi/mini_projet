(() => {
  const config = window.WORKSPACE_CONFIG || {};
  const endpoint = `${String(config.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/workspace-cv`;
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
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const cvPdfBase64 = btoa(binary);
      const payload = {
        action: 'cover-letter-pdf',
        cvPdfBase64,
        cvFileName: file.name,
        jobTitle: String(fd.get('jobTitle') || ''),
        company: String(fd.get('company') || ''),
        offer: String(fd.get('offer') || ''),
        focus: String(fd.get('focus') || ''),
        tone: String(fd.get('tone') || 'natural'),
        length: String(fd.get('length') || 'standard'),
        outputLanguage: String(fd.get('outputLanguage') || 'fr'),
      };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
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