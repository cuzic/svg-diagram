import {resolveLoopBacks} from './loop-back-options.ts';
import {assertScope} from './scope-name.ts';
import type {FontFamily, Roles} from './types/core.ts';
import {must} from './must.ts';
import type {FlowStep, ChevronOpts, ChevronBand, LaidOutFlowShape} from './flow-types.ts';
import {BOX_TONES, common, focusItems, onItem, checkTones, nodeOf} from './flow-layout-core.ts';
import type {TextSpec, Pt, AnchorFn, Texts} from './flow-layout-core.ts';

/** ADR 0082 D1: the `rows` / `perRow` options of a chevron must be whole numbers >= 1 (or rows 'auto'), only one of them, horizontal, and not with loopBack. */
function checkRows(opts: ChevronOpts, n: number): void {
  const {rows, perRow} = opts;
  if (rows === undefined && perRow === undefined) return;
  if (rows !== undefined && perRow !== undefined) throw new Error('chevron(): rows と perRow は一緒に指定できない。どちらか 1 つにする');
  if (rows !== undefined && rows !== 'auto' && !(Number.isInteger(rows) && rows >= 1)) throw new Error(`chevron(): rows は 1 以上の整数か 'auto'（指定は ${String(rows)}）`);
  if (perRow !== undefined && !(Number.isInteger(perRow) && perRow >= 1)) throw new Error(`chevron(): perRow は 1 以上の整数（指定は ${String(perRow)}）`);
  if ((opts.direction ?? 'horizontal') !== 'horizontal') throw new Error("chevron({direction: 'vertical'}): 縦の chevron は折り返さない");
  const multi = rows === 'auto' || (rows !== undefined && rows >= 2) || (perRow !== undefined && perRow < n);
  if (opts.loopBack !== undefined && multi) throw new Error('chevron(): 2 段以上に折り返しうる chevron に loopBack は付けられない（戻る線が下の段の矢羽根を横切る）。loopBack を外すか、rows / perRow を外す');
}

const ROW_GAP = 40;
const TIP_MAX = 22;
/** The text width of a horizontal step when `cols` steps stand in a row (the same arithmetic as the one-row layout). */
function colsGeometry(w: number, gap: number, cols: number): {cellW: number; tip: number; textW: number} {
  const cellW = (w - gap * (cols - 1)) / cols, tip = Math.min(TIP_MAX, cellW / 4);
  return {cellW, tip, textW: cellW - 2 * tip - 8};
}

/** ADR 0082 D3: how many steps a row holds when `rows: 'auto'` — the fewest rows where no text wraps (label and sub, then the label alone), else the fewest lines. */
function autoPerRow(b: ChevronBand, w: number, t: Texts): number {
  const n = b.steps.length, minR = Math.ceil(n / 8), maxR = Math.max(minR, Math.min(4, Math.floor(n / 3)));
  const measure = (text: string | undefined, textW: number, weight: 400 | 700) => {
    if (text === undefined) return {extra: 0, lines: 0};
    const w = t.wrap(text, textW, weight), lines = w.lines.length;
    return {extra: Math.max(0, lines - text.split('\n').length) + +(w.w > textW + 8), lines};
  };
  const cands = Array.from({length: maxR - minR + 1}, (_, k) => {
    const perRow = Math.ceil(n / (minR + k)), {textW} = colsGeometry(w, b.gap, Math.min(perRow, n));
    const per = b.steps.map(s => ({l: measure(s.label, textW, 700), s: measure(s.sub, textW, 400)}));
    return {perRow, labelFits: per.every(p => p.l.extra === 0), subExtra: Math.max(...per.map(p => p.s.extra)), lines: Math.max(...per.map(p => p.l.lines + p.s.lines))};
  });
  const pick = cands.find(c => c.labelFits && c.subExtra === 0) ?? cands.find(c => c.labelFits && c.subExtra <= 1);
  if (pick) return pick.perRow;
  const best = Math.min(...cands.map(c => c.lines));
  return must(cands.find(c => c.lines === best)).perRow;
}

