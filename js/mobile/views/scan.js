// js/mobile/views/scan.js — écran Scanner : lecture du QR (caméra ou simulation), photo,
// confirmation d’emprunt ou checklist de retour, résultat. Le flux est piloté par scanFlow.js.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, selfReturnDeadline, withDefaults, REASON_LABELS } from '../../rules.js';
import { CIRCUITS, ITEM_STATES } from '../../models.js';
import { escapeHtml, badge, formatTime, relativeDay, toast } from '../../ui.js';
import { resolveScan, borrowSelf, returnSelf, userLoans } from '../../actions/loans.js';
import { hasCamera, startScanner, stopScanner, startCamera, stopCamera, capturePhoto, placeholderPhoto, normalizeScanText } from '../../scanner.js';
import { STEPS, initialState, onScanResolved, onPhoto, setChecklistLine, onDone, onError } from '../scanFlow.js';
import { setHeader } from '../layout.js';

const stepTitle = (n, text) => `<h2 class="step-title"><span class="step-num">${n}</span><span class="h6">${escapeHtml(text)}</span></h2>`;
const itemLine = (item) => `<div class="m-item"><span class="m-item__body"><strong>${escapeHtml(item.nom)}</strong><span class="body-tiny text-secondary">${escapeHtml(item.code)}</span></span>${badge('circuit', item.circuit)}</div>`;

// localStorage plein (photos) : message utile plutôt que l’exception du navigateur.
export function friendlyError(e) {
  const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
  return quota ? 'Stockage de démonstration plein : demandez à la pédago de réinitialiser les données.' : (e && e.message) || 'Une erreur est survenue.';
}

// Les emprunts en cours de l’utilisateur : un bouton par objet, qui mène directement au retour
// (photo puis checklist) sans passer par le scan ni la liste de simulation.
export function returnListHtml(loans) {
  if (!loans.length) return '';
  return `
    <div class="card">
      <div class="card__header"><h3 class="card__title">Rendre un objet</h3><span class="body-sm text-secondary">${loans.length}</span></div>
      <div class="m-list">${loans.map(({ loan, item, late }) => `
        <button type="button" class="m-item m-item--button" data-return="${escapeHtml(item.code)}">
          <span class="m-item__body"><strong>${escapeHtml(item.nom)}</strong><span class="body-tiny text-secondary">Retour attendu avant ${escapeHtml(formatTime(loan.finPrevue))}</span></span>
          ${late ? badge('loan', 'en_retard') : ''}
          <span class="m-item__cta">Rendre →</span>
        </button>`).join('')}</div>
    </div>`;
}

export function scanStepHtml({ codes, camera, returnable = [] }) {
  const reader = camera
    ? '<div id="reader" class="reader"><p class="reader__hint">Visez l’étiquette QR de l’objet</p></div>'
    : '<div class="reader"><p class="body-sm">Caméra indisponible — utilisez la simulation ci-dessous.</p></div>';
  const simulation = codes.length
    ? `<label class="field"><span class="field__label">Objet disponible</span><select class="select" name="code-sim">${codes.map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.code)} — ${escapeHtml(c.nom)}</option>`).join('')}</select></label>
        <button type="button" class="btn btn--secondary btn--block" data-action="simulate">Simuler le scan</button>`
    : '<p class="body-sm text-secondary">Aucun objet disponible à emprunter pour le moment.</p>';
  return `
    ${returnListHtml(returnable)}
    ${stepTitle(1, 'Emprunter : scannez l’étiquette de l’objet')}
    ${reader}
    <div class="card">
      <div class="card__header"><h3 class="card__title">Simuler un scan</h3></div>
      <div class="stack">
        ${simulation}
        <label class="field"><span class="field__label">Ou saisir un code</span><input class="input" name="code-manual" placeholder="MDS-0001" autocapitalize="characters"></label>
        <button type="button" class="btn btn--ghost btn--block" data-action="manual">Valider le code</button>
      </div>
    </div>`;
}

export function photoStepHtml({ mode, item, camera }) {
  const why = mode === 'retour' ? 'Photographiez l’objet avant de le rendre : elle atteste de son état.' : 'Photographiez l’objet : elle atteste de son état au moment de l’emprunt.';
  const capture = camera ? '<div class="video-box"><video id="video" playsinline muted></video></div><button type="button" class="btn btn--primary btn--block" data-action="capture">Prendre la photo</button>' : '';
  return `
    ${stepTitle(2, 'Photo de l’objet')}
    ${itemLine(item)}
    <p class="body-sm text-secondary">${why}</p>
    ${capture}
    <button type="button" class="btn ${camera ? 'btn--ghost' : 'btn--primary'} btn--block" data-action="placeholder">${camera ? 'Sans caméra : image de démonstration' : 'Utiliser une image de démonstration'}</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Annuler</button>`;
}

export function confirmStepHtml({ item, photo, deadline }) {
  return `
    ${stepTitle(3, 'Confirmer l’emprunt')}
    ${itemLine(item)}
    <img class="photo-preview" src="${escapeHtml(photo)}" alt="Photo de l’objet à l’emprunt">
    <div class="alert alert--info">Retour attendu ${escapeHtml(relativeDay(deadline, deadline).toLowerCase())} avant ${escapeHtml(formatTime(deadline))}, au bureau des pédago.</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-borrow">Confirmer l’emprunt</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Annuler</button>`;
}

