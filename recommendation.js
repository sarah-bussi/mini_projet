(() => {
  const form = document.getElementById('recommendation-form');
  const status = document.getElementById('form-status');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const strengths = data.getAll('strength');
    const body = [
      'Bonjour Sarah,',
      '',
      'Voici mon témoignage pour ton portfolio.',
      '',
      `Nom : ${data.get('name') || ''}`,
      `Poste / fonction : ${data.get('role') || ''}`,
      `Entreprise / organisation : ${data.get('company') || 'Non renseigné'}`,
      `Contact privé de vérification : ${data.get('contact-private') || ''}`,
      '',
      'Contexte de collaboration :',
      `${data.get('context') || ''}`,
      '',
      'Témoignage :',
      `${data.get('testimonial') || ''}`,
      '',
      `Points représentatifs : ${strengths.length ? strengths.join(', ') : 'Non renseignés'}`,
      `Mode d’identification souhaité : ${data.get('identity') || ''}`,
      '',
      'J’autorise la reprise de tout ou partie de ce témoignage sur le portfolio selon le mode d’identification choisi.',
      '',
      'Merci.'
    ].join('\n');

    const subject = encodeURIComponent('Témoignage professionnel pour le portfolio');
    const encodedBody = encodeURIComponent(body);
    if (status) status.textContent = 'Votre application de messagerie va s’ouvrir avec le témoignage prérempli.';
    window.location.href = `mailto:sarah.bussi2108@gmail.com?subject=${subject}&body=${encodedBody}`;
  });
})();