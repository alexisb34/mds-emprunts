import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { TABS_ADMIN_LOANS, LOAN_COLUMNS, loanRows, empruntsHtml } from '../js/admin/views/emprunts.js';
import { checklistFormHtml, readChecklistForm, openHandoverModal } from '../js/admin/handoverModal.js';
import { sortRows } from '../js/admin/table.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); store.settings.update({ horlogeDemo: NOW.toISOString() }); });

test('TABS_ADMIN_LOANS et loanRows : répartition conforme au seed', () => {
  assert.deepEqual(TABS_ADMIN_LOANS.map((t) => t.key), ['enCours', 'reserves', 'retards', 'historique']);
  assert.equal(loanRows('enCours', NOW).length, 8, '10 en cours moins les 2 en retard');
  assert.equal(loanRows('retards', NOW).length, 2);
  assert.equal(loanRows('reserves', NOW).length, 2);
  assert.ok(loanRows('historique', NOW).length >= 40);
  const r = loanRows('retards', NOW)[0];
  assert.ok(r.item && r.user && r.loan);
  assert.equal(r.late, true);
});

test('LOAN_COLUMNS : rendus échappés, badge de retard, actions selon l’onglet', () => {
  const row = { loan: { id: 'l1', statut: 'en_cours', debutPrevu: NOW.toISOString(), dateRetrait: NOW.toISOString(), finPrevue: NOW.toISOString(), codeRetrait: null }, item: { id: 'i1', nom: '<x>', code: 'MDS-0001' }, user: { id: 'u1', prenom: 'Léa', nom: 'P' }, late: true };
  assert.deepEqual(LOAN_COLUMNS.map((c) => c.key), ['item', 'user', 'debut', 'fin', 'statut']);
  assert.match(LOAN_COLUMNS[0].render(row), /&lt;x&gt;/);
  assert.match(LOAN_COLUMNS[1].render(row), /Léa P/);
  assert.match(LOAN_COLUMNS[4].render(row), /badge--late/);
});

test('empruntsHtml : onglets avec compteurs, actions de l’onglet Réservés, état vide', () => {
  const rows = sortRows(loanRows('reserves', NOW), { key: 'debut', dir: 'asc' }, LOAN_COLUMNS);
  const counts = { enCours: 8, reserves: 2, retards: 2, historique: 41 };
  const html = empruntsHtml({ tab: 'reserves', rows, counts, sort: { key: 'debut', dir: 'asc' }, date: NOW });
  assert.match(html, /tab tab--active" data-tab="reserves">Réservés <span class="tab__count">2<\/span>/);
  assert.match(html, /data-action="handover"/);
  assert.match(html, /data-action="refuse" data-loan="/);
  const vide = empruntsHtml({ tab: 'retards', rows: [], counts: { enCours: 0, reserves: 0, retards: 0, historique: 0 }, sort: null, date: NOW });
  assert.match(vide, /Aucun emprunt/);
});

test('empruntsHtml : onglet En cours propose réception et prolongation', () => {
  const rows = loanRows('enCours', NOW);
  const html = empruntsHtml({ tab: 'enCours', rows, counts: { enCours: rows.length, reserves: 0, retards: 0, historique: 0 }, sort: null, date: NOW });
  assert.match(html, /data-action="receive" data-loan="/);
  assert.match(html, /data-action="extend" data-loan="/);
});

test('checklistFormHtml et readChecklistForm', () => {
  const html = checklistFormHtml('hoya-nd');
  assert.equal((html.match(/data-line="/g) || []).length, 3);
  assert.match(html, /Verre sans rayure/);
  assert.match(html, /name="commentaire"/);
  const root = {
    querySelectorAll: () => [
      { dataset: { line: '0' }, checked: false, closest: () => ({ querySelector: () => ({ value: 'rayure' }) }) },
      { dataset: { line: '1' }, checked: true, closest: () => ({ querySelector: () => ({ value: '' }) }) },
      { dataset: { line: '2' }, checked: true, closest: () => ({ querySelector: () => ({ value: '' }) }) },
    ],
    querySelector: (sel) => (sel === '[name="commentaire"]' ? { value: 'à nettoyer' } : null),
  };
  const read = readChecklistForm(root, 'hoya-nd');
  assert.equal(read.checklist.length, 3);
  assert.equal(read.checklist[0].ok, false);
  assert.equal(read.checklist[0].commentaire, 'rayure');
  assert.equal(read.checklist[1].ok, true);
  assert.equal(read.commentaire, 'à nettoyer');
});

test('openHandoverModal est exposée', () => {
  assert.equal(typeof openHandoverModal, 'function');
});
