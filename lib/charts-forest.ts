// forest(): a forest plot (ADR 0084). One row per study / group: a square at the estimate (sized by its weight), a line from low to high,
// a dashed reference line (1 = no difference), a log or linear axis, heading rows, a summary diamond, the numbers as a right-hand column
// ("1.54 (1.22–1.95)") and a direction note under the axis ("← favours A | favours B →").
import {axisPart, partStep} from './parts.ts';
import {Canvas, checkDomain, checkIds, checkText, fail, finiteNum, niceScale, numText, thinTicks} from './charts-base.ts';
import type {ChartGeom, ChartOpts, LaidOutChartPart} from './charts-base.ts';
import {must} from './must.ts';

export interface ForestStudy {label: string; estimate: number; low: number; high: number; weight?: number; id?: string; summary?: false}
export interface ForestSummary {label: string; estimate: number; low: number; high: number; summary: true; id?: string}
export interface ForestHeading {heading: string}
export type ForestRow = ForestStudy | ForestSummary | ForestHeading;
export interface ForestOpts extends ChartOpts {
  /** 'log' (default: ratios) or 'linear' (differences). A log scale needs every value above 0. */
  scale?: 'linear' | 'log';
  /** The reference line (default 1, or 0 on a linear scale written without `ref`). */
  ref?: number;
  /** Digits of the numbers in the right-hand column (0 to 3, default 2). */
  decimals?: number;
  /** false: no right-hand column of numbers. */
  values?: boolean;
  /** Heading of the right-hand column. */
  valueHeader?: string;
  /** The axis's title under the ticks. */
  axisLabel?: string;
  /** The direction note under the axis: `[left of the reference line, right of it]`. */
  favours?: readonly [left: string, right: string];
  /** The axis's end points `[lo, hi]` (widened to round ticks), so that several figures share one axis. An estimate or the reference line outside it is an error; the end of an interval outside it is cut with an arrowhead. */
  domain?: readonly [number, number];
}
export interface ForestSpec {rows: ForestRow[]; scale: 'linear' | 'log'; ref: number; decimals: number; values: boolean; valueHeader: string; axisLabel: string; favours?: [string, string]; domain?: [number, number]}

export const FOREST_MAX_ROWS = 40;
const isHeading = (r: ForestRow): r is ForestHeading => 'heading' in r;
type Measured = ForestStudy | ForestSummary;
const measured = (rows: readonly ForestRow[]): Measured[] => rows.filter((r): r is Measured => !isHeading(r));

