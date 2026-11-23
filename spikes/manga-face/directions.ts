// node spikes/manga-face/directions.ts [outdir] — two directions of the look (ADR 0079 Q2). The stage-scale strips come first: true size (head r = 36 px, 1 px per px),
// then the same at 2x; below them, three expressions at full size.
import fs from 'node:fs';
import path from 'node:path';
import {prefixIds} from '../../lib/icon-store.ts';
import {ADR0074, BOX, CHARACTERS, SCALE, faceFragment, type Character} from './face.ts';

const bobOf = (c: Character, id: string): Character => ({...structuredClone(c), id, mirror: false, hair: {...c.hair, template: 'bob', parting: -0.5}, palette: {...c.palette, hair: 'black', skin: 'medium', top: 'red', iris: 'brown'}});
const rows: {label: string; sub: string; ch: Character}[] = [
  {label: 'young', sub: 'round eyes, wide face', ch: {...structuredClone(CHARACTERS.a), id: 'y1'}},
  {label: 'mature', sub: 'narrow face, square chin,', ch: {...structuredClone(CHARACTERS.m), id: 'm1'}},
  {label: 'young (bob)', sub: '', ch: bobOf(CHARACTERS.a, 'y2')},
  {label: 'mature (bob)', sub: 'small eyes, thin lid, no lashes', ch: bobOf(CHARACTERS.m, 'm2')},
];
export function directions(): string {
  const lw = 130, cols = ADR0074.length;
  const sw1 = BOX[2] * SCALE, sh1 = BOX[3] * SCALE, sw2 = sw1 * 2, sh2 = sh1 * 2, fw = BOX[2] * 0.62, fh = BOX[3] * 0.62;
  const W = Math.ceil(lw + cols * sw2 + 10);
  let y = 0;
  let out = '';
  const cell = (r: typeof rows[number], e: string, x: number, yy: number, w: number, h: number, tag: string): string => `<svg x="${x}" y="${yy}" width="${w}" height="${h}" viewBox="${BOX.join(' ')}">${prefixIds(faceFragment(r.ch, e).fragment, `${tag}-`)}</svg>`;
  const head = (t: string): string => { const s = `<text x="8" y="${y + 18}" font-weight="bold" fill="#22201b">${t}</text>`; y += 28; return s; };
  out += head(`1. Stage scale, true size (head r = 36 px; the size the comic uses): ${ADR0074.join(' / ')}`);
  rows.forEach((r, ri) => { out += `<text x="8" y="${y + sh1 / 2}" fill="#22201b">${r.label}</text>` + ADR0074.map((e, i) => cell(r, e, lw + i * sw1, y, sw1, sh1, `a${ri}${i}`)).join(''); y += sh1 + 2; });
  y += 14;
  out += head('2. The same at 2x');
  rows.forEach((r, ri) => { out += `<text x="8" y="${y + sh2 / 2}" fill="#22201b">${r.label}</text><text x="8" y="${y + sh2 / 2 + 16}" font-size="11" fill="#666">${r.sub}</text>` + ADR0074.map((e, i) => cell(r, e, lw + i * sw2, y, sw2, sh2, `b${ri}${i}`)).join(''); y += sh2 + 4; });
  y += 14;
  out += head('3. Full size: neutral / smile / angry');
  const full = ['neutral', 'smile', 'angry'];
  rows.forEach((r, ri) => { out += `<text x="8" y="${y + fh / 2}" fill="#22201b">${r.label}</text>` + full.map((e, i) => cell(r, e, lw + i * fw, y, fw, fh, `c${ri}${i}`)).join(''); y += fh + 4; });
  const H = Math.ceil(y + 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" font-size="13"><rect width="100%" height="100%" fill="#ffffff"/>${out}</svg>`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? path.join(import.meta.dirname, 'out');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'directions.svg'), directions());
}
