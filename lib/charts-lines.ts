// lines(): a multi-series line chart worked out into a plane() — the plane already has axes, ticks, paths, markers and labels, this is the
// ergonomic layer on it: categories or numbers on x, a marker shape and a line style of its own per series (colour comes second), the
// series named at the end of its line instead of in a legend, an optional target / ideal line, annotated points. Presets for the
// usual consulting charts follow (strategyCanvas, burndown, burnup).
import {niceScale, fail, finiteNum, checkText, numText} from './charts-base.ts';
import type {PlaneBand, PlaneOpts, PlanePoint, PlanePath, PlaneTone, PlaneLine, PlaneLabel} from './types.ts';
import type {ChartOpts} from './charts-base.ts';
import {ROLES} from './tokens.ts';

import {must} from './must.ts';
export interface LineSeries {
  label: string;
  /** One value per category (null: a gap), or [x, y] pairs for a numeric x axis. */
  values: readonly (number | null)[] | readonly (readonly [number, number])[];
  /** Draw it as the ideal / plan line: dashed, muted, no markers. */
  ideal?: boolean;
  /** Draw a smooth curve through the points (never overshoots them while x increases). */
  smooth?: boolean;
}
export interface LinesAxis {label?: string; min?: number; max?: number; step?: number; ticks?: (number | {at: number; label: string})[]}
export interface LinesAnnotation {
  /** A position in the axes' units ([category index, y] on a category axis), or a series and the index of a point of it. */
  at: readonly [number, number] | {series: string; index: number};
  label: string;
  tone?: PlaneTone;
  labelAt?: PlanePoint['labelAt'];
}
export interface LinesOpts extends Omit<ChartOpts, 'width' | 'alt'> {
  /** x: category names (`categories`), or a numeric axis. */
  x?: LinesAxis & {categories?: readonly string[]};
  y?: LinesAxis;
  /** A horizontal target line at this y value. */
  target?: {at: number; label?: string};
  annotate?: readonly LinesAnnotation[];
  /** Markers on every point (default true). */
  markers?: boolean;
  /** Name each series at the right end of its line (default true; false: no names — the series then cannot be told apart). */
  endLabels?: boolean;
  grid?: boolean;
  width?: number;
}

/** How the n-th series is drawn: a line style, a marker shape and a colour of its own. */
const STYLE: {tone: PlaneTone; dashed: boolean; shape: NonNullable<PlanePoint['shape']>}[] = [
  {tone: 'accent', dashed: false, shape: 'disc'},
  {tone: 'text', dashed: true, shape: 'square'},
  {tone: 'danger', dashed: false, shape: 'diamond'},
  {tone: 'muted', dashed: true, shape: 'triangle'},
  {tone: 'accent', dashed: true, shape: 'hole'},
  {tone: 'text', dashed: false, shape: 'cross'},
];