export function resolveForest(rows: readonly ForestRow[], opts: ForestOpts = {}): ForestSpec {
  if (!Array.isArray(rows) || rows.length === 0) fail('forest', 'needs at least one row');
  if (rows.length > FOREST_MAX_ROWS) fail('forest', `${rows.length} rows are too many for one figure (at most ${FOREST_MAX_ROWS}: split it into several figures)`);
  const scale = opts.scale ?? 'log';
  if (scale !== 'log' && scale !== 'linear') fail('forest', `scale must be 'log' or 'linear' (got ${JSON.stringify(scale)})`);
  const ref = finiteNum('forest', 'ref', opts.ref ?? (scale === 'log' ? 1 : 0));
  const logHint = "a log scale needs values above 0 (for differences write scale: 'linear', ref: 0)";
  if (scale === 'log' && ref <= 0) fail('forest', `ref ${ref} is 0 or less; ${logHint}`);
  const decimals = opts.decimals ?? 2;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 3) fail('forest', `decimals must be a whole number from 0 to 3 (got ${String(decimals)})`);
  const domain = checkDomain('forest', opts.domain);
  if (domain && scale === 'log' && domain[0] <= 0) fail('forest', `domain [${domain[0]}, ${domain[1]}] has a value of 0 or less; ${logHint}`);
  const list = rows.map((r, k): ForestRow => {
    if (r === null || typeof r !== 'object') fail('forest', `row ${k + 1} must be an object`);
    if ('heading' in r) {
      const extra = Object.keys(r).filter(key => key !== 'heading');
      if (extra.length) fail('forest', `row ${k + 1} is a heading row: it holds only "heading" (remove ${extra.map(e => `"${e}"`).join(', ')}, or make it a study row with "label")`);
      return {heading: checkText('forest', `row ${k + 1}'s heading`, r.heading)};
    }
    const label = checkText('forest', `row ${k + 1}'s label`, r.label), at = `"${label}"`;
    const e = finiteNum('forest', `${at} estimate`, r.estimate), lo = finiteNum('forest', `${at} low`, r.low), hi = finiteNum('forest', `${at} high`, r.high);
    if (!(lo <= e && e <= hi)) fail('forest', `${at}: low ${lo} <= estimate ${e} <= high ${hi} does not hold (swap low and high, or fix the estimate)`);
    if (scale === 'log' && lo <= 0) fail('forest', `${at}: low ${lo} is 0 or less; ${logHint}`);
    if (r.summary !== undefined && typeof r.summary !== 'boolean') fail('forest', `${at}: summary must be true`);
    const base = {label, estimate: e, low: lo, high: hi, ...(r.id === undefined ? {} : {id: r.id})};
    if (r.summary === true) {
      if ((r as {weight?: unknown}).weight !== undefined) fail('forest', `${at} is a summary row: it has no weight (remove weight)`);
      return {...base, summary: true};
    }
    if (r.weight === undefined) return base;
    const weight = finiteNum('forest', `${at} weight`, r.weight);
    if (weight <= 0) fail('forest', `${at} weight must be above 0 (got ${weight})`);
    return {...base, weight};
  });
  checkIds('forest', list.map(r => isHeading(r) ? undefined : r.id), opts.id);
  if (!measured(list).length) fail('forest', 'needs at least one row with an estimate (every row is a heading)');
  if (opts.favours !== undefined) {
    if (!Array.isArray(opts.favours) || opts.favours.length !== 2) fail('forest', 'favours must be [left, right], two texts');
    checkText('forest', 'favours[0]', opts.favours[0]); checkText('forest', 'favours[1]', opts.favours[1]);
  }
  const spec: ForestSpec = {rows: list, scale, ref, decimals, values: opts.values !== false, valueHeader: opts.valueHeader ?? '', axisLabel: opts.axisLabel ?? '', ...(opts.favours ? {favours: [opts.favours[0], opts.favours[1]] as [string, string]} : {}), ...(domain ? {domain} : {})};
  const sc = forestScale(spec);
  for (const r of measured(list)) if (r.estimate < sc.min - sc.eps(r.estimate) || r.estimate > sc.max + sc.eps(r.estimate)) fail('forest', `"${r.label}": estimate ${r.estimate} is outside the axis [${numText(sc.min)}, ${numText(sc.max)}] (widen domain; only the ends of an interval may be cut)`);
  if (ref < sc.min - sc.eps(ref) || ref > sc.max + sc.eps(ref)) fail('forest', `ref ${ref} is outside the axis [${numText(sc.min)}, ${numText(sc.max)}] (widen domain)`);
  return spec;
}

export interface ForestScale {min: number; max: number; ticks: number[]; pos: (v: number) => number; eps: (v: number) => number}
/** The axis: a linear one is niceScale's; a log one has ref × 2^k ticks when the data (and ref) span at most 16×, else 1-2-5 per decade. */
export function forestScale(s: ForestSpec): ForestScale {
  const data = measured(s.rows).flatMap(r => [r.low, r.high]);
  const lo = s.domain ? s.domain[0] : Math.min(s.ref, ...data), hi = s.domain ? s.domain[1] : Math.max(s.ref, ...data);
  if (s.scale === 'linear') { const n = niceScale(lo, hi); return {...n, pos: v => (v - n.min) / (n.max - n.min), eps: () => 1e-9}; }
  let ticks: number[];
  if (hi / lo <= 16.0001) {
    const kLo = Math.floor(Math.log2(lo / s.ref) + 1e-9), kHi = Math.ceil(Math.log2(hi / s.ref) - 1e-9);
    ticks = [];
    for (let k = kLo; k <= kHi; k++) ticks.push(parseFloat((s.ref * 2 ** k).toPrecision(12)));
  } else {
    const all: number[] = [];
    for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)) + 1; e++) for (const m of [1, 2, 5]) all.push(parseFloat((m * 10 ** e).toPrecision(12)));
    const a = all.filter(v => v <= lo * (1 + 1e-9)).pop() ?? lo, b = all.find(v => v >= hi * (1 - 1e-9)) ?? hi;
    ticks = all.filter(v => v >= a * (1 - 1e-9) && v <= b * (1 + 1e-9));
  }
  if (ticks.length < 2) { const t = must(ticks[0]); ticks = [t / 2, t, t * 2]; }
  const min = must(ticks[0]), max = must(ticks[ticks.length - 1]);
  return {min, max, ticks, pos: v => (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)), eps: v => Math.abs(v) * 1e-9};
}

