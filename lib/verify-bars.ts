import {segHitsRect} from './bars.ts';
import {must} from './must.ts';
import {PALETTE, colorOf} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutBars} from './types/bars.ts';
import type {CheckRect} from './types/verdicts.ts';
import {CONTRAST_THRESHOLD, dxdy, neverTogether, outsideBox, rectOverlap} from './verify-base.ts';

export function barsProblems(band: LaidOutBars): string[] {
  const problems: string[] = [];
  for (const b of band.labelBoxes) {
    if (outsideBox(b, band)) problems.push(`bars: value label "${b.label}" runs outside the figure (raise width / height or shorten the unit)`);
  }
  // the reference lines, the cumulative line and its guide must not run through a label (the curve over a histogram may)
  const segs = [...(band.ink?.lines ?? []).filter(l => !l.soft), ...(band.ink?.polylines ?? []).filter(l => !l.soft).flatMap(l => l.pts.slice(1).map((q, k) => ({x1: must(l.pts[k]).x, y1: must(l.pts[k]).y, x2: q.x, y2: q.y})))];
  for (const b of band.labelBoxes) {
    const hit = segs.find(sg => segHitsRect(sg, {x: b.x + 1, y: b.y + 2, w: b.w - 2, h: b.h - 4}));
    if (hit) problems.push(`bars: a reference line (a limit, a target, the guide or the cumulative line) runs through the label "${b.label}" (move the line, or hide the values with labels: 'category')`);
  }
  for (let i = 0; i < band.labelBoxes.length; i++) for (let j = i + 1; j < band.labelBoxes.length; j++) {
    const [a, b] = [must(band.labelBoxes[i]), must(band.labelBoxes[j])];
    if (a.bar !== undefined && b.bar !== undefined && neverTogether(must(band.bars[a.bar]), must(band.bars[b.bar]))) continue; // one replaces the other
    const o = rectOverlap(a, b);
    if (o) problems.push(`bars: value label "${a.label}" overlaps value label "${b.label}" by ${dxdy(o)}`);
  }
  return problems;
}

export function barsRects(band: LaidOutBars): CheckRect[] {
  return band.bars.map((b, i) => ({id: b.id ?? null, label: b.id ?? `bar ${i + 1}`, x: b.x, y: b.y, w: b.w, h: b.h, ...(b.until === undefined && !b.reveal ? {} : {life: {reveal: b.reveal, until: b.until}})}));
}

export function barsContrastProblems(band: LaidOutBars, theme: Theme, luminance: (hex: string) => number, dimFill = false): string[] {
  const problems: string[] = [];
  for (const b of band.labelBoxes) {
    if (!b.background) continue;
    const dim = b.bar !== undefined && must(band.bars[b.bar]).dim; // a dimmed bar draws its label muted on bg (on the pale fill when spotlight dim is 'fill')
    const fg = dim ? PALETTE.muted : colorOf('bg', theme), bg = dim ? (dimFill ? PALETTE.border : PALETTE.bg) : colorOf(b.background, theme);
    const delta = Math.abs(luminance(fg) - luminance(bg));
    if (delta < CONTRAST_THRESHOLD) problems.push(`bars: value label "${b.label}" (${fg} on ${bg}) has low contrast (delta=${delta.toFixed(0)}, want >= ${CONTRAST_THRESHOLD})`);
  }
  return problems;
}