export function chevronBand(steps: readonly FlowStep[], opts: ChevronOpts = {}): ChevronBand {
  common('chevron', steps, opts.id);
  assertScope(opts.scope, 'chevron()');
  checkTones('chevron', steps, BOX_TONES);
  const current = opts.current ?? opts.highlight;
  if (current !== undefined && opts.focus !== undefined) throw new Error('chevron(): current / highlight and focus both mark a step: keep focus (the step filled, the others muted) or current (the step in the accent colour)');
  if (current !== undefined && (!Number.isInteger(current) || current < 0 || current >= steps.length)) throw new Error(`chevron(): current/highlight must be a zero-based step index (0..${steps.length - 1})`);
  if (opts.gap !== undefined && !(opts.gap >= 0)) throw new Error('chevron(): gap must be >= 0');
  checkRows(opts, steps.length);
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
  // ADR 0082: a horizontal chevron may wrap onto rows of `cols` steps; one row (cols = n) is the arithmetic it always had
  const perRow = vertical ? n : b.perRow ?? (b.rows === 'auto' ? autoPerRow(b, out.w, t) : Math.ceil(n / (b.rows ?? 1)));
  const cols = Math.min(perRow, n), rows = Math.ceil(n / cols);
  const cellW = vertical ? (b.width ? out.w : Math.min(360, out.w)) : (out.w - b.gap * (cols - 1)) / cols;
  // horizontal: the notch on the left and the point on the right each take `tip` of the width; vertical: the point takes the bottom
  const tip = vertical ? 16 : Math.min(TIP_MAX, cellW / 4), textW = vertical ? cellW - 24 : cellW - 2 * tip - 8;
  const blocks = b.steps.map(s => ({label: t.wrap(s.label, textW), sub: s.sub ? t.wrap(s.sub, textW, 400) : undefined}));
  // a word wider than its arrow would be drawn across the edges: an error with rows / perRow, a finding otherwise
  const wide = vertical ? [] : blocks.flatMap((k, i) => Math.max(k.label.w, k.sub?.w ?? 0) > textW + 8 ? [i + 1] : []);
  if (wide.length && b.rows !== 'auto' && (b.rows ?? b.perRow) !== undefined) throw new Error(`chevron(): ${wide[0]} 番目のステップが矢羽根に収まらない`);
  if (wide.length) out.wide = wide;
  const textH = (k: typeof blocks[number]) => k.label.h + (k.sub?.h ?? 0);
  const cellH = Math.max(60, Math.max(...blocks.map(textH)) + 20 + (vertical ? tip : 0));
  out.h = vertical ? n * cellH + (n - 1) * b.gap : rows * cellH + (rows - 1) * ROW_GAP;
  b.steps.forEach((s, i) => {
    const row = vertical ? 0 : Math.floor(i / cols), col = i - row * cols;
    const xx = vertical ? out.x + (out.w - cellW) / 2 : out.x + col * (cellW + b.gap), yy = vertical ? out.y + i * (cellH + b.gap) : out.y + row * (cellH + ROW_GAP);
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
  // ADR 0082 D4: from the last step of each row, down to the middle of the gap, back to the first column, down onto the first step of the next row (after every polygon, so the arrowhead is not hidden)
  for (let r = 0; r < rows - 1; r++) {
    const yBottom = out.y + r * (cellH + ROW_GAP) + cellH, yMid = yBottom + ROW_GAP / 2;
    const xLast = Math.round(out.x + (cols - 1) * (cellW + b.gap) + cellW / 2), xFirst = Math.round(out.x + cellW / 2);
    const pts: [number, number][] = [[xLast, Math.round(yBottom)], [xLast, Math.round(yMid)], [xFirst, Math.round(yMid)], [xFirst, Math.round(yBottom + ROW_GAP)]];
    const d = (xLast === xFirst ? [must(pts[0]), must(pts[3])] : pts).map(([x, y], j) => `${j ? 'L' : 'M'}${x},${y}`).join(' ');
    out.primitives.push({k: 'path', d, tone: 'text', arrow: true, thin: true});
  }
}