const MINUS = '−';
const fixed = (v: number, d: number): string => { const t = v.toFixed(d); return /^-0(\.0+)?$/.test(t) ? t.slice(1) : t.replace('-', MINUS); };
/** "1.54 (1.22–1.95)"; with a negative number "−4.2 (−7.9, −0.5)" (a dash between two negatives cannot be read). */
export function forestValueText(s: Pick<ForestSpec, 'decimals'>, r: {estimate: number; low: number; high: number}): string {
  const e = fixed(r.estimate, s.decimals), lo = fixed(r.low, s.decimals), hi = fixed(r.high, s.decimals);
  return `${e} (${lo}${[e, lo, hi].some(t => t.startsWith(MINUS)) ? ', ' : '–'}${hi})`;
}
const tickText = (v: number) => numText(parseFloat(v.toPrecision(3)));
/** The side of a study's square: 8 to 18px by the square root of its weight (10px without one). */
export function forestSquare(weight: number | undefined, maxWeight: number): number {
  return weight === undefined ? 10 : 8 + 10 * Math.sqrt(weight / maxWeight);
}

export function forestAlt(s: ForestSpec): string {
  return `フォレストプロット（基準 ${numText(s.ref)}）: ${s.rows.map(r => isHeading(r) ? `【${r.heading}】` : `${r.label} ${forestValueText(s, r)}`).join('、')}`;
}
export function forestTexts(s: ForestSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const r of s.rows) if (isHeading(r)) out.push([r.heading, 700]); else { out.push([r.label, r.summary ? 700 : 400]); if (s.values) out.push([forestValueText(s, r), r.summary ? 700 : 400]); }
  for (const t of forestScale(s).ticks) out.push([tickText(t), 400]);
  if (s.valueHeader) out.push([s.valueHeader, 700]);
  if (s.axisLabel) out.push([s.axisLabel, 400]);
  if (s.favours) out.push([`← ${s.favours[0]}`, 400], [`${s.favours[1]} →`, 400]);
  return out;
}

