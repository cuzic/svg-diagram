import {resolveLoopBacks} from './loop-back-options.ts';
import {assertScope} from './scope-name.ts';
import type {FontFamily, Roles} from './types/core.ts';
import {must} from './must.ts';
import type {FlowStep, ChevronOpts, ChevronBand, LaidOutFlowShape} from './flow-types.ts';
import {BOX_TONES, common, focusItems, onItem, checkTones, nodeOf} from './flow-layout-core.ts';
import type {TextSpec, Pt, AnchorFn, Texts} from './flow-layout-core.ts';

export function chevronBand(steps: readonly FlowStep[], opts: ChevronOpts = {}): ChevronBand {
  common('chevron', steps, opts.id);
  assertScope(opts.scope, 'chevron()');
  checkTones('chevron', steps, BOX_TONES);
  const current = opts.current ?? opts.highlight;
  if (current !== undefined && opts.focus !== undefined) throw new Error('chevron(): current / highlight and focus both mark a step: keep focus (the step filled, the others muted) or current (the step in the accent colour)');
  if (current !== undefined && (!Number.isInteger(current) || current < 0 || current >= steps.length)) throw new Error(`chevron(): current/highlight must be a zero-based step index (0..${steps.length - 1})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('chevron(): gap must be >= 0');
  if (opts.loopBack !== undefined && (opts.direction ?? 'horizontal') !== 'horizontal') throw new Error("chevron({direction: 'vertical'}): loopBack is for horizontal flows (a vertical chevron has no room under it)");
  const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('chevron()', opts.loopBack, steps.length, steps.map(s => s.id));
  const {focus, ...rest} = opts;
  return {...rest, ...(loopBack ? {loopBack} : {}), type: 'chevron', steps: focusItems('chevron', steps, focus), direction: opts.direction ?? 'horizontal', first: opts.first ?? 'pentagon', gap: opts.gap ?? 4};
}

export function chevronTexts(b: ChevronBand, roles: Roles): [string, number, number, FontFamily][] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  const specs = b.steps.flatMap(s => [...bold(s.label), ...plain(s.sub)]);
  return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}

export function layoutChevron(b: ChevronBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const vertical = b.direction === 'vertical', n = b.steps.length, current = b.current ?? b.highlight;
  const cellW = vertical ? (b.width ? out.w : Math.min(360, out.w)) : (out.w - b.gap * (n - 1)) / n;
  // horizontal: the notch on the left and the point on the right each take `tip` of the width; vertical: the point takes the bottom
  const tip = vertical ? 16 : Math.min(22, cellW / 4), textW = vertical ? cellW - 24 : cellW - 2 * tip - 8;
  const blocks = b.steps.map(s => ({label: t.wrap(s.label, textW), sub: s.sub ? t.wrap(s.sub, textW, 400) : undefined}));
  const textH = (k: typeof blocks[number]) => k.label.h + (k.sub?.h ?? 0);
  const cellH = Math.max(60, Math.max(...blocks.map(textH)) + 20 + (vertical ? tip : 0));
  out.h = vertical ? n * cellH + (n - 1) * b.gap : cellH;
  b.steps.forEach((s, i) => {
    const xx = vertical ? out.x + (out.w - cellW) / 2 : out.x + i * (cellW + b.gap), yy = vertical ? out.y + i * (cellH + b.gap) : out.y;
    const notch: Pt[] = i || b.first === 'chevron' ? [[xx + tip, yy + cellH / 2]] : [];
    const points: Pt[] = vertical
      ? [[xx, yy], [xx + cellW, yy], [xx + cellW, yy + cellH - tip], [xx + cellW / 2, yy + cellH], [xx, yy + cellH - tip]]
      : [[xx, yy], [xx + cellW - tip, yy], [xx + cellW, yy + cellH / 2], [xx + cellW - tip, yy + cellH], [xx, yy + cellH], ...notch];
    out.primitives.push({k: 'polygon', points, tone: current === i ? 'accent' : s.tone ?? 'plain', ...(current === i ? {strong: true} : {}), ...nodeOf(s)});
    anchor(s.id, {x: xx, y: yy, w: cellW, h: cellH});
    const k = must(blocks[i]), top = yy + (cellH - (vertical ? tip : 0) - textH(k)) / 2;
    t.place(k.label, xx + cellW / 2, top, onItem(s.tone, 'text'));
    if (k.sub) t.place(k.sub, xx + cellW / 2, top + k.label.h, onItem(s.tone, 'muted'));
  });
}
