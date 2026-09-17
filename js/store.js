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

function emptyDb() {
  const d = { settings: {} };
  for (const c of COLLECTIONS) d[c] = [];
  return d;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  db = raw ? JSON.parse(raw) : null;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function notify() {
  for (const fn of listeners) fn();
}

function commit() {
  persist();
  notify();
}

function collection(name) {
  return {
    list(filter) {
      const rows = db[name];
      return filter ? rows.filter(filter) : [...rows];
    },
    get(id) {
      return db[name].find((r) => r.id === id) || null;
    },
    create(data) {
      const ts = new Date().toISOString();
      const { id = genId(ID_PREFIX[name]), ...rest } = data;
      const record = { id, ...rest, createdAt: rest.createdAt || ts, updatedAt: ts };
      db[name].push(record);
      commit();
      return record;
    },
    update(id, patch) {
      const idx = db[name].findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`${name} : enregistrement introuvable (${id})`);
      const record = { ...db[name][idx], ...patch, updatedAt: new Date().toISOString() };
      db[name][idx] = record;
      commit();
      return record;
    },
    remove(id) {
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
      db = seedFn ? seedFn() : emptyDb();
      persist();
    }
    return db;
  },
  reset(seedFn) {
    db = seedFn ? seedFn() : emptyDb();
    commit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  settings: {
    get() { return { ...db.settings }; },
    update(patch) {
      db.settings = { ...db.settings, ...patch };
      commit();
      return { ...db.settings };
    },
  },
  usage() {
    const bytes = (localStorage.getItem(STORAGE_KEY) || '').length * 2; // UTF-16
    return { bytes, budget: BUDGET_BYTES, percent: Math.min(100, Math.round((bytes / BUDGET_BYTES) * 100)) };
  },
};

for (const c of COLLECTIONS) store[c] = collection(c);

// Synchronisation entre onglets/fenêtres du même navigateur : l'événement `storage`
// est émis dans les AUTRES onglets quand localStorage change.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      load();
      notify();
    }
  });
}
