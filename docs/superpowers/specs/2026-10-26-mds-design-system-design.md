# MDS — Guide de marque & design system — Spec de design

**Date :** 2026-10-26
**Statut :** en attente de validation
**Auteur :** Alexis Bengel (avec Claude)

## 1. Intention

Quelqu'un arrive chez MyDigitalSchool. Un développeur à qui on demande d'ajouter une fonctionnalité à l'outil d'emprunt de matériel. Une personne de la comm qui doit sortir un post pour les réseaux. Un étudiant qui fabrique une affiche pour un événement de l'école. Aujourd'hui, chacun de ces trois-là doit trouver quelqu'un à qui demander, ou deviner.

Ce site est la réponse à ces deux questions, posées sans témoin :

- **« J'ai le droit de faire ça ? »** — l'usage du logo, des couleurs, des polices.
- **« Comment je fais ça ? »** — le bouton, le badge, le tableau, et le code pour les poser.

Le critère de réussite est brutal et unique : **une personne arrivée ce matin se débrouille seule.** Pas de formation, pas de référent, pas de « demande à Alexis ». Si elle doit poser une question, le site a raté quelque chose, et c'est ce quelque chose qu'il faudra corriger.

### Pourquoi maintenant

Le prototype d'emprunt de matériel est arrivé au bout de ses six phases. Son kit d'interface — le Figma « MDS — UI Kit — Prêt de matériel » — est complet : fondations, vingt pages de composants, écrans mobiles. Ce kit n'a jamais été expliqué à personne. Il existe un `kit.html` dans le dépôt, mais il se contente d'aligner des composants sans dire à quoi ils servent ni quand les utiliser. C'est un aide-mémoire pour celui qui l'a écrit, pas un outil pour celui qui arrive.

Et l'école va construire d'autres outils numériques. Si rien n'est écrit maintenant, chaque outil réinventera ses boutons.

## 2. Publics

| Public | Ce qu'il vient chercher | Étage |
|---|---|---|
| Graphiste, personne de la comm | Le logo dans le bon format, les couleurs exactes, ce qui est interdit | Marque |
| Étudiant (affiche, post, projet) | La même chose, en plus rapide, sans vocabulaire de métier | Marque |
| Designer produit | Les fondations, les composants, les états, les règles de composition | Composants |
| Développeur | Le HTML et les classes à copier, les variables CSS à utiliser | Composants |

Les deux premiers ne liront jamais la partie composants. Les deux derniers passeront quand même par la partie marque, au moins une fois. Le site doit donc être agréable à traverser pour les uns et précis pour les autres, sans que la précision des uns alourdisse le parcours des autres.

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

- Rendre l'usage du logo décidable sans demander : versions, fonds, tailles, interdits.
- Rendre le kit d'interface utilisable par quelqu'un qui ne l'a pas dessiné.
- Donner les ressources en un clic : fichiers du logo dans tous les formats utiles, polices.
- Montrer, pas décrire. Un « don't » est une démonstration, pas une phrase.

**Non-objectifs**

- Pas de refonte de l'identité de l'école. On documente ce qui existe.
- Pas de bibliothèque de composants publiée (npm, package). Le site documente le CSS du dépôt, il ne le distribue pas.
- Pas de gestion de contenu. Le site est statique, il se modifie en modifiant son code.
- Pas de dark mode. Le kit n'en a pas.

**Anti-objectifs** — ce qui ferait échouer le site même s'il fonctionne techniquement :

- **Une galerie de composants sans mode d'emploi.** C'est exactement ce qu'est déjà `kit.html`. Refaire ça en plus joli serait un échec complet.
- **Une doc qui ment.** Si le site montre un bouton qui ne ressemble plus à celui de l'application, il devient nuisible : on y perd la confiance, et on retourne demander à quelqu'un.
- **Des règles sans raison.** « Ne déformez pas le logo » ne suffit pas. Un nouvel arrivant applique une règle qu'il comprend ; il contourne une règle qu'on lui impose.
- **Un site que seuls les designers osent ouvrir.** Si l'étudiant qui veut faire une affiche se sent étranger dès l'accueil, la moitié du public est perdue.

## 4. Décisions structurantes

