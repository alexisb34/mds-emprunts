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

- **Le clavier n’atteint ni les lignes cliquables ni les en-têtes triables, et rien ne dit le tri
  à un lecteur d’écran** (2 novembre 2026). Repéré en documentant la page Tableau
  (`design-system/composants/tableau.html`). `renderTable`, dans `js/admin/table.js`, écrit
  des `tr[data-href]` pour une ligne qui ouvre une fiche et des `th[data-sortable]` pour un en-tête
  qui trie ; `bindTable` n’y branche qu’un `click`, sans aucun `keydown`. **Aucun fichier de `js/`, de
  `css/` ni des pages de la racine ne contient `tabindex`**, et `aria-sort` n’est posé nulle part
  dans `js/` (recherche faite sur ces trois dossiers) : une ligne et un en-tête ne reçoivent donc
  jamais le focus, et le tri comme l’ouverture d’une fiche ne s’obtiennent qu’à la souris. Le sens du
  tri n’est dit que par une flèche écrite dans le libellé (` ↑`, ` ↓`). Même défaut, sans l’en-tête,
  pour les `.list__item[data-href]` (des `<div>`) du tableau de bord et de la maintenance
  (`js/admin/views/dashboard.js`, `js/admin/views/maintenance.js`). Un test
  (`tests/ds-registre.test.mjs`) rejoue la recherche et tombe le jour où l’un de ces manques est
  comblé. Reste à décider dans Figma : un lien dans la première cellule et un bouton dans l’en-tête,
  ou `tabindex="0"` avec Entrée et Espace, et `aria-sort` sur la colonne triée.

- **L’interrupteur `.toggle` n’a aucun anneau de focus visible** (2 novembre 2026). Sa vraie case est
  cachée par `css/components.css` (`.toggle input` : `opacity: 0; width: 0; height: 0`) et aucune
  règle `:focus` ni `:focus-visible` de `components.css`, `admin.css`, `mobile.css` ou `base.css` ne
  vise `.toggle` ni `.toggle__track`. Constaté dans Chromium, à la frappe sur Tab : la case a bien le
  focus (`:focus-visible` vrai, zéro pixel de large, opacité 0) et le rail ne change pas. Ce n’est
  pas le cas de la case à cocher, qui garde l’anneau du navigateur. Un seul écran l’emploie :
  « Comptes actifs uniquement », dans `js/admin/views/utilisateurs.js`. Le manque s’ajoute à l’entrée
  sur l’anneau de focus du kit, plus haut : la forme à reprendre est celle de `.kpi--link`, posée sur
  le rail (`.toggle input:focus-visible + .toggle__track`), couleur et épaisseur à décider dans Figma.

- **`aria-invalid` ne marque pas `.textarea`** (2 novembre 2026). La règle de `css/components.css`
  est `.input[aria-invalid="true"], .select[aria-invalid="true"] { border-color:
  var(--feedback-error) }` : la zone de texte n’y figure pas, alors qu’elle partage `.field` avec les
  deux autres et reçoit, elle, l’anneau de focus. Aucun écran ne pose `aria-invalid` aujourd’hui
  (recherche faite dans `js/` et les pages de la racine), donc personne n’est touché : c’est une
  règle du kit à compléter avant le premier formulaire qui valide ses champs.

- **La barre de navigation mobile ne dit pas l’onglet courant, et son texte est petit**
  (2 novembre 2026). (1) `js/mobile/layout.js` écrit `class="m-nav__tab m-nav__tab--active"` pour
  l’onglet courant et **n’écrit pas `aria-current`** : l’onglet ne se distingue que par sa couleur.
  (2) Le texte des onglets (`.m-nav__tab`, `css/mobile.css`) est à 10 px gras, sous les 11 px de
  `body-tiny`. **Les cibles de la barre, elles, ne sont pas petites** : 68 × 67 px mesurés dans le shell
  d’exemple à 360 px de large (98 × 67 à 480). Les cibles de 36 px sont ailleurs : la flèche de
  retour `.m-header__back` (36 × 36) et le sélecteur `.seg__btn` (36 px de haut), sous les 44 px que
  recommande WCAG 2.5.5 ; et le texte de 9 px est celui des créneaux de la salle
  (`.week-grid .slot`), avec `.week-grid th` à 10 px. La page `design-system/composants/mobile.html`
  les nomme ; le registre les porte pour que le correctif se décide avec la maquette. Reste à
  décider dans Figma : `aria-current="page"` sur le lien courant, et la taille minimale du texte
  mobile.

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

  **Cinq paires de plus, vérifiées dans les vues le 2 novembre 2026, que la page Couleurs ne publie
  pas.** Chacune est formée par une règle de la feuille et émise par une vue, sauf la dernière, que
  le kit définit et qu’aucun écran ne pose, comme la carte KPI neutre. Les ratios sont recalculés
  depuis `css/tokens.css` avec `design-system/js/contraste.js`, sur le rapport exact.

  | Paire | Ratio | Texte sur fond | Taille | Émise par |
  |---|---|---|---|---|
  | `.nav-item__count` | 4,13:1 | `--text-secondary` sur `--bg-canvas` | 11 px | `js/admin/layout.js`, le compteur du menu |
  | `.page-header__meta` | 4,13:1 | `--text-secondary` sur `--bg-canvas` | 14 px | cinq vues de `js/admin/views/` (matériel, fiche, emprunts, utilisateurs, fiche utilisateur) |
  | `.input::placeholder` | 1,66:1 | `--text-disabled` sur `--bg-surface` | 14 px | les champs de `js/admin/`, par exemple la recherche de `utilisateurs.js` ; `.textarea::placeholder` a la même règle |
  | `.sidebar__section` | 1,66:1 | `--text-disabled` sur `--bg-surface` | 10 px, gras | `js/admin/layout.js`, l’intitulé « Gestion » |
  | `.field__error` | 4,28:1 | `--feedback-error` sur `--bg-surface` | 11 px | aucun écran : défini par le kit |

  Le texte indicatif d’un champ (`::placeholder`) est du texte, pas un contrôle désactivé : WCAG
  1.4.3 s’y applique. Posé sur le gris de l’application (`--bg-canvas`), le rouge de `.field__error`
  tomberait à 3,88:1. Les corrections se décident dans Figma comme les autres : le ton calculé de
  `--text-secondary` (`#5f6062`, 5,72:1 sur `--bg-canvas`) règle `.nav-item__count` et
  `.page-header__meta` en même temps que les six lignes du premier tableau ; `--text-secondary`
  lui-même (4,55:1 sur blanc, de justesse) ou plus sombre règle `.input::placeholder` et
  `.sidebar__section`, au prix d’un texte indicatif qui ressemble à un texte discret ; et
  `--feedback-error-hover` (5,55:1 sur blanc) règle `.field__error`. La variante active du compteur
  (`--text-brand` sur `--bg-surface`) n’est pas en cause : 9,79:1.

  **Définies par `css/base.css`, posées par aucune vue**, donc non publiées : `.text-error`
  (4,28:1 sur blanc) et `.text-success` (2,79:1). Un test (`tests/ds-registre.test.mjs`) tombe le
  jour où une vue les emploie : elles seront alors à publier.

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
