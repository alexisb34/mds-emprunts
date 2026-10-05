# Scénarios de démonstration

Six scénarios couvrant les phases livrées, dans l’ordre où on les joue devant quelqu’un. Ils servent à deux personnes : celle qui fait la démonstration, et celle qui doit rejouer la boucle complète pour contrôler une phase.

Chaque pas dit ce qu’on **fait**, puis ce qu’on doit **voir**. Le gras repère les boutons, onglets, champs et écrans, écrits comme l’écran les écrit (et, à l’occasion, une consigne sur laquelle insister) ; les messages cités entre « guillemets » sont ceux que l’application affiche. Si un libellé ne correspond plus à l’écran, c’est ce document qui est à corriger, pas l’application.

## 1. Avant de commencer

1. Lancer le prototype : `python3 -m http.server 8000` depuis le dépôt (ou ouvrir l’adresse publiée). La caméra n’est utilisable que sur `localhost` ou en HTTPS ; sans elle, l’écran Scanner propose une simulation, et c’est ce que ce document suit.
2. Ouvrir `admin.html` et `mobile.html` **dans deux fenêtres côte à côte**. Rétrécir la fenêtre du mobile pour qu’elle ressemble à un téléphone.
3. Fenêtre admin : l’écran « Qui êtes-vous ? » liste les comptes de la pédagogie. Choisir **Alexis Bengel**. Le **Tableau de bord** s’ouvre sur la carte **Horloge de démonstration**.
4. Cliquer sur **Jour ouvré 9h**. On voit le toast « Horloge de démo appliquée », la ligne « Maintenant : … à 09h00 », le badge **Horloge simulée** et l’encadré « Bureau ouvert : les emprunts en self-service sont possibles. »
5. Cliquer sur **Régénérer les données**. Une fenêtre « Régénérer les données de démonstration » s’ouvre ; cliquer sur **Régénérer**. On voit le toast « Données de démonstration régénérées ».
6. Fenêtre mobile : choisir un compte (voir le tableau ci-dessous).

À savoir :

- Les deux interfaces **partagent les données du navigateur** : un seul navigateur suffit, et ce que fait l’une apparaît dans l’autre sans recharger. En revanche chaque onglet garde son propre compte connecté, ce qui permet d’être Alexis à gauche et Camille à droite.
- Une **fenêtre de navigation privée** ouvre un second jeu de données, indépendant du premier : utile pour montrer deux personnes qui ne se voient pas.
- À chaque démonstration, recommencer au point 4 : le jeu de démonstration est calé sur la date de génération.

## 2. Les comptes

Aucun mot de passe : l’écran de connexion dit « Comptes de démonstration — aucun mot de passe. » Sur le mobile, la liste est groupée en **Élèves**, **Intervenants** et **Pédagogie** et se filtre avec le champ « Nom, prénom, promo… » ; la liste est triée par nom de famille.

| Rôle | Nom à l’écran | Où se connecter | Pourquoi lui |
|---|---|---|---|
| Élève | **Camille Dubois** (MBA 2 DAD) | `mobile.html`, groupe Élèves (taper « Dubois ») | N’a aucun emprunt ni réservation **en cours** dans le jeu neuf : tout lui est permis. Son onglet Historique n’est pas vide pour autant. |
| Intervenant | **Sophie Marchand** | `mobile.html`, groupe Intervenants (taper « Marchand ») | Sert de « deuxième personne » (salle photo). |
| Pédagogie | **Alexis Bengel** | `admin.html` (aussi présent dans le groupe Pédagogie du mobile) | Propriétaire du prototype. Les quatre autres comptes de la pédagogie se valent. |

Camille et Sophie sont choisis parce qu’ils n’ont rien dans le jeu neuf. D’autres comptes détiennent déjà du matériel et seront refusés, ce qui est normal : par exemple Léa Pezzetti, Nathan Lefebvre, Chloé Martin, Hugo Bernard, Jade Morel et Mathis Leroy ont chacun un objet self-service en cours, et Sacha Lemoine comme Ethan Robin sont en retard (l’emprunt leur est refusé tant qu’ils n’ont pas rendu). L’écran **Emprunts** de l’admin donne la liste.

