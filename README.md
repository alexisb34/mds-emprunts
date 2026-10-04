# MDS Emprunts

Prototype de gestion des emprunts de matériel (école MDS). HTML/CSS/JS vanilla, données en `localStorage`.

## Lancer

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 — `admin.html` (pédagogie, desktop) est disponible ; `mobile.html` (emprunteurs, téléphone) est disponible — ouvrir les deux côte à côte pour la démo (sessions séparées par onglet). La caméra (scan QR, photo) exige `localhost` ou HTTPS.

Les règles suivent une **horloge de démonstration** réglable depuis le tableau de bord admin (carte « Horloge de démonstration ») : un week-end ou hors 8h-12h / 13h-17h, le bureau est fermé et les emprunts en self-service sont refusés. Cliquer sur « Jour ouvré 9h » pour se placer dans une plage ouverte, puis sur « Régénérer les données » pour recaler le jeu de démonstration (emprunts, retards, réservations) sur cette date.

Le scan et la photo utilisent la caméra (autorisation demandée) ; sans caméra, l’écran Scanner propose une simulation et une image de démonstration. Après une mise à jour du code, forcer un rechargement complet (Cmd/Ctrl + Maj + R) : le serveur de développement n’envoie pas d’en-têtes de cache.

## Tester

```bash
npm test
```

Aucune dépendance à installer (Node ≥ 22).

## Documentation

- Spec : `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md`
- Feuille de route : `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

## État d'avancement

- [x] Phase 0 — Fondations (tokens, composants, store, règles, seed)
- [x] Phase 1 — Admin : inventaire & utilisateurs
- [x] Phase 2 — Mobile : self-service
- [ ] Phase 3 — Matériel de valeur
- [ ] Phase 4 — Salle photo
- [ ] Phase 5 — Maintenance & paramètres
- [ ] Phase 6 — Déploiement test
