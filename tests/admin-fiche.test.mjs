import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { itemHistory, manualTransitions } from '../js/actions/items.js';
import { ficheHtml } from '../js/admin/views/materielFiche.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

const build = (item, extra = {}) => ficheHtml({
  item, history: itemHistory(item.id), users: store.users.list(), transitions: manualTransitions(item),
  references: ['canon-r10'], date: NOW, ...extra,
});

test('ficheHtml d’un objet emprunté : en-tête, badges, formulaire, pas de bouton d’état', () => {
  const canon = store.items.list((i) => i.reference === 'canon-r10')[0];
  const html = build(canon);
  assert.match(html, /<h2 class="h5">Canon R10 \+ objectif 18-55 \+ bague<\/h2>/);
  assert.match(html, /badge--borrowed">Sur réservation/);
  assert.match(html, /badge--borrowed">Emprunté/);
  assert.match(html, /name="nom" value="Canon R10 \+ objectif 18-55 \+ bague"/);
  assert.doesNotMatch(html, /data-state=/);
  assert.match(html, /piloté par l’emprunt/);
  assert.match(html, /Optic Services/);
  assert.match(html, /id="qr" data-code="MDS-0029"/);
  assert.match(html, /etiquettes\.html\?codes=MDS-0029/);
  assert.match(html, /Historique des emprunts<\/h3><span class="body-sm text-secondary">\d+</);
});

test('ficheHtml d’un objet disponible : boutons de transition', () => {
  const free = store.items.list((i) => i.etat === 'disponible')[0];
  const html = build(free);
  assert.match(html, /data-state="maintenance">Passer en « Maintenance »/);
  assert.match(html, /data-state="hs">Passer en « Hors service »/);
});

test('ficheHtml : retard affiché et photos d’emprunt', () => {
  const dji = store.items.list((i) => i.reference === 'dji-rsc2')[0];
  const late = build(dji);
  assert.match(late, /badge--late">En retard/);
  const loan = store.loans.list((l) => l.itemId === dji.id && l.statut === 'en_cours')[0];
  store.loans.update(loan.id, { photoEmprunt: 'data:image/jpeg;base64,AAAA' });
  const withPhoto = build(store.items.get(dji.id));
  assert.match(withPhoto, /<img class="thumb" src="data:image\/jpeg;base64,AAAA" alt="Photo à l’emprunt" data-lightbox>/);
});