## 3. Les scénarios

Sauf mention contraire, chaque scénario part d’un jeu neuf (section 1) et d’une horloge sur un jour ouvré à 9h. Pour changer l’horloge, on saisit une date et une heure dans **Date et heure simulées** (Tableau de bord ou **Paramètres**) puis on clique sur **Appliquer** : le toast « Horloge de démo appliquée » confirme.

### Scénario 1 — Self-service : emprunter, rendre avec un problème

*Phase 2. Compte : Camille Dubois sur le mobile, Alexis Bengel sur l’admin.*

1. **Admin** : cliquer sur **Emprunts** dans la barre latérale. On voit la liste des emprunts en cours ; noter le nombre à côté d’**Emprunts** dans la barre latérale (10 sur un jeu neuf).
2. **Mobile** : choisir Camille Dubois. L’accueil dit « Bonjour Camille » et « Aucun emprunt en cours. »
3. Toucher **Scanner un QR code** (le bouton de l’accueil ou celui du centre de la barre du bas). L’écran **Scanner** s’ouvre sur l’étape « Emprunter : scannez l’étiquette de l’objet ». Avec une caméra, viser l’étiquette d’un objet. Sans caméra, la zone d’image dit « Caméra indisponible — utilisez la simulation ci-dessous. » : dans **Simuler un scan**, le champ **Objet disponible** propose en premier « MDS-0003 — Multiprise #3 » ; toucher **Simuler le scan**. (On peut aussi taper un code dans **Ou saisir un code** puis toucher **Valider le code**.)
4. Étape 2, « Photo de l’objet » : on voit la Multiprise #3, son code MDS-0003 et le badge Self-service. Toucher **Prendre la photo** avec une caméra ; sans caméra, toucher **Utiliser une image de démonstration**. (Avec une caméra, le même repli existe sous le nom **Sans caméra : image de démonstration**.)
5. Étape 3, « Confirmer l’emprunt » : la photo s’affiche avec l’encadré « Retour attendu aujourd’hui avant 17h00, au bureau des pédago. » Toucher **Confirmer l’emprunt**.
6. Résultat : une coche, « Emprunt enregistré », puis « Multiprise #3 · Retour attendu aujourd’hui avant 17h00. Bon travail ! »
7. **Admin, sans rien toucher** : le nombre à côté d’**Emprunts** passe de 10 à 11, et la première ligne de la liste est la Multiprise #3 (MDS-0003) de Camille Dubois, au statut **En cours**. Sur le **Tableau de bord**, la liste « Dernières activités » contient maintenant « Emprunt · Camille Dubois » (« Multiprise #3 — Camille Dubois »).
8. **Mobile** : toucher **Scanner un autre objet**. En haut de l’écran Scanner, la carte **Rendre un objet** montre la Multiprise #3 (« Retour attendu avant 17h00 ») avec **Rendre →**. Toucher cette ligne (le bouton **Rendre →** en fait partie).
9. « Photo de l’objet », avec cette fois « Photographiez l’objet avant de le rendre : elle atteste de son état. » : refaire la photo (démonstration si besoin).
10. Étape « État de l’objet » : trois lignes, « Câble intact », « Toutes les prises fonctionnent » et « Interrupteur OK », chacune avec **OK** et **Problème**. Sur « Câble intact », toucher **Problème** : la ligne passe en alerte et un champ « Décrivez le problème (optionnel) » apparaît. Y écrire « Câble coupé », puis toucher **Confirmer le retour**.
11. Résultat : un point d’exclamation et « Retour enregistré — problème signalé » ; le texte dit que « la pédago est prévenue et l’objet passe en maintenance ».
12. **Admin, sans rien toucher** : le nombre à côté d’**Emprunts** retombe à 10 ; dans la barre latérale, le compteur de **Maintenance** passe de 1 à 2. Sur le **Tableau de bord**, la carte **Signalements à traiter** liste « Multiprise #3 » avec « Signalé au retour : Câble intact → Câble coupé » et le badge **Ouvert**.
13. **Admin** : cliquer sur **Maintenance**. L’onglet **Ouverts** montre le signalement ; la carte **Matériel immobilisé** liste la Multiprise #3, badge **Maintenance**, « 1 à traiter ».

