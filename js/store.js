// js/store.js — SEULE couche qui lit/écrit localStorage.
// En phase 2, ce fichier sera remplacé par une implémentation Supabase aux mêmes signatures.

export const STORAGE_KEY = 'mds-emprunts:v1';
export const COLLECTIONS = ['users', 'items', 'loans', 'bookings', 'maintenance', 'log'];

const ID_PREFIX = { users: 'user', items: 'item', loans: 'loan', bookings: 'book', maintenance: 'maint', log: 'log' };
const BUDGET_BYTES = 5 * 1024 * 1024;

const listeners = new Set();
let db = null;

export function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Gèle récursivement un enregistrement : les vues/actions lisent des objets `get`/`list`
// mais ne doivent jamais les muter directement (seul `update()` doit passer par le store).
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

function freezeDb(d) {
  for (const c of COLLECTIONS) for (const row of d[c]) deepFreeze(row);
  deepFreeze(d.settings);
  return d;
}

function assertInit() {
  if (!db) throw new Error('store : appeler store.init() avant toute opération');
}

function emptyDb() {
  const d = { settings: {} };
  for (const c of COLLECTIONS) d[c] = [];
  return d;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  db = raw ? JSON.parse(raw) : null;
  if (db) freezeDb(db);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function notify() {
  for (const fn of listeners) fn();
}

let depth = 0;      // profondeur de transaction
let pending = false; // des écritures attendent d’être persistées

function commit() {
  if (depth > 0) { pending = true; return; }
  persist();
  notify();
}

function collection(name) {
  return {
    list(filter) {
      assertInit();
      const rows = db[name];
      return filter ? rows.filter(filter) : [...rows];
    },
    get(id) {
      assertInit();
      return db[name].find((r) => r.id === id) || null;
    },
    create(data) {
      assertInit();
      const ts = new Date().toISOString();
      const { id = genId(ID_PREFIX[name]), ...rest } = data;
      const record = deepFreeze({ id, ...rest, createdAt: rest.createdAt || ts, updatedAt: ts });
      db[name].push(record);
      commit();
      return record;
    },
    update(id, patch) {
      assertInit();
      const idx = db[name].findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`${name} : enregistrement introuvable (${id})`);
      const record = deepFreeze({ ...db[name][idx], ...patch, updatedAt: new Date().toISOString() });
      db[name][idx] = record;
      commit();
      return record;
    },
    remove(id) {
      assertInit();
      const before = db[name].length;
      db[name] = db[name].filter((r) => r.id !== id);
      if (db[name].length === before) throw new Error(`${name} : enregistrement introuvable (${id})`);
      commit();
    },
  };
}

export const store = {
  init(seedFn) {
    load();
    if (!db) {
      // Le seed (js/seed.js) mute encore ses propres objets pendant leur construction :
      // on ne gèle qu’une fois seedFn() revenu, jamais avant.
      db = freezeDb(seedFn ? seedFn() : emptyDb());
      persist();
    }
    return db;
  },
  reset(seedFn) {
    db = freezeDb(seedFn ? seedFn() : emptyDb());
    commit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  settings: {
    get() { assertInit(); return db.settings; },
    update(patch) {
      assertInit();
      db.settings = deepFreeze({ ...db.settings, ...patch });
      commit();
      return db.settings;
    },
  },
  usage() {
    const bytes = (localStorage.getItem(STORAGE_KEY) || '').length * 2; // UTF-16
    return { bytes, budget: BUDGET_BYTES, percent: Math.min(100, Math.round((bytes / BUDGET_BYTES) * 100)) };
  },
  // Regroupe plusieurs écritures : une seule persistance et une seule notification à la fin.
  // Si `fn` lève, l’état d’avant est restauré et personne n’est notifié.
  // Imbrication : seule la transaction la plus externe restaure. Une transaction imbriquée
  // qui lève remonte l’erreur ; si l’externe la rattrape et continue, les écritures de
  // l’imbriquée sont conservées. Les actions de ce projet n’imbriquent pas.
  transaction(fn) {
    assertInit();
    const snapshot = localStorage.getItem(STORAGE_KEY);
    depth += 1;
    let out;
    try {
      out = fn();
    } catch (err) {
      depth -= 1;
      if (depth === 0) {
        pending = false;
        if (snapshot === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, snapshot);
        load();
      }
      throw err;
    }
    depth -= 1;
    // Hors du try : si persist() lève (stockage plein), l’erreur remonte telle quelle
    // sans fausser la profondeur ni rejouer la restauration.
    if (depth === 0 && pending) { pending = false; persist(); notify(); }
    return out;
  },
};

for (const c of COLLECTIONS) store[c] = collection(c);

// Synchronisation entre onglets/fenêtres du même navigateur : l’événement `storage`
// est émis dans les AUTRES onglets quand localStorage change.
// `e.key === null` signifie un `clear()` fait depuis un autre onglet : on l’ignore
// volontairement (cet onglet garde son état en mémoire ; un `reset()` explicite le
// rechargerait). On ne réagit qu’à une écriture ciblée sur notre clé.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      load();
      notify();
    }
  });
}
