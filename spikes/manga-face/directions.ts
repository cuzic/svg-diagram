// node spikes/manga-face/directions.ts [outdir] — two directions of the look (ADR 0079 Q2) at full size and at stage scale (head r = 36 px, DPR 1).
import fs from 'node:fs';
import path from 'node:path';
import {prefixIds} from '../../lib/icon-store.ts';
import {ADR0074, BOX, CHARACTERS, DIRECTIONS, SCALE, faceFragment, type Character} from './face.ts';

const mk = (dir: keyof typeof DIRECTIONS, base: 'a' | 'b'): Character => ({...structuredClone(CHARACTERS[base]), ...structuredClone(DIRECTIONS[dir]), mirror: false} as Character);
const withStrands = (c: Character, n: number): Character => ({...c, hair: {...c.hair, strands: n}});
const rowsDef = [
  {label: 'young', sub: 'round eyes, wide face', ch: mk('young', 'a')},
  {label: 'mature', sub: 'longer face, small eyes', ch: withStrands(mk('mature', 'a'), 7)},
  {label: 'young (bob)', sub: '', ch: {...mk('young', 'b'), id: 'y2'}},
  {label: 'mature (bob)', sub: '', ch: withStrands({...mk('mature', 'b'), id: 'm2'}, 7)},
];
/** Full size on the left (3 expressions), stage scale (8 expressions, r = 36 px, 1 px per 1 px) on the right. */
export function directions(): string {
  const full = ['neutral', 'smile', 'angry'], big = 0.62, bw = BOX[2] * big, bh = BOX[3] * big;
  const sw = BOX[2] * SCALE, sh = BOX[3] * SCALE;
  const lw = 120, rowH = bh + 8, W = lw + full.length * bw + 30 + ADR0074.length * sw + 10, H = 36 + rowsDef.length * rowH + 8;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(H)}" width="${Math.ceil(W)}" height="${Math.ceil(H)}" font-family="sans-serif" font-size="13"><rect width="100%" height="100%" fill="#ffffff"/>`;
  full.forEach((e, i) => { out += `<text x="${lw + i * bw + bw / 2}" y="22" text-anchor="middle" fill="#22201b">${e}</text>`; });
  const sx0 = lw + full.length * bw + 30;
  out += `<text x="${sx0}" y="22" fill="#22201b">stage scale (head r = 36 px): ${ADR0074.join(' / ')}</text>`;
  rowsDef.forEach((r, ri) => {
    const y = 36 + ri * rowH;
    out += `<text x="8" y="${y + bh / 2}" fill="#22201b">${r.label}</text><text x="8" y="${y + bh / 2 + 16}" font-size="11" fill="#666">${r.sub}</text>`;
    full.forEach((e, i) => { out += `<svg x="${lw + i * bw}" y="${y}" width="${bw}" height="${bh}" viewBox="${BOX.join(' ')}">${prefixIds(faceFragment(r.ch, e).fragment, `d${ri}f${i}-`)}</svg>`; });
    ADR0074.forEach((e, i) => { out += `<svg x="${sx0 + i * sw}" y="${y}" width="${sw}" height="${sh}" viewBox="${BOX.join(' ')}">${prefixIds(faceFragment(r.ch, e).fragment, `d${ri}s${i}-`)}</svg>`; });
  });
  return `${out}</svg>`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? path.join(import.meta.dirname, 'out');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'directions.svg'), directions());
}
