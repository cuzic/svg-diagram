// node spikes/balloon-overlay/comic.ts  — ADR 0078 (round 2): two stacked speech bubbles of one comic panel with a small overlap.
// Layout numbers are lib/comic/constants.ts (panel 420x352 at 6:5, PAD_Y 10, LINE_H 26, gap 6). Geometry only; no slot values.
// Overlap is a VISUAL option here (not a way to fit more lines: the line budget is unchanged). The counts separate same-speaker pairs (lib/comic/layout.ts drops
// the upper tail of such a pair) from different-speaker pairs, and use the real stacking rule of layout.ts (a bubble is stacked under an earlier one when
// their x ranges come within STACK_GAP, or when it lies to the left of it).
import fs from 'node:fs';
import {balloonPath, balloonRadius} from '../../lib/comic/balloon-path.ts';
import {tailOf, bubbleHeight} from '../../lib/comic/layout.ts';
import {HEAD_FROM_BOTTOM, HEAD_R, LINE_H, PAD_X, SIDE_KEEP, STACK_GAP, STAGE_X, ZONE_TOP} from '../../lib/comic/constants.ts';
import {clipArea, rectPoly, roundPoly, type Pt, type Rect} from './geom.ts';

const out = new URL('./out/', import.meta.url).pathname, PW = 420, PH = 352;
const lines: string[] = []; const rep = (s: string): void => { lines.push(s); console.log(s); };
const HEADX = {left: STAGE_X, center: 208, right: PW - STAGE_X} as const; type At = keyof typeof HEADX;
interface B {id: string; at: At; lines: number; w: number; x: number; y: number; h: number; tail?: Pt[]}
const head = (at: At) => ({id: 'h', who: at, name: at, expression: 'neutral', cx: HEADX[at], cy: PH - HEAD_FROM_BOTTOM, r: HEAD_R, mouth: [HEADX[at], PH - HEAD_FROM_BOTTOM + HEAD_R * 0.42] as [number, number]});
const bodyPoly = (b: B): Pt[] => roundPoly(b, balloonRadius('say', b.h));
const textRect = (b: B): Rect => { const ih = b.lines * LINE_H; return {x: b.x + PAD_X, y: b.y + (b.h - ih) / 2, w: b.w - 2 * PAD_X, h: ih}; };
function make(id: string, at: At, n: number, w: number, y: number): B {
  const h = bubbleHeight(n), x = Math.max(SIDE_KEEP, Math.min(HEADX[at] - w / 2, PW - SIDE_KEEP - w)), b: B = {id, at, lines: n, w, x, y, h};
  const t = tailOf({x, y, w, h, kind: 'say'} as never, head(at) as never); if (t) b.tail = [t.base[0], t.tip, t.base[1]];
  return b;
}
const cover = (over: B, under: Rect | Pt[]): number => [bodyPoly(over), ...(over.tail ? [over.tail] : [])].reduce((s, p) => s + clipArea(p, Array.isArray(under) ? under : rectPoly(under)), 0);
const stacked = (a: B, b: B): boolean => (a.x < b.x + b.w + STACK_GAP && b.x < a.x + a.w + STACK_GAP) || b.x < a.x; // layout.ts: `under`

