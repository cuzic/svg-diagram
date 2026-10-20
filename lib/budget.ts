// Text-volume budget for a laid-out diagram. Warn-only: a figure
// that is too wordy is usually still a valid figure, so verify.ts reports
// these as `warnings` and never fails the build on them.
//
// Counted in "display width" units rather than raw characters: a full-width
// (CJK, emoji) character counts 1, a half-width one 0.5. Japanese text carries
// far more per character than ASCII, and the width is what the reader sees.
// Only the box body counts toward the per-box limit — the title is a label,
// not reading load.

// Thresholds sit just above the current maximum of the existing, accepted
// diagrams, so this is a guard against NEW outliers, not a critique of old ones.
// (A percentile cut would flag a fixed share of diagrams whatever their quality.)
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutBox} from './types/text-bands.ts';
import type {BudgetLimits, BudgetMeasure} from './types/verdicts.ts';

import {must} from './must.ts';
export const BUDGET: BudgetLimits = {
  boxBody: 100,  // display-width units in one box, title excluded
  total: 380,    // all text in one diagram
  boxes: 20,     // box() count in one diagram
};

export function displayWidth(text: unknown): number {
  let w = 0;
  for (const ch of String(text)) w += must(ch.codePointAt(0)) < 0x80 ? 0.5 : 1;
  return w;
}

function boxesOf(d: Pick<LaidOutDiagram, 'laidOut'>): LaidOutBox[] {
  const out: LaidOutBox[] = [];
  for (const band of d.laidOut) {
    if (band.type === 'box') out.push(band);
    else if (band.type === 'row' || band.type === 'grid') out.push(...band.children);
  }
  return out;
}

function bodyWidth(box: {title?: string; wrappedRuns?: {text: string}[]}): number {
  return (box.wrappedRuns ?? []).filter(r => r.text !== box.title).reduce((s, r) => s + displayWidth(r.text), 0);
}

// -> {boxes, total, maxBody: {width, label}}
export function measureBudget(d: Pick<LaidOutDiagram, 'laidOut'>): BudgetMeasure {
  const boxes = boxesOf(d);
  let total = 0;
  for (const band of d.laidOut) {
    if (band.type === 'row' || band.type === 'grid') continue;
    for (const r of 'wrappedRuns' in band ? band.wrappedRuns : []) total += displayWidth(r.text);
  }
  let maxBody = {width: 0, label: ''};
  for (const b of boxes) {
    for (const r of b.wrappedRuns ?? []) total += displayWidth(r.text);
    const w = bodyWidth(b);
    if (w > maxBody.width) maxBody = {width: w, label: b.title ?? b.id ?? '(box)'};
  }
  return {boxes: boxes.length, total, maxBody};
}

export function budgetWarnings(d: Pick<LaidOutDiagram, 'laidOut'>, limits: BudgetLimits = BUDGET): string[] {
  const m = measureBudget(d);
  const w: string[] = [];
  if (m.maxBody.width > limits.boxBody) w.push(`box "${m.maxBody.label}" has ${Math.round(m.maxBody.width)} width-units of body text (budget ${limits.boxBody}) — cut words before shrinking the layout`);
  if (m.total > limits.total) w.push(`diagram has ${Math.round(m.total)} width-units of text in total (budget ${limits.total})`);
  if (m.boxes > limits.boxes) w.push(`diagram has ${m.boxes} boxes (budget ${limits.boxes})`);
  return w;
}
