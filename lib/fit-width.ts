// fitWidth: try the ways a layered figure can be made to fit its width, in order, and say what was tried when none does (ADR 0010).
// It wraps layeredAttempt (lib/layered-route.ts) and owns no placement or routing: each attempt is a function the caller supplies.
import type {FitApplied} from './types/diagrams.ts';
import type {LayeredLayout} from './graph-layout.ts';
import {splitByHeight, splitWidest} from './fit-split.ts';
import {keepWordsRequested, withKeepWords} from './wrap.ts';

/** What an attempt has to give back: the part of layeredAttempt's result that fitWidth reads. */
/** The layers a result's layout folded (a result with a `lay`), if any. */
const foldedOf = (r: FitResult): {layer: number; rows: number}[] => (r as {lay?: {folded?: {layer: number; rows: number}[]}}).lay?.folded ?? [];

export interface FitResult {
  size: {w: number; h: number};
  score: {crossings: number; bends: number};
}

export interface FitAttempt<R extends FitResult> {
  /** How the failure message names it, e.g. `dir 'up' (as written)`, `maxNodeW 130`. */
  label: string;
  run: () => R;
  /** What the attempt changed from the author's figure (recorded when it is the one chosen). The first attempt, as written, has none. */
  applied?: FitApplied[];
}

export interface FitOpts<R extends FitResult> {
  /** first: the first attempt that fits (a figure that already fits is never touched). best: of the attempts that fit (and are not too tall), the best score; a tie goes to the earlier one. */
  mode: 'first' | 'best';
  /** The tallest a figure may be (a canvas height or the slide's `maxDisplayHeight`; both modes skip an attempt taller than it). None: width only. */
  heightBudget?: number;
  /** The width an attempt takes up when that is not `size.w` (a state diagram's loops hang out beside it). */
  widthOf?: (r: R) => number;
}

export interface Tried {label: string; w: number; h: number}

export type Fitted<R extends FitResult> =
  | {ok: true; result: R; index: number; /** what the chosen attempt changed */ applied: FitApplied[]; tried: Tried[]}
  | {ok: false; tried: Tried[]; /** every attempt's result, in the order of `tried` */ results: R[]};

/** Half a pixel of slack, as the layouts themselves allow (`maxAcross: w + 0.5`). */
const SLACK = 0.5;

const lexLess = (a: FitResult['score'], b: FitResult['score']): boolean => a.crossings < b.crossings || (a.crossings === b.crossings && a.bends < b.bends);

/**
 * Runs the attempts in order. `first` stops at the first that fits `w` (the rest are not run); `best` runs them all and keeps the best of
 * those that fit `w` and the height budget. Every attempt that ran is in `tried`, with its width and height, whether or not it was chosen.
 */
export function fitWidth<R extends FitResult>(w: number, attempts: readonly FitAttempt<R>[], opts: FitOpts<R>): Fitted<R> {
  const widthOf = opts.widthOf ?? ((r: R) => r.size.w);
  const tried: Tried[] = [], results: R[] = [];
  let best: {result: R; index: number} | undefined;
  for (const [index, a] of attempts.entries()) {
    const result = a.run();
    results.push(result);
    const width = widthOf(result);
    tried.push({label: a.label, w: Math.ceil(width), h: Math.ceil(result.size.h)});
    if (width > w + SLACK) continue;
    if (opts.heightBudget !== undefined && result.size.h > opts.heightBudget + SLACK) continue;
    if (opts.mode === 'first') return {ok: true, result, index, applied: a.applied ?? [], tried};
    if (!best || lexLess(result.score, best.result.score)) best = {result, index};
  }
  if (!best) return {ok: false, tried, results};
  return {ok: true, result: best.result, index: best.index, applied: attempts[best.index].applied ?? [], tried};
}

/**
 * The message for a figure no attempt fitted: what was tried with its width, what was not tried and why, and one fix.
 *   causeTree(): the figure does not fit 900px.
 *     tried: dir 'up' (as written) 1460px; dir 'right' 1180px
 *     not tried: dir 'right' (dir is explicit; write dir: 'auto' to let it change)
 *     fix: dir: 'auto', or widen the figure (diagram({width: 1100}))
 */
