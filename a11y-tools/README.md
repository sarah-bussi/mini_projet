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
- `sources.json` : sources de référence suivies
- `link-status.json` : état du contrôle automatique des liens
- `../scripts/update_a11y_watch.py` : collecte de veille + détection GitHub + vérification des liens
- `../.github/workflows/a11y-watch.yml` : automatisation quotidienne

## Suivi personnel

Le suivi est conservé dans `localStorage` du navigateur, sans compte ni serveur :

- outils : `Favori`, `Important`, `À tester`
- articles : `Favori`, `Lu`, `À lire`, `Important`
- outils détectés : `Favori`, `Important`, `À tester`, `Ignorer`

Ces états sont personnels au navigateur utilisé. Ils ne sont pas synchronisés entre plusieurs appareils.

## Nouveaux outils détectés

La veille interroge quotidiennement GitHub avec plusieurs recherches ciblées sur l’accessibilité. Les dépôts récents sont ajoutés dans `detected-tools.json` uniquement s’ils ne correspondent pas déjà à un dépôt présent dans la bibliothèque principale.

Cette file est un radar, pas une recommandation. Avant promotion dans la bibliothèque principale, vérifier notamment :

- maintenance récente
- documentation
- périmètre réel
- dépendances et compatibilité
- activité du dépôt
- crédibilité des résultats
- intérêt métier concret

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