Un retour sans problème (tout sur **OK**) donne « Retour enregistré » et « Merci ! L’objet est de nouveau disponible. »

### Scénario 2 — Règles de refus

*Phase 2. Compte : Camille Dubois sur le mobile, Alexis Bengel sur l’admin.*

**Bureau fermé**

1. **Admin** : sur le Tableau de bord, régler **Date et heure simulées** sur le jour même à 12h30 (la pause de midi), puis **Appliquer**. L’encadré devient « Bureau fermé : ouvert les jours ouvrés de 8h-12h et 13h-17h. Les emprunts en self-service sont refusés, les retours restent possibles. » (Un samedi donne « Bureau fermé (week-end). … »)
2. **Mobile** : **Scanner un QR code**, puis **Simuler le scan** sur le premier objet de la liste. L’écran affiche une croix, « Impossible », le nom de l’objet et le message : « Le bureau de la pédagogie est fermé (jours ouvrés, 8h-12h et 13h-17h) : le self-service reprendra à l’ouverture. » Les boutons proposés sont **Scanner à nouveau** et **Retour à l’accueil**. Les horaires cités sont les horaires réglés (voir le scénario 6).

**Déjà un exemplaire**

3. **Admin** : remettre **Date et heure simulées** sur le jour même à 9h00, **Appliquer**. L’encadré redevient « Bureau ouvert : … ».
4. **Mobile** : **Scanner à nouveau**, puis refaire l’emprunt comme au scénario 1 (pas 3 à 6) : « MDS-0003 — Multiprise #3 », photo, **Confirmer l’emprunt**.
5. Toucher **Scanner un autre objet**. La liste commence maintenant par « MDS-0004 — Multiprise #4 » : toucher **Simuler le scan**.
6. L’écran affiche « Impossible », « Multiprise #4 » et « Vous avez déjà un exemplaire de ce matériel (emprunt ou réservation en cours). » Le refus porte sur la référence : un autre exemplaire du même objet est refusé tant qu’on n’a pas rendu le premier. (Rescanner le **même** code, lui, propose de le rendre.)
7. Pour nettoyer : **Scanner à nouveau**, **Rendre →** sur la Multiprise #3, photo, laisser tout sur **OK**, **Confirmer le retour**.

### Scénario 3 — Matériel de valeur : réserver, remettre, retard, expiration

*Phase 3. Compte : Camille Dubois sur le mobile, Alexis Bengel sur l’admin. Objet : « Filtre variable Hoya ».*

**Réserver et remettre**

1. **Mobile** : toucher **Catalogue** dans la barre du bas. Dans le champ « Rechercher un matériel… », taper « Hoya » : une carte « Filtre variable Hoya » apparaît avec les badges **Disponible** et **Sur réservation**. La toucher.
2. La fiche dit « Matériel sur réservation : la pédago vous le remet à l’heure prévue. » et liste l’exemplaire « MDS-0042 · Armoire sécurisée ». Toucher **Réserver**.
3. L’écran **Réserver** propose **Date de retrait**, **Heure de retrait**, **Date de retour** et **Motif (visible par la pédago)**. Les valeurs par défaut sont le prochain jour ouvré, 9h00, retour le même jour ; **les garder**. Écrire un motif, par exemple « Tournage du projet », puis toucher **Confirmer la réservation**.
4. On voit le toast « Réservé — à retirer le JJ/MM/AAAA à 09h00 » et l’écran **Mes emprunts**, onglet **Réservations** : « Filtre variable Hoya », « Retrait … à 09h00 · retour le … », badge **Réservé**, et « Votre code de retrait s’affichera à l’heure prévue. »
5. **L’objet devient indisponible** : dans le **Catalogue**, la carte porte maintenant le badge **Réservé** ; sur la fiche, Camille lit « Vous avez déjà réservé ce matériel (retrait le … à 09h00). » avec **Voir ma réservation**. Pour une autre personne (Sophie Marchand, par exemple), la fiche dit « Aucun exemplaire disponible pour le moment. »
6. **Admin** : sur le Tableau de bord, cliquer sur **Jour ouvré 9h**. L’horloge arrive au jour et à l’heure du retrait (09h00). La carte **À remettre aujourd’hui** affiche la ligne « Filtre variable Hoya », « Camille Dubois · retrait à 09h00 · code XXXXXX », badge **Réservé**, bouton **Remettre**. (Une autre réservation du jeu, le Tascam DR-70, est aussi à remettre ce jour-là : n’y pas toucher.)
7. **Mobile** : **Mes emprunts**, onglet **Réservations** : la carte affiche maintenant le QR de retrait, le code à six caractères, « À retirer avant 10h00 » et « Montrez ce code à la pédago pour récupérer le matériel. » L’accueil porte aussi l’encadré « Filtre variable Hoya : à retirer avant 10h00 — voir mon code. »
8. **Admin** : cliquer sur **Remettre** à la ligne du Filtre variable Hoya. La fenêtre **Remettre le matériel** dit « Scannez le QR affiché par l’emprunteur, ou vérifiez son code de retrait. » et le champ **Code de retrait** est déjà rempli (avec une caméra, on peut viser le QR affiché sur le mobile). Cliquer sur **Remettre** : toast « Matériel remis ».
9. **Mobile** : l’onglet **En cours** de **Mes emprunts** montre le Filtre variable Hoya avec le badge **En cours**.

