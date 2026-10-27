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

- **Onze paires de couleurs du kit sont sous le seuil de lisibilité de 4,5:1** (constat du
  26 octobre 2026). Mesuré en écrivant le chapitre Couleurs du design system
  (`design-system/couleurs.html`), qui les publie telles quelles, avec leur ratio. La décision
  prise ce jour est de **publier plutôt que de corriger** la palette d’un prototype qui tourne :
  rien n’a été changé dans `css/tokens.css` ni dans `css/components.css`, et **la correction
  reste à décider dans Figma**. Les ratios sont jugés sur le rapport exact et arrondis au
  centième pour l’affichage seulement. Chaque paire est formée par le CSS : la page cite le
  sélecteur qui la produit, et un test (`tests/ds-dette.test.mjs`) le retrouve.

  | Paire | Ratio | Texte sur fond | Taille |
  |---|---|---|---|
  | `badge--maintenance` | 1,72:1 | `--status-maintenance-fg` sur `--status-maintenance-bg` | 11 px, gras |
  | `badge--available` | 2,49:1 | `--status-available-fg` sur `--status-available-bg` | 11 px, gras |
  | `badge--reserved` | 2,91:1 | `--status-reserved-fg` sur `--status-reserved-bg` | 11 px, gras |
  | `badge--hs` | 3,51:1 | `--status-hs-fg` sur `--status-hs-bg` | 11 px, gras |
  | `badge--late` | 3,54:1 | `--status-late-fg` sur `--status-late-bg` | 11 px, gras |
  | `kpi` | 3,51:1 | `--text-secondary` sur `--bg-muted` | 14 px et 12 px |
  | `kpi--retard` | 3,76:1 | `--text-secondary` sur `--status-late-bg` | 14 px et 12 px |
  | `kpi--emprunte` | 3,82:1 | `--text-secondary` sur `--status-borrowed-bg` | 14 px et 12 px |
  | `kpi--salle` | 4,02:1 | `--text-secondary` sur `--status-reserved-bg` | 14 px et 12 px |
  | `kpi--disponible` | 4,06:1 | `--text-secondary` sur `--status-available-bg` | 14 px et 12 px |
  | `table tr:hover` | 4,13:1 | `--text-secondary` sur `--bg-canvas` (ligne survolée) | 11 px |

  `badge--borrowed` (8,23:1) et `table th` (4,55:1) sont conformes. La seconde de justesse : posé
  sur `--bg-canvas` plutôt que dans une carte blanche, l’en-tête de colonne tomberait à 4,13:1.
  `kpi` est la carte neutre que le kit définit ; le tableau de bord n’en pose aucune, il passe
  toujours une teinte.

  **Deux corrections à trancher dans Figma.** (1) Six lignes, les cinq cartes KPI et la ligne
  survolée, tiennent à un seul token : `--text-secondary` (`#757678`). Le foncer jusqu’à `#646567`
  les fait toutes passer, y compris sur `--bg-muted`, le fond le plus exigeant. C’est une valeur
  calculée (même teinte, luminosité abaissée), pas une décision, et elle touche tous les textes
  discrets de l’outil. (2) Pour chaque badge, un texte plus sombre de la même teinte. La
  maintenance a déjà de quoi le faire : `--status-maintenance-text` (6,21:1 sur son fond),
  que l’alerte d’avertissement emploie et que le badge n’emploie pas.

  **Pas encore publiées**, mais sous le seuil elles aussi : `.alert--error` (3,54:1),
  `.alert--info` (2,91:1), `.btn--danger` (4,28:1), `.toast--success` (2,79:1) et
  `.toast--error` (4,28:1). Elles sont à ajouter à la page quand on voudra l’inventaire complet.

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
