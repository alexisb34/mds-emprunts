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
