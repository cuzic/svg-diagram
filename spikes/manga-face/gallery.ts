// node spikes/manga-face/gallery.ts [outdir] — gallery.svg (8 expressions x 2 hair styles x 2 skin tones) and extras.svg.
import fs from 'node:fs';
import path from 'node:path';
import {prefixIds} from '../../lib/icon-store.ts';
import {ADR0074, BOX, CHARACTERS, faceFragment, type Character} from './face.ts';

const SKINS = {light: 'light', brown: 'brown'};
const base = (hair: 'short' | 'bob', skin: string): Character => {
  const src = hair === 'short' ? CHARACTERS.a : CHARACTERS.b;
  return {...structuredClone(src), mirror: false, palette: {...src.palette, skin}} as Character;
};
const rows = (['short', 'bob'] as const).flatMap(h => Object.entries(SKINS).map(([name, skin]) => ({label: `${h} / ${name}`, ch: base(h, skin)})));

export function sheet(expressions: readonly string[], rowDefs = rows, cw = 132): string {
  const ch = cw * BOX[3] / BOX[2], lw = 110, top = 34;
  const W = lw + cw * expressions.length + 8, H = top + rowDefs.length * ch + 8;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" font-size="13"><rect width="${W}" height="${H}" fill="#ffffff"/>`;
  expressions.forEach((e, i) => { out += `<text x="${lw + cw * i + cw / 2}" y="22" text-anchor="middle" fill="#2b2530">${e}</text>`; });
  rowDefs.forEach((r, ri) => {
    out += `<text x="8" y="${top + ri * ch + ch / 2}" fill="#2b2530">${r.label}</text>`;
    expressions.forEach((e, i) => {
      const x = lw + cw * i, y = top + ri * ch;
      out += `<rect x="${x + 2}" y="${y}" width="${cw - 4}" height="${ch - 4}" fill="#fbf6ee" stroke="#d8d0c4"/>`
        + `<svg x="${x + 2}" y="${y}" width="${cw - 4}" height="${ch - 4}" viewBox="${BOX.join(' ')}" overflow="hidden">${prefixIds(faceFragment(r.ch, e).fragment, `g${ri}${i}-`)}</svg>`;
    });
  });
  return `${out}</svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? path.join(import.meta.dirname, 'out');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'gallery.svg'), sheet(ADR0074));
  fs.writeFileSync(path.join(dir, 'extras.svg'), sheet(['shy', 'smug', 'deadpan', 'clench', 'cry', 'blank'], rows.slice(0, 2)));
}