export function checklistStepHtml({ item, photo, checklist }) {
  const rows = checklist.map((line, i) => `
    <div class="checklist__row${line.ok ? '' : ' checklist__row--problem'}" data-row="${i}">
      <span class="checklist__line">${escapeHtml(line.ligne)}</span>
      <div class="seg">
        <button type="button" data-line="${i}" data-ok="1" class="seg__btn${line.ok ? ' seg__btn--on' : ''}">OK</button>
        <button type="button" data-line="${i}" data-ok="0" class="seg__btn${line.ok ? '' : ' seg__btn--problem'}">Problème</button>
      </div>
      <textarea class="textarea checklist__comment" data-comment="${i}" placeholder="Décrivez le problème (optionnel)">${escapeHtml(line.commentaire)}</textarea>
    </div>`).join('');
  return `
    ${stepTitle(3, 'État de l’objet')}
    ${itemLine(item)}
    <img class="photo-preview" src="${escapeHtml(photo)}" alt="Photo de l’objet au retour">
    <div class="checklist">${rows}</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-return">Confirmer le retour</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Annuler</button>`;
}

export function resultHtml({ mode, item, result }) {
  let icon = 'ok';
  let title = 'Emprunt enregistré';
  let text = `Retour attendu ${result && result.finPrevue ? `${relativeDay(result.finPrevue, result.finPrevue).toLowerCase()} avant ${formatTime(result.finPrevue)}` : 'aujourd’hui'}. Bon travail !`;
  if (mode === 'retour') {
    if (result && result.problem) { icon = 'warn'; title = 'Retour enregistré — problème signalé'; text = 'Merci, la pédago est prévenue et l’objet passe en maintenance.'; }
    else { title = 'Retour enregistré'; text = 'Merci ! L’objet est de nouveau disponible.'; }
  }
  return `
    <div class="card result">
      <div class="result__icon result__icon--${icon}">${icon === 'ok' ? '✓' : '!'}</div>
      <h2 class="h6">${escapeHtml(title)}</h2>
      <p class="body-sm text-secondary">${escapeHtml(item.nom)} · ${escapeHtml(text)}</p>
      <button type="button" class="btn btn--primary btn--block" data-action="restart">Scanner un autre objet</button>
      <a class="btn btn--ghost btn--block" href="#/accueil">Retour à l’accueil</a>
    </div>`;
}

export function errorHtml({ reason, error, item }) {
  const message = reason ? (REASON_LABELS[reason] || reason) : (error || 'Une erreur est survenue.');
  let hint = '';
  if (item && item.circuit === CIRCUITS.VALEUR) hint = `<a class="btn btn--secondary btn--block" href="#/catalogue/${escapeHtml(item.reference)}">Réserver depuis le catalogue</a>`;
  if (item && item.circuit === CIRCUITS.SALLE) hint = '<a class="btn btn--secondary btn--block" href="#/salle">Réserver la salle photo</a>';
  return `
    <div class="card result">
      <div class="result__icon result__icon--error">✕</div>
      <h2 class="h6">Impossible</h2>
      ${item ? `<p class="body-sm">${escapeHtml(item.nom)}</p>` : ''}
      <p class="body-sm text-secondary">${escapeHtml(message)}</p>
      ${hint}
      <button type="button" class="btn btn--primary btn--block" data-action="restart">Scanner à nouveau</button>
      <a class="btn btn--ghost btn--block" href="#/accueil">Retour à l’accueil</a>
    </div>`;
}

