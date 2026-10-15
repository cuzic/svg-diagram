// fitWidth: try the ways a layered figure can be made to fit its width, in order, and say what was tried when none does (ADR 0010).
// It wraps layeredAttempt (lib/layered-route.ts) and owns no placement or routing: each attempt is a function the caller supplies.
import type {FitApplied} from './types/diagrams.ts';

/** What an attempt has to give back: the part of layeredAttempt's result that fitWidth reads. */
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
  /** The tallest a figure may be (best mode; a canvas height or the slide's `maxDisplayHeight`). None: width only. */
  heightBudget?: number;
  /** The width an attempt takes up when that is not `size.w` (a state diagram's loops hang out beside it). */
  widthOf?: (r: R) => number;
}

export interface Tried {label: string; w: number; h: number}

export type Fitted<R extends FitResult> =
  | {ok: true; result: R; index: number; /** what the chosen attempt changed */ applied: FitApplied[]; tried: Tried[]}
  | {ok: false; tried: Tried[]};

/** Half a pixel of slack, as the layouts themselves allow (`maxAcross: w + 0.5`). */
const SLACK = 0.5;

const lexLess = (a: FitResult['score'], b: FitResult['score']): boolean => a.crossings < b.crossings || (a.crossings === b.crossings && a.bends < b.bends);

/**
 * Runs the attempts in order. `first` stops at the first that fits `w` (the rest are not run); `best` runs them all and keeps the best of
 * those that fit `w` and the height budget. Every attempt that ran is in `tried`, with its width and height, whether or not it was chosen.
 */
export function fitWidth<R extends FitResult>(w: number, attempts: readonly FitAttempt<R>[], opts: FitOpts<R>): Fitted<R> {
  const widthOf = opts.widthOf ?? ((r: R) => r.size.w);
  const tried: Tried[] = [];
  let best: {result: R; index: number} | undefined;
  for (const [index, a] of attempts.entries()) {
    const result = a.run();
    const width = widthOf(result);
    tried.push({label: a.label, w: Math.ceil(width), h: Math.ceil(result.size.h)});
    if (width > w + SLACK) continue;
    if (opts.heightBudget !== undefined && result.size.h > opts.heightBudget + SLACK) continue;
    if (opts.mode === 'first') return {ok: true, result, index, applied: a.applied ?? [], tried};
    if (!best || lexLess(result.score, best.result.score)) best = {result, index};
  }
  if (!best) return {ok: false, tried};
  return {ok: true, result: best.result, index: best.index, applied: attempts[best.index].applied ?? [], tried};
}

/**
 * The message for a figure no attempt fitted: what was tried with its width, what was not tried and why, and one fix.
 *   causeTree(): the figure does not fit 900px.
 *     tried: dir 'up' (as written) 1460px; dir 'right' 1180px
 *     not tried: dir 'right' (dir is explicit; write dir: 'auto' to let it change)
 *     fix: dir: 'auto', or widen the figure (diagram({width: 1100}))
 */
export function fitFailure(who: string, w: number, tried: readonly Tried[], fix: string, notTried: readonly string[] = []): string {
  const lines = [`${who}: the figure does not fit ${Math.round(w)}px.`];
  if (tried.length) lines.push(`  tried: ${tried.map(t => `${t.label} ${t.w}px wide, ${t.h}px tall`).join('; ')}`);
  if (notTried.length) lines.push(`  not tried: ${notTried.join('; ')}`);
  lines.push(`  fix: ${fix}`);
  return lines.join('\n');
}

/** A width to suggest in a fix: the narrowest tried figure, rounded up to the next 20px and plus the margins the caller gives. */
export function widerThan(tried: readonly Tried[], margins = 0): number {
  const least = Math.min(...tried.map(t => t.w));
  return Math.ceil((least + margins) / 20) * 20;
}

/** One line for the `auto-fit-applied` rule: what changed and what it did to the width. */
export function describeApplied(a: FitApplied): string {
  const was = a.wasW === undefined ? '' : ` (${a.wasW}→${a.nowW ?? '?'}px)`;
  if (a.what === 'fold') return `folded layer ${a.to}${was}`;
  return `${a.what} from ${a.from} to ${a.to}${was}`;
}

