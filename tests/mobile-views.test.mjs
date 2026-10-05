import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userLoans } from '../js/actions/loans.js';
import { groupByReference } from '../js/mobile/catalog.js';
import { accueilHtml, salleCardBooking } from '../js/mobile/views/accueil.js';
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

test('salleCardBooking : un créneau passé resté ouvert ne masque pas la réservation à venir', () => {
  const lapsed = { id: 'book_hier', userId: 'user_010', date: '2026-09-16', creneaux: [11], statut: 'en_cours', etatEntree: { lignes: [] }, etatSortie: null };
  const futur = { id: 'book_demain', userId: 'user_010', date: '2026-09-18', creneaux: [9], statut: 'a_venir', etatEntree: null, etatSortie: null };
  const salle = { active: { booking: lapsed, entreeFaite: true, sortieFaite: false }, aVenir: [futur], passees: [] };
  assert.equal(salleCardBooking(salle, NOW).id, 'book_demain', 'le créneau à venir est celui de la carte');
  const html = accueilHtml({ user: store.users.get('user_010'), enCours: [], nextBooking: salleCardBooking(salle, NOW), date: NOW, salle });
  assert.match(html, /Demain · 9h-10h/);
  assert.doesNotMatch(html, /<strong>Hier/, 'le créneau passé ne prend pas la ligne de la carte');
  // Le bouton porte sur le créneau d’hier, pas sur la ligne affichée : il le nomme.
  assert.match(html, /Faire l’état des lieux de sortie — Hier 11h-12h/, 'la sortie manquante reste proposée et nomme son créneau');
  // Sans réservation à venir, le créneau passé n’est pas affiché comme une carte.
  assert.equal(salleCardBooking({ ...salle, aVenir: [] }, NOW), null);
  // Un créneau réellement en cours garde la carte.
  const enCours = { ...lapsed, id: 'book_now', date: '2026-09-17', creneaux: [9, 10] };
  assert.equal(salleCardBooking({ ...salle, active: { booking: enCours, entreeFaite: true, sortieFaite: false } }, NOW).id, 'book_now');
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
  const sansProchaine = accueilHtml({ ...base, nextBooking: null, salle: { active: { booking, entreeFaite: false, sortieFaite: false }, aVenir: [], passees: [] } });
  assert.match(sansProchaine, /Faire l’état des lieux d’entrée/);
  assert.doesNotMatch(sansProchaine, /Aucune réservation de la salle photo/, 'pas de message vide au-dessus du bouton');
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

test('ficheHtml : l’aide du self-service cite les horaires réglés', () => {
  const group = groupByReference(store.items.list()).find((g) => g.reference === 'multiprise');
  const regle = ficheHtml({ group, date: NOW, settings: { horaires: [{ debut: 9, fin: 11 }, { debut: 14, fin: 18 }] } });
  assert.match(regle, /9h-11h et 14h-18h/);
  assert.doesNotMatch(regle, /8h-12h/);
  assert.match(ficheHtml({ group, date: NOW }), /8h-12h et 13h-17h/, 'sans réglages : horaires par défaut');
});

test('ficheHtml : l’heure de retour du self-service vient aussi des réglages', () => {
  const group = groupByReference(store.items.list()).find((g) => g.circuit === 'self');
  const parDefaut = ficheHtml({ group, date: NOW });
  assert.match(parDefaut, /avant 17h/);
  const regle = ficheHtml({ group, date: NOW, settings: { heureRetourSelf: 16, horaires: [{ debut: 9, fin: 12 }] } });
  assert.match(regle, /avant 16h/);
  assert.match(regle, /9h-12h/);
  assert.doesNotMatch(regle, /avant 17h/);
});

test('ficheHtml : sans heure de retour enregistrée, l’aide cite la fermeture réglée', () => {
  const group = groupByReference(store.items.list()).find((g) => g.circuit === 'self');
  const html = ficheHtml({ group, date: NOW, settings: { horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 16 }] } });
  assert.match(html, /8h-12h et 13h-16h\)\. Retour le jour même avant 16h\./);
  assert.doesNotMatch(html, /avant 17h/);
});
