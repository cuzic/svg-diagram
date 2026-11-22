// node spikes/balloon-overlay/comic.ts  — ADR 0078: two stacked speech bubbles of one comic panel with a bounded overlap, and the two z-orders.
// Layout numbers are lib/comic/constants.ts (panel 420x352 at 6:5, zone 16..236, PAD_Y 10, LINE_H 26, gap 6). Geometry only; no slot values.
import fs from 'node:fs';
import {balloonPath, balloonRadius} from '../../lib/comic/balloon-path.ts';
import {tailOf, bubbleHeight, zoneOf, lineBudget} from '../../lib/comic/layout.ts';
import {HEAD_FROM_BOTTOM, HEAD_R, LINE_H, PAD_X, PAD_Y, SIDE_KEEP, STAGE_X, ZONE_TOP} from '../../lib/comic/constants.ts';
import {clipArea, rectPoly, roundPoly, type Pt, type Rect} from './geom.ts';

const PH = Number(process.argv[2] ?? 352), out = new URL('./out/', import.meta.url).pathname, PW = 420, zone = zoneOf(PH);
const lines: string[] = []; const rep = (s: string): void => { lines.push(s); console.log(s); };
const HEADX = {left: STAGE_X, center: 208, right: PW - STAGE_X} as const; type At = keyof typeof HEADX;
interface B {id: string; at: At; lines: number; w: number; x: number; y: number; h: number; tail?: Pt[]; z: number}
const head = (at: At) => ({id: 'h', who: at, name: at, expression: 'neutral', cx: HEADX[at], cy: PH - HEAD_FROM_BOTTOM, r: HEAD_R, mouth: [HEADX[at], PH - HEAD_FROM_BOTTOM + HEAD_R * 0.42] as [number, number]});
const bodyPoly = (b: B): Pt[] => roundPoly(b, balloonRadius('say', b.h));
const textRect = (b: B): Rect => { const ih = b.lines * LINE_H; return {x: b.x + PAD_X, y: b.y + (b.h - ih) / 2, w: b.w - 2 * PAD_X, h: ih}; };
function make(id: string, at: At, n: number, w: number, y: number): B {
  const h = bubbleHeight(n), x = Math.max(SIDE_KEEP, Math.min(HEADX[at] - w / 2, PW - SIDE_KEEP - w)), b: B = {id, at, lines: n, w, x, y, h, z: 0};
  const t = tailOf({x, y, w, h, kind: 'say'} as never, head(at) as never); if (t) b.tail = [t.base[0], t.tip, t.base[1]];
  return b;
}
const outlinePoly = (b: B): Pt[][] => [bodyPoly(b), ...(b.tail ? [b.tail] : [])]; // body and tail: one path, so they sit at one z
const cover = (over: B, under: Rect | Pt[]): number => outlinePoly(over).reduce((s, p) => s + clipArea(p, Array.isArray(under) ? under : rectPoly(under)), 0);

