# SDD ledger — plan: docs/superpowers/plans/2026-10-04-phase-3-materiel-valeur.md
Spec: docs/superpowers/specs/2026-09-17-mds-emprunts-design.md (reachable)
Branch: phase-3-valeur (from main @ plan commit)

## Pre-flight scan (2026-10-04)
| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 (carry-over fixes) → T5 | scanner.js reused by the admin handover modal | fixed before the admin reuses it — correct order |
| T2 actions → T3 (reserveValeur), T4 (cancelLoan, expireDueLoans), T5 (handOver/receiveLoan/refuseLoan/extendLoan/expireDueLoans) | signatures | consistent |
| T2 userLoans.reservations enriched → T3 fiche, T4 cards/notices | { loan, item, window, pickupOpen, expired } | consistent |
| T2 REASONS additions → messages via REASON_LABELS | fenetre_retrait, deja_reserve, date_passee | consistent |
| T4 loanQrPayload/renderQr → mobile.html needs vendor/qrcode.min.js | noted in T4 Step 3 | consistent |
| T5 handoverModal → dashboard + emprunts view | openHandoverModal({ onDone }) | consistent |
| Whole plan | extracted into a scratch copy and run: 223/223 after fixing 4 defects found by running the plan's own tests | clean |
Pre-flight defects found and fixed in the plan before execution:
- handOver looked up the short code filtered on statut RESERVEE → a reused code answered "code inconnu" instead of "plus en attente de remise"; now searches reservations first, then any loan with that code.
- The seed already holds 2 reservations (one the next weekday at 9h), which broke the expireDueLoans / pendingHandovers counts → the test file now clears them in beforeEach.
- The empty-motif refusal was asserted on an already-refused loan → now asserted on a fresh reservation.
- The phase-2 test « empruntsHtml : réservations et historique » asserts a wording the new reservation card replaces → T4 Step 1 instructs updating it.

