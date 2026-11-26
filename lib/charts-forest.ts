// SPIKE (not for merge): forest(): a forest plot. One row per study / group: a square at the estimate (sized by weight), a line from
// low to high, a vertical reference line (1 = no difference), optional log scale, heading rows, a summary diamond, the numbers as a
// right-hand column ("1.54 (1.22–1.95)") and a direction note under the axis ("← favours A | favours B →").
import {axisPart, partStep} from './parts.ts';
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText, thinTicks} from './charts-base.ts';
import type {ChartGeom, ChartOpts, LaidOutChartPart} from './charts-base.ts';
import {must} from './must.ts';

export type ForestRow =
  | {label: string; estimate: number; low: number; high: number; weight?: number; id?: string; summary?: boolean}
  | {heading: string};
export interface ForestOpts extends ChartOpts {
  ref?: number;
  scale?: 'linear' | 'log';
  decimals?: number;
  /** Heading of the numeric column (default none). */
  valueHeader?: string;
  /** Axis title under the ticks. */
  axisLabel?: string;
  favours?: readonly [left: string, right: string];
  /** false: no numeric column. */
  values?: boolean;
}
export interface ForestSpec {rows: ForestRow[]; ref: number; scale: 'linear' | 'log'; decimals: number; valueHeader: string; axisLabel: string; favours?: [string, string]; values: boolean}

const isHeading = (r: ForestRow): r is {heading: string} => 'heading' in r;

export function resolveForest(rows: readonly ForestRow[], opts: ForestOpts = {}): ForestSpec {
  if (!Array.isArray(rows) || rows.length === 0) fail('forest', 'needs at least one row');
  const scale = opts.scale ?? 'linear';
  const ref = opts.ref ?? (scale === 'log' ? 1 : 0);
  checkIds('forest', rows.map(r => isHeading(r) ? undefined : r.id), opts.id);
  const list = rows.map((r, k): ForestRow => {
    if (isHeading(r)) return {heading: checkText('forest', `row ${k + 1}'s heading`, r.heading)};
    const e = finiteNum('forest', `"${r.label}" estimate`, r.estimate), lo = finiteNum('forest', `"${r.label}" low`, r.low), hi = finiteNum('forest', `"${r.label}" high`, r.high);
    if (!(lo <= e && e <= hi)) fail('forest', `"${r.label}": low ${lo} <= estimate ${e} <= high ${hi} does not hold (swap low and high, or fix the estimate)`);
    if (scale === 'log' && lo <= 0) fail('forest', `"${r.label}": low ${lo} is 0 or less; a log scale needs values above 0 (use scale: 'linear' for differences)`);
    return {...r, label: checkText('forest', `row ${k + 1}'s label`, r.label)};
  });
  return {rows: list, ref, scale, decimals: opts.decimals ?? 2, valueHeader: opts.valueHeader ?? '', axisLabel: opts.axisLabel ?? '', ...(opts.favours ? {favours: [opts.favours[0], opts.favours[1]]} : {}), values: opts.values !== false};
}

/** Log ticks: ref × 2^k when the data spans at most 16×, else 1-2-5 per decade. */
export function forestScale(s: ForestSpec): {min: number; max: number; ticks: number[]; pos: (v: number) => number} {
  const data = s.rows.flatMap(r => isHeading(r) ? [] : [r.low, r.high]);
  const lo = Math.min(s.ref, ...data), hi = Math.max(s.ref, ...data);
  if (s.scale === 'linear') { const n = niceScale(lo, hi); return {...n, pos: v => (v - n.min) / (n.max - n.min)}; }
  let ticks: number[];
  if (hi / lo <= 16.0001) {
    const kLo = Math.floor(Math.log2(lo / s.ref) + 1e-9), kHi = Math.ceil(Math.log2(hi / s.ref) - 1e-9);
    ticks = []; for (let k = kLo; k <= kHi; k++) ticks.push(s.ref * 2 ** k);
  } else {
    const all: number[] = [];
    for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)) + 1; e++) for (const m of [1, 2, 5]) all.push(m * 10 ** e);
    const a = all.filter(v => v <= lo + 1e-12).pop() ?? lo, b = all.find(v => v >= hi - 1e-12) ?? hi;
    ticks = all.filter(v => v >= a - 1e-12 && v <= b + 1e-12);
  }
  const min = must(ticks[0]), max = must(ticks[ticks.length - 1]);
  return {min, max, ticks, pos: v => (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))};
}

const valueText = (s: ForestSpec, r: {estimate: number; low: number; high: number}) => `${r.estimate.toFixed(s.decimals)} (${r.low.toFixed(s.decimals)}–${r.high.toFixed(s.decimals)})`;
const tickText = (v: number) => numText(parseFloat(v.toPrecision(3)));