**Retard et réception**

10. **Admin** : régler **Date et heure simulées** sur le même jour à 18h00, **Appliquer**. Le bureau est fermé ; le Filtre variable Hoya devait rentrer à 17h00.
11. Le **Tableau de bord** liste le Filtre variable Hoya dans la carte **Retards** (« En retard », « 1 jour »). Il n’est pas seul : le saut a aussi mis en retard les emprunts self-service de la veille, qui devaient être rendus à 17h. Sur le mobile, l’accueil de Camille annonce « 1 emprunt en retard — pensez à le rendre. »
12. **Admin** : cliquer sur **Emprunts**, onglet **En retard**, ligne « Filtre variable Hoya », bouton **Réceptionner**. La fenêtre « Réceptionner — Filtre variable Hoya » liste trois cases cochées : « Verre sans rayure », « Bague tourne » et « Étui ».
13. Décocher « Verre sans rayure » et écrire « Rayure sur le verre » dans le champ « Problème constaté (optionnel) » de cette ligne. Cliquer sur **Valider le retour** : toast « Retour enregistré — problème signalé ».
14. **Admin** : cliquer sur **Maintenance**, onglet **Ouverts** : « Filtre variable Hoya — Signalé à la réception : Verre sans rayure → Rayure sur le verre ». La carte **Matériel immobilisé** le liste, badge **Maintenance**. Sur le mobile, la carte du **Catalogue** affiche **Maintenance** et « Indisponible ».

**Expiration d’une réservation**

15. **Admin** : **Jour ouvré 9h**. **Mobile** : **Catalogue**, chercher « Audio-Technica », toucher la carte, **Réserver**, garder les valeurs par défaut, **Confirmer la réservation**.
16. **Admin** : **Jour ouvré 9h** (l’horloge arrive à l’heure du retrait), puis régler **Date et heure simulées** sur le même jour à **10h01** (une heure et une minute après l’heure de retrait) et **Appliquer**.
17. **Mobile** : l’accueil de Camille affiche l’encadré « Audio-Technica kit de streaming : réservation expirée, le matériel est reparti dans le catalogue. » La fiche de l’objet redit **Disponible** avec le bouton **Réserver** ; dans **Mes emprunts**, l’onglet **Historique** le range sous le statut **Non retiré**.

### Scénario 4 — Salle photo : réserver, états des lieux, sortie manquante

*Phase 4. Comptes : Camille Dubois puis Sophie Marchand sur le mobile, Alexis Bengel sur l’admin. Jeu neuf, un jour ouvré à 9h.*

**Réserver, bloquer un autre compte**

