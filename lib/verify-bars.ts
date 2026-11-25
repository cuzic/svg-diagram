import {barsValuesHidden} from './diagram-description.ts';
import {visibleAt} from './reveal-visibility.ts';
import {at} from './finding-rules.ts';
import type {Band, LaidOutDiagram} from './types/index.ts';
import {segHitsRect} from './bars.ts';
import {must} from './must.ts';
import {PALETTE, colorOf} from './tokens.ts';
import type {DiagramData, Theme} from './types/core.ts';
import type {LaidOutBars} from './types/bars.ts';
import type {CheckRect, Finding} from './types/verdicts.ts';
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


/** Warn once, at the first band with a positive bar drawn at a pixel or less. */
export function thinBarFindings({laidOut}: Partial<Pick<LaidOutDiagram, 'laidOut'>>): Finding[] {
  const band = laidOut?.find(b => b.type === 'bars' && b.bars.some(r =>
    (r.w > 0 && r.w <= 1 && r.h > 0) || (r.h > 0 && r.h <= 1 && r.w > 0)));
  return band ? [{...at(band), rule: 'bars-thin-bar', severity: 'warn', message: '棒が 1px 以下になっている。図の高さ・幅を上げるか max を見直す'}] : [];
}

export function hiddenBarsTitleFindings(
  d: Pick<DiagramData, 'medium' | 'bands'>, title: () => string, walk: (bands: Band[]) => readonly Band[], stage?: number,
): Finding[] {
  if (d.medium !== 'doc' || title()) return [];
  return walk(d.bands).some(band => band.type === 'bars' && visibleAt(band, stage) && barsValuesHidden(band))
    ? [{rule: 'bars-values-hidden', severity: 'warn', message: '値を隠した bars があるが、図に題名がなく <desc> も出ない。diagram({title}) を指定する（値の列は自動で <desc> に入る）'}]
    : [];
}

export const barsRules = /* @__PURE__ */ Object.freeze({
  'bars-values-hidden': {doc: '値ラベルも目盛りも出さない bars があるのに、図の題名（SVG の <title>）がなく、値を読み上げる <desc> が届かない（doc 媒体）', scope: 'diagram'},
  'bars-thin-bar': {doc: '棒が 1px 以下（値は 0 でない）。図の高さ・幅を上げるか max を見直す', scope: 'band'},
} as const);
