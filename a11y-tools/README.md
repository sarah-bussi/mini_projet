# Bibliothèque d’outils d’accessibilité numérique

Mini-projet séparé du portfolio, créé sur la branche `feature/a11y-tools-library`.

## Objectif

Avoir un point d’entrée unique pour retrouver rapidement quel outil utiliser selon un besoin métier : audit automatisé, audit guidé, clavier/focus, lecteurs d’écran, structure/sémantique, contraste/couleurs, développement/CI, responsive web, mobile, jeux vidéo, médias, design, PDF/EPUB/documents, monitoring/gouvernance ou référentiels.

La base privilégie les outils reconnus et utilisés à l’international, mais ne prétend pas être exhaustive. Le W3C recense lui-même plus de 100 outils d’évaluation et précise que sa liste n’est ni exhaustive ni une recommandation de qualité.

## Structure

- `index.html` : interface du répertoire
- `tools-data.js` : base principale des outils
- `tools-extra-data.js` : extension internationale, mobile, gaming, médias, open source et technologies d’assistance
- `app.js` : recherche, filtres, logos, périmètres et tri
- `styles.css` : mise en page responsive et accessible
- `veille.html` / `veille.js` / `veille-data.json` : veille et archives
- `sources.json` : sources de référence suivies
- `link-status.json` : état du contrôle automatique des liens
- `../scripts/update_a11y_watch.py` : collecte de veille + vérification des liens
- `../.github/workflows/a11y-watch.yml` : automatisation quotidienne

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

## Open source / GitHub

Les projets open source peuvent être très utiles pour comprendre comment une règle est implémentée, intégrer des contrôles dans le code ou découvrir des approches nouvelles. Ils sont cependant distingués des outils établis : activité du dépôt, maintenance, compatibilité et qualité doivent être vérifiées avant une adoption en production.

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

- favoris personnels
- statut `testé / à tester`
- notes personnelles
- date du dernier test
- compatibilité Chrome / Firefox / Edge / Safari
- correspondance avec les critères RGAA les plus concernés
- filtres par rôle : designer, développeur, QA, auditeur, PO/PM
- export CSV/JSON
- comparateur d’outils
- indicateur de maintenance des dépôts open source
- détection automatique de nouveaux outils via W3C/GitHub et file d’attente `à valider`