export function layoutForest(s: ForestSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap);
  const sc = forestScale(s), rows = s.rows, studies = measured(rows);
  const hasHeading = rows.some(isHeading), indent = hasHeading ? 12 : 0;
  const bold = (r: ForestRow) => isHeading(r) || r.summary === true;
  const labelOf = (r: ForestRow) => isHeading(r) ? r.heading : r.label;
  const labelW = Math.min(Math.max(...rows.map(r => c.tw(labelOf(r), bold(r)) + (isHeading(r) ? 0 : indent))) + 12, g.w * 0.34);
  const valW = s.values ? Math.max(s.valueHeader ? c.tw(s.valueHeader, true) : 0, ...studies.map(r => c.tw(forestValueText(s, r), r.summary === true))) + 16 : 0;
  const plotL = g.x + labelW + 8, plotR = g.x + g.w - valW - 12;
  if (plotR - plotL < 160) fail('forest', 'the figure is too narrow for its labels and numbers (raise width, or shorten the labels)');
  const xOf = (v: number) => plotL + Math.min(1, Math.max(0, sc.pos(v))) * (plotR - plotL);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const xr = r1(xOf(s.ref));
  if (s.favours) {
    const need = (t: string) => c.tw(t) + 8;
    if (need(`← ${s.favours[0]}`) > xr - g.x) fail('forest', `the note "← ${s.favours[0]}" is wider than the room left of the reference line (shorten favours, or raise width)`);
    if (need(`${s.favours[1]} →`) > g.x + g.w - xr) fail('forest', `the note "${s.favours[1]} →" is wider than the room right of the reference line (shorten favours, or raise width)`);
  }
  const lineH = c.lineH(), pitch = Math.max(S + 12, 26), headH = s.valueHeader ? pitch : 6;
  const wrapped = rows.map(r => c.wrap(labelOf(r), labelW - 12 - (isHeading(r) ? 0 : indent), bold(r)));
  const rowH = wrapped.map(l => Math.max(pitch, l.length * lineH + 8));
  const y0 = g.y + headH, bodyH = rowH.reduce((a, b) => a + b, 0), bodyB = y0 + bodyH + 6;
  const axisH = S + 14 + (s.axisLabel ? S + 8 : 0) + (s.favours ? S + 10 : 0);
  const need = headH + bodyH + 6 + axisH + 4;
  if (g.height !== undefined && g.height < need) fail('forest', `height ${g.height} is too small for ${rows.length} rows (need at least ${need})`);
  c.h = g.height ?? Math.max(160, need);
  if (s.valueHeader) c.text(s.valueHeader, g.x + g.w, g.y + S, 'end', 'text', {bold: true});
  // axis
  const tk = sc.ticks.map(v => ({v})), shown = thinTicks(tk, xOf, t => c.tw(tickText(t.v)), 12);
  c.withPart(axisPart('x'), () => {
    c.line(plotL, bodyB, plotR, bodyB, {stroke: 'muted'});
    for (const t of tk) { c.line(xOf(t.v), bodyB, xOf(t.v), bodyB + 5, {stroke: 'muted'}); if (shown.has(t)) c.text(tickText(t.v), xOf(t.v), bodyB + S + 8, 'middle', 'muted'); }
    if (s.axisLabel) c.text(s.axisLabel, (plotL + plotR) / 2, bodyB + 2 * S + 16, 'middle', 'muted');
  });
  c.withPart(partStep('ref', 0, 'ref'), () => c.line(xr, y0 - 4, xr, bodyB, {stroke: 'text', sw: 1.5, dash: '4 3'}));
  const weights = studies.flatMap(r => r.summary === true || r.weight === undefined ? [] : [r.weight]), wMax = weights.length ? Math.max(...weights) : 1;
  const notes: NonNullable<LaidOutChartPart['notes']> = [];
  const plain = studies.filter(r => r.summary !== true), weighted = plain.filter(r => r.weight !== undefined);
  if (weighted.length > 0 && weighted.length < plain.length) notes.push({rule: 'forest-weight-partial', message: `forest(): ${weighted.length} of ${plain.length} rows have a weight; the others are drawn with a 10px square (give every row a weight, or none)`});
  const clipped: string[] = [];
  let y = y0;
  rows.forEach((r, k) => {
    const rh = must(rowH[k]), cy = y + rh / 2, lines = must(wrapped[k]), base = cy - (lines.length - 1) * lineH / 2 + S * 0.36;
    y += rh;
    if (isHeading(r)) { c.lines(lines, g.x, base, 'start', 'text', {bold: true}); return; }
    const of = r.id ?? `#${k}`, summary = r.summary === true;
    c.withPart(partStep('row', r.id ?? k, r.label), () => {
      c.lines(lines, g.x + indent, base, 'start', 'text', {bold: summary, of});
      const xl = r1(xOf(r.low)), xh = r1(xOf(r.high)), xe = r1(xOf(r.estimate));
      const cutL = sc.pos(r.low) < -1e-9, cutH = sc.pos(r.high) > 1 + 1e-9;
      if (cutL || cutH) clipped.push(r.label);
      let side: number;
      if (summary) {
        side = Math.min(18, pitch - 6);
        const hh = side / 2;
        c.path(`M${xl} ${r1(cy)} L${xe} ${r1(cy - hh)} L${xh} ${r1(cy)} L${xe} ${r1(cy + hh)} Z`, {fill: 'accent', of});
      } else {
        c.line(xl, r1(cy), xh, r1(cy), {stroke: 'text', sw: 1.5, of});
        if (cutL) c.path(`M${xl} ${r1(cy)} L${r1(xl + 6)} ${r1(cy - 4)} L${r1(xl + 6)} ${r1(cy + 4)} Z`, {fill: 'text', of});
        if (cutH) c.path(`M${xh} ${r1(cy)} L${r1(xh - 6)} ${r1(cy - 4)} L${r1(xh - 6)} ${r1(cy + 4)} Z`, {fill: 'text', of});
        side = forestSquare((r as ForestStudy).weight, wMax);
        c.rect(r1(xe - side / 2), r1(cy - side / 2), r1(side), r1(side), {fill: 'accent', solid: r.label, of});
      }
      if (s.values) c.text(forestValueText(s, r), g.x + g.w, c.mid(cy), 'end', 'text', {bold: summary, of});
      if (r.id) { const x1 = Math.min(xl, xe - side / 2), x2 = Math.max(xh, xe + side / 2); c.anchors.push({id: r.id, x: r1(x1), y: r1(cy - Math.max(side, 12) / 2), w: r1(x2 - x1), h: r1(Math.max(side, 12))}); }
    });
  });
  const summaries = studies.filter(r => r.summary === true);
  if (summaries.length === 1) c.withPart(partStep('ref', 1, 'summary'), () => c.line(r1(xOf(must(summaries[0]).estimate)), y0 - 4, r1(xOf(must(summaries[0]).estimate)), bodyB, {stroke: 'accent', sw: 1, dash: '2 3', soft: true}));
  if (s.favours) {
    const fy = bodyB + S + 14 + (s.axisLabel ? S + 8 : 0) + S;
    c.text(`← ${s.favours[0]}`, xr - 8, fy, 'end', 'muted');
    c.text(`${s.favours[1]} →`, xr + 8, fy, 'start', 'muted');
  }
  if (clipped.length) notes.push({rule: 'forest-clipped', message: `forest(): ${clipped.map(l => `"${l}"`).join(', ')}: the interval runs past the axis, so it is cut at the end with an arrowhead (widen domain to show all of it)`});
  return {...c.done(), notes};
}