/** What an attempt changed, with the widths filled in: the figure as first tried (`tried[0]`) against the one chosen. */
export function withWidths(applied: readonly FitApplied[], tried: readonly Tried[], index: number): FitApplied[] {
  return applied.map(a => ({...a, wasW: tried[0].w, nowW: tried[index].w}));
}

/** The widths a node may grow to, widest first, when a figure has to be narrowed to fit (ADR 0010 D1). Below the last the text breaks into one or two characters a line. */
export const NARROWING = [200, 160, 130, 110];

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
  /** A written maxNodeW is not narrowed. */
  maxNodeW?: number;
  /** false: the component has no node width to narrow (a class diagram). */
  narrow?: boolean;
  /** true: the figure has no `dir` (a mindmap): the labels leave it out. */
  noDir?: boolean;
  /** The widest a node may grow by default (the first of NARROWING). */
  build: (dir: D, maxW: number) => R;
  widthOf?: (r: R) => number;
  heightBudget?: number;
  /** 'best' (dir: 'auto' with an axis to choose): the best score; otherwise the first that fits. */
  best?: boolean;
  /** More lines for "not tried". */
  notTried?: string[];
  /** The one fix to name when the figure is not given as an explicit dir; default: a wider figure, or splitting it when that is a lot wider. */
  fix?: string;
}

/**
 * Lays a figure out in the ways ADR 0010 D1 allows and returns the first (or best) that fits `w`, with what was changed to get there.
 * Throws, with what was tried and one fix, when none fits. A figure that fits as written is attempt 0 and changes nothing.
 */
export function fitLayout<D extends string, R extends FitResult>(plan: LayoutPlan<D, R>): {result: R; applied: FitApplied[]} {
  const narrow = plan.narrow !== false;
  const alt = plan.alt !== plan.start ? plan.alt : undefined;
  const free = !plan.explicitDir;
  const dirs: D[] = free && alt !== undefined ? [plan.start, alt] : [plan.start];
  const widths = narrow && free && plan.maxNodeW === undefined ? NARROWING : [plan.maxNodeW ?? NARROWING[0]];
  const attempts: FitAttempt<R>[] = [];
  for (const mw of widths) for (const d of dirs) {
    const applied: FitApplied[] = [];
    if (d !== plan.start) applied.push({what: 'dir', from: plan.start, to: d, mode: plan.mode});
    if (mw !== widths[0]) applied.push({what: 'maxNodeW', from: widths[0], to: mw, mode: plan.mode});
    const note = attempts.length ? '' : plan.explicitDir || plan.maxNodeW !== undefined ? ' (as written)' : ' (default)';
    attempts.push({label: `${plan.noDir ? '' : `dir '${d}'`}${narrow ? `${plan.noDir ? '' : ', '}maxNodeW ${mw}` : ''}${note}`, run: () => plan.build(d, mw), applied});
  }
  const fitted = fitWidth(plan.w, attempts, {mode: plan.best ? 'best' : 'first', ...(plan.heightBudget === undefined ? {} : {heightBudget: plan.heightBudget}), ...(plan.widthOf ? {widthOf: plan.widthOf} : {})});
  if (fitted.ok) return {result: fitted.result, applied: withWidths(fitted.applied, fitted.tried, fitted.index)};
  const notTried: string[] = [];
  if (plan.explicitDir) notTried.push(`${alt !== undefined ? `dir '${alt}'${narrow ? ' and ' : ''}` : ''}${narrow ? 'narrower nodes' : ''} (dir is explicit; write dir: 'auto' to let ${alt !== undefined || narrow ? 'them' : 'it'} change)`);
  else if (narrow && plan.maxNodeW !== undefined) notTried.push(`narrower nodes (maxNodeW is explicit: ${plan.maxNodeW})`);
  if (!plan.explicitDir && alt === undefined && plan.axisKept) notTried.push(plan.axisKept);
  notTried.push(...(plan.notTried ?? []));
  const wider = widerThan(fitted.tried, 40);
  const fix = plan.explicitDir ? `dir: 'auto', or widen the figure (diagram({width: ${wider}}))` : plan.fix ?? (wider > 1400 ? 'split the figure in two (fewer entities on one level)' : `widen the figure (diagram({width: ${wider}}))`);
  throw new Error(fitFailure(plan.who, plan.w, fitted.tried, fix, notTried));
}
