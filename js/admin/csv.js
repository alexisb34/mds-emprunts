// js/admin/csv.js — CSV minimal, sans dépendance : ce qu’on écrit est ce qu’on sait relire.
// Séparateur point-virgule à l’écriture, car c’est celui qu’Excel attend en français.

const quote = (v) => {
  const s = v == null ? '' : String(v);
  return /[";,\t\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows, sep = ';') {
  const line = (values) => values.map(quote).join(sep);
  return [line(headers), ...rows.map((r) => line(headers.map((h) => r[h])))].join('\r\n');
}

// shortcut : séparateur deviné sur la première ligne, donc un champ entre guillemets qui
// contient des points-virgules peut tromper la détection. À revoir si un export tiers arrive.
function detectSep(firstLine) {
  return [';', ',', '\t'].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best), ';');
}

function parseRows(text) {
  const sep = detectSep(text.split(/\r?\n/)[0] || '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
      continue;
    }
    if (c === '"' && field === '') { quoted = true; continue; }
    if (c === sep) { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Rend un objet par ligne, clés = en-têtes en minuscules. Les lignes vides sont ignorées.
export function parseCsv(text) {
  const rows = parseRows(String(text).replace(/^﻿/, ''));
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}
