# SDD ledger — plan: docs/superpowers/plans/2026-09-17-phase-0-fondations.md
Spec: docs/superpowers/specs/2026-09-17-mds-emprunts-design.md (reachable)
Branch: phase-0-fondations (from main @ b30f142)

## Pre-flight scan (2026-09-17)
| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 → all | tokens.css vars, tests/helpers/storage.mjs shim | T2-T9 tests import './helpers/storage.mjs' first — consistent |
| T2 models → T4 rules, T6 seed, T8 ui | CIRCUITS/ITEM_STATES/LOAN_STATES/BOOKING_STATES/MAINT_*/ROLES/PROMOS/LABELS | names match in all consumers |
| T3 store → T4 (now), T6/T7 (init/seed), T7 log/auth | store.settings.get(), store.log.create, store.users.get | signatures match |
| T4 rules → T6 seed, T7 log | DEFAULT_SETTINGS, addDays, atHour, ymd, isWeekday, now() | match; seed test uses isLate/slots*/fromYmd also exported by T4 |
| T5 checklists → T6 seed | buildChecklist, buildRoomChecklist | match; seed test asserts every CATALOG reference ∈ CHECKLISTS |
| T6 seed → T7 tests | log actions in seed ⊂ ACTIONS (T7) | verified by T7 test; strings cross-checked manually |
| T8 ui → T10 kit.html | openModal/toast + #modal-root/#toast-root | kit.html includes both roots |
| T9 router | pure matchRoute tested; DOM part verified in phase 1 | ok |
| T1 .gitignore vs SDD workspace | plan mandates `.gitignore` = `.DS_Store` only | Ruling: keep .gitignore as planned; `.superpowers/` excluded via .git/info/exclude — cost if wrong: none (local only) |
| Global: no npm deps | package.json has no dependencies | ok |
| Whole plan code | extracted to scratchpad and run: 61/61 tests pass; kit.html renders, modal/toast behave | clean |
Test counts per task: T1 1, T2 5, T3 13, T4 11, T5 6, T6 8, T7 9, T8 6, T9 2 → 61.