| Décision | Choix | Qui a décidé |
|---|---|---|
| Structure | Deux étages : vitrine de marque devant, documentation des composants derrière | Alexis |
| Ton visuel | Clair et lumineux — fond blanc, respiration, couleur en aplats et dégradés doux | Alexis |
| Modèle de référence | `brand.dropbox.com` : chapitres, longues pages qui déroulent, phrases courtes, démonstrations visuelles | Alexis |
| Emplacement | Dossier `design-system/` dans le dépôt `mds-emprunts` | Alexis |
| Source des tokens | `css/tokens.css` du dépôt, lu directement — jamais recopié | Alexis |
| Technique | HTML/CSS/JS vanilla, aucune étape de build, comme le reste du dépôt | Claude |
| Langue | Français | Claude (cohérence avec tout le projet) |
| Publication | GitHub Pages, avec le prototype | Claude |
| Contrastes insuffisants | Le site publie les chiffres mesurés et nomme les paires non conformes comme dette connue ; il n'en utilise aucune pour lui-même | Alexis |
| Fichiers du logo | Hébergés dans le dépôt et téléchargeables depuis le site, versions monochromes comprises | Alexis |
| Lien vers le Figma | Aucun — le fichier est privé, le site documente depuis le CSS et devient la seule porte d'entrée | Alexis |
| Fin du travail | Le travail s'arrête à « testé avec un nouvel arrivant », pas à « publié » | Alexis |

### La décision qui porte tout le reste

Le site **lit `css/tokens.css` et `css/components.css` du dépôt**, il ne les recopie pas. Un bouton montré dans la documentation est le bouton de l'application, rendu par le même CSS. Une pastille de couleur affiche `var(--brand-primary)`, pas `#662483` écrit en dur.

Conséquence voulue : la documentation ne peut pas dériver silencieusement. Si quelqu'un change un token, le site change. C'est l'anti-objectif « une doc qui ment » traité à la racine, et non par de la discipline.

Conséquence subie : le site ne peut pas documenter un composant qui n'existe pas encore dans le CSS. Documenter devient un acte qui suit le code. C'est accepté.

### Comment un exemple est rendu

Le dépôt n'a pas une feuille de style mais cinq, et elles se contredisent. `.tabs` existe dans `components.css` (onglets soulignés, `.tab--active`) **et** dans `admin.css` (onglets en pastille, `.is-active`) — deux composants différents sous le même nom. `.week-grid` est défini deux fois, dans `admin.css` et `mobile.css`, avec des tailles de cellule différentes. Et chacune de ces feuilles pose de la mise en page globale — `.admin-shell` en grille plein écran, `.m-nav` en position fixe, `#toast-root` fixe — qui prendrait le contrôle de n'importe quelle page de documentation où on la chargerait.

Donc : **chaque exemple est rendu dans son propre cadre isolé**, qui charge exactement les feuilles dont ce composant a besoin, et rien d'autre. C'est la seule façon de tenir la promesse « c'est le vrai composant » sans que la documentation se fasse dévorer par la mise en page de l'application. Aucune étape de construction n'est nécessaire : un cadre est un fichier HTML de plus.

Quand un composant existe en deux versions réellement différentes, il est documenté deux fois, explicitement nommées « desktop » et « mobile ». Les faire passer pour un seul composant serait un mensonge de plus.

## 5. Architecture

### Étage 1 — Marque

Un chapitre par page. Navigation haute, commune aux deux étages.

| Page | Contenu |
|---|---|
| **Accueil** | Hero « Les talents se connectent ». Deux phrases sur ce qu'est ce site. Les chapitres en entrées visuelles. Les deux étages annoncés clairement, pour que chacun sache où aller. |
| **Logo** | Le logo, ses versions, sa construction, ce qu'on en fait et ce qu'on n'en fait pas. Détaillé en §6. |
| **Couleurs** | Les couleurs de la marque, celles du produit, et la relation entre les deux. Contrastes. Détaillé en §6. |
| **Typographie** | Bricolage Grotesque et Inter. L'échelle complète du kit. Quand on utilise laquelle. |
| **Ton** | Comment on écrit dans les interfaces de l'école. *Chapitre proposé par Claude — voir §9.* |
| **Ressources** | Tous les téléchargements. Détaillé en §7. |

### Étage 2 — Composants

Sommaire fixe à gauche, pages courtes.

| Page | Contenu |
|---|---|
| **Démarrer** | Le chemin le plus court entre « on m'a demandé d'ajouter un écran » et « mon écran ressemble au reste ». Quels fichiers CSS inclure, dans quel ordre, quelles classes existent déjà. |
| **Fondations** | Couleurs sémantiques, espacements, rayons, ombres, typographie, tailles. Chaque token avec son nom, sa valeur, et sa valeur copiable en un clic. |
| **Composants** | Une page par famille, reprises du Figma : Icons, Button, Badge & Tag, Avatar, Form Controls, Table, KPI Card, Cards, Navigation, Modal & Feedback. |
| **Mobile** | Les motifs propres au mobile : shell, listes et cartes, réservation, salle, scan. |

