# Bibliothèque d’outils d’accessibilité numérique

Mini-projet séparé du portfolio, créé sur la branche `feature/a11y-tools-library`.

## Objectif

Avoir un point d’entrée unique pour retrouver rapidement quel outil utiliser selon un besoin métier : audit automatisé, audit guidé, clavier/focus, lecteurs d’écran, structure/sémantique, contraste/couleurs, développement/CI, responsive web, mobile, jeux vidéo, médias, design, PDF/EPUB/documents, monitoring/gouvernance ou référentiels.

La base privilégie les outils reconnus et utilisés à l’international, mais ne prétend pas être exhaustive. Les nouveaux projets sont placés dans une file de détection distincte avant toute intégration dans la bibliothèque principale.

## Structure

- `index.html` : interface du répertoire
- `tools-data.js` : base principale des outils
- `tools-extra-data.js` : extension internationale, mobile, gaming, médias, open source et technologies d’assistance
- `app.js` : recherche, filtres, logos, périmètres, tri et suivi personnel des outils
- `personal-state.js` : Favori / Lu / À lire / Important / À tester stockés localement
- `styles.css` : mise en page responsive et accessible
- `veille.html` / `veille.js` / `veille-data.json` : veille et archives avec suivi de lecture
- `detected.html` / `detected.js` / `detected-tools.json` : file des nouveaux outils détectés automatiquement
- `brief.html` / `brief.js` / `weekly-brief.json` : synthèse IA hebdomadaire
- `sources.json` : sources de référence suivies
- `link-status.json` : état du contrôle automatique des liens
- `../scripts/update_a11y_watch.py` : collecte de veille + détection GitHub + vérification des liens
- `../scripts/generate_a11y_weekly_brief.py` : synthèse hebdomadaire assistée par IA
- `../.github/workflows/a11y-watch.yml` : automatisation quotidienne
- `../.github/workflows/a11y-weekly-ai.yml` : brief IA chaque dimanche + déclenchement manuel

## Suivi personnel

Le suivi est conservé dans `localStorage` du navigateur, sans compte ni serveur :

- outils : `Favori`, `Important`, `À tester`
- articles : `Favori`, `Lu`, `À lire`, `Important`
- outils détectés : `Favori`, `Important`, `À tester`, `Ignorer`

Ces états sont personnels au navigateur utilisé. Ils ne sont pas synchronisés entre plusieurs appareils.

## Veille quotidienne

La veille collecte les flux configurés, interroge GitHub pour repérer de nouveaux projets d’accessibilité et vérifie les liens des outils. Cette partie ne nécessite aucune clé OpenAI.

La file des nouveaux outils est un radar, pas une recommandation. Avant promotion dans la bibliothèque principale, vérifier notamment : maintenance récente, documentation, périmètre réel, dépendances, compatibilité, activité du dépôt, crédibilité des résultats et intérêt métier concret.

## Brief IA hebdomadaire

Le brief IA analyse uniquement les données déjà collectées dans `veille-data.json` et `detected-tools.json`. Il produit une synthèse courte en français : actualités prioritaires, impact métier, outils à tester/surveiller et actions proposées. Les URL de sortie sont limitées aux URL présentes dans les données sources.

Le modèle par défaut est `gpt-5-mini`. Il peut être remplacé via la variable d’environnement `OPENAI_BRIEF_MODEL`.

### Configuration nécessaire

Dans GitHub :

1. ouvrir `Settings`
2. `Secrets and variables`
3. `Actions`
4. `New repository secret`
5. nom : `OPENAI_API_KEY`
6. valeur : une clé API OpenAI

La clé ne doit jamais être ajoutée dans les fichiers du dépôt ni dans le JavaScript envoyé au navigateur.

Le workflow `.github/workflows/a11y-weekly-ai.yml` est prévu chaque dimanche à `07:23 UTC` et peut aussi être lancé manuellement avec `workflow_dispatch`.

Important : les workflows GitHub Actions planifiés par `schedule` s’exécutent depuis la branche par défaut. Tant que ce projet reste uniquement sur `feature/a11y-tools-library`, utiliser le lancement manuel pour tester. Après fusion du workflow dans `main`, la planification hebdomadaire pourra fonctionner normalement.

Si `OPENAI_API_KEY` est absent, le script termine proprement sans écraser le dernier brief généré.

## Champs suivis pour chaque outil

- nom
- catégorie métier
- type d’outil
- gratuit / freemium / payant
- priorité d’usage
- niveau d’usage métier
- niveau de fiabilité dans son périmètre
- périmètre produit (web, responsive, Android, iOS, Flutter, jeux vidéo, médias, PDF, EPUB, design, CI…)
- statut open source lorsque pertinent
- à quoi il sert concrètement
- limites à garder en tête
- lien officiel ou dépôt principal
- logo ou favicon lorsqu’il est disponible

## Principe de classement

Les notes `Usage métier` et `Fiabilité` sont des repères pratiques initiaux, pas des mesures scientifiques. Elles servent à retrouver rapidement les outils prioritaires et devront être ajustées au fil des retours d’expérience.

Aucun outil automatique ne permet de conclure seul à la conformité RGAA/WCAG. Les tests clavier, lecteurs d’écran, commande vocale/contacteurs, zoom/reflow, vraie utilisation mobile, médias, compréhension des contenus et revue manuelle restent nécessaires.

## Couverture actuelle

- web desktop et responsive
- Android, iOS et Flutter
- technologies d’assistance : lecteurs d’écran, commande vocale, switch
- développement, composants et CI/CD
- jeux vidéo : guidelines, Unity, Unreal, Xbox, AbleGamers
- médias : lecteurs, sous-titres, WebVTT, audiodescription
- PDF, Office, EPUB
- design et contrastes
- monitoring et gouvernance
- ressources RGAA, WCAG et internationales
- projets communautaires / open source sélectionnés

## Pistes d’évolution

- notes personnelles libres
- date du dernier test
- compatibilité Chrome / Firefox / Edge / Safari
- correspondance avec les critères RGAA les plus concernés
- filtres par rôle : designer, développeur, QA, auditeur, PO/PM
- export / import du suivi personnel
- comparateur d’outils
- indicateur de maintenance des dépôts open source
- workflow de promotion d’un outil détecté vers la bibliothèque principale
