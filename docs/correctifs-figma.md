# Correctifs décidés dans Figma, à répercuter dans le code

Le kit [MDS — UI Kit — Prêt de matériel](https://www.figma.com/design/pyMDlyt4X8jot1ZeHcXvtk/MDS---UI-Kit---Pr%C3%AAt-de-mat%C3%A9riel)
porte la maquette mobile depuis le 7 octobre 2026. Quand une décision est prise **dans Figma**,
c’est Figma qui fait foi et le code suit : ce fichier est la file d’attente entre les deux.

Une ligne sort d’ici quand le code est changé **et** que les tests qui citent l’ancienne valeur
le sont aussi — un libellé vit souvent dans trois endroits : la vue, un test, et un document.

## À faire

- **Le kit ne dessine aucun anneau de focus pour ses contrôles** (26 octobre 2026, reformulé le
  27). Repéré en documentant la page Bouton du design system. Aucune règle `:focus-visible` sur
  `.btn`, et le kit entier est dans ce cas : ni bouton, ni onglet (`.tab`), ni élément de
  navigation (`.nav-item`) n’en a. Deux règles seulement dessinent un anneau choisi :
  `.input` / `.select` / `.textarea` et `.kpi--link`.

  **Ce n’est pas un anneau absent, c’est un anneau non maîtrisé.** Le dépôt ne pose `outline: none`
  nulle part, donc le navigateur affiche le sien et on le voit bien en tabulant — vérifié. Le
  défaut est que sa couleur et son épaisseur changent d’un navigateur à l’autre, et que son
  contraste n’est garanti ni sur le violet de `--brand-primary` ni sur le rouge de
  `--feedback-error`, les deux fonds pleins du kit.

  La forme à reprendre existe déjà dans le dépôt, sur `.kpi--link` (`outline: 2px solid
  var(--brand-primary); outline-offset: 2px`) — reste à décider dans Figma la couleur et
  l’épaisseur, pour les boutons comme pour les onglets et la navigation, et notamment ce que
  devient l’anneau posé sur un aplat violet, où `--brand-primary` ne se verrait pas. Puis à le
  porter dans `css/components.css`. La page `design-system/composants/bouton.html` nomme ce manque
  en attendant, et un test (`tests/ds-cadre.test.mjs`) tombe le jour où une feuille du dépôt
  dessine ou supprime un anneau, pour que la documentation ne reste pas sur une description
  périmée. Elle l’est déjà restée une fois : la première version de cette ligne disait « aucun
  style de focus visible », ce qu’un lecteur réfutait en tabulant trois secondes.

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
