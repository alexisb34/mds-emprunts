// scripts/make-icons.mjs — génère les icônes PNG de la PWA sans dépendance.
// `node scripts/make-icons.mjs` réécrit assets/icon-192.png et assets/icon-512.png.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const VIOLET = [0x66, 0x24, 0x83];
const BLANC = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (const octet of buf) {
    c ^= octet;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([len, corps, crc]);
}

function png(size, pixel) {
  const lignes = [];
  for (let y = 0; y < size; y += 1) {
    const ligne = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x, y, size);
      ligne[1 + x * 3] = r;
      ligne[2 + x * 3] = g;
      ligne[3 + x * 3] = b;
    }
    lignes.push(ligne);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 2;   // couleur vraie RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(lignes), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Un motif de repère de QR code sur fond violet : lisible à 48 px, et il dit « scanner ».
function motif(x, y, size) {
  const u = size / 16;           // grille de 16 unités
  const gx = Math.floor(x / u);
  const gy = Math.floor(y / u);
  const dansCarre = (x0, y0, c) => gx >= x0 && gx < x0 + c && gy >= y0 && gy < y0 + c;
  const anneau = (x0, y0) => dansCarre(x0, y0, 7) && !(dansCarre(x0 + 1, y0 + 1, 5) && !dansCarre(x0 + 2, y0 + 2, 3));
  if (anneau(1, 1) || anneau(8, 8)) return BLANC;
  return VIOLET;
}

mkdirSync('assets', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`assets/icon-${size}.png`, png(size, motif));
  console.log(`assets/icon-${size}.png écrit (${size}×${size})`);
}
