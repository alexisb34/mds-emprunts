# Correctifs décidés dans Figma, à répercuter dans le code

Le kit [MDS — UI Kit — Prêt de matériel](https://www.figma.com/design/pyMDlyt4X8jot1ZeHcXvtk/MDS---UI-Kit---Pr%C3%AAt-de-mat%C3%A9riel)
porte la maquette mobile depuis le 7 octobre 2026. Quand une décision est prise **dans Figma**,
c’est Figma qui fait foi et le code suit : ce fichier est la file d’attente entre les deux.

Une ligne sort d’ici quand le code est changé **et** que les tests qui citent l’ancienne valeur
le sont aussi — un libellé vit souvent dans trois endroits : la vue, un test, et un document.

## À faire

### Onglet « Salle » → « Salle photo »

**Décidé le 7 octobre 2026**, délibérément, dans la barre de navigation basse du kit.

Le code écrit `Salle` ; la maquette écrit `Salle photo`. À changer :

- `js/mobile/layout.js:19` — l’entrée `TABS` du chemin `/salle`.
- `tests/mobile-layout.test.mjs:30` — épingle les quatre libellés, le test tombera sinon.
- `docs/notice-testeurs.md:23` — « Onglet **Salle** », le seul document qui nomme l’onglet
  littéralement. Les autres parlent de « la salle photo » et restent justes.

Raison du report : c’est une retouche d’interface sans urgence, et la grouper avec d’autres
évite trois commits pour trois mots.

## Divergences connues, laissées telles quelles

- **`#d1d5db`, le gris du stepper.** Il vient du kit communautaire d’où le composant a été
  repris et n’appartient pas à la palette (le plus proche est `border/strong` `#c8c9cc`). Il est
  désormais rangé dans la variable `border/muted`, donc alignable en un point le jour où vous le
  déciderez — mais il reste hors système tant que ce n’est pas tranché.
- **Icônes `Salle` et `Emprunts`.** L’app les dessine à sa façon (`js/mobile/layout.js`,
  `ICONS.salle` et `ICONS.emprunts`) ; le kit utilise `Icon/clock` et `Icon/arrow-right-left`.
  Les deux jeux se ressemblent sans être identiques. La maquette suit le kit.

## Fait

- **`Text Field` : hauteur de cadre 10 px → épouse son contenu** (7 octobre 2026). Les
  20 variantes avaient un cadre de 10 px pour un contenu de 70 : invisible dans la bibliothèque,
  mais les champs se chevauchaient dès qu’on les posait dans un auto-layout. Correctif côté
  Figma uniquement ; le CSS était déjà juste.
