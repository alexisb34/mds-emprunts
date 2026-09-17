// js/seed.js — base de démo cohérente, construite relativement à `now`.
// Tous les noms sont fictifs (sauf la personne pédago n°1, propriétaire du prototype).
import { ROLES, PROMOS, ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_TYPES, MAINT_STATES } from './models.js';
import { DEFAULT_SETTINGS, addDays, atHour, ymd, isWeekday } from './rules.js';
import { buildChecklist, buildRoomChecklist } from './checklists.js';

export const ELEVES = [
  ["Léa", "Pezzetti"], ["Yann", "Guihard"], ["Camille", "Dubois"], ["Nathan", "Lefebvre"], ["Inès", "Moreau"],
  ["Lucas", "Fontaine"], ["Chloé", "Martin"], ["Théo", "Garnier"], ["Manon", "Roux"], ["Hugo", "Bernard"],
  ["Sarah", "Lambert"], ["Enzo", "Petit"], ["Jade", "Morel"], ["Louis", "Girard"], ["Emma", "Rousseau"],
  ["Mathis", "Leroy"], ["Zoé", "Fournier"], ["Tom", "Mercier"], ["Lina", "Blanc"], ["Adam", "Guérin"],
  ["Anaïs", "Muller"], ["Rayan", "Henry"], ["Clara", "Perrin"], ["Noah", "Faure"], ["Maëlle", "André"],
  ["Sacha", "Lemoine"], ["Romane", "Chevalier"], ["Ethan", "Robin"], ["Lucie", "Gauthier"], ["Mehdi", "Benali"],
];

export const INTERVENANTS = [
  ["Sophie", "Marchand"], ["Julien", "Caron"], ["Nadia", "Ferreira"], ["Marc", "Delorme"], ["Aurélie", "Vidal"],
  ["Karim", "Haddad"], ["Céline", "Baptiste"], ["Olivier", "Renard"], ["Isabelle", "Toussaint"], ["Frédéric", "Lacombe"],
];

export const PEDAGO = [
  ["Alexis", "Bengel"], ["Amandine", "Leclerc"], ["Bastien", "Morin"], ["Élodie", "Rey"], ["Thomas", "Picard"],
];

export const CATALOG = [
  // [reference, nom, categorie, circuit, exemplaires, valeurEstimee, localisation]
  ["multiprise", "Multiprise", "Bureautique", "self", 6, 15, "Bureau pédago"],
  ["kit-tableau", "Kit tableau blanc", "Bureautique", "self", 4, 40, "Bureau pédago"],
  ["casque-audio", "Casque audio", "Audio", "self", 5, 35, "Bureau pédago"],
  ["clavier", "Clavier", "Bureautique", "self", 4, 25, "Bureau pédago"],
  ["souris", "Souris", "Bureautique", "self", 4, 15, "Bureau pédago"],
  ["newer-eclairage", "Newer kit éclairage", "Lumière", "salle", 1, 180, "Salle photo"],
  ["newer-led", "Newer pack LED + batteries", "Lumière", "salle", 1, 120, "Salle photo"],
  ["leofoto-trepied", "Trépied et tête fluide LeoFoto", "Vidéo", "salle", 1, 350, "Salle photo"],
  ["mini-studio", "Mini studio photo produit", "Photo", "salle", 1, 90, "Salle photo"],
  ["sac-beschoi", "Sac à dos Beschoi", "Accessoire", "salle", 1, 60, "Salle photo"],
  ["canon-r10", "Canon R10 + objectif 18-55 + bague", "Photo", "valeur", 1, 1100, "Armoire sécurisée"],
  ["dji-rsc2", "DJI Ronin RSC2 stabilisateur", "Vidéo", "valeur", 1, 450, "Armoire sécurisée"],
  ["tascam-dr70", "Tascam DR-70 enregistreur", "Audio", "valeur", 1, 280, "Armoire sécurisée"],
  ["zoom-h5", "Zoom H5 enregistreur", "Audio", "valeur", 1, 300, "Armoire sécurisée"],
  ["sd-256", "Carte SD 256 Go", "Stockage", "valeur", 3, 45, "Armoire sécurisée"],
  ["sd-32", "Carte SD 32 Go", "Stockage", "valeur", 3, 15, "Armoire sécurisée"],
  ["lpe17", "Batterie Canon LP-E17", "Accessoire", "valeur", 3, 60, "Armoire sécurisée"],
  ["hoya-nd", "Filtre variable Hoya", "Photo", "valeur", 1, 80, "Armoire sécurisée"],
  ["sennheiser", "Casque Sennheiser", "Audio", "valeur", 1, 120, "Armoire sécurisée"],
  ["at-streaming", "Audio-Technica kit de streaming", "Audio", "valeur", 1, 250, "Armoire sécurisée"],
];