export function fitFailure(who: string, w: number, tried: readonly Tried[], fix: string, notTried: readonly string[] = [], heightBudget?: number, split?: string): string {
  // a figure that fits the width but is too tall is a height failure: say so (ADR 0019 D2)
  const tooTall = heightBudget !== undefined && tried.some(t => t.w <= w + 0.5);
  const lines = [tooTall ? `${who}: the figure does not fit ${Math.round(w)}px wide by ${Math.round(heightBudget)}px tall (every attempt that fits the width is too tall).` : `${who}: the figure does not fit ${Math.round(w)}px.`];
  if (tried.length) lines.push(`  tried: ${tried.map(t => `${t.label} ${t.w}px wide, ${t.h}px tall`).join('; ')}`);
  if (notTried.length) lines.push(`  not tried: ${notTried.join('; ')}`);
  lines.push(`  fix: ${fix}`);
  if (split) lines.push(`  split: ${split}`);
  return lines.join('\n');
}

/** A width to suggest in a fix: the narrowest tried figure, rounded up to the next 20px and plus the margins the caller gives. */
export function widerThan(tried: readonly Tried[], margins = 0): number {
  const least = Math.min(...tried.map(t => t.w));
  return Math.ceil((least + margins) / 20) * 20;
}

/** One phrase for the `auto-fit-applied` rule: what changed and what it did to the width. */
export function describeApplied(a: FitApplied): string {
  const was = a.wasW === undefined ? '' : `(${a.wasW}→${a.nowW ?? '?'}px)`;
  if (a.what === 'fold') return `層 ${a.to} を折り返した${was}`;
  if (a.what === 'maxNodeW') return `maxNodeW を ${a.from}→${a.to} に${Number(a.to) < Number(a.from) ? '縮めた' : '広げた'}${was}`;
  return `dir を ${a.from} から ${a.to} に変えた${was}`;
}

/** What an attempt changed, with the widths filled in: the figure as first tried (`tried[0]`) against the one chosen. */
export function withWidths(applied: readonly FitApplied[], tried: readonly Tried[], index: number): FitApplied[] {
  return applied.map(a => ({...a, wasW: tried[0].w, nowW: tried[index].w}));
}

/** The widths a node may grow to, widest first, when a figure has to be narrowed to fit (ADR 0010 D1). Below the last the text breaks into one or two characters a line. */
export const NARROWING = [200, 160, 130, 110];
/** `maxNodeW: 'auto'` (ADR 0019 D2): widest first, 10px apart. The first that fits the width and the height budget is kept: fewer lines in a node, a shorter figure. */
export const AUTO_GRID = Array.from({length: 17}, (_, i) => 260 - i * 10);

export interface LayoutPlan<D extends string, R extends FitResult> {
  /** `causeTree()`, `stateDiagram()`: the start of the failure message. */
  who: string;
  /** The width the figure has. */
  w: number;
  /** The direction as laid out when nothing changes (the written one, or the default). */
  start: D;
  /** The other axis, tried when the author left `dir` out or wrote 'auto'. None: the axis is kept (a cause tree). */
  alt?: D;
  /** Said when `alt` is none: why. */
  axisKept?: string;
  /** `dir` is written as a direction: nothing is changed. */
  explicitDir: boolean;
  /** How `dir` was not written: left out (a warning) or 'auto' (a note). */
  mode: 'omitted' | 'auto';
  /** The component can fold a layer into rows (ADR 0010 D7; `build` takes the row limit as its third argument). Only a figure whose layers lie across its width. */
  foldable?: boolean;
  /** The author's `fold`: true allows folding also when `dir` is written, false forbids it. */
  fold?: boolean;
  /** A written maxNodeW is not narrowed. */
  maxNodeW?: number;
  /** `maxNodeW: 'auto'` (ADR 0019 D2): the widest node width that fits the width (and the height budget) is looked for, from AUTO_GRID, also when `dir` is written; folding is the last resort. */
  autoWidth?: boolean;
  /** false: the component has no node width to narrow (a class diagram). */
  narrow?: boolean;
  /** true: the figure has no `dir` (a mindmap): the labels leave it out. */
  noDir?: boolean;
  /** The widest a node may grow by default (the first of NARROWING). */
  build: (dir: D, maxW: number, fold?: number) => R;
  widthOf?: (r: R) => number;
  heightBudget?: number;
  /** The layout of a result (a layered figure's `lay`, whose layers lie along the height when `vertical`): the failure message then says where to split the figure. */
  layoutOf?: (r: R) => {lay: LayeredLayout; vertical: boolean};
  /** 'best' (dir: 'auto' with an axis to choose): the best score; otherwise the first that fits. */
  best?: boolean;
  /** More lines for "not tried". */
  notTried?: string[];
  /** The one fix to name when the figure is not given as an explicit dir; default: a wider figure, or splitting it when that is a lot wider. */
  fix?: string;
}

