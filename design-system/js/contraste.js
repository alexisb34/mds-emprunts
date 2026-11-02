// Mesure de contraste selon WCAG 2.1 : ratio entre deux couleurs et verdict
// pour une taille de texte donnée. Module pur, sans DOM.

// Seuils de « grand texte » de WCAG, convertis en pixels CSS :
// 18 pt = 24 px, et 14 pt gras = 18,66 px.
export const GRAND_TEXTE = { px: 24, pxGras: 18.66 };

// Accepte « #rgb » ou « #rrggbb », insensible à la casse.
function canaux(hex) {
  const brut = String(hex).trim().toLowerCase();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(brut);
  if (!m) throw new Error(`Couleur invalide : ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Luminance relative WCAG 2.1, entre 0 (noir) et 1 (blanc).
function luminance(hex) {
  const [r, g, b] = canaux(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Ratio de contraste en pleine précision, entre 1 et 21.
export function ratioExact(hexA, hexB) {
  const la = luminance(hexA);
  const lb = luminance(hexB);
  const [clair, sombre] = la > lb ? [la, lb] : [lb, la];
  return (clair + 0.05) / (sombre + 0.05);
}

// Ratio arrondi à 2 décimales, pour l'affichage seulement.
export function ratio(hexA, hexB) {
  return Math.round(ratioExact(hexA, hexB) * 100) / 100;
}

// Verdict WCAG pour un ratio non arrondi, une taille (px) et un gras :
// 'AA' (texte normal, ratio >= 4,5), 'AA-large' (grand texte, ratio >= 3)
// ou 'echec'. Les bornes sont inclusives.
export function verdict(ratioMesure, px, gras) {
  if (ratioMesure >= 4.5) return 'AA';
  const grand = px >= GRAND_TEXTE.px || (gras && px >= GRAND_TEXTE.pxGras);
  if (grand && ratioMesure >= 3) return 'AA-large';
  return 'echec';
}