1. **Mobile** (Camille) : toucher **Salle** dans la barre du bas. Une carte montre la semaine (par exemple « 5 – 9 oct. »), avec les jours en colonnes et les heures de 8h à 16h en lignes. Les créneaux passés sont grisés, ceux déjà pris portent « Pris » (le jeu neuf en contient un aujourd’hui de 8h à 10h). Sous la grille : « Touchez un ou plusieurs créneaux qui se suivent. »
2. Dans la colonne d’aujourd’hui, toucher **14h** puis **15h**. La barre du bas affiche « 14h-16h · 2 créneaux ». Toucher **Réserver**.
3. Toast « Salle réservée 14h-16h le … ». Les deux cases portent « Vous », et **Mes réservations** montre « Aujourd’hui · 14h-16h », badge **À venir**, bouton **Annuler**.
4. **Un autre compte est bloqué** : toucher la pastille ronde d’initiales en haut à droite (écran « Mon profil »), puis **Changer d’utilisateur**, taper « Marchand » et choisir **Sophie Marchand**. Dans **Salle**, les cases 14h et 15h d’aujourd’hui affichent « Pris » et ne se touchent pas ; les cases libres restent sélectionnables. Se reconnecter ensuite en Camille Dubois de la même façon (« Dubois »).
5. **Admin** : cliquer sur **Salle photo**. Le planning de la semaine montre le créneau de 14h à 16h avec les initiales « CD ». Cliquer dessus ouvre « Créneau du … » : Camille Dubois, « 14h-16h », badge **À venir**, « État des lieux d’entrée : pas encore faite. », « État des lieux de sortie : pas encore faite. » et le bouton **Annuler la réservation**. Cliquer sur **Fermer**.

**État des lieux d’entrée**

6. **Admin** : régler **Date et heure simulées** sur le jour même à 14h05, **Appliquer**.
7. **Mobile** (Camille) : dans **Salle**, **Mes réservations** montre « Créneau du jour · 14h-16h » et le bouton **Faire l’état des lieux d’entrée**. Le toucher.
8. L’écran « État des lieux d’entrée » dit « Vérifiez le matériel avant de commencer : ce que vous signalez maintenant ne vous sera pas reproché. » Il liste le matériel de la salle, par exemple « Newer kit éclairage — 2 pieds, 2 softbox, 2 ampoules OK », jusqu’à « Salle rangée, rien d’anormal », chaque ligne avec **OK** et **Problème**. Laisser tout sur **OK** et toucher **Valider l’état des lieux** : toast « État des lieux enregistré ».
9. **Mes réservations** affiche maintenant « Créneau en cours · 14h-16h », badge **En cours**, et le bouton **Faire l’état des lieux de sortie**.

**État des lieux de sortie avec un objet signalé**

10. **Admin** : régler l’horloge sur le même jour à 15h30, **Appliquer**.
11. **Mobile** : toucher **Faire l’état des lieux de sortie**. L’écran dit « Vérifiez le matériel avant de partir : la salle doit être rangée. » Sur la ligne « Sac à dos Beschoi — Présent, fermetures OK », toucher **Problème**, écrire « Fermeture cassée » dans « Décrivez le problème (optionnel) », puis **Valider l’état des lieux**.
12. Toast d’alerte « État des lieux enregistré — problème signalé ». La réservation disparaît de **Mes réservations** : elle est terminée.
13. **Admin** : dans **Salle photo**, cliquer sur la case « CD ». « Créneau du … » indique le badge **Terminée**, « État des lieux d’entrée · … à 14h05 » avec « Tout était conforme. », et « État des lieux de sortie · … à 15h30 » avec l’alerte « Sac à dos Beschoi — Présent, fermetures OK → Fermeture cassée ». Le **Tableau de bord** liste le Sac à dos Beschoi dans **Signalements à traiter** (badge **Ouvert**), et **Maintenance** le range dans **Matériel immobilisé**.

**Sortie jamais faite**