const iso = (d) => d.toISOString();
const pad = (n, w) => String(n).padStart(w, '0');

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Dernier jour ouvré ≤ date (à 9h)
function lastWeekday(date) {
  let d = atHour(date, 9);
  while (!isWeekday(d)) d = addDays(d, -1);
  return d;
}

// n-ième jour ouvré strictement après date (à 9h)
function nextWeekday(date, n) {
  let d = atHour(date, 9);
  let count = 0;
  while (count < n) {
    d = addDays(d, 1);
    if (isWeekday(d)) count++;
  }
  return d;
}

function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildSeed(now = new Date()) {
  const rand = makeRandom(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(rand() * 31)]).join('');

  const db = { settings: { ...DEFAULT_SETTINGS, salle: { ...DEFAULT_SETTINGS.salle }, horaires: DEFAULT_SETTINGS.horaires.map((h) => ({ ...h })) },
    users: [], items: [], loans: [], bookings: [], maintenance: [], log: [] };

  const t0 = iso(addDays(now, -90));
  const base = lastWeekday(now); // jour ouvré de référence pour « aujourd'hui »

  const addLog = (date, auteurId, action, refs, detail) => {
    db.log.push({
      id: `log_${pad(db.log.length + 1, 4)}`, date: iso(date), auteurId, action,
      itemId: null, loanId: null, bookingId: null, userId: null, ...refs, detail,
      createdAt: iso(date), updatedAt: iso(date),
    });
  };

  // ---- Utilisateurs ----
  const mkUser = (n, [prenom, nom], role, promo) => ({
    id: `user_${pad(n, 3)}`, prenom, nom, email: `${slug(prenom)}.${slug(nom)}@mds-demo.fr`,
    role, promo, actif: true, createdAt: t0, updatedAt: t0,
  });
  ELEVES.forEach((p, i) => db.users.push(mkUser(i + 1, p, ROLES.ELEVE, PROMOS[i % PROMOS.length])));
  INTERVENANTS.forEach((p, i) => db.users.push(mkUser(31 + i, p, ROLES.INTERVENANT, null)));
  PEDAGO.forEach((p, i) => db.users.push(mkUser(41 + i, p, ROLES.PEDAGO, null)));
  const pedagos = db.users.filter((u) => u.role === ROLES.PEDAGO);
  const emprunteurs = db.users.filter((u) => u.role !== ROLES.PEDAGO);
  const ped0 = pedagos[0];

  // ---- Matériel ----
  let n = 0;
  for (const [reference, nom, categorie, circuit, count, valeurEstimee, localisation] of CATALOG) {
    for (let k = 1; k <= count; k++) {
      n++;
      db.items.push({
        id: `item_${pad(n, 3)}`, code: `MDS-${pad(n, 4)}`, nom: count > 1 ? `${nom} #${k}` : nom,
        reference, categorie, circuit, etat: ITEM_STATES.DISPONIBLE, localisation,
        dateAchat: '2025-09-01', valeurEstimee, notes: '', photoUrl: '', createdAt: t0, updatedAt: t0,
      });
    }
  }
  const byRef = (ref) => db.items.filter((i) => i.reference === ref);
  const item = (ref, k = 0) => byRef(ref)[k];
  const selfRefs = CATALOG.filter((c) => c[3] === 'self').map((c) => c[0]);
  const valeurRefs = CATALOG.filter((c) => c[3] === 'valeur').map((c) => c[0]);
  const salleItems = db.items.filter((i) => i.circuit === 'salle');

  // ---- Emprunts ----
  const addLoan = (fields) => {
    const l = {
      id: `loan_${pad(db.loans.length + 1, 3)}`, motif: '', motifRefus: '', codeRetrait: null,
      photoEmprunt: null, photoRetour: null, checklistRetour: null, commentaire: '',
      remisPar: null, receptionnePar: null, dateRetrait: null, dateRetourReelle: null, ...fields,
    };
    db.loans.push(l);
    return l;
  };
  const who = (u) => `${u.prenom} ${u.nom}`;

  // 40 emprunts passés, retournés sans problème (30 self, 10 valeur) sur les 60 derniers jours
  for (let i = 0; i < 40; i++) {
    const isSelf = i % 4 !== 0;
    const ref = isSelf ? pick(selfRefs) : pick(valeurRefs);
    const it = pick(byRef(ref));
    const user = pick(emprunteurs);
    const day = lastWeekday(addDays(base, -(60 - i)));
    const start = atHour(day, 9 + Math.floor(rand() * 3), 15);
    const end = isSelf ? atHour(day, 16, 30) : atHour(addDays(day, 1 + Math.floor(rand() * 3)), 15);
    const ped = pick(pedagos);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.RETOURNEE,
      dateReservation: iso(isSelf ? start : addDays(start, -2)), debutPrevu: iso(start),
      finPrevue: iso(isSelf ? atHour(day, 17) : end), dateRetrait: iso(start), dateRetourReelle: iso(end),
      remisPar: isSelf ? null : ped.id, receptionnePar: isSelf ? null : ped.id,
      checklistRetour: buildChecklist(ref), createdAt: iso(start), updatedAt: iso(end),
    });
    addLog(start, isSelf ? user.id : ped.id, isSelf ? 'loan.emprunt' : 'loan.remise', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
    addLog(end, isSelf ? user.id : ped.id, 'loan.retour', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} rendu`);
  }

  // 6 emprunts self en cours aujourd'hui
  [["multiprise", 0], ["multiprise", 1], ["kit-tableau", 0], ["casque-audio", 0], ["clavier", 0], ["souris", 0]].forEach(([ref, k], i) => {
    const it = item(ref, k);
    const user = emprunteurs[i * 3];
    const start = atHour(base, 8 + (i % 4), 5 + i * 7);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, dateReservation: iso(start), debutPrevu: iso(start),
      finPrevue: iso(atHour(base, 17)), dateRetrait: iso(start), createdAt: iso(start), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(start, user.id, 'loan.emprunt', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
  });

  // 2 emprunts valeur en cours (dans les temps)
  [["canon-r10", -1, 2, "Tournage projet MBA"], ["zoom-h5", -2, 1, "Interview podcast"]].forEach(([ref, dStart, dEnd, motif], i) => {
    const it = item(ref);
    const user = emprunteurs[20 + i];
    const start = atHour(addDays(base, dStart), 10);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, motif, codeRetrait: code6(),
      dateReservation: iso(addDays(start, -3)), debutPrevu: iso(start), finPrevue: iso(atHour(addDays(base, dEnd), 15)),
      dateRetrait: iso(atHour(start, 10, 12)), remisPar: ped0.id, createdAt: iso(addDays(start, -3)), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(addDays(start, -3), user.id, 'loan.reservee', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
    addLog(start, ped0.id, 'loan.remise', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} remis à ${who(user)}`);
  });

  // 2 emprunts en retard : un valeur (DJI, fin il y a 3 jours), un self (casque #2, hier 17h)
  {
    const it = item('dji-rsc2');
    const user = emprunteurs[25];
    const start = atHour(addDays(base, -6), 9);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, motif: "Clip vidéo association", codeRetrait: code6(),
      dateReservation: iso(addDays(start, -4)), debutPrevu: iso(start), finPrevue: iso(atHour(addDays(base, -3), 17)),
      dateRetrait: iso(atHour(start, 9, 20)), remisPar: pedagos[1].id, createdAt: iso(addDays(start, -4)), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(start, pedagos[1].id, 'loan.remise', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} remis à ${who(user)}`);
  }
  {
    const it = item('casque-audio', 1);
    const user = emprunteurs[27];
    const day = lastWeekday(addDays(base, -1));
    const start = atHour(day, 9, 40);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, dateReservation: iso(start), debutPrevu: iso(start),
      finPrevue: iso(atHour(day, 17)), dateRetrait: iso(start), createdAt: iso(start), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(start, user.id, 'loan.emprunt', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
  }

  // 2 réservations valeur à venir
  [["tascam-dr70", 1, 2, "Captation conférence"], ["sennheiser", 2, 1, "Montage son"]].forEach(([ref, nStart, dLen, motif], i) => {
    const it = item(ref);
    const user = emprunteurs[10 + i];
    const start = atHour(nextWeekday(base, nStart), 9 + i);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.RESERVEE, motif, codeRetrait: code6(),
      dateReservation: iso(atHour(base, 9, 30 + i)), debutPrevu: iso(start), finPrevue: iso(atHour(addDays(start, dLen), 17)),
      createdAt: iso(atHour(base, 9, 30 + i)), updatedAt: iso(atHour(base, 9, 30 + i)),
    });
    it.etat = ITEM_STATES.RESERVE;
    addLog(atHour(base, 9, 30 + i), user.id, 'loan.reservee', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
  });

  // ---- Maintenance ----
  const addMaint = (fields) => {
    const m = { id: `maint_${pad(db.maintenance.length + 1, 3)}`, prestataire: '', cout: 0, loanId: null, bookingId: null, ...fields };
    db.maintenance.push(m);
    return m;
  };

  // Souris #3 : rendue avec un problème il y a 2 jours → maintenance + signalement ouvert
  {
    const it = item('souris', 2);
    const user = emprunteurs[5];
    const day = lastWeekday(addDays(base, -2));
    const start = atHour(day, 10, 10);
    const end = atHour(day, 15, 45);
    const checklist = buildChecklist('souris');
    checklist[0].ok = false;
    checklist[0].commentaire = "Clic gauche ne répond plus";
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.RETOURNEE, dateReservation: iso(start), debutPrevu: iso(start),
      finPrevue: iso(atHour(day, 17)), dateRetrait: iso(start), dateRetourReelle: iso(end), checklistRetour: checklist,
      createdAt: iso(start), updatedAt: iso(end),
    });
    it.etat = ITEM_STATES.MAINTENANCE;
    const m = addMaint({
      itemId: it.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: user.id, date: iso(end), statut: MAINT_STATES.OUVERT,
      description: "Signalé au retour : Clic et molette OK → Clic gauche ne répond plus", loanId: l.id, createdAt: iso(end), updatedAt: iso(end),
    });
    addLog(start, user.id, 'loan.emprunt', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
    addLog(end, user.id, 'loan.retour', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} rendu avec un problème`);
    addLog(end, user.id, 'maintenance.signalement', { itemId: it.id, loanId: l.id }, m.description);
  }

  // Clavier #3 : hors service depuis 20 jours
  {
    const it = item('clavier', 2);
    const d = atHour(addDays(base, -20), 11);
    it.etat = ITEM_STATES.HS;
    it.notes = 'Hors service : touches arrachées, non réparable.';
    const m = addMaint({
      itemId: it.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: ped0.id, date: iso(d), statut: MAINT_STATES.CLOS,
      description: "Touches arrachées, non réparable — passé hors service.", createdAt: iso(d), updatedAt: iso(d),
    });
    addLog(d, ped0.id, 'item.etat', { itemId: it.id }, `${it.nom} passé hors service`);
    addLog(d, ped0.id, 'maintenance.clos', { itemId: it.id }, m.description);
  }

  // Canon R10 : intervention externe close il y a 30 jours
  {
    const it = item('canon-r10');
    const d = atHour(addDays(base, -30), 14);
    const m = addMaint({
      itemId: it.id, type: MAINT_TYPES.EXTERNE, auteurId: ped0.id, date: iso(d), statut: MAINT_STATES.CLOS,
      prestataire: 'Optic Services', cout: 90, description: 'Nettoyage capteur et révision annuelle.',
      createdAt: iso(addDays(d, -5)), updatedAt: iso(d),
    });
    addLog(addDays(d, -5), ped0.id, 'maintenance.intervention', { itemId: it.id }, `${m.prestataire} — ${m.description}`);
    addLog(d, ped0.id, 'maintenance.clos', { itemId: it.id }, 'Intervention close, matériel remis en service');
  }

  // ---- Salle photo ----
  const addBooking = (fields) => {
    const b = { id: `book_${pad(db.bookings.length + 1, 3)}`, etatEntree: null, etatSortie: null, ...fields };
    db.bookings.push(b);
    return b;
  };
  const etat = (date) => ({ date: iso(date), lignes: buildRoomChecklist(salleItems) });

  // 2 réservations passées terminées
  [[-7, [9, 10, 11], 12], [-3, [14, 15], 16]].forEach(([dOff, creneaux, uIdx]) => {
    const day = lastWeekday(addDays(base, dOff));
    const user = emprunteurs[uIdx];
    const start = atHour(day, creneaux[0]);
    const end = atHour(day, creneaux[creneaux.length - 1] + 1);
    const b = addBooking({
      userId: user.id, date: ymd(day), creneaux, statut: BOOKING_STATES.TERMINEE,
      etatEntree: etat(atHour(day, creneaux[0], 3)), etatSortie: etat(atHour(day, creneaux[creneaux.length - 1], 55)),
      createdAt: iso(addDays(start, -2)), updatedAt: iso(end),
    });
    addLog(addDays(start, -2), user.id, 'booking.creee', { bookingId: b.id, userId: user.id }, `Salle photo ${creneaux[0]}h-${creneaux[creneaux.length - 1] + 1}h — ${who(user)}`);
    addLog(atHour(day, creneaux[0], 3), user.id, 'booking.entree', { bookingId: b.id, userId: user.id }, "État des lieux d'entrée OK");
    addLog(atHour(day, creneaux[creneaux.length - 1], 55), user.id, 'booking.sortie', { bookingId: b.id, userId: user.id }, "État des lieux de sortie OK");
  });

  // 1 réservation en cours maintenant (si jour ouvré et dans la plage)
  if (isWeekday(now) && now.getHours() >= db.settings.salle.heureDebut && now.getHours() < db.settings.salle.heureFin) {
    const h = now.getHours();
    const creneaux = h > db.settings.salle.heureDebut ? [h - 1, h] : [h];
    const user = emprunteurs[3];
    const start = atHour(now, creneaux[0]);
    const b = addBooking({
      userId: user.id, date: ymd(now), creneaux, statut: BOOKING_STATES.EN_COURS,
      etatEntree: etat(atHour(now, creneaux[0], 2)), createdAt: iso(addDays(start, -1)), updatedAt: iso(start),
    });
    addLog(addDays(start, -1), user.id, 'booking.creee', { bookingId: b.id, userId: user.id }, `Salle photo ${creneaux[0]}h-${creneaux[creneaux.length - 1] + 1}h — ${who(user)}`);
    addLog(atHour(now, creneaux[0], 2), user.id, 'booking.entree', { bookingId: b.id, userId: user.id }, "État des lieux d'entrée OK");
  }

  // 3 réservations à venir
  [[1, [8, 9, 10, 11, 12], 7], [2, [14, 15], 18], [3, [9, 10], 32]].forEach(([nOff, creneaux, uIdx]) => {
    const day = nextWeekday(base, nOff);
    const user = emprunteurs[uIdx];
    const created = atHour(base, 8, 30);
    const b = addBooking({
      userId: user.id, date: ymd(day), creneaux, statut: BOOKING_STATES.A_VENIR, createdAt: iso(created), updatedAt: iso(created),
    });
    addLog(created, user.id, 'booking.creee', { bookingId: b.id, userId: user.id }, `Salle photo ${creneaux[0]}h-${creneaux[creneaux.length - 1] + 1}h — ${who(user)}`);
  });

  db.log.sort((a, b) => a.date.localeCompare(b.date));
  return db;
}
