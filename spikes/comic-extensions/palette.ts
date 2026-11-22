// ADR 0076 spike (round 2): is a small avatar palette readable? Fill-vs-fill contrast cannot be guaranteed by 6 x 6 x 9 colours,
// and an ink outline alone is not enough on dark fills. So every boundary between two fills is drawn as a stack:
//   paper keyline (1.5px) | ink line (2.5px) | paper keyline (1.5px)
// and the edge is visible whatever the fills are, because the ink line always sits next to paper. This file measures that, and the
// cases where a plain ink outline would not be enough.
import fs from 'node:fs';
import {contrast} from '../comic-worksheet/proto.ts';

export const INK = '#222222', PAPER = '#fffdf6';
export const SKIN = {fair: '#ffe3c8', light: '#f6d0a8', medium: '#e2ab7c', tan: '#c98c5c', brown: '#9c6341', dark: '#6e4430'} as const;
export const HAIR = {black: '#1f1f24', brown: '#4a3322', chestnut: '#7d4a2b', blond: '#d2a640', gray: '#9097a3', navy: '#2d3f66'} as const;
export const TOP = {navy: '#3b5b92', blue: '#5b8ed6', teal: '#2f8f8a', green: '#5a9a52', yellow: '#e0b43a', orange: '#e0833a', red: '#c8473f', purple: '#7a58b0', gray: '#7b8290'} as const;
export const KEYLINE = 1.5, LINE = 2.5;
const c2 = (a: string, b: string) => +contrast(a, b).toFixed(2);
/** What the eye can use at a boundary: the best contrast between the line stack and what touches it. With the keyline stack it is ink against paper. */
export const edgeWithKeyline = c2(INK, PAPER);
/** Without the keyline: the ink line against the worse of the two fills. */
export const edgeInkOnly = (a: string, b: string) => Math.min(c2(INK, a), c2(INK, b));

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = {skin: SKIN, hair: HAIR, top: TOP} as Record<string, Record<string, string>>;
  console.log('fill vs ink, lowest per set:', Object.entries(all).map(([n, p]) => { const r = Object.entries(p).map(([k, v]) => [k, c2(v, INK)] as const).sort((x, y) => x[1] - y[1]); return `${n}: ${r.slice(0, 3).map(([k, v]) => `${k}=${v}`).join(' ')}`; }).join(' | '));
  const adj = (name: string, A: Record<string, string>, B: Record<string, string>) => {
    const pairs = Object.entries(A).flatMap(([a, av]) => Object.entries(B).map(([b, bv]) => ({a, b, fill: c2(av, bv), inkOnly: edgeInkOnly(av, bv)})));
    return `${name}: ${pairs.length} pairs; fill vs fill under 3:1 = ${pairs.filter(p => p.fill < 3).length}; ink-only edge under 3:1 = ${pairs.filter(p => p.inkOnly < 3).length}; nearly the same fill (under 1.2:1) = ${pairs.filter(p => p.fill < 1.2).length} [${pairs.filter(p => p.fill < 1.2).map(p => `${p.a}/${p.b}=${p.fill}`).join(' ')}]; with the keyline stack: every pair ${edgeWithKeyline}:1`;
  };
  console.log(adj('hair | skin', HAIR, SKIN)); console.log(adj('top | skin (neck, hands)', TOP, SKIN)); console.log(adj('top | hair (long hair on the shoulder)', TOP, HAIR));
  console.log('glasses (frame only, no lens fill): frame = ink line with keyline, against any skin:', edgeWithKeyline + ':1; ink alone on skin.dark:', c2(INK, SKIN.dark));
  console.log('stroke colours of the marks against paper:', Object.entries({anger: '#c0392b', sigh: '#5a6072', zzz: '#5a6072', gloom: '#4a5a7a', ink: INK}).map(([k, v]) => `${k}=${c2(v, PAPER)}`).join(' '));
  const out = process.argv[2];
  if (out) { // the three worst pairs, with and without the keyline
    const worst: [string, string][] = [[HAIR.black, SKIN.dark], [HAIR.blond, SKIN.medium], [HAIR.gray, SKIN.tan]];
    const cell = (i: number, plain: boolean, h: string, s: string) => { const x = 20 + i * 130, y = plain ? 20 : 140; const edge = plain ? `<path d="M${x} ${y + 40}h100" stroke="${INK}" stroke-width="${LINE}"/>` : `<path d="M${x} ${y + 40}h100" stroke="${PAPER}" stroke-width="${LINE + 2 * KEYLINE}"/><path d="M${x} ${y + 40}h100" stroke="${INK}" stroke-width="${LINE}"/>`; return `<rect x="${x}" y="${y}" width="100" height="40" fill="${h}"/><rect x="${x}" y="${y + 40}" width="100" height="40" fill="${s}"/>${edge}`; };
    fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(`${out}/avatar-keyline.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 240" width="410" height="240"><rect width="410" height="240" fill="${PAPER}"/>${worst.map(([h, s], i) => cell(i, true, h, s) + cell(i, false, h, s)).join('')}</svg>`);
  }
}
