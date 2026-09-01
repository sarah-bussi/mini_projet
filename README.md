# Portfolio accessible de Sarah Bussi

Portfolio statique en HTML/CSS/JavaScript, pensé pour être déployé facilement sur GitHub Pages.

## Contenu

- `index.html` : portfolio principal
- `cv.html` : CV en version HTML accessible
- `styles.css` : styles responsive, thèmes clair/sombre et gestion des préférences utilisateur
- `script.js` : changement de thème et filtres de projets
- `ACCESSIBILITY.md` : choix d'accessibilité et vérifications à réaliser

## Principes d'accessibilité intégrés

- structure HTML sémantique (`header`, `nav`, `main`, `section`, `article`, `footer`)
- lien d'évitement vers le contenu principal
- hiérarchie de titres cohérente
- focus clavier très visible
- cibles interactives de taille confortable
- filtre de projets utilisable au clavier et état exposé via `aria-pressed`
- annonce du nombre de projets filtrés avec `aria-live`
- thème clair/sombre avec état programmatique
- prise en compte de `prefers-reduced-motion`
- prise en compte de `prefers-contrast: more`
- aucune police, icône ou librairie JavaScript externe obligatoire
- contenu principal utilisable sans JavaScript

## Déploiement GitHub Pages

Dans **Settings → Pages**, choisir **Deploy from a branch**, sélectionner `portfolio-site` puis le dossier `/root`.

## Prochaines améliorations possibles

- ajouter des captures anonymisées et non confidentielles des projets ;
- ajouter une version anglaise ;
- enrichir les études de cas avec contexte, rôle, méthode, décisions et résultats ;
- réaliser un audit manuel complet avant toute revendication de conformité.