14. Le jeu régénéré à 9h contient un créneau de 8h à 10h réservé par **Nathan Lefebvre**, dont l’état des lieux d’entrée est fait mais pas la sortie. L’horloge ayant dépassé 11h00, le **Tableau de bord** affiche la carte **Sorties non faites**, avec « … · 8h-10h — Nathan Lefebvre » et le lien **Voir le planning →**. (Régénéré à une autre heure, le jeu ne contient pas ce créneau : réserver alors une plage avec Camille, faire l’entrée, et laisser l’horloge dépasser d’une heure la fin du créneau.)
15. **Admin** : cliquer sur **Salle photo**. Le bandeau **Sorties non faites** dit « … 8h-10h — Nathan Lefebvre n’a pas fait l’état des lieux de sortie. » avec le bouton **Clore le créneau**. Le cliquer : la fenêtre « Clore le créneau » dit « L’état des lieux de sortie n’a pas été fait. Clore le créneau le retire des alertes ; vérifiez la salle avant de valider. » Cliquer sur **Clore le créneau** : toast « Créneau clos », et le bandeau disparaît.

### Scénario 5 — Maintenance : interventions, remise en service, hors service

*Phase 5. Compte : Alexis Bengel sur l’admin. Jeu neuf. Objet : « Souris #3 », rendue avec un problème dans le jeu de démonstration.*

1. **Admin** : cliquer sur **Maintenance**. Le sous-titre dit « 1 à traiter ». L’onglet **Ouverts** liste « Souris #3 — Signalé au retour : Clic et molette OK → Clic gauche ne répond plus », type **Signalement**, badge **Ouvert**, avec les boutons **Démarrer** et **Clôturer**. À droite, **Matériel immobilisé** liste « Clavier #3 » (« rien à traiter », **Hors service**) et « Souris #3 » (« 1 à traiter », **Maintenance**).
2. Cliquer sur **Démarrer** : toast « Intervention démarrée ». La ligne quitte **Ouverts** ; elle est dans l’onglet **En cours**, qui ne propose plus que **Clôturer**.
3. Cliquer sur **Créer une intervention**. La fenêtre propose **Matériel**, **Type** (« Intervention interne » ou « Intervention externe »), **Prestataire**, **Coût en euros** et **Description**. Choisir « Souris #3 » et « Intervention externe », écrire « Objectif Service » comme prestataire, « 120,50 » comme coût et « Remplacement du capteur » comme description, puis cliquer sur **Créer** : toast « Intervention créée ».
4. Onglet **Tous** : la nouvelle ligne indique « Intervention externe », « Objectif Service » et « 120,50 € ». Dans **Matériel immobilisé**, la Souris #3 affiche « 2 à traiter ».
5. **Clore la première** : onglet **En cours**, bouton **Clôturer** de la Souris #3. La fenêtre « Clôturer l’événement » explique que, si c’est le dernier événement ouvert de l’objet, il repart dans le circuit, et qu’il faut choisir « Hors service » s’il ne doit plus être emprunté. Elle propose **Annuler**, **Hors service** et **Remettre en service**. Cliquer sur **Remettre en service** : toast « Événement clos ». **L’objet reste immobilisé** : il figure toujours dans **Matériel immobilisé** (« 1 à traiter », **Maintenance**), car l’intervention externe est encore ouverte.
6. **Clore la dernière** : onglet **Ouverts**, ligne « Intervention externe », **Clôturer**, puis **Remettre en service** : toast « Événement clos ». La Souris #3 disparaît de **Matériel immobilisé**.
7. **L’objet revient au catalogue** : sur le mobile, la fiche « Souris » (**Catalogue**) montre « Souris #3 » en **Disponible**. Côté admin, **Matériel** la liste avec l’état **Disponible**.
8. **Hors service** : toujours sur **Maintenance**, cliquer sur **Signaler une panne**. Choisir **Matériel** « Multiprise #4 », écrire « Câble sectionné » dans **Description**, cliquer sur **Signaler** : toast « Panne signalée ». La Multiprise #4 entre dans **Matériel immobilisé** (**Maintenance**).
9. Onglet **Ouverts**, **Clôturer** sur la Multiprise #4, puis **Hors service** : toast « Matériel passé hors service ». La carte **Matériel immobilisé** la liste avec le badge **Hors service** et « rien à traiter ».
10. **L’objet disparaît du catalogue mais reste à l’inventaire** : sur le mobile, la fiche « Multiprise » ne liste plus la Multiprise #4 ; côté admin, **Matériel** la montre toujours, état **Hors service** (le filtre d’état, qui commence sur « Tous les états », permet de ne voir que ceux-là).