const DEPTHS = [0, 4, 8, 12, 16], ATS: At[] = ['left', 'center', 'right'];
type Row = {pairs: number; textFirstOnTop: number; textLastOnTop: number; bodyOverlap: number};
const mk = (): Record<number, Row> => Object.fromEntries(DEPTHS.map(d => [d, {pairs: 0, textFirstOnTop: 0, textLastOnTop: 0, bodyOverlap: 0}])) as Record<number, Row>;
const same = mk(), diff = mk();
let noCrossOverlap = 0, total = 0, nStacked = 0, nSame = 0, nDiffStacked = 0, cross = 0, crossHidden20 = 0, crossEmerges = 0, tailTextFirstOnTop = 0, noCross = 0;
const demo: {a1: At; a2: At; n1: number; n2: number; w: number}[] = [];
for (const a1 of ATS) for (const a2 of ATS) for (const n1 of [1, 2, 3]) for (const n2 of [1, 2, 3]) for (const w1 of [188, 204]) for (const w2 of [188, 204]) {
  total++;
  const f0 = make('p1.d1', a1, n1, w1, ZONE_TOP), s0 = make('p1.d2', a2, n2, w2, f0.y + f0.h);
  if (!stacked(f0, s0)) continue; nStacked++;
  const isSame = a1 === a2; if (isSame) nSame++;
  for (const d of DEPTHS) {
    const first = make('p1.d1', a1, n1, w1, ZONE_TOP), second = make('p1.d2', a2, n2, w2, first.y + first.h - d);
    // the tail of a same-speaker upper bubble is dropped by layout.ts (a speaker's two bubbles read as one)
    if (isSame) delete first.tail;
    const R = (isSame ? same : diff)[d]!; R.pairs++;
    if (clipArea(bodyPoly(first), bodyPoly(second)) > 0.5) R.bodyOverlap++;
    if (cover(first, textRect(second)) > 0.5) R.textFirstOnTop++;
    if (cover(second, textRect(first)) > 0.5) R.textLastOnTop++;
    if (d === 8 && !isSame) {
      const over = first.tail ? clipArea(first.tail, bodyPoly(second)) : 0, tail = first.tail ? Math.abs(clipArea(first.tail, first.tail)) : 0;
      if (over > 0.5) { cross++; if (over / tail >= 0.2) crossHidden20++; if (!(first.tail![1][0] > second.x && first.tail![1][0] < second.x + second.w && first.tail![1][1] > second.y && first.tail![1][1] < second.y + second.h)) crossEmerges++; if (clipArea(first.tail!, textRect(second)) > 0.5) tailTextFirstOnTop++; }
      else { noCross++; if (clipArea(bodyPoly(first), bodyPoly(second)) > 0.5) noCrossOverlap++; }
    }
  }
  if (!isSame) nDiffStacked++;
}
rep(`combinations: ${total} (3x3 speaker places, 1-3 lines each, widths 188 / 204); stacked by the real rule of layout.ts: ${nStacked}; of those same speaker ${nSame}, different speakers ${nDiffStacked}`);
rep('\n| overlap depth (px) | same-speaker pairs (upper tail dropped) | text of 2nd covered, 1st on top | text of 1st covered, 2nd on top | different-speaker pairs | text of 2nd covered, 1st on top | text of 1st covered, 2nd on top |\n|---|---|---|---|---|---|---|');
for (const d of DEPTHS) rep(`| ${d} | ${same[d]!.pairs} | ${same[d]!.textFirstOnTop} | ${same[d]!.textLastOnTop} | ${diff[d]!.pairs} | ${diff[d]!.textFirstOnTop} | ${diff[d]!.textLastOnTop} |`);
rep(`\ndifferent-speaker pairs (stacked), depth 8: the upper tail crosses the lower body in ${cross} of ${nDiffStacked} (today's comic-tail-crosses-bubble, a problem; unchanged); the lower bubble on top would hide >= 20% of that tail in ${crossHidden20}, and in ${crossEmerges} of them the tip comes out outside the lower bubble (the tail passes behind it and reads as that bubble's own tail); the upper bubble on top would paint the tail over the lower text in ${tailTextFirstOnTop}.`);
rep(`different-speaker pairs with no crossing tail: ${noCross} of ${nDiffStacked}; of those, the bodies overlap at depth 8 (x ranges meet, upper tail clear of the lower bubble) in ${noCrossOverlap}. Same-speaker pairs: ${nSame}, upper tail dropped, bodies overlap in all of them.`);
rep(`text starts ${(bubbleHeight(1) - LINE_H) / 2}px (1 line) to 10px (more lines) inside the top edge: depth <= PAD_Y - 2 = 8 is a rule with margin, not a threshold.`);