**Chaque page de composant suit la même trame**, sans exception :

1. **À quoi ça sert** — une phrase, en langage ordinaire.
2. **L'exemple** — le composant vivant, rendu par le CSS de l'application.
3. **Les variantes et les états** — tous ceux qui existent dans le CSS. Un état attendu mais absent est **nommé comme absent**, pas passé sous silence.
4. **Le code** — le HTML exact, copiable en un clic. Et quand le composant se fabrique réellement depuis JavaScript, la fonction à appeler plutôt que le HTML à recopier.
5. **Quand ne pas l'utiliser** — et vers quoi se tourner à la place.
6. **Accessibilité** — rôles, libellés, taille de cible, contraste mesuré.

Le point 5 est celui qui distingue ce site d'une galerie. Il est obligatoire.

**Sur le point 3** : il n'existe aujourd'hui aucun état de chargement dans le kit — pas de bouton en attente, pas de squelette, un seul indicateur de progression confiné à une étape du scan mobile. Les états vides se limitent à `.empty-state`. Le site ne les invente pas : la règle « la documentation suit le code » vaut aussi quand elle est gênante. Chaque manque est écrit noir sur blanc sur la page concernée et reporté dans `docs/correctifs-figma.md`. Un trou nommé est une information ; un trou masqué est un piège.

**Sur le point 4** : la moitié du kit n'est pas du HTML qu'on recopie. Les modales, les notifications, les badges, les avatars, les tableaux et la grille de semaine sont produits par des fonctions de `js/ui.js` et de ses voisins, qui exigent par ailleurs des racines dans la page (`#modal-root`, `#toast-root`) et posent des classes sur le corps du document. Personne ne devrait écrire une modale à la main. **`js/ui.js` devient donc une troisième source de vérité**, au même titre que `tokens.css` et `components.css` : chaque page de composant concernée documente la fonction, ses arguments, ses valeurs possibles, et ce que la page doit contenir pour qu'elle fonctionne.

## 6. Les deux chapitres qui demandent le plus de soin

### Logo

Le logo récupéré sur `mydigitalschool.com` est en deux couleurs : **turquoise `#2DB8C5`** et **anthracite `#3C3C3B`**. Format SVG, 150 × 88, dix-neuf tracés.

Le chapitre couvre :

- **Les versions.** Couleur sur fond clair ; monochrome blanc sur fond sombre ou coloré ; monochrome anthracite pour l'impression en une couleur. Les deux dernières sont à produire — elles n'existent pas aujourd'hui.
- **La zone de protection.** Exprimée en proportion du logo lui-même, pour rester vraie à toutes les tailles.
- **La taille minimale.** Une à l'écran, une à l'impression.
- **Les fonds autorisés.** Démonstration sur blanc, sur `bg-canvas`, sur violet, sur anthracite, sur photo claire, sur photo chargée.
- **Les interdits**, chacun montré pour de vrai, côte à côte avec la version correcte : étirer, recolorer, ajouter une ombre portée, poser sur un fond qui n'a pas assez de contraste, poser sur une photo chargée, pivoter, réarranger les éléments, enfermer dans une forme, ajouter un contour.

**Chaque interdit est accompagné de sa raison.** « Ne recolorez pas le logo » est une règle qu'on contourne ; « le turquoise est le seul repère de couleur de la marque, le perdre revient à ne plus être reconnu » est une règle qu'on applique.

### Couleurs

Il y a une tension à traiter de front, et elle n'est écrite nulle part aujourd'hui :

> Le logo est turquoise et anthracite. La couleur primaire du kit d'interface est le violet `#662483`, qui n'apparaît pas dans le logo.

Ce n'est pas une anomalie — beaucoup de marques séparent la couleur de l'identité de celle de leurs produits. Mais c'est exactement le genre de détail qui fait hésiter quelqu'un qui arrive, et faute d'explication, chacun tranchera dans son coin. Le chapitre dit donc clairement laquelle sert à quoi, et montre les deux ensemble pour qu'on voie qu'elles tiennent.

Le chapitre couvre aussi :

- Les primitives du Figma : violets, turquoises, roses, neutres, états.
- Les tokens sémantiques, qui sont ce qu'on utilise réellement : `brand/primary`, `text/secondary`, `status/borrowed/fg`…
- **La règle du nom** : on écrit `var(--brand-primary)`, jamais `#662483`. Avec la raison : une couleur changée en un seul endroit.
- Les contrastes, chiffrés — traités ci-dessous.

