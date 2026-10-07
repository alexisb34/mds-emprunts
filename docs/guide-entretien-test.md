# MDS Emprunts — guide d’entretien pour tester l’application mobile

Pour la personne qui **anime** la séance. La notice remise aux testeurs est à part :
[`docs/notice-testeurs.md`](notice-testeurs.md). Ne donnez pas ce guide-ci au testeur.

Durée : **40 minutes** par personne. Comptez 15 minutes entre deux séances pour vos notes.

---

## 1. Ce que ces séances doivent trancher

Quatre questions, dans cet ordre d’importance. Tout le reste est du bonus.

1. **La réservation par demi-journées se comprend-elle ?** C’est la mécanique la plus neuve et la
   plus abstraite : on réserve une *référence* (« une carte SD »), pas un objet précis, sur une
   *période* (« demain après-midi jusqu’à vendredi matin »). Personne n’a encore testé ça.
2. **Un refus est-il compréhensible sans aide ?** « Complet sur cette période », « durée trop
   longue », « hors des heures d’ouverture ». Un refus qu’on ne comprend pas devient un message
   à la pédago — c’est-à-dire précisément le travail que le prototype doit supprimer.
3. **Sait-on quoi faire sans explication ?** Scanner, rendre, retrouver ses emprunts.
4. **L’utiliseraient-ils vraiment ?** À la place de ce qu’ils font aujourd’hui.

**Ce que ces séances ne tranchent pas** : les couleurs, les formulations exactes, la vitesse. Si
un testeur part là-dessus, notez-le et ramenez-le à sa tâche.

## 2. Qui faire venir

**Cinq à six personnes suffisent** pour voir l’essentiel. Au-delà, les mêmes blocages
reviennent. Visez :

- 3 élèves qui emprunent déjà du matériel (MBA 2 ou Bachelor 3) ;
- 2 élèves qui n’en ont jamais emprunté — ce sont eux qui révèlent ce que l’interface suppose ;
- 1 intervenant, dont les besoins diffèrent (emprunts plus longs, matériel de valeur).

Faites-les venir **séparément**. À deux, le plus assuré parle et l’autre suit.

## 3. Avant la séance — dix minutes de préparation

- [ ] Un **téléphone chargé** (le leur si possible : c’est leur navigateur, leurs habitudes).
- [ ] L’adresse ouverte, **compte Camille Dubois** choisi d’avance pour ne pas perdre trois
      minutes dans la liste. Vérifiez que **Mes emprunts** n’est pas déjà encombré ; sinon,
      régénérez les données (admin → Paramètres → **Régénérer les données**).
- [ ] **Deux étiquettes QR imprimées** à 100 % et collées sur de vrais objets : la
      **Multiprise #3 (MDS-0003)** et une seconde, pour que le scan ne soit pas une abstraction.
- [ ] `admin.html` ouvert **sur votre ordinateur**, pas sur leur téléphone : vous y remettez
      l’horloge et vous y faites la remise du matériel à l’étape 3.
- [ ] Du papier pour la fiche d’observation (§8). Pas d’ordinateur entre vous et la personne.
- [ ] L’autorisation d’enregistrer, si vous enregistrez. Demandez-la, et uniquement l’audio.

**Si c’est hors des heures d’ouverture** (avant 8h, après 17h, pause de midi, week-end), le
self-service sera refusé — c’est voulu. Posez l’horloge de démonstration sur un jour ouvré avant
de commencer : admin → Tableau de bord → régler **Date et heure simulées** sur un jour ouvré à
**9h30**, puis **Appliquer**. Évitez le raccourci « Jour ouvré 9h » : à 9h pile, la fenêtre de
retrait d’une réservation du matin se referme, et vous testeriez une coïncidence.

## 4. Les règles du modérateur

Les trois premières sont les seules qui comptent vraiment.

1. **N’aidez pas.** Votre réflexe sera d’indiquer le bon onglet. Chaque fois que vous le faites,
   vous détruisez la donnée que vous êtes venu chercher. Un silence de dix secondes est
   inconfortable pour vous, pas pour la personne.
2. **Ne défendez rien.** « C’est parce que… » n’a pas sa place. Si on vous demande pourquoi
   l’écran fait ça, répondez « qu’est-ce que vous en attendiez, vous ? » et notez la réponse.