/** The widths a folded figure is cut to, as shares of its width (the first that fits is kept): the settling of the rows between their neighbours can push it wider than one row. */
const FOLD_SHARES = [1, 0.85, 0.7, 0.55];

/**
 * Lays a figure out in the ways ADR 0010 D1 allows and returns the first (or best) that fits `w`, with what was changed to get there.
 * Throws, with what was tried and one fix, when none fits. A figure that fits as written is attempt 0 and changes nothing.
 */
export function fitLayout<D extends string, R extends FitResult>(plan: LayoutPlan<D, R>): {result: R; applied: FitApplied[]} {
  const narrow = plan.narrow !== false;
  const alt = plan.alt !== plan.start ? plan.alt : undefined;
  const free = !plan.explicitDir;
  const dirs: D[] = free && alt !== undefined ? [plan.start, alt] : [plan.start];
  const widths = plan.autoWidth ? AUTO_GRID : narrow && free && plan.maxNodeW === undefined ? NARROWING : [plan.maxNodeW ?? NARROWING[0]];
  const widthMode = plan.autoWidth ? 'auto' as const : plan.mode, from0 = plan.autoWidth ? NARROWING[0] : widths[0]; // what the figure would have had: the default node width
  // keepWords (ADR 0029 D3): every attempt is tried with the floor (no katakana word broken) first; only when none fits, without it. The order keeps what a figure
  // looked like without the option: narrower with the floor, narrower without, then folded with, folded without (a fold is the last resort in both).
  const floors = keepWordsRequested() ? [true, false] : [undefined];
  const suffix = (floor: boolean | undefined): string => floor === false ? ', words may break' : '';
  const run = <T>(floor: boolean | undefined, f: () => T): T => floor === undefined ? f() : withKeepWords(floor, f);
  const narrowing = (floor: boolean | undefined): FitAttempt<R>[] => {
    const list: FitAttempt<R>[] = [];
    for (const mw of widths) for (const d of dirs) {
      const applied: FitApplied[] = [];
      if (d !== plan.start) applied.push({what: 'dir', from: plan.start, to: d, mode: plan.mode});
      if (mw !== from0) applied.push({what: 'maxNodeW', from: from0, to: mw, mode: widthMode});
      const note = list.length || plan.autoWidth ? '' : plan.explicitDir || plan.maxNodeW !== undefined ? ' (as written)' : ' (default)';
      list.push({label: `${plan.noDir ? '' : `dir '${d}'`}${narrow ? `${plan.noDir ? '' : ', '}maxNodeW ${mw}` : ''}${note}${suffix(floor)}`, run: () => run(floor, () => plan.build(d, mw)), applied});
    }
    return list;
  };
  // Folding (ADR 0010 D7), the last attempt: a layer wider than the figure is cut into rows, at the narrowest node width, the axis kept. `fold: true` also when `dir` is written.
  const canFold = plan.foldable === true && plan.fold !== false;
  const folding = (floor: boolean | undefined): FitAttempt<R>[] => {
    const list: FitAttempt<R>[] = [];
    if (canFold && (plan.fold === true || free || plan.autoWidth)) {
      const mw = widths[widths.length - 1], d = plan.start;
      for (const share of FOLD_SHARES) {
        const applied: FitApplied[] = [];
        if (mw !== from0) applied.push({what: 'maxNodeW', from: from0, to: mw, mode: widthMode});
        list.push({label: `dir '${d}', maxNodeW ${mw}, fold${share < 1 ? ` ${Math.round(share * 100)}%` : ''}${suffix(floor)}`, applied, run: () => run(floor, () => {
          const r = plan.build(d, mw, plan.w * share + 0.5);
          for (const f of foldedOf(r)) applied.push({what: 'fold', from: f.rows, to: f.layer + 1, mode: plan.autoWidth ? 'auto' : plan.explicitDir ? 'written' : plan.mode});
          return r;
        })});
      }
    }
    return list;
  };
  // without the option there is one stage (as before); with it, four, each only when the one before found nothing that fits
  const stages: FitAttempt<R>[][] = floors.length === 1 ? [[...narrowing(undefined), ...folding(undefined)]] : [narrowing(true), narrowing(false), folding(true), folding(false)];
  const fitOpts = {mode: plan.best ? 'best' as const : 'first' as const, ...(plan.heightBudget === undefined ? {} : {heightBudget: plan.heightBudget}), ...(plan.widthOf ? {widthOf: plan.widthOf} : {})};
  const allTried: Fitted<R>['tried'] = [], allResults: R[] = [];
  for (const stage of stages.filter(s => s.length)) {
    const got = fitWidth(plan.w, stage, fitOpts);
    if (got.ok) return {result: got.result, applied: withWidths(got.applied, [...allTried, ...got.tried], allTried.length + got.index)};
    allTried.push(...got.tried); allResults.push(...got.results);
  }
  const fitted = {ok: false as const, tried: allTried, results: allResults};
  const notTried: string[] = [];
  if (plan.explicitDir) notTried.push(`${alt !== undefined ? `dir '${alt}'${narrow ? ' and ' : ''}` : ''}${narrow ? 'narrower nodes' : ''} (dir is explicit; write dir: 'auto' to let ${alt !== undefined || narrow ? 'them' : 'it'} change)`);
  else if (narrow && !plan.autoWidth && plan.maxNodeW !== undefined) notTried.push(`narrower nodes (maxNodeW is explicit: ${plan.maxNodeW})`);
  if (!plan.explicitDir && alt === undefined && plan.axisKept) notTried.push(plan.axisKept);
  if (plan.foldable && plan.fold === false) notTried.push('folding a layer into rows (fold is written: false)');
  notTried.push(...(plan.notTried ?? []));
  const tooTall = plan.heightBudget !== undefined && fitted.tried.some(t => t.w <= plan.w + 0.5);
  const wider = widerThan(fitted.tried, 40);
  const fix = tooTall ? 'split the figure in two (fewer entities or fewer layers), or give the canvas more height' : plan.explicitDir ? `dir: 'auto', ${canFold && plan.fold === undefined ? 'or fold: true (a layer wider than the figure is cut into rows, the direction stays), ' : ''}or widen the figure (diagram({width: ${wider}}))` : plan.fix ?? (wider > 1400 ? 'split the figure in two (fewer entities on one level)' : `widen the figure (diagram({width: ${wider}}))`);
  // where to split (ADR 0019 D3): a height failure by the first attempt that fits the width, a width failure by the narrowest one that did not fold
  let split: string | undefined;
  if (plan.layoutOf) {
    const results = fitted.results, lays = results.map(plan.layoutOf);
    if (tooTall) {
      const i = fitted.tried.findIndex(t => t.w <= plan.w + 0.5);
      if (lays[i].vertical && plan.heightBudget !== undefined) split = splitByHeight(lays[i].lay, plan.heightBudget);
    } else {
      const unfolded = results.map((r, i) => ({r, i})).filter(({i}) => !fitted.tried[i].label.includes('fold'));
      const narrowest = unfolded.sort((a, b) => fitted.tried[a.i].w - fitted.tried[b.i].w)[0];
      if (narrowest) split = splitWidest(lays[narrowest.i].lay);
    }
  }
  throw new Error(fitFailure(plan.who, plan.w, fitted.tried, fix, notTried, plan.heightBudget, split));
}