export function linesOpts(series: readonly LineSeries[], opts: LinesOpts = {}): PlaneOpts {
  const who = 'lines';
  if (!Array.isArray(series) || series.length === 0) fail(who, 'needs at least one series');
  if (series.filter(s => !s.ideal).length > 6) fail(who, `${series.filter(s => !s.ideal).length} series are too many to tell apart (at most 6, besides ideal lines)`);
  const cats = opts.x?.categories;
  if (cats !== undefined && (!Array.isArray(cats) || cats.length < 2)) fail(who, 'x.categories needs at least two names');
  cats?.forEach((c, i) => checkText(who, `category ${i + 1}`, c));
  const labels = series.map((s, i) => checkText(who, `series ${i + 1}'s label`, s.label));
  if (new Set(labels).size !== labels.length) fail(who, 'each series needs its own label');
  // every series as [x, y] points, in axis units
  const pts: ([number, number] | null)[][] = series.map(s => {
    if (!Array.isArray(s.values) || s.values.length === 0) fail(who, `series "${s.label}" has no values`);
    return (s.values as readonly unknown[]).map((v, i) => {
      if (v === null) { if (!cats) fail(who, `series "${s.label}": null (a gap) needs x.categories`); return null; }
      if (Array.isArray(v)) {
        if (cats) fail(who, `series "${s.label}": [x, y] pairs belong to a numeric x axis; with x.categories give one value per category`);
        return [finiteNum(who, `"${s.label}" x`, v[0]), finiteNum(who, `"${s.label}" y`, v[1])] as [number, number];
      }
      if (!cats) fail(who, `series "${s.label}": give [x, y] pairs, or x.categories to give one value per category`);
      return [i, finiteNum(who, `"${s.label}" value ${i + 1}`, v)] as [number, number];
    });
  });
  if (cats) for (const [k, p] of pts.entries()) if (p.length !== cats.length) fail(who, `series "${must(series[k]).label}" has ${p.length} values for ${cats.length} categories (use null for a gap)`);
  if (!cats) for (const [k, p] of pts.entries()) { const xs = p.map(q => must(q)[0]); if (xs.some((x, i) => i > 0 && x <= must(xs[i - 1]))) fail(who, `series "${must(series[k]).label}": x must increase along the series`); }
  const real = pts.flat().filter((q): q is [number, number] => q !== null);
  if (!real.length) fail(who, 'every value is null');
  // axes
  const xs = real.map(q => q[0]), ys = real.map(q => q[1]).concat(opts.target ? [opts.target.at] : []);
  let x: PlaneOpts['x'];
  if (cats) x = {label: opts.x?.label, min: -0.5, max: cats.length - 0.5, ticks: cats.map((c, i) => ({at: i, label: c}))};
  else {
    const sc = niceScale(opts.x?.min ?? Math.min(...xs), opts.x?.max ?? Math.max(...xs), 6);
    x = {label: opts.x?.label, min: opts.x?.min ?? sc.min, max: opts.x?.max ?? sc.max, ...(opts.x?.step !== undefined ? {step: opts.x.step} : opts.x?.ticks ? {} : {step: sc.step}), ...(opts.x?.ticks ? {ticks: opts.x.ticks} : {})};
  }
  const ysc = niceScale(opts.y?.min ?? Math.min(0, ...ys), opts.y?.max ?? Math.max(...ys), 5);
  const y: PlaneOpts['y'] = {label: opts.y?.label, min: opts.y?.min ?? ysc.min, max: opts.y?.max ?? ysc.max, ...(opts.y?.step !== undefined ? {step: opts.y.step} : opts.y?.ticks ? {} : {step: ysc.step}), ...(opts.y?.ticks ? {ticks: opts.y.ticks} : {})};
  for (const q of real) {
    if (q[1] < (y.min ?? 0) || q[1] > y.max) fail(who, `a value (${numText(q[1])}) is outside the y axis ${y.min ?? 0}-${y.max}`);
    if (q[0] < (x.min ?? 0) || q[0] > x.max) fail(who, `an x (${numText(q[0])}) is outside the x axis ${x.min ?? 0}-${x.max}`);
  }
  if (opts.x?.label === undefined) delete x.label;
  if (opts.y?.label === undefined) delete y.label;
  const points: PlanePoint[] = [], paths: PlanePath[] = [];
  const named = opts.endLabels !== false, mark = opts.markers !== false;
  series.forEach((s, k) => {
    const st = STYLE[series.slice(0, k).filter(o => !o.ideal).length], tone: PlaneTone = s.ideal ? 'muted' : must(st).tone, dashed = s.ideal ? true : must(st).dashed;
    // runs of consecutive points (a gap breaks the line)
    const runs: [number, number][][] = [];
    let run: [number, number][] = [];
    for (const q of must(pts[k])) { if (q) run.push(q); else { if (run.length) runs.push(run); run = []; } }
    if (run.length) runs.push(run);
    for (const r of runs) if (r.length >= 2) paths.push({through: r, tone, dashed, ...(s.smooth ? {smooth: true} : {})});
    const lastRun = must(runs[runs.length - 1]), end = lastRun[lastRun.length - 1];
    for (const r of runs) for (const q of r) {
      const isEnd = q === end;
      if (s.ideal && !isEnd) continue;
      if (!mark && !isEnd) continue;
      points.push({at: q, tone, shape: s.ideal ? 'ring' : must(st).shape, ...(isEnd && named && !s.ideal ? {label: s.label, labelAt: cats && q[0] !== cats.length - 1 ? 'auto' as const : 'right' as const, ...(cats && q[0] !== cats.length - 1 ? {labelLeader: true} : {})} : {})});
    }
  });
  // an ideal / plan line is named beside the middle of its run (above it when it falls, below it when it climbs), where nothing else is
  const midLabels: PlaneLabel[] = [];
  if (named) series.forEach((s, k) => {
    if (!s.ideal) return;
    const q = must(pts[k]).filter((v): v is [number, number] => v !== null), a = must(q[0]), b = must(q[q.length - 1]);
    midLabels.push({at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], text: s.label, anchor: 'start', tone: 'muted', bold: true, offset: b[1] >= a[1] ? [10, 24] : [10, -12]});
  });
  const find = (name: string, index: number): [number, number] => {
    const k = labels.indexOf(name);
    if (k < 0) fail(who, `annotate: no series "${name}" (series: ${labels.join(', ')})`);
    const q = must(pts[k])[index];
    if (!q) fail(who, `annotate: series "${name}" has no point ${index}`);
    return q as [number, number];
  };
  for (const a of opts.annotate ?? []) {
    checkText(who, 'an annotation label', a.label);
    const at = Array.isArray(a.at) ? a.at as [number, number] : find((a.at as {series: string}).series, (a.at as {index: number}).index);
    points.push({at, tone: a.tone ?? 'danger', shape: 'ring', label: a.label, labelAt: a.labelAt ?? 'above'});
  }
  const lines: PlaneLine[] = [], extra: PlaneLabel[] = [...midLabels];
  if (opts.target) {
    finiteNum(who, 'target.at', opts.target.at);
    lines.push({from: [x.min ?? 0, opts.target.at], to: [x.max, opts.target.at], tone: 'danger', dashed: true});
    // above the line, clear of it: a plane label's box reaches 6px under its baseline and the line's ink 2px over it
    const size = ROLES[opts.labelRole ?? 'note'], lift = Math.round(size * 5 / 14) + 9;
    if (opts.target.label) extra.push({at: [x.max, opts.target.at], text: opts.target.label, anchor: 'end', tone: 'danger', bold: true, offset: [-6, -lift]});
  }
  return {x, y, points, paths, ...(lines.length ? {lines} : {}), ...(extra.length ? {labels: extra} : {}), grid: opts.grid !== false, height: opts.height ?? 340, endLabels: named,
    ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}),
    ...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until})};
}
export type {PlaneBand};