## Progress
Tasks 1-2 (batched): implementer ad2ebc4a956541b7e, commits 947874b..c5b118c, 218/218, code identical to the validated scratch (cosmetic wrapping aside). Review: approved; 1 Important plan-mandated (`extendLoan` outside `store.transaction`), minors (reservation with an elapsed pickup window accepted then swept; DEJA_RESERVE wording when the user holds the reference en_cours; code6 collisions ~1e-9; stale header comment).
Rulings:
- Ruling: `extendLoan` wrapped in `store.transaction` + a quota-rollback test — why: the global constraint applies to every multi-write action; a silent date change without journal breaks traceability.
- Ruling: `reserveValeur` refuses a start whose pickup window is already closed (`DATE_PASSEE`) — why: otherwise the user gets "réservé" then an immediate expiry; the phase-3 UI lets one pick today.
- Ruling: `DEJA_RESERVE` label kept as is (the remap only ever concerns the user's own loan; wording covers the common case) — cost if wrong: a slightly off message when the user already has the reference en_cours. Parked.
- Ruling: `code6` uniqueness loop not added (1 in 887M per pair, QR path unaffected). Parked.
Fix round 1 dispatched.
Tasks 1-2: fix round 1/5 (3 addressed, 0 open — extendLoan transactionnel + rollback test, reserveValeur refuse une fenêtre close, en-tête à jour; commits c5b118c..71a6a1e, 220/220)
Task 1: complete (commits 34b06d0..71a6a1e, review clean after 1 fix round)
Task 2: complete (commits 34b06d0..71a6a1e, review clean after 1 fix round)
Tasks 3-4 (batched): implementer a0a9fcdae2ad25bd5, commits 711d57d..09ed2d5, 226/226. Review: 2 Important plan-mandated — (1) duplicate LOAN_EXPIREE journal entry when ≥2 reservations expire while a view is subscribed (re-entrant render iterates a stale `due` array; reproduced); (2) the accueil "réservation expirée" notice is dead code because expireDueLoans runs before userLoans, so `expired` is never true.
Rulings:
- Ruling: `expireDueLoans` re-reads each loan and skips those no longer RESERVEE, and returns the real count — why: inner writes notify subscribers mid-loop; the audit journal must not duplicate entries — cost if wrong: none (idempotence strengthened).
- Ruling: the expiry notice is sourced from a new `userLoans(...).expireesRecentes` (statut `expiree`, pickup window end < 24 h ago) instead of `reservations`; `reservationCardHtml`'s expired branch is kept as a defensive, tested path — cost if wrong: the notice window is arbitrary (24 h) and can be tuned.
Deferred (ledger): fiche/catalogue don't sweep expirations, so a lapsed reservation can briefly show "déjà réservé" until another view runs the sweep → phase 5 (a single sweep at app start would fix it); no timer means the QR appears/disappears only on the next render (handOver enforces the window anyway) → accepted.
Fix round 1 dispatched.
Tasks 3-4: fix round 1/5 (2 addressed, 0 open — expireDueLoans re-reads each loan and returns the real count; userLoans.expireesRecentes feeds the accueil notice; commits 09ed2d5..6d5b703, 228/228)
Task 3: complete (commits 71a6a1e..6d5b703, review clean after 1 fix round)
Task 4: complete (commits 71a6a1e..6d5b703, review clean after 1 fix round)
Task 5: implementer a60b14be3a0fa25db, commit c4e5e0e, 234/234, emprunts.js/handoverModal.js/tests identical to the validated scratch. Controller browser check (two windows, demo clock Monday): reserve SD 256 at 10h → "Votre code s'affichera à l'heure prévue" (no QR) → clock 10h15 → QR + code 7QDUAA + accueil notice "à retirer avant 11h00" → admin Remettre with the code → en_cours/emprunte, mobile tabs update live → Réceptionner with "Vidée / formatée" unchecked → retournee, item maintenance, signalement "Signalé à la réception : …". PASS.
Review: 2 Important plan-level omissions — (1) admin.html never loads vendor/html5-qrcode.min.js, so the admin QR scan is dead and `.reader` base CSS is mobile-only; (2) closing the handover modal with ✕/backdrop leaves the camera running (ui.closeModal knows nothing about the scanner). Minors: default sort overrides loanRows order on Réservés/Retards (plan-mandated, spec silent — parked); toast flood on a repeatedly misread QR (parked, phase 6 field test will tell); row "Remettre" doesn't pre-fill that row's code (parked); null row.item guard (theoretical — parked); extend default date uses UTC slice (fixed in round 1).
Ruling: `ui.openModal` gains an `onClose` hook invoked by `closeModal` on every path (button, ✕, backdrop) — why: the camera must be released however the modal closes, and phase 4-5 modals will need the same; cost if wrong: one more parameter on a shared helper.
Fix round 1 dispatched.
Task 5: fix round 1/5 (3 addressed, 0 open — html5-qrcode loaded in admin.html, .reader--admin self-sufficient, ui.openModal onClose hook releasing the scanner on every close path, extend date local; commits c4e5e0e..81197ff, 235/235)
Controller browser check after the fix: window.Html5Qrcode and window.QRCode both defined on admin.html; the handover modal shows a styled dark reader falling back to "Caméra indisponible : saisissez le code" (the browser pane blocks getUserMedia); ✕ closes it. ⚠️ The actual camera release on ✕ cannot be verified in the pane — to confirm on a real machine with a webcam (phase 6 field test).
Task 5: complete (commits 6d5b703..81197ff, review clean after 1 fix round)
Task 6 Steps 1-2 (controller): npm test 235/235; apostrophe and colour greps clean. Phase scenario verified in two windows: reservation → QR only inside the window → handover by code → reception with a problem (maintenance + signalement) → expiration (statut expiree, item released, exactly ONE loan.expiree journal entry, accueil notice shown). Refusal/cancellation covered by unit tests; the admin camera path falls back to code entry in the pane (camera blocked).
Task 6: implementer a76f177d6ad004c12, commit a451818, tag phase-3. Docs-only diff verified by controller.
Task 6: complete (commits 81197ff..a451818)

## Final whole-branch review (sonnet, 34b06d0..a451818): "With fixes"
Important: (1) refusal motif never shown to the borrower (spec §5.2/§7) and no refusal notice; (2) the expiry sweep runs in only 3 renders and is unguarded (a failed write breaks the view permanently); (3) no "non retiré" label on the admin side; (4) spec §6 says the LOAN/short-code search lands in phase 3 — not implemented; (5) reserveValeur accepts a Saturday pickup, fin<debut and an unbounded horizon, and the hour list is hardcoded; (6) openModal's single onClose slot loses the previous modal's cleanup; (7) handoverModal/checklist helpers not reusable for phases 4-5; (8) handOver reports CODE_INCONNU with an MDS-label message; (9) test gaps.
Rulings:
- Ruling: F1 refusal motif surfaced on the historique card + `userLoans().refuseesRecentes` feeding an accueil notice — spec §7 lists "refus" among the notifications.
- Ruling: F2 `sweepExpirations(date)` wrapper (try/catch) replaces the direct calls and is also called from both `guard()`s — one place for phase 4 to add booking sweeps; cost if wrong: an expiry can be delayed by one navigation.
- Ruling: F3 `LABELS.loanState.expiree` becomes "Non retiré" (reads correctly on both sides).
- Ruling (#4): the §6 search by retrait code moves to **phase 5**, alongside the scan-modal extraction and the row-level pre-fill — spec amended; cost if wrong: the pédago types the code in the modal instead of the topbar until then.
- Ruling: F4 `canReserveValeur` requires office hours at pickup and `fin >= debut`; the form derives its hours from `settings.horaires` and bounds the horizon to 60 days.
- Ruling: F6 `openModal` flushes the previous `onClose`; the full identity token is deferred to phase 5.
- Ruling (#7): `handoverModal` extraction deferred to phase 5 (roadmap updated) — nothing in phase 4 needs it.
- Ruling: M3 fixes the duplicate check at the source (`commonChecks` tests the user's own active loan before the item state) and drops the `DEJA_RESERVE` remap.
- Ruling: M4 deletes `pendingHandovers` (dead: the dashboard uses `kpi.dueTodayReservations`).
- Ruling: the expiry journal entry keeps `auteurId: loan.userId` (it is the borrower's reservation lapsing) — parked.
Deferred (ledger): `ui.toDate` local parsing + TZ test and `store.transaction` deferred persist/notify → **phase 4 task 0** (roadmap updated); scan-modal extraction, row-level handover pre-fill, admin search by code, modal identity token → **phase 5**; dashboard showing `codeRetrait` in clear → phase 5 decision; `code6` uniqueness, item null guards in handOver/receiveLoan → parked.
Fix wave dispatched: brief final-fix-brief.md, base a451818.
Final fix wave: implementer a375804e062d2deaf, commits 873e419..941eab6 (9), 249/249. Scoped re-review (sonnet): all F1-F6, M1-M5 and the docs ADDRESSED, no new breakage; `commonChecks` reordering confirmed harmless for the phase-2 tests; `pendingHandovers`/`DEJA_RESERVE` fully gone.
Residuals adjudicated (both load-bearing → ruled and fixed, not parked):
- Ruling: `refuseLoan` stamps `dateRefus` from `now()` and `refuseesRecentes` filters on it — `store.update` uses the real clock, so under the demo clock (the spec's own J+4 scenario) the accueil refusal notice never appeared; cost if wrong: refusals older than the fix are never "recent" (acceptable, they show in the historique with their motif).
- Ruling: `defaultDates` proposes the next working day — a Friday user was otherwise refused with HORS_OUVERTURE on the default date.
Parked: `openHours` throws on `horaires: null` (isOfficeOpen tolerates it) and renders "8.5h00" for fractional bounds → phase 5 settings form must keep integers; the `hors_ouverture` label hardcodes 8h-12h/13h-17h while hours are configurable → phase 5; alternating error messages defeat the scan debounce; `defaultDates` keeps an unused `dureeMax` parameter; `store.update`'s real-clock `updatedAt` is a trap for any future "recent" filter → noted for phase 5.
Residual fix: commit 4e8a36d (dateRefus on the demo clock, next working day default), 250/250. Verified by controller.
Tag phase-3 moved to 4e8a36d. Phase 3 COMPLETE.
