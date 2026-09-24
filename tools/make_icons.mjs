// Generates the PNG icons (a white "W" path on green) with zero dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'icons');
mkdirSync(OUT, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function png(size, { scale = 1, rounded = true }) {
  const bg = [31, 122, 90];
  const fg = [255, 255, 255];
  const pts = [[0.2, 0.3], [0.35, 0.7], [0.5, 0.42], [0.65, 0.7], [0.8, 0.3]].map(([x, y]) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale]);
  const stroke = 0.075 * scale;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
      let d = Infinity;
      for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(nx, ny, ...pts[i], ...pts[i + 1]));
      const cover = Math.max(0, Math.min(1, (stroke - d) * size + 0.5));
      let alpha = 255;
      if (rounded) {
        const r = 0.22;
        const cx = Math.min(Math.max(nx, r), 1 - r), cy = Math.min(Math.max(ny, r), 1 - r);
        alpha = Math.round(255 * Math.max(0, Math.min(1, (r - Math.hypot(nx - cx, ny - cy)) * size + 0.5)));
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(bg[c] * (1 - cover) + fg[c] * cover);
      raw[o + 3] = alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync(join(OUT, 'icon-192.png'), png(192, {}));
writeFileSync(join(OUT, 'icon-512.png'), png(512, {}));
writeFileSync(join(OUT, 'icon-maskable-512.png'), png(512, { scale: 0.72, rounded: false }));
console.log('Icons written to', OUT);
