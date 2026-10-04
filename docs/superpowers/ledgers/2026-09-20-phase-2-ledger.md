# SDD ledger — plan: docs/superpowers/plans/2026-09-20-phase-2-mobile-self-service.md
Spec: docs/superpowers/specs/2026-09-17-mds-emprunts-design.md (reachable)
Branch: phase-2-mobile (from main @ plan commit)

## Pre-flight scan (2026-09-20)
| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 layout (setHeader, mountNav, routes placeholders) → T4-T6 | signatures | consistent |
| T2 loans (resolveScan/borrowSelf/returnSelf/userLoans) → T4 accueil, T5 scan, T6 emprunts | signatures | consistent |
| T2 rules REASONS.CODE_INCONNU → T5 errorHtml via REASON_LABELS | string key | consistent |
| T3 scanner + scanFlow → T5 | exports | consistent |
| T4 catalog (groupByReference/filterCatalog/availability) → catalogue/fiche views | signatures | consistent |
| T5 scanView returns cleanup that stops camera/scanner, no store subscription | router cleanup contract | consistent |
| Whole plan | extracted + assembled in scratch: 184/184 tests; mobile flow smoke-tested in browser (login, accueil, catalogue chips, scan simulate → placeholder photo → emprunt; manual code → retour with problem → signalement; historique with 2 photos); camera blocked in pane → fallback path verified | clean |
Ruling: the seed's "today" self loans are all late on a non-working day (known phase-0 ruling) — the phase scenario uses user_002 (no loan) and the demo clock; documented in Task 5 Step 6.