### La dette de contraste, écrite en clair

Les couleurs de statut du kit ne passent pas le niveau AA. Les mesures, sur le texte de badge qui fait 11 px en gras et exige donc 4,5:1 :

| Paire | Ratio | |
|---|---|---|
| maintenance `#faad14` sur `#fef3d9` | 1,72:1 | échoue |
| disponible `#47b036` sur `#e8f6e5` | 2,49:1 | échoue |
| réservé `#269ca6` sur `#e0f5f7` | 2,91:1 | échoue |
| hors service `#757678` sur `#e1e2e6` | 3,51:1 | échoue |
| en retard `#e63247` sur `#fce4e7` | 3,54:1 | échoue |
| emprunté `#662483` sur `#f0e9f3` | 8,23:1 | conforme |

Et au-delà des badges : `--text-secondary` sur `--bg-canvas` tombe à 4,13:1, le turquoise de marque sur blanc à 2,39:1, le rose d'accent à 4,36:1, le blanc sur le rouge d'erreur à 4,28:1. S'y ajoutent deux manques de comportement : les modales n'ont ni échappement au clavier ni piège de focus, et aucun bouton, onglet ou élément de navigation n'a de style de focus visible.

**Le site publie ces chiffres.** Chaque paire est affichée avec son ratio réel et son verdict. Les paires qui échouent sont présentées comme une dette connue, datée, avec ce qu'il faudrait faire — pas comme un modèle à suivre. Les correctifs partent dans `docs/correctifs-figma.md`, où le Figma fait foi et le code suit.

**Et le site ne s'en sert pas pour lui-même.** Sa propre interface n'utilise aucune paire qui échoue. Un guide qui recommande ce qu'il s'interdit n'est pas lu deux fois.

C'est le choix le plus honnête disponible : ne rien cacher, ne rien casser dans un prototype qui tourne, et laisser à l'école la décision de corriger la palette.

### Une divergence à afficher telle quelle

`docs/correctifs-figma.md` enregistre que `--border-muted` (`#d1d5db`) est hors système tant que personne n'a tranché. La page Fondations l'affiche quand même, marqué comme non tranché. Le site montre ce que le code est aujourd'hui ; le registre des correctifs dit ce qu'il devrait devenir. Les deux disent vrai, et ne se contredisent que pour qui confond les deux questions.

## 7. Ressources téléchargeables

| Ressource | Forme |
|---|---|
| Logo couleur | SVG, plus PNG sur fond transparent en 600 et 1200 px de large |
| Logo blanc | SVG, plus les mêmes PNG |
| Logo anthracite | SVG, plus les mêmes PNG |
| Palette | Un fichier texte des tokens, prêt à coller dans un projet |
| Polices | Liens vers Google Fonts — Bricolage Grotesque et Inter |

Les fichiers vivent dans `design-system/assets/`, hors du dossier `images/` que le dépôt exclut déjà.

**Les PNG sont fabriqués par le navigateur au moment du clic**, à partir du SVG. Aucun fichier binaire n'est stocké, aucune étape de construction n'est ajoutée, et les tailles restent utiles : le SVG source fait 150 × 88, ce qui est largement trop petit pour l'affiche d'un étudiant. Les deux largeurs retenues couvrent l'écran et l'impression courante.

Les polices sont **liées, pas hébergées**. Elles viennent de Google Fonts, qui les sert déjà au site de l'école ; les redistribuer depuis le dépôt n'apporterait rien et brouillerait la question de la licence.

**Pas de lien vers le Figma.** Le fichier est privé, et une porte fermée au nez de quelqu'un qui arrive sans contact est pire que pas de porte du tout. Le site doit donc se suffire à lui-même : tout ce qu'un designer ou un développeur a besoin de savoir est sur le site, pas dans le Figma. C'est une exigence, pas un regret.

## 8. Contraintes

- **Aucune étape de build.** On ouvre un fichier, on le modifie, on recharge. Comme le reste du dépôt. Quelqu'un qui arrive doit pouvoir corriger une faute de frappe sans installer Node.
- **Aucune dépendance externe** hors Google Fonts, déjà utilisé par le prototype.
- **Chemins relatifs**, pour que GitHub Pages serve le site depuis un sous-répertoire.
- **Le site respecte ses propres règles.** Un guide d'accessibilité qui échoue à ses propres contrastes se discrédite en une page. Les contrastes du site sont vérifiés, la navigation fonctionne au clavier, la structure des titres est correcte.
- **Lisible sur téléphone.** Un étudiant qui cherche le logo le cherchera depuis son téléphone.

