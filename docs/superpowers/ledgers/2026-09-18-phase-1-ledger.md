# SDD ledger — plan: docs/superpowers/plans/2026-09-18-phase-1-admin-inventaire.md
Spec: docs/superpowers/specs/2026-09-17-mds-emprunts-design.md (reachable)
Branch: phase-1-admin (from main @ aa28ab9)

## Pre-flight scan (2026-09-18)
| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 layout → T4-T7 | setTopbar({title, subtitle, action:{label,onClick}}), takeSearch() | consistent |
| T1 app.js routes → T4-T7 | commented import/route lines replaced per task | exact strings given |
| T2 items → T5, T6 | createItem/updateItem/setItemState/manualTransitions/itemHistory | consistent |
| T2 models ITEM_CODE_RE → T6 qr.js | capturing regex /^MDS-(\d{4})$/ | consistent |
| T3 users → T7 | createUser/updateUser/setUserActive/userStats/userHistory | consistent |
| T5 table → T5, T7 | renderTable/sortRows/toggleSort/bindTable | consistent |
| T5 itemFormHtml/readItemForm → T6 fiche | signatures | consistent |
| T6 SELECT_COLUMN + toolbar edits to materiel.js | described as exact replacements | validated in scratch assembly |
| T7 badge('derived', actif|desactive) | needs LABELS.derived + VARIANTS.derived (T7 Step 4 end) | consistent |
| Whole plan | extracted + assembled in scratch: 129/129 tests, admin smoke-tested in browser (login, dashboard, materiel, fiche+QR, state change, utilisateurs, fiche user, etiquettes) | clean |
Ruling: `.claude/`, `.superpowers/` stay in .git/info/exclude (local) — cost if wrong: none.

## Progress
Task 1: implementer a8f124840da884de6, commit 38dbcf1, 85/85. Review clean (minor: brief said "6 remplacements" vs 7 bullets — plan wording). Controller browser check: /login → login → #/dashboard, sidebar active, counts 10/1, topbar title, aVenir card, no console errors. PASS.
Task 1: complete (commits aa28ab9..38dbcf1, review clean)
Tasks 2-3 (batched): implementer a80c25c8684d301e5, commits 605ecdc..32afe86, 102/102, files identical to validated scratch. Review clean.
Task 2: minor (deferred): byCreatedDesc duplicated in items.js/users.js (plan-inherited); updateItem/updateUser log even on empty patch (no guard)
Task 2: complete (commits 38dbcf1..32afe86, review clean)
Task 3: complete (commits 38dbcf1..32afe86, review clean)
Tasks 4-5 (batched): implementer a69dfb7f5cae1726f, commits 9c446bf..b854a4f, 117/117, files identical to validated scratch. Review clean. Controller browser check (after hard reload — module cache): dashboard KPI 30/10/2/3, 2 late rows, 15 activities; matériel live filter keeps focus, sort arrow, 1 row for "ronin". PASS.
Task 4: complete (commits 32afe86..b854a4f, review clean)
Task 5: complete (commits 32afe86..b854a4f, review clean)
Task 6: implementer a2c1d3e9c0ef381d1, commit eaec546, 124/124. Review clean. Controller browser check: fiche Canon (QR image, no state buttons, maintenance visible), state change item_004 → hs with motif (log + toast + modal closed), selection survives filter (3), etiquettes 3 labels with QR + names. PASS.
Task 6: complete (commits b854a4f..eaec546, review clean)
Task 7: implementer a95f31958fcddfbc3, commit 438912c, 129/129, files identical to validated scratch. Review clean (brief test-count arithmetic 11 vs actual 14 — plan wording). Controller browser check: users list 45, sort retards ↓ with badge, deactivate user_002 (modal, log, badge, button flips), add user with duplicate email → error toast + modal stays, valid → fiche "Nina Costa". Cross-tab: rename in tab A → list in tab B updated live, separate sessions per tab. PASS.
Task 7: complete (commits eaec546..438912c, review clean)
Task 8 Step 1-2 (controller): npm test 129/129 expected; scenario steps 1-8 verified in browser during tasks 4-7 checks.
Task 8: implementer ab301f4c0fdb7e7f8, commit 9cb6d8e, tag phase-1. Docs-only diff verified by controller.
Task 8: complete (commits 438912c..9cb6d8e)

## Final whole-branch review (opus, aa28ab9..9cb6d8e): "With fixes" — 7 Important
Rulings:
- Ruling (#1): full re-render must not destroy in-progress input — setTopbar preserves the current search text; fiche views skip re-render while their form is dirty and toast "Données mises à jour — enregistrez ou rechargez" — cost if wrong: a stale fiche until save/reload.
- Ruling (#2): v1 global search = matériel only; spec §6 amended ("Recherche matériel dans la topbar ; utilisateurs et emprunts ont leurs propres filtres") ; pattern routing (LOAN code → emprunts) deferred to phase 3 — cost: spec narrowed, reversible.
- Ruling (#3): user-facing histories sort by domain dates (loans: dateRetrait ?? debutPrevu ?? dateReservation ; maintenance: date), tie-break createdAt ; shared `sortByDateDesc(rows, pick)` in rules.js ; `createdAt` stays wall-clock (audit only, never for ordering).
- Ruling (#4): `actions/items.js` exports `applyItemState(id, etat)` (transition check + update, NO journal) used by `setItemState` ; phases 2-5 loan/maintenance actions call `applyItemState` and own their single journal entry — cost: two code paths to keep in sync (both go through assertTransition).
- Ruling (#5): photo thumbnails open a modal lightbox on click.
- Ruling (#6): `photoUrl` (illustration URL) editable now in the item form (tiny), consumed by phase-2 catalogue.
- Ruling (#7): add Node tests for takeSearch / readItemForm / readUserForm with element stubs — template for DOM readers.
- Minor fixed in the wave: empty-patch guard in updateItem/updateUser (log only changed keys, no-op returns current); etiquettes unknown-codes message; last-active-pedago / self deactivation guard; `.is-login .view { padding: 0 }`; roadmap Phase-1 table updated to shipped signatures.
- Deferred (ledger): hashchange dispatch coupling (phase 3 if search routing changes), nextItemCode reuse (documented: items never deleted), validateUser store-dependence comment, openModal returning the element, keyboard focus on rows, `ACTIONS` additions (phase 5).
Fix wave dispatched: brief final-fix-brief.md, base 9cb6d8e.
Fix wave: implementer ad08fa6b37ad9ee35, commits e34ed7a..6607ad2 (11), 142/142. Scoped re-review (sonnet): all F1-F7, M1-M4 ADDRESSED, no new breakage. Out-of-scope: toggle-active modal lacks try/catch around setUserActive (unreachable via UI thanks to isSelf guard) — deferred to phase 5 users polish; roadmap "aujourd'hui" straight apostrophe in .md — deferred docs nit; double requireItem in setItemState — trivial.
Controller browser check of F1: dirty notes preserved across a cross-write + warning toast; save persists; topbar search text preserved. PASS.
Tag phase-1 moved to 6607ad2. Phase 1 COMPLETE.