## Progress
Task 1: implementer a600e1f02f78ffb4d, commit 84bdf7c, 149/149, files identical to validated scratch. Review clean. Noted: temporary self-pointing back arrow on /accueil placeholder — disappears in Task 4 (accueilView has no back). Ruling: no action.
Task 1: complete (commits 3b8f40d..84bdf7c, review clean)
Tasks 2-3 (batched): implementer a2596564f986eacfc, commits 27cf52c..2a3fae2, 169/169, files identical to validated scratch. Review: 1 Important plan-mandated (non-atomic multi-write in borrowSelf/returnSelf — quota error mid-sequence leaves item/loan inconsistent), 1 Minor (startCamera doesn't stop a previous stream).
Ruling: add `store.transaction(fn)` (snapshot localStorage, restore + reload + notify on throw) and wrap both actions, writing the photo-bearing record first — why: cheapest real atomicity for a single-key localStorage store; phases 3-5 actions must use it too — cost if wrong: intermediate notifications during a failed transaction show a transient state (then corrected).
Fix round 1 dispatched (resume implementer).
Tasks 2-3: fix round 1/5 (2 addressed, 0 open — store.transaction + atomic actions + startCamera guard; commits 2a3fae2..6957c2a, 173/173)
Task 2: complete (commits 84bdf7c..6957c2a, review clean after 1 fix round)
Task 3: complete (commits 84bdf7c..6957c2a, review clean after 1 fix round)
Note for phase-3+ plans: multi-write actions must use `store.transaction(fn)` and write the largest record first.
Task 4: implementer a298092f50c9dbb43, commit 3fc66e2, 180/180, files identical to validated scratch. Review clean. Minor (deferred): catalogue search caret resets to end on mid-string edits (full re-render); relativeDay on 'YYYY-MM-DD' parses UTC midnight — safe for France (UTC+), latent elsewhere → use fromYmd in a later pass.
Task 4: complete (commits 6957c2a..3fc66e2, review clean)
Tasks 5-6 (batched): implementer aa15ac53ead88e08f, commits aeeea65..da47253, 188/188, files identical to validated scratch. Review: 2 Important (bindPhoto binds capture/cancel/placeholder listeners after awaits → dead buttons during camera warm-up), minors (defensive stopScanner in bindScan catch, comment on fire-and-forget stopScanner, relativeDay(x,x) degenerate — plan-inherited, kept: deadline is same-day by construction). Fix round 1 dispatched.
Tasks 5-6: fix round 1/5 (4 addressed, 0 open; commits da47253..3f85ce9, 188/188)
Task 5: complete (commits 3fc66e2..3f85ce9, review clean after 1 fix round)
Task 6: complete (commits 3fc66e2..3f85ce9, review clean after 1 fix round)
Task 7 Steps 1-2 (controller): npm test 188/188; greps clean. Two-window scenario on the real project (admin seed tab + mobile tab, demo clock Monday 10h, user_002): borrow MDS-0008 → admin KPI 10→11 + journal live; return with problem → Maintenance 1→2 + signalement live. PASS.
Observed (deferred to final review fix wave): (a) scan step re-renders when hasCamera() resolves, resetting the simulation <select> the user may have already changed — should patch the reader in place instead of re-rendering; (b) python http.server sends no Cache-Control → browsers keep stale modules across deploys; document a hard-reload tip in README (or add a cache-busting note for phase 6).
Task 7: implementer aeddb9f250b1d4ebd, commit 674eab7, tag phase-2. Docs-only diff verified by controller.
Task 7: complete (commits 3f85ce9..674eab7)

## Final whole-branch review (sonnet, 3b8f40d..674eab7): "With fixes"
Important: (1) valeur loans self-returnable via scan — spec §5.2 violation; (2) photo not enforced at action level — spec §5.1; (3) login filter loses focus every keystroke (keyboard closes on phones); (4) camera/scanner lifecycle races (scanner leak when leaving during start, stale onCode can hijack #view, stopScanner doesn't await real release, 1×1 JPEG when videoWidth=0); (5) quota error shown as raw English DOMException; (6) store.transaction persists/notifies per write (rework deferred); (7) no admin path to close a self loan (spec gap).
Rulings:
- Ruling: self-return limited to circuit `self`; new REASON `rendu_a_la_pedago` — why: spec §5.2 reserves valeur returns for the pédago's reception + full checklist — cost if wrong: a borrower must hand valeur gear back in person (intended).
- Ruling: photo mandatory enforced in `borrowSelf`/`returnSelf` (`data:image/` string) — why: phase-3 callers must not bypass it.
- Ruling: login + catalogue re-render only `[data-role="results"]` — why: focus/caret loss on phones; same idiom for both.
- Ruling: scanner/camera get generation tokens + a serialized op chain inside `scanner.js` — why: the admin scan modal (phase 3) will reuse it; keep views declarative.
- Ruling: quota → French message now; `store.usage()` surfacing stays phase 5.
- Ruling: `returnSelf` only forces item state when it is still `emprunte`.
- Ruling: historique sorts on `dateRetourReelle || dateRetrait || debutPrevu`.
Deferred (ledger): `store.transaction` rework to deferred persist/notify + in-memory snapshot → start of phase 3; `ui.toDate` local parsing of `YYYY-MM-DD` + TZ-pinned test → prerequisite at start of phase 4 (booking dates reach the home screen and planning); safe-area CSS (`env(safe-area-inset-*)`, `100dvh`, toast above the nav) → phase 5.4 PWA; admin reception of self loans / warn when deactivating a user with open loans → phase 3; `userLoans.reservations` to expose `pickupOpen`/`expired` → phase 3; GitHub Pages `max-age=600` stale modules → phase 6 notice; `errorHtml` hint for a reserved valeur item → phase 3; scan-flow table-driven modes if a new mode appears → phase 3; checklist re-render flicker, `normalizeScanText` URL tolerance, `router.matchRoute` URIError, pédago "Ouvrir l'admin" link → minor, unscheduled.
Fix wave dispatched: brief final-fix-brief.md, base 674eab7.
Final fix wave: implementer ab9f8fdeec1400d9f, commits 1246829..fc1d24c (7), 198/198. Scoped re-review (sonnet): all F1-F6, M1-M3 ADDRESSED; both implementer deviations judged equivalent-or-stronger (F4 test replacement exercises the real stop-during-start race; M2 test still discriminates the old sort key).
Residual minors adjudicated (no second fix wave; ruled into phase 3's plan as its first task):
- Ruling: `bindPhoto`'s catch must ignore the new `Caméra annulée.` rejection and null-guard `.video-box` — real TypeError/unhandled rejection + spurious toast when the user taps the placeholder while the permission prompt is pending; introduced by F4 — cost if wrong: a console error and a misleading toast in the phone demo. → phase 3 Task 1.
- Ruling: `errorHtml` must not show the "Réserver depuis le catalogue" hint when `reason === 'rendu_a_la_pedago'` (the user already holds the item); phase 3 replaces it with "Montrez votre QR de retrait à la pédago". → phase 3 Task 1.
- Ruling: `startScanner` should stop a previously running instance before assigning (latent today, reachable once the admin scan modal reuses the module in phase 3). → phase 3 Task 1.
Tag phase-2 moved to fc1d24c. Phase 2 COMPLETE.
