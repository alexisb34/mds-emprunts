# Correctifs décidés dans Figma, à répercuter dans le code

Le kit [MDS — UI Kit — Prêt de matériel](https://www.figma.com/design/pyMDlyt4X8jot1ZeHcXvtk/MDS---UI-Kit---Pr%C3%AAt-de-mat%C3%A9riel)
porte la maquette mobile depuis le 7 octobre 2026. Quand une décision est prise **dans Figma**,
c’est Figma qui fait foi et le code suit : ce fichier est la file d’attente entre les deux.

Une ligne sort d’ici quand le code est changé **et** que les tests qui citent l’ancienne valeur
le sont aussi — un libellé vit souvent dans trois endroits : la vue, un test, et un document.

## À faire

- **`.btn` n’a aucun style de focus visible** (26 octobre 2026). Repéré en documentant la page
  Bouton du design system. Aucune règle `:focus-visible` sur `.btn` dans tout le dépôt — et le kit
  entier est dans ce cas&nbsp;: ni bouton, ni onglet (`.tab`), ni élément de navigation
  (`.nav-item`) n’en a. Seuls `.input` / `.select` / `.textarea` et `.kpi--link` sont stylés. Une
  personne qui navigue au clavier traverse un écran sans voir où elle est&nbsp;: échec du critère
  WCAG 2.4.7. La forme existe déjà dans le dépôt, sur `.kpi--link` (`outline: 2px solid
  var(--brand-primary); outline-offset: 2px`) — reste à décider dans Figma la couleur et
  l’épaisseur de l’anneau, pour les boutons comme pour les onglets et la navigation, puis à le
  porter dans `css/components.css`. La page `design-system/composants/bouton.html` nomme ce manque
  en attendant, et un test (`tests/ds-cadre.test.mjs`) échouera le jour où le style sera ajouté,
  pour que la documentation ne continue pas à annoncer un trou rebouché.

## Divergences connues, laissées telles quelles

- **`#d1d5db`, le gris du stepper.** Il vient du kit communautaire d’où le composant a été
  repris et n’appartient pas à la palette (le plus proche est `border/strong` `#c8c9cc`). Il est
  désormais rangé dans la variable `border/muted`, donc alignable en un point le jour où vous le
  déciderez — mais il reste hors système tant que ce n’est pas tranché.

## Fait

- **Onglet « Salle » → « Salle photo »** (7 octobre 2026). Décidé dans la maquette, porté dans
  `js/mobile/layout.js`, `tests/mobile-layout.test.mjs` et `docs/notice-testeurs.md`.
- **Les trois icônes de la barre de navigation suivent le kit** (7 octobre 2026) : le bouton
  central passe du viseur au QR code (`Icon/qr-code`), l’horloge de l’onglet Salle photo prend un
  rayon de 10 au lieu de 9 (`Icon/clock`), et les flèches de l’onglet Emprunts deviennent celles
  du kit (`Icon/arrow-right-left`). Tracés relevés sur les vecteurs du kit, pas approchés à l’œil.
- **`Text Field` : hauteur de cadre 10 px → épouse son contenu** (7 octobre 2026). Les
  20 variantes avaient un cadre de 10 px pour un contenu de 70 : invisible dans la bibliothèque,
  mais les champs se chevauchaient dès qu’on les posait dans un auto-layout. Correctif côté
  Figma uniquement ; le CSS était déjà juste.