3. **Mesurez l’aide, pas l’avis.** Ce qui se note, c’est *combien* d’aide il a fallu, et *où*.
   L’avis en fin de séance est très mal corrélé à ce qu’on vient d’observer.
4. Faites penser à voix haute : « dites-moi ce que vous cherchez, même si c’est confus ».
5. Quand quelqu’un hésite, demandez **« qu’est-ce que vous feriez si je n’étais pas là ? »**
   C’est la question la plus utile du guide.
6. Si on vous dit « c’est bien » : « qu’est-ce qui vous a fait hésiter, avant ? »

### Échelle d’aide — à noter pour chaque tâche

| Niveau | Ce que vous avez fait |
|---|---|
| **0** | Rien. La personne a réussi seule. |
| **1** | Vous avez relancé : « qu’est-ce que vous cherchez ? » |
| **2** | Vous avez reformulé l’objectif, sans nommer d’écran. |
| **3** | Vous avez nommé l’onglet ou le bouton. |
| **4** | Vous avez fait à sa place. **Tâche échouée.** |

Le total des niveaux 3 et 4 sur six personnes est votre liste de travail, classée toute seule.

## 5. Ouverture — 4 minutes

> « Merci de venir. On teste un prototype d’emprunt de matériel pour l’école. Deux choses
> importantes : **ce n’est pas vous qu’on teste, c’est l’application**. Si vous ne trouvez pas
> quelque chose, c’est un défaut de notre côté, et c’est exactement ce que je suis venu noter.
>
> Deuxième chose : je ne vais pas vous aider, même si ça me démange. Dites-moi tout haut ce que
> vous cherchez et ce que vous comprenez, même si c’est flou. Rien de ce que vous ferez n’est
> réel : rien n’est envoyé nulle part, rien ne sera emprunté pour de vrai.
>
> On en a pour quarante minutes. Vous pouvez arrêter quand vous voulez. Des questions ? »

### Réchauffement — 4 minutes, avant de leur donner le téléphone

Ne sautez pas cette partie : c’est elle qui dit si le produit sert à quelque chose.

- « Racontez-moi la dernière fois que vous avez eu besoin de matériel de l’école. »
- « Comment vous avez fait, concrètement ? » *(Qui ils ont demandé, par quel canal, combien de temps.)*
- « Qu’est-ce qui a été pénible ? »
- « Vous est-il arrivé de renoncer, ou d’emprunter ailleurs ? » *(Si oui : creusez. C’est le vrai concurrent.)*
- « Vous arrive-t-il de rendre en retard ? Qu’est-ce qui se passe alors ? »

---

## 6. Les tâches

Chaque tâche se lit **à voix haute telle quelle**. Elle donne un but, jamais un chemin : si votre
consigne contient le nom d’un onglet, vous venez de résoudre la tâche à sa place.

### Tâche 1 — Emprunter et rendre un objet en libre-service · 8 min

> « Vous avez besoin de cette multiprise pour un tournage cet après-midi. Allez-y. »
>
> *(Posez l’objet étiqueté devant la personne. Ne dites pas « scannez ».)*

**Réussi si** l’emprunt est confirmé et que la personne sait jusqu’à quand elle l’a.

**À observer**

- Trouve-t-elle le scan seule ? (Le bouton est sur l’accueil, mais le réflexe peut être le catalogue.)
- Que fait-elle de la demande d’autorisation de la caméra ? Hésite-t-elle à l’accepter ?
- **La photo obligatoire** : la subit-elle ou la comprend-elle ? Dit-elle pourquoi on la demande ?
- A-t-elle vu l’heure limite de retour ? Peut-elle la citer sans regarder l’écran ?

**Relances** *(après, jamais pendant)*

- « À quoi sert la photo, d’après vous ? » — puis : « ça vous gêne ? »
- « Si vous ne rendez pas à l’heure, qu’est-ce qui se passe ? »

> « Finalement le tournage est annulé. Rendez-la. »

**À observer** : cherche-t-elle le scan, ou un bouton « rendre » dans ses emprunts ? Les deux
chemins existent — notez lequel elle tente **en premier**.

### Tâche 2 — Réserver du matériel de valeur · 12 min · **la tâche importante**

> « Vous avez besoin d’une carte SD pour la semaine prochaine, du mardi matin au jeudi
> après-midi. Débrouillez-vous pour l’avoir. »

