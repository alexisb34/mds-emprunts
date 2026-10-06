# MDS Emprunts

Prototype de gestion des emprunts de matériel (école MDS). HTML/CSS/JS vanilla, données en `localStorage`.

## Lancer

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 — `admin.html` (pédagogie, desktop) est disponible ; `mobile.html` (emprunteurs, téléphone) est disponible — ouvrir les deux côte à côte pour la démo (sessions séparées par onglet). La caméra (scan QR, photo) exige `localhost` ou HTTPS.

Les règles suivent une **horloge de démonstration** réglable depuis le tableau de bord admin (carte « Horloge de démonstration ») : un week-end ou hors 8h-12h / 13h-17h, le bureau est fermé et les emprunts en self-service sont refusés. Cliquer sur « Jour ouvré 9h » pour se placer dans une plage ouverte, puis sur « Régénérer les données » pour recaler le jeu de démonstration (emprunts, retards, réservations) sur cette date.

**Limite connue : un seul navigateur, pas de serveur.** Les deux interfaces se synchronisent par l’événement `storage` du navigateur ; le refus d’un créneau déjà pris ne vaut qu’une fois cet événement arrivé dans l’onglet concerné. De plus, la persistance `localStorage` réécrit l’ensemble des données à chaque écriture : deux écritures simultanées dans deux onglets se résolvent en « dernier arrivé gagne », et l’une peut disparaître. Un déploiement réel devra faire respecter les conflits de réservation côté serveur.

Le **matériel de valeur** se réserve depuis la fiche d’une référence, pas d’un exemplaire : l’emprunteur choisit une période à la demi-journée — matin ou après-midi, bornes des horaires réglés — jusqu’à sept jours calendaires, et le système lui attribue un exemplaire libre. **La disponibilité se calcule par période, jamais par état** : réserver un appareil pour le mois prochain ne le rend pas indisponible aujourd’hui. L’écran répond sur la période choisie avant toute validation — nombre d’exemplaires libres, motif du refus, ou premier créneau libre. La validation est la remise physique : la pédago scanne le code de retrait dans l’heure qui suit le début du créneau, sans quoi la réservation expire.

La **salle photo** se réserve depuis l’onglet *Salle* du mobile, par créneaux d’une heure de 8h à 17h du lundi au vendredi, plusieurs créneaux à la suite. Le créneau commencé demande un état des lieux d’entrée, puis un de sortie : une ligne en « Problème » ouvre un signalement par objet et bascule l’objet en maintenance. Côté pédagogie, l’onglet *Salle photo* montre le planning de la semaine, le détail d’un créneau avec ses deux états des lieux, et un bandeau « Sorties non faites » — avec un bouton *Clore le créneau* — une heure après la fin d’un créneau resté ouvert.

Côté pédagogie, l’onglet *Maintenance* suit les pannes : un signalement — venu d’une checklist de retour, d’un état des lieux de la salle ou créé à la main — donne lieu à des interventions, internes ou confiées à un prestataire avec un coût, qu’on démarre puis qu’on clôt. Clore le dernier événement ouvert d’un objet le remet en service, ou le passe définitivement hors service : il reste alors à l’inventaire mais disparaît du catalogue. L’onglet *Paramètres* règle les horaires d’ouverture, la durée maximale d’une réservation, la fenêtre de retrait et la règle anti-retard ; il affiche aussi l’espace occupé dans le navigateur et permet de régénérer les données. Les horaires réglés sont la seule source de vérité : l’état du bureau, les messages de refus et l’aide du catalogue les citent tels quels.

Depuis un téléphone, `mobile.html` s’ajoute à l’écran d’accueil et s’ouvre comme une application (manifeste et icônes fournis, encoche et barre d’accueil prises en compte). L’installation réelle exige HTTPS : elle arrive en phase 6. Il n’y a volontairement pas de *service worker* — le hors-ligne n’est pas au programme, et un cache mal réglé transformerait chaque mise à jour en énigme pendant les tests.

Le scan et la photo utilisent la caméra (autorisation demandée) ; sans caméra, l’écran Scanner propose une simulation et une image de démonstration. Après une mise à jour du code, forcer un rechargement complet (Cmd/Ctrl + Maj + R) : le serveur de développement n’envoie pas d’en-têtes de cache.

## Tester

```bash
npm test
```

Aucune dépendance à installer (Node ≥ 22).

## Publier

Le prototype est un site statique : n’importe quel hébergement de fichiers le sert tel quel. Les chemins sont tous relatifs, donc un sous-répertoire convient.

**La caméra exige HTTPS.** Sans elle, le scan de QR et les photos retombent sur la saisie manuelle et une image de démonstration — utile en salle, insuffisant pour un vrai test terrain. `localhost` fait exception : en local, tout fonctionne.

Depuis ce dossier, une fois un dépôt GitHub créé :

```bash
git remote add origin https://github.com/<compte>/mds-emprunts.git
git push -u origin main
```

Publier `main` une fois la branche de phase fusionnée (aujourd’hui `phase-6-deploiement`) : sinon les phases 4 à 6 ne seraient pas en ligne.

Puis, dans le dépôt : **Settings → Pages → Source : Deploy from a branch → `main` / `/ (root)`**. L’URL `https://<compte>.github.io/mds-emprunts/` répond au bout d’une minute ou deux.

Dernière étape avant de distribuer la notice : dans `docs/notice-testeurs.md`, remplacer les deux occurrences de `<compte>` (l’adresse du site et celle de `admin.html`) par l’URL réelle, puis imprimer. Le fichier garde volontairement ces marques : c’est au moment de la distribution qu’on les remplit.

Pour montrer une version en cours sans rien publier, un tunnel suffit :

```bash
cloudflared tunnel --url http://localhost:8000
```

## Documentation

- Spec : `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md`
- Feuille de route : `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`
- Scénarios de démonstration : `docs/scenarios-demo.md`
- Notice à remettre aux testeurs : `docs/notice-testeurs.md`

## État d’avancement

- [x] Phase 0 — Fondations (tokens, composants, store, règles, seed)
- [x] Phase 1 — Admin : inventaire & utilisateurs
- [x] Phase 2 — Mobile : self-service
- [x] Phase 3 — Matériel de valeur
- [x] Phase 4 — Salle photo
- [x] Phase 5 — Maintenance & paramètres
- [x] Phase 6 — Déploiement test
