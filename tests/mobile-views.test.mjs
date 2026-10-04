import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userLoans } from '../js/actions/loans.js';
import { groupByReference } from '../js/mobile/catalog.js';
import { accueilHtml } from '../js/mobile/views/accueil.js';
import { catalogueHtml, catalogueResultsHtml } from '../js/mobile/views/catalogue.js';
import { ficheHtml } from '../js/mobile/views/fiche.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('accueilHtml : salutation, emprunts en cours avec retard, réservation salle, CTA', () => {
  const late = store.loans.list((l) => l.statut === 'en_cours' && new Date(l.finPrevue) < NOW)[0];
  const user = store.users.get(late.userId);
  const html = accueilHtml({ user, enCours: userLoans(user.id, NOW).enCours, nextBooking: null, date: NOW });
  assert.match(html, new RegExp(`Bonjour ${user.prenom}`));
  assert.match(html, /badge--late">En retard/);
  assert.match(html, /href="#\/scan"/);
  assert.match(html, /Aucune réservation de la salle photo/);
  const booking = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const html2 = accueilHtml({ user: store.users.get(booking.userId), enCours: [], nextBooking: booking, date: NOW });
  assert.match(html2, /Aucun emprunt en cours/);
  assert.match(html2, /9h-11h/);
  assert.match(html2, /En cours/);
});

test('accueilHtml : bouton d’état des lieux quand le créneau est en cours', () => {
  const booking = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const base = { user: store.users.get(booking.userId), enCours: [], nextBooking: booking, date: NOW };
  const entree = accueilHtml({ ...base, salle: { active: { booking, entreeFaite: false, sortieFaite: false }, aVenir: [], passees: [] } });
  assert.match(entree, /<a class="btn btn--primary btn--block" href="#\/salle">Faire l’état des lieux d’entrée<\/a>/);
  const sortie = accueilHtml({ ...base, salle: { active: { booking, entreeFaite: true, sortieFaite: false }, aVenir: [], passees: [] } });
  assert.match(sortie, /état des lieux de sortie/);
  const fait = accueilHtml({ ...base, salle: { active: { booking, entreeFaite: true, sortieFaite: true }, aVenir: [], passees: [] } });
  assert.doesNotMatch(fait, /Faire l’état des lieux/);
  assert.doesNotMatch(accueilHtml(base), /Faire l’état des lieux/);
});

test('catalogueHtml : chips, cartes par référence, badge et pastille circuit', () => {
  const groups = groupByReference(store.items.list());
  const html = catalogueHtml({ groups, filters: { q: '', categorie: 'Audio' }, categories: ['Bureautique', 'Audio'] });
  assert.match(html, /chip chip--active" data-categorie="Audio"/);
  assert.match(html, /chip" data-categorie=""/);
  assert.equal((html.match(/class="m-card"/g) || []).length, 20);
  assert.match(html, /href="#\/catalogue\/multiprise"/);
  assert.match(html, /4 sur 6 disponibles/);
  assert.match(html, /badge--available">Self-service/);
  const empty = catalogueHtml({ groups: [], filters: { q: 'zzz', categorie: '' }, categories: [] });
  assert.match(empty, /Aucun matériel ne correspond/);
  assert.match(html, /data-role="results"/);
  assert.match(empty, /data-role="results"/);
  assert.equal((catalogueResultsHtml(groups).match(/class="m-card"/g) || []).length, groups.length);
});

test('ficheHtml : exemplaires et bouton selon le circuit', () => {
  const groups = groupByReference(store.items.list());
  const self = ficheHtml({ group: groups.find((g) => g.reference === 'multiprise'), date: NOW });
  assert.equal((self.match(/m-exemplaire/g) || []).length, 6);
  assert.match(self, /href="#\/scan"[^>]*>Scanner pour emprunter/);
  assert.match(self, /MDS-0001/);
  const salle = ficheHtml({ group: groups.find((g) => g.reference === 'leofoto-trepied'), date: NOW });
  assert.match(salle, /Disponible dans la salle photo/);
  assert.match(salle, /href="#\/salle"/);
  const valeur = ficheHtml({ group: groups.find((g) => g.reference === 'sd-256'), date: NOW });
  assert.match(valeur, /href="#\/reserver\/item_0\d\d"[^>]*>Réserver/);
  const allOut = ficheHtml({ group: groups.find((g) => g.reference === 'canon-r10'), date: NOW });
  assert.match(allOut, /Aucun exemplaire disponible/);
  assert.doesNotMatch(allOut, /href="#\/reserver/);
});

test('ficheHtml : réservation déjà faite → lien vers Mes emprunts, pas de bouton Réserver', () => {
  const group = groupByReference(store.items.list()).find((g) => g.reference === 'sd-256');
  const html = ficheHtml({ group, date: NOW, reserved: { loan: { debutPrevu: new Date(2026, 8, 18, 9).toISOString() } } });
  assert.match(html, /Voir ma réservation/);
  assert.doesNotMatch(html, /href="#\/reserver\//);
});

test('accueilHtml : avis de retrait et d’expiration', () => {
  const base = { user: store.users.get('user_010'), enCours: [], nextBooking: null, date: NOW };
  const item = { nom: 'Canon R10' };
  const w = { end: new Date(2026, 8, 17, 11, 0) };
  const open = accueilHtml({ ...base, reservations: [{ loan: {}, item, pickupOpen: true, expired: false, window: w }] });
  assert.match(open, /à retirer avant 11h00/);
  assert.match(open, /href="#\/emprunts"/);
  const exp = accueilHtml({ ...base, expireesRecentes: [{ loan: {}, item }] });
  assert.match(exp, /réservation expirée/);
  assert.doesNotMatch(accueilHtml(base), /alert--info|alert--warning/);
});

test('accueilHtml : avis de refus avec le motif, échappé', () => {
  const base = { user: store.users.get('user_010'), enCours: [], nextBooking: null, date: NOW };
  const html = accueilHtml({ ...base, refuseesRecentes: [{ loan: { motifRefus: 'Réservé pour un <cours>' }, item: { nom: 'Canon R10' } }] });
  assert.match(html, /alert--error/);
  assert.match(html, /Canon R10 : réservation refusée — Réservé pour un &lt;cours&gt;/);
  assert.doesNotMatch(accueilHtml(base), /alert--error/);
});