Un objet encore emprunté ou réservé ne peut pas passer **Hors service** : l’application répond « Cet objet est encore dehors : attendez son retour pour le passer hors service. »

### Scénario 6 — Paramètres : les horaires réglés pilotent les refus

*Phase 5. Comptes : Alexis Bengel sur l’admin, Camille Dubois sur le mobile. Jeu neuf, un jour ouvré à 9h.*

1. **Admin** : cliquer sur **Paramètres**. L’écran présente la carte **Horloge de démonstration**, la carte **Règles d’emprunt** (**Ouverture du matin**, **Fermeture du matin**, **Ouverture de l’après-midi**, **Fermeture de l’après-midi**, durée maximale, fenêtre de retrait, créneaux de la salle, règle anti-retard) et la carte **Espace occupé**.
2. Dans **Fermeture du matin**, remplacer 12 par 11 et cliquer sur **Enregistrer** : toast « Réglages enregistrés ».
3. Régler **Date et heure simulées** sur le même jour à 11h30, **Appliquer**. L’encadré dit « Bureau fermé : ouvert les jours ouvrés de 8h-11h et 13h-17h. Les emprunts en self-service sont refusés, les retours restent possibles. »
4. **Mobile** (Camille) : **Scanner un QR code**, **Simuler le scan**. L’écran affiche « Impossible » et « Le bureau de la pédagogie est fermé (jours ouvrés, 8h-11h et 13h-17h) : le self-service reprendra à l’ouverture. » Le message cite **11h**, l’horaire réglé, pas l’horaire d’origine.
5. **Admin** : remettre 12 dans **Fermeture du matin**, **Enregistrer**. Sur le mobile, toucher **Scanner à nouveau** pour quitter l’écran « Impossible », puis **Simuler le scan** : on arrive cette fois à l’étape « Photo de l’objet » (toucher **Annuler** pour ne rien emprunter).
6. **Montrer la jauge d’espace** : la carte **Espace occupé** affiche un pourcentage, une barre et un texte du type « 203 Ko sur 5,0 Mo — les photos d’emprunt et de retour pèsent l’essentiel. » Les photos des emprunts et des retours remplissent le navigateur ; à partir de 80 %, un avertissement invite à régénérer les données.

## 4. Pièges d’horloge

- **Après un grand saut dans le temps, régénérer les données.** Les emprunts du jeu sont calés sur la date de génération : un saut de plusieurs jours en laisse beaucoup « en retard » et les réservations de la salle sont déjà passées. La carte Horloge le rappelle. Le saut d’un jour ou deux, comme dans les scénarios, reste lisible.
- **Jour ouvré 9h** va à 9h le jour même si l’heure actuelle est avant 9h, sinon au prochain jour ouvré. Un vendredi après-midi ou un week-end, il tombe un lundi. Dans les scénarios 3 et 4 il suppose qu’on a gardé les dates proposées par défaut à la réservation.
- **Le week-end, le bureau est fermé** : tout emprunt self-service est refusé, et la grille **Salle** du mobile s’ouvre sur la **semaine suivante**, la semaine écoulée n’offrant plus rien.
- **L’horloge est partagée** : elle est enregistrée avec les données, donc l’admin et le mobile (et tous les onglets du navigateur) la voient. Le badge **Horloge simulée** ou **Temps réel** de la carte dit laquelle est active ; **Temps réel** la rend à l’heure de la machine.
- **Régénérer remet aussi les réglages d’origine** (horaires 8h-12h et 13h-17h, etc.) ; l’horloge, elle, est conservée à la date indiquée.
- Un onglet déjà ouvert garde l’ancien code après une mise à jour du dépôt : forcer un rechargement complet (Cmd/Ctrl + Maj + R).

## 5. Remettre à zéro

- **Paramètres** (ou le Tableau de bord) → **Régénérer les données** → **Régénérer** : jeu neuf calé sur la date affichée dans **Date et heure simulées**. Les photos prises pendant la démonstration sont perdues, les réglages reviennent aux valeurs d’origine.
- Pour tout effacer, y compris l’horloge : supprimer les données du site dans les réglages du navigateur. Au prochain chargement, un jeu neuf est créé à l’heure réelle.