export function forestAlt(s: ForestSpec): string {
  return `フォレストプロット（基準 ${numText(s.ref)}）: ${s.rows.map(r => isHeading(r) ? `【${r.heading}】` : `${r.label} ${valueText(s, r)}`).join('、')}`;
}
export function forestTexts(s: ForestSpec): [string, number][] {
  const out: [string, number][] = [];
  for (const r of s.rows) if (isHeading(r)) out.push([r.heading, 700]); else { out.push([r.label, r.summary ? 700 : 400]); if (s.values) out.push([valueText(s, r), r.summary ? 700 : 400]); }
  for (const t of forestScale(s).ticks) out.push([tickText(t), 400]);
  if (s.valueHeader) out.push([s.valueHeader, 700]);
  if (s.axisLabel) out.push([s.axisLabel, 400]);
  if (s.favours) out.push([`← ${s.favours[0]}`, 400], [`${s.favours[1]} →`, 400]);
  return out;
}

export function layoutForest(s: ForestSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf, g.wrap);
  const sc = forestScale(s);
  const studies = s.rows.filter(r => !isHeading(r)) as Exclude<ForestRow, {heading: string}>[];
  const labelW = Math.min(Math.max(...s.rows.map(r => isHeading(r) ? c.tw(r.heading, true) : c.tw(r.label, !!r.summary) + 12)) + 12, g.w * 0.34);
  const valW = s.values ? Math.max(c.tw(s.valueHeader, true), ...studies.map(r => c.tw(valueText(s, r), !!r.summary))) + 16 : 0;
  const plotL = g.x + labelW + 8, plotR = g.x + g.w - valW - 12;
  if (plotR - plotL < 160) fail('forest', 'the figure is too narrow for its labels and numbers (raise width, or shorten the labels)');
  const xOf = (v: number) => plotL + sc.pos(v) * (plotR - plotL);
  const pitch = Math.max(S + 12, 26), headH = s.valueHeader ? pitch : 6;
  const y0 = g.y + headH;
  const bodyB = y0 + s.rows.length * pitch + 6;
  const axisH = S + 14 + (s.axisLabel ? S + 8 : 0) + (s.favours ? S + 10 : 0);
  c.h = Math.max(160, headH + s.rows.length * pitch + 6 + axisH + 4);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  if (s.valueHeader) c.text(s.valueHeader, g.x + g.w, g.y + S, 'end', 'text', {bold: true});
  // grid and axis
  const tk = sc.ticks.map(v => ({v})), shown = thinTicks(tk, xOf, t => c.tw(tickText(t.v)), 12);
  c.withPart(axisPart('x'), () => {
    c.line(plotL, bodyB, plotR, bodyB, {stroke: 'muted'});
    for (const t of tk) { c.line(xOf(t.v), bodyB, xOf(t.v), bodyB + 5, {stroke: 'muted'}); if (shown.has(t)) c.text(tickText(t.v), xOf(t.v), bodyB + S + 8, 'middle', 'muted'); }
    if (s.axisLabel) c.text(s.axisLabel, (plotL + plotR) / 2, bodyB + 2 * S + 16, 'middle', 'muted');
  });
  // reference line
  const xr = r1(xOf(s.ref));
  c.withPart(partStep('ref', 0, 'ref'), () => c.line(xr, y0 - 4, xr, bodyB, {stroke: 'text', sw: 1.5, dash: '4 3'}));
  // weights → square side 8..18 by sqrt
  const ws = studies.filter(r => !r.summary && r.weight !== undefined).map(r => r.weight as number), wMax = ws.length ? Math.max(...ws) : 1;
  s.rows.forEach((r, k) => {
    const cy = y0 + k * pitch + pitch / 2;
    if (isHeading(r)) { c.text(r.heading, g.x, c.mid(cy), 'start', 'text', {bold: true}); return; }
    const of = r.id ?? `#${k}`;
    c.withPart(partStep('row', r.id ?? k, r.label), () => {
      c.text(r.label, g.x + 12, c.mid(cy), 'start', 'text', {bold: !!r.summary, of});
      const xl = r1(xOf(r.low)), xh = r1(xOf(r.high)), xe = r1(xOf(r.estimate));
      if (r.summary) {
        const hh = Math.min(9, pitch / 2 - 3);
        c.path(`M${xl} ${r1(cy)} L${xe} ${r1(cy - hh)} L${xh} ${r1(cy)} L${xe} ${r1(cy + hh)} Z`, {fill: 'accent', of});
        c.line(xe, y0 - 4, xe, bodyB, {stroke: 'accent', sw: 1, dash: '2 3', soft: true});
      } else {
        c.line(xl, r1(cy), xh, r1(cy), {stroke: 'text', sw: 1.5, of});
        const side = r.weight === undefined ? 10 : 8 + 10 * Math.sqrt(r.weight / wMax);
        c.rect(r1(xe - side / 2), r1(cy - side / 2), r1(side), r1(side), {fill: 'accent', solid: r.label, of});
      }
      if (s.values) c.text(valueText(s, r), g.x + g.w, c.mid(cy), 'end', 'text', {bold: !!r.summary, of});
      if (r.id) c.anchors.push({id: r.id, x: xl, y: r1(cy - 9), w: r1(xh - xl), h: 18});
    });
  });
  if (s.favours) {
    const fy = bodyB + S + 14 + (s.axisLabel ? S + 8 : 0) + S;
    c.text(`← ${s.favours[0]}`, xr - 8, fy, 'end', 'muted');
    c.text(`${s.favours[1]} →`, xr + 8, fy, 'start', 'muted');
  }
  return c.done();
}
