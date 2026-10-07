// js/mobile/scanFlow.js — réducteur pur des étapes de l’écran Scanner.
// scan → (erreur) | chargement → photo → confirmation (emprunt) | checklist (retour) → terminé.
import { buildChecklist } from '../checklists.js';

export const STEPS = { SCAN: 'scan', CHARGEMENT: 'chargement', PHOTO: 'photo', CONFIRM: 'confirm', CHECKLIST: 'checklist', DONE: 'done', ERREUR: 'erreur' };

export function initialState() {
  return { step: STEPS.SCAN, mode: null, item: null, loan: null, reason: null, photo: null, checklist: null, result: null, error: null };
}

// Un scan réussi passe par un temps de chargement avant la photo : sans lui, l’écran change
// si vite qu’on ne sait pas ce qui vient d’être reconnu. Un refus, lui, s’affiche tout de suite.
export function onScanResolved(state, { mode, item, loan, reason }) {
  if (mode === 'erreur') return { ...state, step: STEPS.ERREUR, mode, item, loan, reason, error: null };
  return { ...state, step: STEPS.CHARGEMENT, mode, item, loan, reason: null, error: null };
}

export function onLoaded(state) {
  return { ...state, step: STEPS.PHOTO };
}

export function onPhoto(state, photo) {
  const retour = state.mode === 'retour';
  return { ...state, photo, step: retour ? STEPS.CHECKLIST : STEPS.CONFIRM, checklist: retour ? buildChecklist(state.item.reference) : null };
}

export function setChecklistLine(state, index, { ok, commentaire }) {
  const checklist = state.checklist.map((line, i) => {
    if (i !== index) return line;
    const nextOk = ok === undefined ? line.ok : ok;
    return { ...line, ok: nextOk, commentaire: nextOk ? '' : (commentaire === undefined ? line.commentaire : commentaire) };
  });
  return { ...state, checklist };
}

export function onDone(state, result) {
  return { ...state, step: STEPS.DONE, result };
}

export function onError(state, message) {
  return { ...state, step: STEPS.ERREUR, reason: null, error: message };
}
