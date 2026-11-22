// ADR 0076 spike: reading-order / crossing-tail / unclear-speaker checks that read only the geometry map (plus the speaker of each bubble).
import type {Geometry, Rect} from '../comic-worksheet/proto.ts';
import {tailPolygon} from './manpu.ts';

export interface PanelInfo {id: string; speakers: (string | null)[]} // the speaker of each bubble in dialogue order (null: narration)
export interface Found {rule: string; where: string; message: string}
const cmpSeg = (a: [number, number], b: [number, number], c: [number, number]) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
const segHit = (p: [number, number], q: [number, number], r: [number, number], s: [number, number]) => cmpSeg(p, r, s) !== cmpSeg(q, r, s) && cmpSeg(p, q, r) !== cmpSeg(p, q, s);
const edges = (poly: [number, number][]) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]!] as const);
const segInRect = (a: [number, number], b: [number, number], r: Rect) => { for (let t = 0; t <= 20; t++) { const x = a[0] + (b[0] - a[0]) * t / 20, y = a[1] + (b[1] - a[1]) * t / 20; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true; } return false; };
const distToSeg = (p: [number, number], a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); };

/** Expected reading order of bubbles in one panel (horizontal, left to right): rows from the top, within a row from the left. A row is a set of bubbles whose vertical ranges overlap. */
export function readingOrder(rects: Rect[], dir: 'ltr' | 'rtl' = 'ltr'): number[] {
  const idx = rects.map((_, i) => i).sort((a, b) => rects[a]!.y - rects[b]!.y), rows: number[][] = [];
  for (const i of idx) { const row = rows.find(r => r.some(j => rects[j]!.y < rects[i]!.y + rects[i]!.h && rects[i]!.y < rects[j]!.y + rects[j]!.h)); if (row) row.push(i); else rows.push([i]); }
  return rows.flatMap(r => r.sort((a, b) => dir === 'ltr' ? rects[a]!.x - rects[b]!.x : rects[b]!.x - rects[a]!.x));
}
export function checkOrderAndTails(geo: Geometry, panels: PanelInfo[]): Found[] {
  const out: Found[] = [];
  for (const p of panels) {
    const keys = p.speakers.map((_, i) => `${p.id}.b${i}`), rects = keys.map(k => geo.bubbles[k]!);
    const want = readingOrder(rects);
    if (want.some((v, i) => v !== i)) out.push({rule: 'comic-reading-order', where: p.id, message: `bubbles read in the order ${want.map(i => i + 1).join(',')} but are written in the order ${rects.map((_, i) => i + 1).join(',')}`});
    const tails = keys.map((k, i) => p.speakers[i] ? tailPolygon(geo, k, `${p.id}.${p.speakers[i]}`) : null);
    tails.forEach((t, i) => { if (!t) return;
      tails.forEach((u, j) => { if (j > i && u && edges(t).some(([a, b]) => edges(u).some(([c, d]) => segHit(a, b, c, d)))) out.push({rule: 'comic-tail-cross', where: `${keys[i]}~${keys[j]}`, message: 'two tails cross'}); });
      rects.forEach((r, j) => { if (j !== i && edges(t).some(([a, b]) => segInRect(a, b, r))) out.push({rule: 'comic-tail-cross', where: `${keys[i]}>${keys[j]}`, message: 'a tail runs through another bubble'}); });
      const sp = p.speakers[i]!, spHead = geo.points[`${p.id}.${sp}`]!.head, tip = t[1], mid: [number, number] = [(t[0][0] + t[2][0]) / 2, (t[0][1] + t[2][1]) / 2];
      for (const [hk, h] of Object.entries(geo.points)) if (hk.startsWith(`${p.id}.`) && hk !== `${p.id}.${sp}` && distToSeg([h.head[0], h.head[1]], mid, tip) < h.head[2] + 4) out.push({rule: 'comic-speaker-unclear', where: keys[i]!, message: `the tail passes the head of ${hk.split('.')[1]} on its way to ${sp}`});
      const r = rects[i]!, cx = r.x + r.w / 2;
      for (const [hk, h] of Object.entries(geo.points)) if (hk.startsWith(`${p.id}.`) && hk !== `${p.id}.${sp}` && Math.abs(cx - h.head[0]) < Math.abs(cx - spHead[0]) - 8) out.push({rule: 'comic-speaker-unclear', where: keys[i]!, message: `the bubble is nearer to ${hk.split('.')[1]} than to its speaker ${sp}`});
    });
  }
  return out;
}
