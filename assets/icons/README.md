# Pictogrammes filaires, palette forêt et corail

Mini-bibliothèque SVG conçue pour le portfolio. Les huit pictogrammes utilisent le même trait et héritent de la couleur du thème avec `currentColor`.

## Aperçu

Ouvrir `preview.html` dans le navigateur. La galerie montre chaque pictogramme sur fond clair et sur fond forêt.

## Utilisation

Ajouter la feuille de style :

```html
<link rel="stylesheet" href="assets/icons/icons.css">
```

Puis insérer un pictogramme décoratif :

```html
<svg class="wire-icon" aria-hidden="true" focusable="false">
  <use href="assets/icons/wire-icons.svg#icon-vitruvian"></use>
</svg>
```

Avec un libellé visible :

```html
<span class="icon-label">
  <svg class="wire-icon wire-icon--small" aria-hidden="true" focusable="false">
    <use href="assets/icons/wire-icons.svg#icon-keyboard-focus"></use>
  </svg>
  Navigation clavier
</span>
```

## Catalogue et emplacements suggérés

| Identifiant | Sens | Emplacement conseillé |
| --- | --- | --- |
| `icon-vitruvian` | Corps, humain, ingénierie | Introduction ou parcours |
| `icon-accessibility` | Accessibilité universelle | Expertise ou valeurs |
| `icon-wheelchair` | Mobilité / PMR | Uniquement dans un contexte de mobilité |
| `icon-orthosis` | Orthèse instrumentée | Projet BRA(S)VO |
| `icon-cognitive` | Cognition et réseau | Ergonomie cognitive |
| `icon-vision-contrast` | Perception visuelle | Audits et contrastes |
| `icon-keyboard-focus` | Clavier et focus | Tests d'accessibilité |
| `icon-biofeedback` | Capteurs et retour temps réel | BLE, capteurs, rééducation |

## Règles d'accessibilité

- Pour un pictogramme purement décoratif, conserver `aria-hidden="true"`.
- Pour une action, donner un nom accessible au bouton ou au lien. Le pictogramme ne remplace jamais le texte.
- Ne pas employer le fauteuil roulant comme symbole générique du handicap : il représente ici la mobilité. Pour un sens large, préférer `icon-accessibility`.
- Les couleurs essentielles viennent du texte et du fond ; le corail `#FF9A83` et l'or `#FFD166` servent seulement de repères visuels.
- Taille conseillée : 24 à 48 px. Éviter d'en placer plus d'un par carte ou groupe de contenu.