// demos that really overlap: (a) one speaker, two bubbles, full x overlap; (b) two speakers, x ranges overlap, no tail crossing
const draw = (title: string, bs: B[], order: B[], sameSp: boolean): string => {
  const heads = ATS.filter(a => bs.some(b => b.at === a)).map(a => { const h = head(a); return `<circle cx="${h.cx}" cy="${h.cy}" r="${h.r}" fill="#f6dcc0" stroke="#22201b" stroke-width="2.5"/>`; }).join('');
  const body = order.map(b => { const p = balloonPath(b, 'say', b.tail ? {tip: b.tail[1], halfWidth: 8} : undefined), tr = textRect(b);
    return `<g data-bubble="${b.id}"><path d="${p.d}" fill="#fff" stroke="#22201b" stroke-width="2.5" stroke-linejoin="round"/><rect x="${tr.x}" y="${tr.y}" width="${tr.w}" height="${tr.h}" fill="none" stroke="#c33" stroke-width="0.5" stroke-dasharray="3 2"/><text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 6}" text-anchor="middle" font-size="18" fill="#22201b">${b.id.endsWith('d1') ? 'ここが変更点' : '要確認'}</text></g>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH + 24}" width="${PW}" height="${PH + 24}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="8" y="14" font-size="12">${title}${sameSp ? ' (same speaker: upper tail dropped)' : ''}</text><g transform="translate(0,24)"><rect x="1.5" y="1.5" width="${PW - 3}" height="${PH - 3}" fill="#fffdf5" stroke="#22201b" stroke-width="3"/>${heads}${body}</g></svg>`;
};
let diffDemo: [At, At, number, number, number] | undefined;
for (const a1 of ATS) for (const a2 of ATS) if (a1 !== a2 && !diffDemo) for (const [n1, n2] of [[1, 1], [1, 2], [2, 1], [2, 2], [3, 2]] as [number, number][]) for (const w of [188, 204]) {
  const f = make('p1.d1', a1, n1, w, ZONE_TOP), s = make('p1.d2', a2, n2, w, f.y + f.h - 8);
  if (!diffDemo && stacked(f, s) && (!f.tail || clipArea(f.tail, bodyPoly(s)) <= 0.5) && clipArea(bodyPoly(f), bodyPoly(s)) > 5 && (!s.tail || clipArea(s.tail, bodyPoly(f)) <= 0.5)) diffDemo = [a1, a2, n1, n2, w];
}
const demos: [string, At, At, number, number, number][] = [['same-speaker', 'center', 'center', 2, 1, 204], ...(diffDemo ? [['two-speakers', ...diffDemo] as [string, At, At, number, number, number]] : [])];
for (const [name, a1, a2, n1, n2, w] of demos) {
  const first = make('p1.d1', a1, n1, w, ZONE_TOP), second = make('p1.d2', a2, n2, w, first.y + first.h - 8);
  if (a1 === a2) delete first.tail;
  const ov = clipArea(bodyPoly(first), bodyPoly(second));
  rep(`demo ${name}: ${a1}/${a2}, ${n1}+${n2} lines, depth 8: bodies overlap by ${ov.toFixed(0)}px^2 (x ranges ${first.x}..${first.x + first.w} and ${second.x}..${second.x + second.w})`);
  fs.writeFileSync(`${out}comic-${name}-first-on-top.svg`, draw(`${name}: depth 8, first read on top`, [first, second], [second, first], a1 === a2));
  fs.writeFileSync(`${out}comic-${name}-last-on-top.svg`, draw(`${name}: depth 8, last read on top (proposed default)`, [first, second], [first, second], a1 === a2));
}
fs.writeFileSync(`${out}measurements-comic.txt`, lines.join('\n') + '\n');
