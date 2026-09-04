# Bibliothèque d’outils d’accessibilité numérique

Mini-projet séparé du portfolio, créé sur la branche `feature/a11y-tools-library`.

## Objectif

Avoir un point d’entrée unique pour retrouver rapidement quel outil utiliser selon un besoin métier : audit automatisé, audit guidé, clavier/focus, lecteurs d’écran, structure/sémantique, contraste/couleurs, développement/CI, mobile, design, PDF/documents, monitoring/gouvernance ou référentiels.

## Structure

- `index.html` : interface du répertoire
- `tools-data.js` : base des outils et métadonnées
- `app.js` : recherche, filtres et tri
- `styles.css` : mise en page responsive et accessible

## Champs suivis pour chaque outil

- nom
- catégorie métier
- type d’outil
- gratuit / freemium / payant
- priorité d’usage
- niveau d’usage métier
- niveau de fiabilité dans son périmètre
- périmètre (web, mobile, PDF, design, CI…)
- à quoi il sert concrètement
- limites à garder en tête
- lien officiel

## Principe de classement

Les notes `Usage métier` et `Fiabilité` sont des repères pratiques initiaux, pas des mesures scientifiques. Elles servent à retrouver rapidement les outils prioritaires et devront être ajustées au fil des retours d’expérience.

Aucun outil automatique ne permet de conclure seul à la conformité RGAA/WCAG. Les tests clavier, lecteurs d’écran, zoom/reflow, compréhension des contenus et revue manuelle restent nécessaires.

## Pistes d’évolution

- favoris personnels
- statut `testé / à tester`
- notes personnelles
- date du dernier test
- compatibilité Chrome / Firefox / Edge / Safari
- correspondance avec les critères RGAA les plus concernés
- filtres par rôle : designer, développeur, QA, auditeur, PO/PM
- export CSV/JSON
- ajout d’un comparateur d’outils