// enumerate: first/second speaker x line counts x width, for each overlap depth d (second.y = first.bottom - d; d = -6 is today's gap)
const DEPTHS = [-6, 0, 4, 8, 12, 16];
const res: Record<number, {n: number; fit: number; text1: number; text2: number; cross: number; hiddenFirstTop: number; gone: number; hiddenLastTop: number; tailTextFirst: number}> = {};
for (const d of DEPTHS) res[d] = {n: 0, fit: 0, text1: 0, text2: 0, cross: 0, hiddenFirstTop: 0, gone: 0, hiddenLastTop: 0, tailTextFirst: 0};
const ATS: At[] = ['left', 'center', 'right'];
for (const a1 of ATS) for (const a2 of ATS) for (const n1 of [1, 2, 3]) for (const n2 of [1, 2, 3]) for (const w1 of [188, 204]) for (const w2 of [188, 204]) for (const d of DEPTHS) {
  const first = make('p1.d1', a1, n1, w1, ZONE_TOP);
  const second = make('p1.d2', a2, n2, w2, first.y + first.h - d);
  const R = res[d]!; R.n++;
  if (second.y + second.h > zone.bottom) continue; R.fit++;
  // (A) first on top: the first bubble's outline (with its tail) paints over the second. (B) last on top: the second paints over the first.
  const textUnder2 = cover(first, textRect(second)), textUnder1 = cover(second, textRect(first));
  if (textUnder2 > 0.5) R.text1++; if (textUnder1 > 0.5) R.text2++;
  const tailOver = first.tail ? clipArea(first.tail, bodyPoly(second)) : 0, tail = first.tail ? Math.abs(clipArea(first.tail, first.tail)) : 0;
  if (tailOver > 0.5) {
    R.cross++;
    R.hiddenLastTop += Math.min(1, tailOver / tail) >= 0.2 ? 1 : 0; // the second paints over the tail: how often is >= 20% of it hidden
    R.gone += tailOver / tail >= 0.9 ? 1 : 0; // (almost) the whole tail behind the 2nd bubble: the reader loses the speaker
    R.tailTextFirst += first.tail ? (clipArea(first.tail, textRect(second)) > 0.5 ? 1 : 0) : 0; // the first's tail paints over the second's TEXT
  }
}
rep('| overlap depth d (px) | cases that fit the zone (of 324) | text of 2nd covered if 1st on top | text of 1st covered if 2nd on top | tail of 1st crosses the 2nd body | ... of those, the 2nd (on top) hides >= 20% of the tail | ... of those, the 1st tail (on top) covers the 2nd text (conservative: whole inner box) | ... of those, >= 90% of the tail is hidden by the 2nd (on top) |\n|---|---|---|---|---|---|---|---|');
for (const d of DEPTHS) { const r = res[d]!; rep(`| ${d === -6 ? '-6 (today: 6px gap)' : d} | ${r.fit} | ${r.text1} | ${r.text2} | ${r.cross} | ${r.hiddenLastTop} | ${r.tailTextFirst} | ${r.gone} |`); }
rep(`\nline budget at 6:5: ${lineBudget(PH)} lines; zone ${zone.top}..${zone.bottom} (${zone.bottom - zone.top}px). 3+2 lines: ${bubbleHeight(3)}+${bubbleHeight(2)} = ${bubbleHeight(3) + bubbleHeight(2)}px stacked with a 6px gap = ${bubbleHeight(3) + bubbleHeight(2) + 6}px (zone ${zone.bottom - zone.top}px) -> overlap 8: ${bubbleHeight(3) + bubbleHeight(2) - 8}px`);
rep(`PAD_Y = ${PAD_Y}px: text starts ${PAD_Y}px (1 line: ${(bubbleHeight(1) - LINE_H) / 2}px) inside the top edge; the rounded corner (r = ${balloonRadius('say', 48)}) leaves the corner area empty.`);

// SVGs: a 3+2 panel that does not fit today, drawn with depth 8 in both z-orders, plus a crossing-tail case
const draw = (title: string, bs: B[], order: B[]): string => {
  const heads = ATS.filter(a => bs.some(b => b.at === a)).map(a => { const h = head(a); return `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="#f6dcc0" stroke="#22201b" stroke-width="2.5"/>`; }).join('');
  const body = order.map(b => { const p = balloonPath(b, 'say', b.tail ? {tip: b.tail[1], halfWidth: 8} : undefined), tr = textRect(b);
    return `<g data-bubble="${b.id}"><path d="${p.d}" fill="#fff" stroke="#22201b" stroke-width="2.5" stroke-linejoin="round"/><rect x="${tr.x}" y="${tr.y}" width="${tr.w}" height="${tr.h}" fill="none" stroke="#c33" stroke-width="0.5" stroke-dasharray="3 2"/><text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 6}" text-anchor="middle" font-size="18" fill="#22201b">${b.id.endsWith('d1') ? 'ここが変更点' : '要確認'}</text></g>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH + 24}" width="${PW}" height="${PH + 24}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="14" font-size="12">${title}</text><g transform="translate(0,24)"><rect x="1.5" y="1.5" width="${PW - 3}" height="${PH - 3}" fill="#fffdf5" stroke="#22201b" stroke-width="3"/>${heads}${body}</g></svg>`;
};
if (PH === 352) for (const [name, a1, a2, n1, n2, d] of [['overlap-3plus2', 'left', 'right', 3, 2, 8], ['overlap-tail-behind', 'right', 'left', 2, 2, 8]] as [string, At, At, number, number, number][]) {
  const first = make('p1.d1', a1, n1, 204, ZONE_TOP), second = make('p1.d2', a2, n2, 204, first.y + first.h - d);
  fs.writeFileSync(`${out}comic-${name}-first-on-top.svg`, draw(`${name}: depth ${d}, first read on top`, [first, second], [second, first]));
  fs.writeFileSync(`${out}comic-${name}-last-on-top.svg`, draw(`${name}: depth ${d}, last read on top`, [first, second], [first, second]));
}
if (PH === 352) fs.writeFileSync(`${out}measurements-comic.txt`, lines.join('\n') + '\n');