**Réussi si** la réservation est confirmée sur la bonne période, et que la personne peut dire
**où et quand** elle viendra la chercher.

**À observer — c’est ici que se joue la séance**

- Comprend-elle que ce matériel **ne se scanne pas** ? Quel indice le lui dit ? *(Le badge
  « Sur réservation » et le texte d’aide de la fiche. Tente-t-elle le scan d’abord ?)*
- **Les demi-journées.** « Matin (8h-12h) » / « Après-midi (13h-17h) », au retrait et au retour.
  Est-ce lu comme deux créneaux à choisir, ou comme un réglage obscur ? Confond-elle la
  demi-journée de retour avec l’heure de retour ?
- **La ligne de disponibilité** sous les champs, qui se recalcule à chaque changement : la
  remarque-t-elle ? Comprend-elle que « 3 exemplaires libres sur cette période » parle de la
  période qu’elle vient de choisir, et pas du stock de l’école ?
- Comprend-elle qu’elle réserve **une** carte sans savoir laquelle ? Est-ce que ça la dérange ?
- **La fenêtre de retrait d’une heure.** Après confirmation, sait-elle qu’elle doit venir dans
  l’heure qui suit le début de son créneau, et que sinon la réservation tombe ? C’est le point
  le plus coûteux s’il n’est pas compris : il produit du matériel immobilisé pour rien.

**Relances**

- « Vous avez réservé quoi, exactement ? » *(Une référence ou un objet ? Écoutez le vocabulaire qu’elle emploie.)*
- « Cette ligne, là, elle vous dit quoi ? » *(En désignant la ligne de disponibilité.)*
- « Vous venez quand, et vous allez où ? »
- « Et si vous ne pouvez pas venir à l’heure prévue ? »

### Tâche 3 — Comprendre un refus · 5 min · enchaîne sur la tâche 2

> « Même matériel. Cette fois il vous le faut pour trois semaines. »

**Réussi si** la personne comprend **pourquoi** c’est refusé et trouve seule une période qui passe.

**À observer** : lit-elle le message, ou clique-t-elle au hasard ? Remarque-t-elle que le bouton
**Confirmer** est éteint ? Comprend-elle que le refus vient de la *durée* et non de la
*disponibilité* ?

> « Autre chose : il vous faut l’enregistreur **Tascam DR-70**, le prochain jour ouvré, toute
>   la journée. »
>
> *(Refus garanti quel que soit le jour de la séance : le jeu de démonstration n’en contient
> qu’un exemplaire et quelqu’un d’autre l’a déjà réservé sur les deux premiers jours ouvrés à
> venir. L’écran répond « Aucun exemplaire n’est libre sur cette période. Premier créneau
> libre : le … » et éteint le bouton.)*

**À observer** : utilise-t-elle la date que le message lui donne, ou tâtonne-t-elle à l’aveugle ?
Comprend-elle que l’objet existe et va bien se libérer — « complet sur cette période » — et non
qu’il est cassé ou retiré du catalogue ? C’est toute la différence que cette application doit
réussir à faire passer.

### Tâche 4 — Réserver la salle photo · 7 min

> « Vous devez faire des photos de vos maquettes jeudi en fin de matinée, pendant deux heures.
>   Réservez ce qu’il faut. »

**Réussi si** deux créneaux qui se suivent sont réservés le bon jour.

**À observer**

- Distingue-t-elle les créneaux libres des créneaux pris, **sans vous le demander** ?
- Comprend-elle qu’il faut les prendre **à la suite** ? Que fait-elle si elle en saute un ?
- Comprend-elle qu’elle réserve une **salle** et non un objet ? *(Le trépied LeoFoto MDS-0026
  vit dans la salle : il ne s’emprunte pas, il s’utilise sur place.)*
- A-t-elle vu qu’un état des lieux l’attend à l’entrée et à la sortie ?

### Tâche 5 — Retrouver ses affaires · 4 min

> « Qu’est-ce que vous avez en ce moment, et qu’est-ce que vous devez rendre en premier ? »
>
> *(Aucun chemin n’est indiqué. C’est une tâche de lecture, pas d’action.)*

**À observer** : où va-t-elle d’abord — accueil ou onglet **Emprunts** ? Comprend-elle la
différence entre **En cours**, **Réservations** et **Historique** ? Sait-elle lire une date de
retour sans la calculer ?

---