## 9. Les choix que je fais, et qui méritent ton œil

Ce sont mes décisions, pas les tiennes. Elles sont faciles à défaire.

- **Le chapitre « Ton ».** Dropbox a un chapitre *Voice & Tone*. Je propose l'équivalent, limité à l'écriture dans les interfaces : phrases courtes, pas de jargon, messages d'erreur qui disent quoi faire. Le prototype a déjà un ton très identifiable, je le décris plutôt que de l'inventer. Si tu trouves ça hors sujet, on le retire sans rien casser.
- **Les règles d'usage du logo.** Tu m'as dit de les construire. Elles seront solides et argumentées, mais elles ne sont validées par personne du côté de la marque. Le site le dira en toutes lettres, pour que personne ne les prenne pour une charte officielle approuvée — d'autant que les fichiers seront servis publiquement.
- **Les logos monochromes.** Ils n'existent pas. Je les produis à partir du SVG officiel en remplaçant les deux couleurs. C'est mécanique et fidèle, mais ça reste une création de ma part sur un logo que je n'ai pas dessiné.
- **`kit.html` est supprimé.** Le relecteur a montré qu'il a déjà dérivé : il affiche `.kpi--brand` et `.kpi--teal`, deux classes qui n'existent plus — ces cartes se rendent en gris depuis un moment, et personne ne l'a vu. Garder un fichier qui ment, même en redirection, c'est garder deux vérités. `index.html` pointera vers le design system à sa place, et `tests/deploiement.test.mjs`, qui vérifie la liste des pages et les liens de l'accueil, sera mis à jour.
- **Les exemples sont rendus dans des cadres isolés** (§4). Un composant par cadre, les feuilles de style choisies une par une. C'est la seule réponse que j'aie trouvée au fait que le dépôt a cinq feuilles qui se contredisent.
- **Les PNG sont fabriqués par le navigateur** (§7), plutôt que stockés en binaire ou produits par un script.
- **Les manques sont nommés** (§5) : pas d'état de chargement inventé, pas de case vide muette.
- **`js/ui.js` devient une troisième source de vérité** (§5). Sans ça, la page Modales ne pourrait montrer qu'un HTML que personne ne devrait copier.

## 10. Ce qui est laissé au constructeur

- Le découpage exact des fichiers CSS et JS du site.
- La mécanique du « copier » sur les tokens et les blocs de code.
- La mécanique exacte des cadres d'exemple et de l'export PNG.
- La façon de recouper le Figma et le CSS au moment de documenter chaque composant. Le site ne renvoie pas au Figma, mais rien n'empêche de s'en servir pour écrire : quand les deux divergent, c'est le CSS qui est montré et la divergence qui est signalée.
- Le texte précis de chaque chapitre, dans l'esprit décrit ici : affirmatif, court, jamais de jargon non expliqué.
- Les illustrations des « do » et « don't », qui doivent être des démonstrations HTML réelles et non des images — pour qu'elles ne vieillissent pas.

## 11. Risque principal

Ce site vit tant que quelqu'un le met à jour. Le lien direct avec `css/tokens.css` et `css/components.css` protège les couleurs, les espacements et l'apparence des composants : ceux-là ne peuvent pas mentir. Il ne protège pas les textes, les règles et les « quand ne pas l'utiliser », qui sont écrits à la main.

C'est acceptable à cette taille, et il vaut mieux l'écrire que le découvrir. Un composant ajouté sans sa page de documentation laissera le site incomplet, pas faux.

Le second risque est plus sournois : en devenant la seule porte d'entrée, sans lien vers le Figma, le site hérite d'une responsabilité qu'il n'avait pas. Ce qui n'y figure pas n'existe pour personne. Une page oubliée n'est plus une lacune, c'est une impasse.

## 12. Comment ce travail se termine

Pas à la publication. Une séance de test avec une personne de chaque public — quelqu'un de la comm, un étudiant, un développeur — sur le modèle de `docs/guide-entretien-test.md`, qui existe déjà pour le prototype.

La consigne à donner est la même que l'objectif : on pose une tâche réelle (« fais-moi une bannière avec le logo », « ajoute un écran à l'outil d'emprunt »), on ne répond à aucune question, et on note chaque endroit où la personne hésite, revient en arrière, ou cherche quelqu'un à qui demander. Ces endroits sont la liste des corrections.

Tant que cette séance n'a pas eu lieu, le site est livré mais pas fini.