export interface StrategyCanvasOpts extends LinesOpts {
  /** The scale of the levels (default 0-5). */
  levels?: {min?: number; max?: number; low?: string; high?: string};
}
/**
 * A strategy canvas (戦略キャンバス): the factors of competition along x, the level each company offers on each (low to high) on y; one line
 * per company. Series are given as {label, values: [one level per factor]}.
 */
export function strategyCanvasOpts(factors: readonly string[], series: readonly {label: string; values: readonly number[]}[], opts: StrategyCanvasOpts = {}): [LineSeries[], LinesOpts] {
  const lv = opts.levels ?? {}, min = lv.min ?? 0, max = lv.max ?? 5;
  const {levels: _l, ...rest} = opts;
  return [series.map(s => ({label: s.label, values: s.values})), {...rest, x: {categories: factors, ...opts.x}, y: {min, max, ticks: [{at: min, label: lv.low ?? '低い'}, {at: max, label: lv.high ?? '高い'}], label: '提供価値の水準', ...opts.y}}];
}
export interface BurndownSpec {
  /** The work at the start (story points, hours, tickets). */
  total: number;
  /** The length of the period, in days (or whatever the x axis counts). */
  days: number;
  /** The work left at the end of each day, from day 0 (the start): `null` for days not yet reached. */
  actual: readonly (number | null)[];
}
/** A burndown chart (バーンダウン): the work left against the days, with the ideal straight line from the total to 0. */
export function burndownOpts(spec: BurndownSpec, opts: LinesOpts = {}): [LineSeries[], LinesOpts] {
  if (!(spec.days >= 1) || !Number.isInteger(spec.days)) fail('burndown', `days must be a whole number >= 1 (got ${spec.days})`);
  finiteNum('burndown', 'total', spec.total, {min: 0});
  if (spec.actual.length > spec.days + 1) fail('burndown', `actual has ${spec.actual.length} values for days 0-${spec.days}`);
  const actual: [number, number][] = [];
  spec.actual.forEach((v, i) => { if (v !== null) actual.push([i, finiteNum('burndown', `actual[${i}]`, v, {min: 0})]); });
  return [[{label: '理想', values: [[0, spec.total], [spec.days, 0]], ideal: true}, {label: '実績', values: actual}], {...opts, x: {min: 0, max: spec.days, step: spec.days > 14 ? undefined : 1, label: '日', ...opts.x}, y: {min: 0, max: opts.y?.max ?? niceScale(0, Math.max(spec.total, ...actual.map(q => q[1])), 5).max, label: '残り', ...opts.y}}];
}
export interface BurnupSpec {
  /** The scope: one number (it never changes), or the scope at the end of each day (it may grow). */
  scope: number | readonly number[];
  days: number;
  /** The work done at the end of each day, from day 0. */
  done: readonly (number | null)[];
}
/** A burnup chart (バーンアップ): the work done climbing towards the scope line (which may move). */
export function burnupOpts(spec: BurnupSpec, opts: LinesOpts = {}): [LineSeries[], LinesOpts] {
  if (!(spec.days >= 1) || !Number.isInteger(spec.days)) fail('burnup', `days must be a whole number >= 1 (got ${spec.days})`);
  const scope: [number, number][] = typeof spec.scope === 'number' ? [[0, spec.scope], [spec.days, spec.scope]] : spec.scope.map((v, i) => [i, finiteNum('burnup', `scope[${i}]`, v, {min: 0})] as [number, number]);
  if (scope.length < 2) fail('burnup', 'scope needs a value for each day (at least days 0 and 1), or one number');
  const done: [number, number][] = [];
  spec.done.forEach((v, i) => { if (v !== null) done.push([i, finiteNum('burnup', `done[${i}]`, v, {min: 0})]); });
  const top = Math.max(...scope.map(q => q[1]), ...done.map(q => q[1]));
  return [[{label: 'スコープ', values: scope, ideal: true}, {label: '完了', values: done}], {...opts, x: {min: 0, max: spec.days, step: spec.days > 14 ? undefined : 1, label: '日', ...opts.x}, y: {min: 0, max: opts.y?.max ?? niceScale(0, top, 5).max, label: '完了', ...opts.y}}];
}