export function scanView(container) {
  const user = auth.currentUser();
  let state = initialState();
  let camera = false;
  let alive = true;

  // La simulation ne propose que ce qui peut réellement être emprunté : un objet déjà emprunté,
  // réservé, en maintenance ou hors service n’a rien à faire dans cette liste.
  const codes = () => store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE).sort((a, b) => a.code.localeCompare(b.code)).map((i) => ({ code: i.code, nom: i.nom }));
  // Objets que l’utilisateur peut rendre en self-service (le matériel de valeur se rend à la pédago).
  const returnable = () => userLoans(user.id, now()).enCours.filter((x) => x.item && x.item.circuit === CIRCUITS.SELF);
  const set = (next) => { state = next; render(); };
  const on = (selector, fn) => { const el = container.querySelector(selector); if (el) el.addEventListener('click', fn); };
  // stopScanner() n’est pas attendu : le jeton de génération du module neutralise déjà les lectures
  // tardives, donc le flux peut avancer sans dépendre de l’arrêt réel du lecteur.
  const handleCode = (text) => {
    if (!alive || state.step !== STEPS.SCAN) return;
    stopScanner();
    set(onScanResolved(state, resolveScan(normalizeScanText(text), user.id, now())));
  };

  const bindScan = async () => {
    stopCamera();
    container.querySelectorAll('[data-return]').forEach((b) => b.addEventListener('click', () => handleCode(b.dataset.return)));
    on('[data-action="simulate"]', () => handleCode(container.querySelector('[name="code-sim"]').value));
    on('[data-action="manual"]', () => handleCode(container.querySelector('[name="code-manual"]').value));
    if (!camera) return;
    try {
      await startScanner('reader', (text) => handleCode(text));
      if (!alive) stopScanner();
    } catch (e) {
      stopScanner();
      const hint = container.querySelector('.reader__hint');
      if (hint) hint.textContent = 'Caméra indisponible — utilisez la simulation.';
    }
  };

  const bindPhoto = async () => {
    on('[data-action="cancel"]', () => { stopCamera(); set(initialState()); });
    on('[data-action="placeholder"]', () => { stopCamera(); set(onPhoto(state, placeholderPhoto(state.item.code))); });
    const capture = container.querySelector('[data-action="capture"]');
    const video = container.querySelector('#video');
    if (capture) {
      capture.addEventListener('click', () => {
        if (!video.srcObject || !video.videoWidth) { toast('La caméra démarre…', 'info'); return; }
        const photo = capturePhoto(video);
        stopCamera();
        set(onPhoto(state, photo));
      });
    }
    await stopScanner();
    if (!capture) return;
    try {
      await startCamera(video);
      if (!alive) stopCamera();
    } catch (e) {
      capture.disabled = true;
      container.querySelector('.video-box').hidden = true;
      toast('Caméra indisponible : utilisez l’image de démonstration.', 'warning');
    }
  };

  const bindConfirm = () => {
    on('[data-action="cancel"]', () => set(initialState()));
    on('[data-action="confirm-borrow"]', () => {
      try {
        const loan = borrowSelf({ itemCode: state.item.code, userId: user.id, photo: state.photo });
        set(onDone(state, { loanId: loan.id, finPrevue: loan.finPrevue }));
      } catch (e) {
        set(e.reason ? onScanResolved(state, { mode: 'erreur', item: state.item, loan: null, reason: e.reason }) : onError(state, friendlyError(e)));
      }
    });
  };

  const bindChecklist = () => {
    on('[data-action="cancel"]', () => set(initialState()));
    container.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => set(setChecklistLine(state, Number(b.dataset.line), { ok: b.dataset.ok === '1' }))));
    container.querySelectorAll('[data-comment]').forEach((t) => t.addEventListener('input', () => { state = setChecklistLine(state, Number(t.dataset.comment), { commentaire: t.value }); }));
    on('[data-action="confirm-return"]', () => {
      try {
        const r = returnSelf({ loanId: state.loan.id, userId: user.id, photo: state.photo, checklist: state.checklist });
        set(onDone(state, { loanId: r.loan.id, problem: !!r.maintenance }));
      } catch (e) {
        set(onError(state, friendlyError(e)));
      }
    });
  };

  const render = () => {
    setHeader({ title: 'Scanner', back: '/accueil' });
    switch (state.step) {
      case STEPS.SCAN: container.innerHTML = scanStepHtml({ codes: codes(), camera, returnable: returnable() }); bindScan(); break;
      case STEPS.PHOTO: container.innerHTML = photoStepHtml({ mode: state.mode, item: state.item, camera }); bindPhoto(); break;
      case STEPS.CONFIRM: {
        const deadline = selfReturnDeadline(now(), withDefaults(store.settings.get()).heureRetourSelf);
        container.innerHTML = confirmStepHtml({ item: state.item, photo: state.photo, deadline }); bindConfirm(); break;
      }
      case STEPS.CHECKLIST: container.innerHTML = checklistStepHtml({ item: state.item, photo: state.photo, checklist: state.checklist }); bindChecklist(); break;
      case STEPS.DONE: container.innerHTML = resultHtml({ mode: state.mode, item: state.item, result: state.result }); on('[data-action="restart"]', () => set(initialState())); break;
      default: container.innerHTML = errorHtml({ reason: state.reason, error: state.error, item: state.item }); on('[data-action="restart"]', () => set(initialState()));
    }
  };

  hasCamera().then((c) => {
    if (!alive || c === camera) return;
    camera = c;
    if (state.step !== STEPS.SCAN) return;
    // Le re-rendu ne doit pas écraser ce que l’utilisateur a déjà choisi ou saisi.
    const sim = container.querySelector('[name="code-sim"]');
    const manual = container.querySelector('[name="code-manual"]');
    const keep = { sim: sim ? sim.value : null, manual: manual ? manual.value : '' };
    render();
    const sim2 = container.querySelector('[name="code-sim"]');
    const manual2 = container.querySelector('[name="code-manual"]');
    if (sim2 && keep.sim) sim2.value = keep.sim;
    if (manual2) manual2.value = keep.manual;
  });
  render();
  return () => { alive = false; stopScanner(); stopCamera(); };
}
