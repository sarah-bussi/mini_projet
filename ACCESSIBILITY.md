# Note d'accessibilité

Ce portfolio a été conçu avec l'accessibilité comme contrainte de base. Il ne revendique **pas** une conformité RGAA/WCAG complète tant qu'un audit manuel en navigateur et avec technologies d'assistance n'a pas été réalisé.

## Mesures intégrées

- document en français (`lang="fr"`)
- un seul `h1`, hiérarchie de titres structurée
- landmarks sémantiques : `header`, `nav`, `main`, `section`, `article`, `footer`
- lien d'évitement visible au focus
- navigation disponible sur desktop **et mobile**
- focus clavier à fort contraste
- boutons natifs pour le filtre et le changement de thème
- état des boutons de filtre exposé avec `aria-pressed`
- annonce polie du nombre de projets affichés avec `aria-live`
- désactivation/réduction des mouvements via `prefers-reduced-motion`
- renforcement des bordures avec `prefers-contrast: more`
- pas de dépendance à une police web, un framework ou des icônes externes
- informations non véhiculées uniquement par la couleur
- contenu principal accessible même si JavaScript est désactivé

## Vérifications statiques à maintenir

- présence de `lang="fr"`
- unicité du `h1`
- unicité des identifiants HTML
- vérification des ancres internes

## À vérifier avant publication définitive

- parcours clavier complet dans Chrome / Firefox / Safari
- test NVDA + Firefox/Chrome
- test VoiceOver + Safari et TalkBack si version mobile prioritaire
- zoom à 200 % et reflow à 320 CSS px
- contrastes sur l'ensemble des états interactifs
- ordre de lecture et cohérence du filtre de projets
- contenu et structure du CV HTML
