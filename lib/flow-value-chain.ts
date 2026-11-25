import {partStep} from './parts.ts';
import {assertScope} from './scope-name.ts';
import type {FontFamily, Roles} from './types/core.ts';
import {must} from './must.ts';
import type {FlowStep, ValueChainOpts, ValueChainBand, LaidOutFlowShape} from './flow-types.ts';
import {BOX_TONES, common, focusItems, onItem, checkTones, nodeOf} from './flow-layout-core.ts';
import type {TextSpec, Pt, AnchorFn, Texts} from './flow-layout-core.ts';

export function valueChainBand(parts: {support?: readonly (string | FlowStep)[]; primary: readonly (string | FlowStep)[]}, opts: ValueChainOpts = {}): ValueChainBand {
  const step = (x: string | FlowStep): FlowStep => typeof x === 'string' ? {label: x} : x;
  const support = (parts.support ?? []).map(step), primary = parts.primary.map(step);
  common('valueChain', primary, opts.id);
  if (support.length) common('valueChain', support, opts.id);
  const ids = [...support, ...primary].flatMap(s => s.id ? [s.id] : []);
  if (new Set(ids).size !== ids.length) throw new Error(`valueChain(): duplicate id "${ids.find((x, i) => ids.indexOf(x) !== i)}"`);
  assertScope(opts.scope, 'valueChain()');
  checkTones('valueChain', [...support, ...primary], BOX_TONES);
  if (opts.margin === '') throw new Error('valueChain(): margin must be a non-empty label, or false to leave the arrow out');
  // focus counts the support activities first, then the primary ones (as they are written)
  const {focus, ...rest} = opts, all = focusItems('valueChain', [...support, ...primary], focus);
  return {...rest, type: 'valueChain', support: all.slice(0, support.length), primary: all.slice(support.length), margin: opts.margin ?? 'マージン', titles: opts.titles ?? ['支援活動', '主活動']};
}

export function valueChainTexts(b: ValueChainBand, roles: Roles): [string, number, number, FontFamily][] {
  const bold = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 700]] : [];
  const plain = (t: string | undefined): TextSpec[] => t ? [[t, roles.note, 400]] : [];
  const specs = [...b.support, ...b.primary].flatMap(s => [...bold(s.label), ...plain(s.sub)]).concat(bold(b.margin || undefined), b.titles ? bold(b.titles[0]) : [], b.titles ? bold(b.titles[1]) : []);
  return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}

export function layoutValueChain(b: ValueChainBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void {
  const gap = 4, tipM = 20;
  const marginW = b.margin ? Math.min(140, Math.max(76, t.width(b.margin) + tipM + 16)) : 0;
  const mainW = out.w - (b.margin ? marginW + 8 : 0);
  let y = out.y;
  const title = (text: string | undefined, part?: string) => {
    if (!text) return;
    const k = t.wrap(text, mainW);
    t.place(k, out.x, y, 'muted', 'start', part);
    y += k.h + 6;
  };
  const top = y;
  // ADR 0054 D9.2: the support activities, the primary activities and the margin are parts
  const titles = b.titles || undefined, support = partStep('support', 0, titles?.[0] ?? ''), primary = partStep('primary', 0, titles?.[1] ?? ''), margin = partStep('margin', 0, b.margin || '');
  // support activities: one bar each, full width
  if (b.support.length) {
    title(b.titles ? b.titles[0] : undefined, support);
    for (const s of b.support) {
      const label = t.wrap(s.label, mainW - 24), sub = s.sub ? t.wrap(s.sub, mainW - 24, 400) : undefined;
      const h = Math.max(36, label.h + (sub?.h ?? 0) + 16), textTop = y + (h - label.h - (sub?.h ?? 0)) / 2;
      out.primitives.push({k: 'polygon', points: [[out.x, y], [out.x + mainW, y], [out.x + mainW, y + h], [out.x, y + h]], tone: s.tone ?? 'muted', ...nodeOf(s), part: support});
      anchor(s.id, {x: out.x, y, w: mainW, h}, support);
      t.place(label, out.x + mainW / 2, textTop, onItem(s.tone, 'text'), 'middle', support);
      if (sub) t.place(sub, out.x + mainW / 2, textTop + label.h, onItem(s.tone, 'muted'), 'middle', support);
      y += h + gap;
    }
    y += 8 - gap;
  }
  // primary activities: chevrons, the first one a pentagon
  title(b.titles ? b.titles[1] : undefined, primary);
  // a chevron's two slanted sides are parallel: at every height the room between them is cellW - tip wide, only moved sideways (left at the
  // middle, where the notch reaches in; right at the top and bottom). Each line is centred in the room at its own height (ADR 0061)
  const n = b.primary.length, cellW = (mainW - gap * (n - 1)) / n, tip = Math.min(18, cellW / 4), textW = cellW - tip - 8;
  const blocks = b.primary.map(s => ({label: t.wrap(s.label, textW), sub: s.sub ? t.wrap(s.sub, textW, 400) : undefined}));
  const textH = (k: typeof blocks[number]) => k.label.h + (k.sub?.h ?? 0);
  const cellH = Math.max(72, Math.max(...blocks.map(textH)) + 24);
  b.primary.forEach((s, i) => {
    const xx = out.x + i * (cellW + gap), yy = y;
    const notch: Pt[] = i ? [[xx + tip, yy + cellH / 2]] : [];
    out.primitives.push({k: 'polygon', points: [[xx, yy], [xx + cellW - tip, yy], [xx + cellW, yy + cellH / 2], [xx + cellW - tip, yy + cellH], [xx, yy + cellH], ...notch], tone: s.tone ?? 'plain', ...nodeOf(s), part: primary});
    anchor(s.id, {x: xx, y: yy, w: cellW, h: cellH}, primary);
    const k = must(blocks[i]), textTop = yy + (cellH - textH(k)) / 2, mid = yy + cellH / 2;
    // the room at height y: from the notch's side (none on the first, a pentagon) to the point's side, r = 0 at the middle, 1 at the top and bottom
    const xAt = (ly: number) => { const r = Math.min(1, Math.abs(ly - mid) / (cellH / 2)), left = xx + (i ? tip * (1 - r) : 0), right = xx + cellW - tip * r; return (left + right) / 2; };
    t.place(k.label, xx + cellW / 2, textTop, onItem(s.tone, 'text'), 'middle', primary, xAt);
    if (k.sub) t.place(k.sub, xx + cellW / 2, textTop + k.label.h, onItem(s.tone, 'muted'), 'middle', primary, xAt);
  });
  const bottom = y + cellH;
  // the margin: a tall arrow over the whole height, pointing right
  if (b.margin) {
    const mx = out.x + out.w - marginW, mid = (top + bottom) / 2;
    out.primitives.push({k: 'polygon', points: [[mx, top], [mx + marginW - tipM, top], [mx + marginW, mid], [mx + marginW - tipM, bottom], [mx, bottom]], tone: 'accent', strong: true, part: margin});
    const label = t.wrap(b.margin, marginW - tipM - 4);
    t.place(label, mx + (marginW - tipM) / 2, mid - label.h / 2, 'text', 'middle', margin);
  }
  out.h = bottom - out.y;
}
