import {must} from './must.ts';
import type {LaidOutQuadrant} from './quadrant.ts';
import type {Rect} from './types/core.ts';
import {dxdy, eachOverlap, outsideBox} from './verify-base.ts';

// quadrant(): items keep clear of each other, of every label and of the arrows; every label stays inside the figure.
export function quadrantProblems(band: LaidOutQuadrant): string[] {
  const problems: string[] = [];
  const nearRect = (cx: number, cy: number, r: number, b: Rect): boolean => Math.hypot(cx - Math.max(b.x, Math.min(cx, b.x + b.w)), cy - Math.max(b.y, Math.min(cy, b.y + b.h))) < r - 0.5;
  const fig = {x: band.x, y: band.y, w: band.w, h: band.h}, boxes = band.labelBoxes, bs = band.bubbles;
  for (const b of boxes) {
    const lim = b.kind === 'item' ? band.plot : fig;
    if (outsideBox(b, lim)) problems.push(`quadrant: label "${b.label}" runs outside the ${b.kind === 'item' ? 'plot' : 'figure'} (shorten it or widen the figure)`);
  }
  eachOverlap(boxes, (a, b, o) => problems.push(`quadrant: label "${a.label}" overlaps label "${b.label}" by ${dxdy(o)}`));
  // an item (its mark and its label) stays inside its own cell: one on a border reads as the other cell's
  const within = (r: Rect, c: Rect) => r.x >= c.x - 0.5 && r.y >= c.y - 0.5 && r.x + r.w <= c.x + c.w + 0.5 && r.y + r.h <= c.y + c.h + 0.5;
  bs.forEach(q => { if (!within({x: q.x - q.cr, y: q.y - q.cr, w: 2 * q.cr, h: 2 * q.cr}, must(band.cells[q.cell]))) problems.push(`quadrant: item "${q.label}" crosses the border of its cell`); });
  for (const b of boxes) if (b.kind === 'item' && b.item !== undefined && !within(b, must(band.cells[must(bs[b.item]).cell]))) problems.push(`quadrant: the label of "${b.label}" runs out of its cell`);
  bs.forEach((q, i) => {
    for (let j = i + 1; j < bs.length; j++) if (Math.hypot(q.x - must(bs[j]).x, q.y - must(bs[j]).y) < q.cr + must(bs[j]).cr - 1) problems.push(`quadrant: item "${q.label}" overlaps item "${must(bs[j]).label}" (move one, or give the cell more room)`);
    for (const b of boxes) if (nearRect(q.x, q.y, q.cr, b)) problems.push(`quadrant: item "${q.label}" sits on the label "${b.label}"`);
    if (q.x - q.cr < band.plot.x - 0.5 || q.x + q.cr > band.plot.x + band.plot.w + 0.5 || q.y - q.cr < band.plot.y - 0.5 || q.y + q.cr > band.plot.y + band.plot.h + 0.5) problems.push(`quadrant: item "${q.label}" runs outside the plot`);
  });
  band.arrows.forEach((a, k) => {
    const n = Math.max(1, Math.ceil(Math.hypot(a.x2 - a.x1, a.y2 - a.y1) / 3));
    const on = (r: Rect) => Array.from({length: n + 1}, (_v, s) => ({x: a.x1 + (a.x2 - a.x1) * s / n, y: a.y1 + (a.y2 - a.y1) * s / n})).some(p => p.x >= r.x - 1 && p.x <= r.x + r.w + 1 && p.y >= r.y - 1 && p.y <= r.y + r.h + 1);
    for (const b of boxes) if (b.kind !== 'arrow' && !(b.kind === 'axis') && on(b)) problems.push(`quadrant: arrow ${k + 1} runs through the label "${b.label}" (move an item, or a label's cell)`);
    for (const q of bs) if (Array.from({length: n + 1}, (_v, s) => ({x: a.x1 + (a.x2 - a.x1) * s / n, y: a.y1 + (a.y2 - a.y1) * s / n})).some(p => Math.hypot(p.x - q.x, p.y - q.y) < q.cr - 1)) problems.push(`quadrant: arrow ${k + 1} runs through the item "${q.label}"`);
  });
  return problems;
}