## 7. Clôture — 5 minutes

Dans cet ordre. La première question vaut les trois autres réunies.

1. **« Sur tout ce qu’on vient de faire, qu’est-ce qui vous a fait hésiter ? »**
   Laissez le silence. La première réponse est polie ; la deuxième est la vraie.
2. « Qu’avez-vous cherché sans le trouver ? »
3. « Si c’était en service demain, vous l’utiliseriez, ou vous continueriez comme avant ?
   Pourquoi ? » *(Un « oui » tiède est un non. Creusez le « pourquoi ».)*
4. « Qu’est-ce qui manque pour que vous l’utilisiez pour de vrai ? »
5. Une note, pour comparer les séances entre elles : **« de 1 à 5, à quel point ça a été
   facile ? »** Notez le chiffre et, surtout, la phrase qui vient après.

Puis : « est-ce qu’il y a quelque chose que je ne vous ai pas demandé et que vous voulez dire ? »

## 8. Fiche d’observation — à remplir pendant, pas après

| Tâche | Aide (0-4) | Temps | Où ça a coincé | Mots employés par la personne |
|---|---|---|---|---|
| 1 · Emprunter en libre-service | | | | |
| 1b · Rendre | | | | |
| 2 · Réserver du matériel de valeur | | | | |
| 3 · Comprendre un refus | | | | |
| 4 · Réserver la salle | | | | |
| 5 · Retrouver ses affaires | | | | |

Notez les **verbatims**, pas vos résumés. « Je sais pas ce que ça veut dire, demi-journée de
retour » vaut dix fois « n’a pas compris le formulaire ».

À chaud, en trois lignes, avant la séance suivante :

- Le moment où la personne a été le plus perdue :
- Ce qu’elle a dit et qui ne colle pas avec notre façon de nommer les choses :
- Ce que je changerais demain matin :

## 9. Défauts déjà connus — ne les comptez pas comme découvertes

Si un testeur tombe sur l’un de ces cas, c’est déjà au registre. Notez-le d’un mot et passez.

- **Deux téléphones ne se voient pas.** Chaque navigateur a ses propres données ; il n’y a pas
  de serveur. Un conflit entre deux testeurs ne se verra donc jamais.
- **On peut réserver avec un retour un samedi ou un dimanche.** Seul le retrait est vérifié
  contre les heures d’ouverture. Le correctif est identifié.
- **Le raccourci « Jour ouvré 9h »** de l’interface pédagogie tombe exactement à la fermeture de
  la fenêtre de retrait d’un créneau du matin. Réglez l’heure à la main.
- **L’icône ajoutée à l’écran d’accueil** peut avoir ses propres données, séparées de celles du
  navigateur. Choisissez l’un ou l’autre et restez-y.
- Le prototype est **bâti sur un jeu de démonstration** : des emprunts, des retards et des
  réservations existent déjà au départ. Ce n’est pas un bug.

## 10. Après les six séances

1. Rassemblez les niveaux d’aide par tâche. Toute tâche qui a demandé un **niveau 3 ou 4 chez
   deux personnes ou plus** est un défaut à corriger, pas un hasard.
2. Classez ce qui reste :
   - **Bloquant** — la personne n’a pas pu faire la tâche, ou a fait l’inverse de ce qu’elle voulait.
   - **Gênant** — elle y est arrivée, mais en tâtonnant ou en se trompant d’abord.
   - **Cosmétique** — elle l’a remarqué et dit, sans que ça la ralentisse.
3. Écrivez les trois corrections qui suppriment le plus de « bloquant » pour le moins de travail.
   Pas une liste de quinze.
4. Confrontez ce que les gens ont **dit** en §7 à ce qu’ils ont **fait** en §6. Quand les deux
   divergent, ce qu’ils ont fait a raison.

---

*Repères cités par ce guide, et épinglés par `tests/seed.test.mjs` : compte **Camille Dubois**,
**Multiprise #3** (MDS-0003), **Carte SD 256 Go** (MDS-0033, trois exemplaires),
**Tascam DR-70 enregistreur** (MDS-0031, un seul exemplaire, réservé d’avance par le jeu) et
**Trépied et tête fluide LeoFoto** (MDS-0026, circuit salle). Si un test de ce fichier échoue
après un changement du jeu de démonstration, c’est ce guide qu’il faut relire avant de
corriger le test.*
