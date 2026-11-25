import {at} from './finding-rules.ts';
import type {Finding} from './types/verdicts.ts';
import {must} from './must.ts';
import type {LaidOutQuadrant, QuadrantBand} from './quadrant.ts';
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

export function quadrantFindings(b: QuadrantBand): Finding[] {
  return !b.groups.length && new Set(b.items.flatMap(i => i.tone ? [i.tone] : [])).size >= 2 ? [{...at(b), rule: 'quadrant-tone-only', severity: 'warn', message: 'quadrant() の項目を tone（色）だけで分けている。色だけでは意味が伝わらない。group を指定する（形と凡例が付く）'}] : [];
}

export function quadrantLayoutFindings(b: LaidOutQuadrant): Finding[] {
  const out: Finding[] = [];
  const far = b.moved.filter(m => m.px >= 16);
  if (far.length) out.push({...at(b), rule: 'quadrant-item-moved', severity: 'warn', message: `quadrant() の項目 ${far.map(m => `「${m.label}」(${Math.round(m.px)}px)`).join('、')} が、他の項目やラベルを避けて座標から離れた。座標を離すか、図を大きくする`});
  if (b.emptyCells.length) out.push({...at(b), rule: 'quadrant-empty-cell', severity: 'warn', message: `quadrant() のマス ${b.emptyCells.map(l => `「${l}」`).join('、')} に項目がない（空の枠が残っている）。項目を入れるか、マスを減らす。意図した空きなら quadrant({allowEmpty: [[col, row]]}) （全部なら true）`});
  if (b.floored.length) out.push({...at(b), rule: 'quadrant-size-floor', severity: 'warn', message: `quadrant() の項目 ${b.floored.map(l => `「${l}」`).join('、')} の size が最大の値に比べて小さすぎ、最小の円で描いた（面積が値より大きく見える）。値の差が大きすぎるなら、大きさではなく文字で示す`});
  return out;
}

export const quadrantRules = /* @__PURE__ */ Object.freeze({
  'quadrant-item-moved': {doc: 'quadrant() の項目が、重なりを避けるため指定した座標から 16px 以上動いた（座標は目安として読まれる）', scope: 'band'},
  'quadrant-size-floor': {doc: 'quadrant() の項目の size が小さすぎ、最小の円で描いた（面積が値より大きく見える）', scope: 'band'},
  'quadrant-empty-cell': {doc: 'quadrant() のマスに項目が 1 つもない（「該当なし」の空の枠が残っている。意図した空きは allowEmpty で示す）', scope: 'band'},
  'quadrant-tone-only': {doc: 'quadrant() の項目の色（tone）だけで種類を分けている（group を使うと形と凡例でも伝わる）', scope: 'band'},
} as const);
