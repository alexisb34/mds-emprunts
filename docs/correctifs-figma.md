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

- **La modale ne se ferme pas avec Échap et ne piège pas le focus** (2 novembre 2026). Repérés en
  documentant la page Modale et retours du design system (`design-system/composants/modale.html`).
  `openModal`, dans `js/ui.js`, ne se ferme que par la croix, le clic sur le fond, un bouton d’action
  ou `closeModal()`. (1) **Aucune fermeture par Échap** : ni `js/ui.js` ni aucun autre fichier de
  `js/` n’écoute le clavier pour une modale ; le seul `keydown` du dépôt est la recherche globale
  de l’administration. (2) **Aucun piège de focus** : `openModal` ne déplace pas le focus à
  l’ouverture, ne le rend pas à la fermeture et ne rend rien d’autre inerte. Au clavier, le focus reste
  sur le bouton qui a ouvert la modale, derrière le fond (constaté dans un seul navigateur, à l’activation
  au clavier ; le clic à la souris n’a pas été essayé), et `#modal-root` vient après le contenu dans
  l’ordre du balisage : un utilisateur du clavier atteint la modale en dernier. La seule modale qui
  déplace le focus est celle du scan (`js/scanModal.js`), dans son champ. Reste à décider dans
  Figma où le focus arrive à l’ouverture (le titre, le premier champ, l’action principale) et où il
  retourne, puis à le porter dans `js/ui.js`. La page nomme ces deux manques en attendant.

- **Seize paires de couleurs du kit sont sous le seuil de lisibilité de 4,5:1** (constat du
  26 octobre 2026). Mesuré en écrivant le chapitre Couleurs du design system
  (`design-system/couleurs.html`), qui les publie telles quelles, avec leur ratio. La décision
  prise ce jour est de **publier plutôt que de corriger** la palette d’un prototype qui tourne :
  rien n’a été changé dans `css/tokens.css` ni dans `css/components.css`, et **la correction
  reste à décider dans Figma**. Les ratios sont jugés sur le rapport exact et arrondis au
  centième pour l’affichage seulement. Chaque paire est formée par le CSS et émise par une vue :
  la page cite le sélecteur qui la produit, et un test (`tests/ds-dette.test.mjs`) le retrouve.

  | Paire | Ratio | Texte sur fond | Taille |
  |---|---|---|---|
  | `badge--maintenance` | 1,72:1 | `--status-maintenance-fg` sur `--status-maintenance-bg` | 11 px, gras |
  | `badge--available` | 2,49:1 | `--status-available-fg` sur `--status-available-bg` | 11 px, gras |
  | `toast--success` | 2,79:1 | `--text-inverse` sur `--feedback-success` | 14 px, gras |
  | `badge--reserved` | 2,91:1 | `--status-reserved-fg` sur `--status-reserved-bg` | 11 px, gras |
  | `alert--info` | 2,91:1 | `--status-reserved-fg` sur `--brand-secondary-subtle` | 14 px |
  | `badge--hs` | 3,51:1 | `--status-hs-fg` sur `--status-hs-bg` | 11 px, gras |
  | `kpi` | 3,51:1 | `--text-secondary` sur `--bg-muted` | 14 px et 12 px |
  | `badge--late` | 3,54:1 | `--status-late-fg` sur `--status-late-bg` | 11 px, gras |
  | `alert--error` | 3,54:1 | `--status-late-fg` sur `--status-late-bg` | 14 px |
  | `kpi--retard` | 3,76:1 | `--text-secondary` sur `--status-late-bg` | 14 px et 12 px |
  | `kpi--emprunte` | 3,82:1 | `--text-secondary` sur `--status-borrowed-bg` | 14 px et 12 px |
  | `kpi--salle` | 4,02:1 | `--text-secondary` sur `--status-reserved-bg` | 14 px et 12 px |
  | `kpi--disponible` | 4,06:1 | `--text-secondary` sur `--status-available-bg` | 14 px et 12 px |
  | `table tr:hover` | 4,13:1 | `--text-secondary` sur `--bg-canvas` (ligne survolée) | 11 px |
  | `btn--danger` | 4,28:1 | `--text-inverse` sur `--feedback-error` | 14 px et 12 px, gras |
  | `toast--error` | 4,28:1 | `--text-inverse` sur `--feedback-error` | 14 px, gras |

  `badge--borrowed` (8,23:1) et `table th` (4,55:1) sont conformes. La seconde de justesse : posé
  sur `--bg-canvas` plutôt que dans une carte blanche, l’en-tête de colonne tomberait à 4,13:1.
  `kpi` est la carte neutre que le kit définit ; le tableau de bord n’en pose aucune, il passe
  toujours une teinte.

  **Trois corrections à trancher dans Figma.** Chaque ton calculé vise 4,8:1, soit 0,3 de marge
  au-dessus du seuil : un repère, pas une limite. On peut l’éclaircir tant que le ratio reste au
  moins à 4,5:1 sur chaque fond où le token sert, pas seulement sur la ligne lue ; le foncer
  davantage ne fait jamais perdre de contraste. (1) Six lignes, les cinq
  cartes KPI et la ligne survolée, tiennent à un seul token : `--text-secondary` (`#757678`). Le
  foncer jusqu’à `#5f6062` les fait toutes passer (4,86:1 sur `--bg-muted`, le fond le plus
  exigeant, soit 0,36 de marge réelle ; la ligne de `--bg-canvas` affiche 5,72:1 et ne doit pas servir
  de repère) : la page affiche cette même valeur sur les six lignes. C’est une valeur calculée
  (même teinte, luminosité abaissée), pas une décision, et elle touche tous les textes discrets
  de l’outil. (2) Pour chaque badge, un texte plus sombre de la même teinte. La maintenance a déjà
  de quoi le faire : `--status-maintenance-text` (6,21:1 sur son fond), que l’alerte
  d’avertissement emploie et que le badge n’emploie pas. Les alertes d’erreur et d’information
  reprennent les couleurs des badges « En retard » et « Réservé » : le même ton les règle deux à
  deux (`#c7182d` pour `badge--late` et `alert--error`, `#1c747c` pour `badge--reserved` et
  `alert--info`). (3) Sous un texte blanc, c’est l’aplat qu’il faut foncer. Pour le rouge, le kit a
  déjà `--feedback-error-hover` (5,55:1 sous du blanc), le fond du bouton de danger au survol : il
  règle `btn--danger` et `toast--error`. Mais le bouton serait alors identique à son état survolé
  et n’aurait plus de retour : il faut aussi assombrir l’état survolé. Pour le vert de
  `toast--success`, un fond de `#348228` (4,81:1 sous du blanc, calculé).

  **Repérées dans le CSS, pas vérifiées dans les vues**, donc non publiées : `.text-error`
  (4,28:1 sur blanc), `.text-success` (2,79:1), `--text-disabled` (1,66:1 sur blanc, pour les
  champs vides et les intitulés de section de la barre latérale), et `--text-secondary` sur
  `--bg-canvas` (4,13:1) hors des tableaux, par exemple `.page-header__meta`. Elles sont à
  vérifier, puis à ajouter à la page.

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
