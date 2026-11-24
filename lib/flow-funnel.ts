import {partStep} from './parts.ts';
import {assertScope} from './scope-name.ts';
import type {FontFamily, Roles} from './types/core.ts';
import {must} from './must.ts';
import type {FunnelStage, FunnelOpts, FunnelBand, LaidOutFlowShape} from './flow-types.ts';
import {BOX_TONES, common, focusItems, onItem, checkTones, nodeOf, LINE} from './flow-layout-core.ts';
import type {TextSpec, AnchorFn, Texts} from './flow-layout-core.ts';

export function funnelBand(stages: readonly FunnelStage[], opts: FunnelOpts = {}): FunnelBand {
  common('funnel', stages, opts.id);
  assertScope(opts.scope, 'funnel()');
  checkTones('funnel', stages, BOX_TONES);
  stages.forEach((s, i) => { if (s.value !== undefined && (!Number.isFinite(s.value) || s.value < 0)) throw new Error(`funnel(): stage ${i + 1} value must be a finite number >= 0`); });
  const scale = opts.scale ?? 'even';
  if (scale === 'value' && stages.some(s => s.value === undefined)) throw new Error('funnel(): scale "value" requires a value on every stage');
  const {focus, ...rest} = opts;
  return {...rest, type: 'funnel', stages: focusItems('funnel', stages, focus), scale, showRate: opts.showRate ?? false};
}

const funnelLabel = (s: FunnelStage): string => s.value === undefined ? s.label : `${s.label}  ${s.value}`;
const funnelRate = (prev: number | undefined, v: number | undefined): string | undefined => prev && v !== undefined ? `${Math.round(v / prev * 100)}%` : undefined;

export function funnelTexts(b: FunnelBand, roles: Roles): [string, number, number, FontFamily][] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  const specs = b.stages.flatMap((s, i) => [...bold(funnelLabel(s)), ...(b.showRate && i ? plain(funnelRate(must(b.stages[i - 1]).value, s.value)) : [])]);
  return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}

export function layoutFunnel(b: FunnelBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void {
  const n = b.stages.length, w = out.w, cx = out.x + w / 2, minW = Math.min(150, w * .3), max = Math.max(...b.stages.map(s => s.value ?? 0), 1);
  const frac = (i: number) => b.scale === 'value' ? (must(b.stages[i]).value ?? 0) / max : n === 1 ? 1 : 1 - i * .65 / (n - 1);
  const tops = b.stages.map((_, i) => Math.max(minW, w * frac(i)));
  const bottoms = tops.map((top, i) => i < n - 1 ? must(tops[i + 1]) : Math.max(minW * .8, top * .8)); // each stage ends where the next begins
  const lh = roles.note * LINE;
  const plans = b.stages.map((s, i) => {
    const text = funnelLabel(s), ti = must(tops[i]), bi = must(bottoms[i]), inner = Math.min(ti, bi) - 24, sideLeft = cx + Math.max(ti, bi) / 2 + 14, sideW = out.x + w - sideLeft;
    const beside = t.width(text) > inner && sideW >= 80; // too wide for the stage: to its right, when there is room
    const label = t.wrap(text, beside ? sideW : inner);
    const rateText = b.showRate && i ? funnelRate(must(b.stages[i - 1]).value, s.value) : undefined;
    const rate = rateText ? t.wrap(rateText, w, 400) : undefined;
    const rateLeft = rate !== undefined && cx - Math.max(ti, bi) / 2 - 14 - rate.w >= out.x; // else under the label
    return {label, beside, sideLeft, rate, rateLeft};
  });
  const rowH = Math.max(64, ...plans.map(p => p.label.h + (p.rate && !p.rateLeft ? p.rate.h : 0) + 20));
  out.h = n * rowH;
  b.stages.forEach((s, i) => {
    const yy = out.y + i * rowH, a = must(tops[i]), z = must(bottoms[i]), p = must(plans[i]);
    const part = partStep('stage', s.id ?? i, s.label); // ADR 0054: a stage, its label and the rate into it
    out.primitives.push({k: 'polygon', points: [[cx - a / 2, yy], [cx + a / 2, yy], [cx + z / 2, yy + rowH - 4], [cx - z / 2, yy + rowH - 4]], tone: s.tone ?? (i % 2 ? 'muted' : 'accent'), ...nodeOf(s), part});
    anchor(s.id, {x: cx - Math.max(a, z) / 2, y: yy, w: Math.max(a, z), h: rowH - 4}, part);
    const blockH = p.label.h + (p.rate && !p.rateLeft ? p.rate.h : 0), top = yy + (rowH - 4 - blockH) / 2;
    const lx = p.beside ? p.sideLeft : cx, la = p.beside ? 'start' : 'middle';
    t.place(p.label, lx, top, p.beside ? 'text' : onItem(s.tone, 'text'), la, part);
    if (p.rate) {
      if (p.rateLeft) t.place(p.rate, cx - Math.max(a, z) / 2 - 14, yy + (rowH - 4 - lh) / 2, 'muted', 'end', part);
      else t.place(p.rate, lx, top + p.label.h, p.beside ? 'muted' : onItem(s.tone, 'muted'), la, part);
    }
  });
}