## Progress
Tasks 1-3 (batched): implementer aec9ea2687c19153b, commits 0b8ca25..75adcc9, 19/19 tests. Review: 1 Important (test title apostrophe `\'` vs `’` in tests/models.test.mjs), 1 Minor (report claimed a non-existent typo fix). Fix round 1 dispatched (resume implementer).
Tasks 1-3: fix round 1/5 (2 addressed, 0 open — apostrophe restored, report corrected; commits 75adcc9..2356b1e)
Task 1: complete (commits b30f142..2356b1e, review clean after 1 fix round)
Task 2: complete (commits b30f142..2356b1e, review clean after 1 fix round)
Task 3: complete (commits b30f142..2356b1e, review clean after 1 fix round)
Tasks 4-6 (batched): implementer af4b80a84420f3088, commits 47bb335..e197f94, 44/44 tests. Review: 1 Important (U+2019 → U+0027 substituted in 9 user-facing strings + test titles, misreported as verbatim). ⚠️ store.init(seedFn) shape — resolved by controller: store.test "init avec seedFn" + seed.test cover the db shape {settings, users, items, loans, bookings, maintenance, log}; no gap. Fix round 1 dispatched (resume implementer).
Tasks 4-6: fix round 1/5 (1 addressed, 0 open — U+2019 + single quotes restored, files byte-identical to validated extraction; commits e197f94..7b03391)
Task 4: complete (commits 2356b1e..7b03391, review clean after 1 fix round)
Task 5: complete (commits 2356b1e..7b03391, review clean after 1 fix round)
Task 6: complete (commits 2356b1e..7b03391, review clean after 1 fix round)
Tasks 7-9 (batched): implementer a24116a7a37025bd9, commits 675722e..e09ce9a, 61/61 tests, files byte-identical to plan. Review clean.
Task 7: minor (deferred): ui.js toast/openModal use #modal-root/#toast-root unguarded (closeModal null-checks) — plan-mandated; check in kit.html DOM pass
Task 8: minor (deferred): ui.initials() throws if prenom/nom undefined (only '' handled)
⚠️ DOM parts of ui.js (openModal/toast/avatar) and router.js (currentPath/navigate/createRouter) — to verify in Task 10 kit.html (controller browser check) ; router DOM verified in phase 1
Task 7: complete (commits 7b03391..e09ce9a, review clean)
Task 8: complete (commits 7b03391..e09ce9a, review clean)
Task 9: complete (commits 7b03391..e09ce9a, review clean)
Task 10: implementer a28775e26ded1bc1e, commit fe6daf7. Controller visual check (kit.html @ http://127.0.0.1:8000): pill buttons 44px, 6 pastel badges, KPI white/violet/teal with Bricolage 40px, table caps headers, sidebar nav, tabs, alerts — consistent with Figma dashboard demo (2:117) captured earlier; Figma desktop no longer has the file active so per-page node screenshots unavailable. Modal (open/close/keep-open on empty motif) and toasts verified earlier on identical ui.js in scratch. No console errors. Controller diff vs validated extraction: kit.html has 3 lines with `'` instead of `’` (demo text) — awaiting reviewer.
Task 10 review: 1 Important (3 straight apostrophes in kit.html demo text, misreported), Minor: report line counts wrong; `.toast-stack` listed in brief interface but never defined (brief inconsistency). Ruling: the toast container contract is `#toast-root` (styled in components.css, used by ui.toast) — `.toast-stack` is dropped from the interface; phase-1 plan must reference `#toast-root` — cost if wrong: a view referencing `.toast-stack` gets no styling (visible immediately). Fix round 1 dispatched (resume implementer).
Task 10: fix round 1/5 (1 Important addressed; Minor "report line counts" marked NOT ADDRESSED by re-reviewer because the report lives in the git-ignored workspace and is invisible in the diff — controller checked the report file directly: counts corrected to 151/195. Closed. commits fe6daf7..8f2d947)
Task 10: complete (commits e09ce9a..8f2d947, review clean after 1 fix round)
Task 11: controller ran Step 2 (cross-tab storage propagation) in the browser: tab B create → tab A subscriber fired (45 items) without reload — PASS. Implementer aae6d7c7b9ea0b4c2: npm test 61/61, README updated, commit 5665d5b, tag phase-0. Diff reviewed by controller (README-only, verbatim).
Task 11: complete (commits 8f2d947..5665d5b, README-only diff verified by controller)

## Final whole-branch review (opus, b30f142..5665d5b): "With fixes"
Important: F1 fractional-day duration rule; F2 store hands out live references; F3 seed en-cours loans dated in the future on mornings / all late on weekends; F4 no Node test for cross-tab sync; F5 REASONS collapses distinct refusals; F6 relativeDay defaults to wall clock (bypasses demo clock).
Rulings:
- Ruling: duration = calendar days (fromYmd(ymd(fin)) - fromYmd(ymd(debut))), spec §5.2 amended — why: date-granular picker + finPrevue at 17h + DST make 24h periods wrong — cost if wrong: a 5-day rule accepts up to 5d+hours; acceptable.
- Ruling: records are deep-frozen in store (rows + settings, not collection arrays), plus init guard — why: cheapest way to turn silent unpersisted mutations into TypeErrors during phases 1-5 — cost if wrong: actions must always use update() with patches (already the contract).
- Ruling: seed clamps "today" loan/booking timestamps to ≤ now; weekend behaviour accepted and documented (set demo clock) — cost if wrong: weekend demo shows 8 late loans until clock is set.
- Ruling: storage event with key null (clear from another tab) is ignored, documented + tested — cost if wrong: stale tab until reset.
- Ruling: REASONS extended (emprunte_par_autre, reserve_par_autre, en_maintenance, hors_service), indisponible kept as fallback.
- Ruling: relativeDay(d, ref) — ref mandatory (throws) ; ui.js stays store-free.
- Ruling: withDefaults(settings) applied in rules so an un-seeded store (settings {}) doesn't silently disable rules.
- Ruling: LABELS.derived added for en_retard / sortie_non_faite.
Deferred to later phases (ledger): hardcoded hover/overlay colours in components.css → phase 1 shell CSS task; ACTIONS additions (maintenance.en_cours, user.reactive) → phase 5; router error boundary / query strings → phase 1; store create() duplicate id / update() overwriting id → phase 1 actions tests; `LABELS.circuit.valeur = 'Sur réservation'` kept (UX wording, matches spec §7 pastille).
Fix wave dispatched: brief final-fix-brief.md, base 5665d5b.
Fix wave: session restart mid-wave (db67460 committed + uncommitted work, 78 tests green). Fresh implementer a0e3d31468e2aa76a audited and completed: commits db67460..1f1ebb2 (6 commits), 78/78 tests. Scoped re-review dispatched.
Final fix wave re-review (sonnet, 5665d5b..1f1ebb2): all F1-F7 ADDRESSED, no new breakage. Out-of-scope minor: Monday-8h seed test doesn't assert the booking etatEntree clamp at the H:01 edge (deferred, phase 1 dashboard task).
Tag phase-0 moved to 1f1ebb2. Phase 0 COMPLETE — proceeding to finishing-a-development-branch.
