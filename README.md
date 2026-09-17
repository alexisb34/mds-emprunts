# MDS Emprunts

Prototype de gestion des emprunts de matériel (école MDS). HTML/CSS/JS vanilla, données en `localStorage`.

## Lancer

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 — `admin.html` (pédagogie, desktop) et `mobile.html` (emprunteurs, téléphone). La caméra (scan QR, photo) exige `localhost` ou HTTPS.

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
- [ ] Phase 1 — Admin : inventaire & utilisateurs
- [ ] Phase 2 — Mobile : self-service
- [ ] Phase 3 — Matériel de valeur
- [ ] Phase 4 — Salle photo
- [ ] Phase 5 — Maintenance & paramètres
- [ ] Phase 6 — Déploiement test
