// tornado(): a sensitivity chart. Each row is one input; its two bars run from the base result to the result in the low case and in the
// high case, so the longest row is the input the result is most sensitive to and the rows fall in order of that length.
import {Canvas, checkIds, checkText, fail, finiteNum, niceScale, numText, thinTicks} from './charts-base.ts';
import type {ChartGeom, ChartOpts, ChartTone, LaidOutChartPart} from './charts-base.ts';

export interface TornadoItem {
  label: string;
  /** The result when this input is at its low value (not necessarily the lower result). */
  low: number;
  /** The result when this input is at its high value. */
  high: number;
  id?: string;
}
export interface TornadoOpts extends ChartOpts {
  /** The result at the base case: the line the bars start from. Required. */
  base: number;
  unit?: string;
  /** Names of the two cases in the legend (default 低ケース / 高ケース). */
  lowLabel?: string;
  highLabel?: string;
  /** Name of the base line (default 基準). */
  baseLabel?: string;
  /** Keep the order given instead of the longest first. */
  sort?: boolean;
  /** Colours of the low and the high bars (default text / accent). */
  lowTone?: ChartTone;
  highTone?: ChartTone;
}
export interface TornadoSpec {items: TornadoItem[]; base: number; unit: string; lowLabel: string; highLabel: string; baseLabel: string; lowTone: ChartTone; highTone: ChartTone}

export function resolveTornado(items: readonly TornadoItem[], opts: TornadoOpts): TornadoSpec {
  if (!Array.isArray(items) || items.length === 0) fail('tornado', 'needs at least one item');
  if (items.length > 24) fail('tornado', `${items.length} items are too many for one figure (at most 24: keep the ones that matter)`);
  if (opts?.base === undefined) fail('tornado', 'needs the base result: tornado(items, {base: 1000})');
  const base = finiteNum('tornado', 'base', opts.base);
  checkIds('tornado', items.map(i => i.id), opts.id);
  const list = items.map((i, k) => ({label: checkText('tornado', `item ${k + 1}'s label`, i.label), low: finiteNum('tornado', `"${i.label}" low`, i.low), high: finiteNum('tornado', `"${i.label}" high`, i.high), ...(i.id === undefined ? {} : {id: i.id})}));
  const ordered = opts.sort === false ? list : [...list].sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low) || list.indexOf(a) - list.indexOf(b));
  const tones = ['accent', 'danger', 'muted', 'text'];
  for (const k of ['lowTone', 'highTone'] as const) if (opts[k] !== undefined && !tones.includes(opts[k] as string)) fail('tornado', `${k} must be accent, danger, muted or text`);
  return {items: ordered, base, unit: opts.unit ?? '', lowLabel: opts.lowLabel ?? '低ケース', highLabel: opts.highLabel ?? '高ケース', baseLabel: opts.baseLabel ?? '基準', lowTone: opts.lowTone ?? 'text', highTone: opts.highTone ?? 'accent'};
}
export function tornadoAlt(s: TornadoSpec): string {
  return `トルネード図（${s.baseLabel} ${numText(s.base)}${s.unit}）: ${s.items.map(i => `${i.label} ${s.lowLabel} ${numText(i.low)}${s.unit}・${s.highLabel} ${numText(i.high)}${s.unit}`).join('、')}`;
}
export function tornadoTexts(s: TornadoSpec): [string, number][] {
  const out: [string, number][] = [[s.lowLabel, 400], [s.highLabel, 400], [`${s.baseLabel} ${numText(s.base)}${s.unit}`, 700]];
  for (const i of s.items) out.push([i.label, 400], [`${numText(i.low)}${s.unit}`, 700], [`${numText(i.high)}${s.unit}`, 700]);
  const all = s.items.flatMap(i => [i.low, i.high]);
  for (const t of niceScale(Math.min(s.base, ...all), Math.max(s.base, ...all)).ticks) out.push([numText(t), 400]);
  return out;
}

export function layoutTornado(s: TornadoSpec, g: ChartGeom): LaidOutChartPart {
  const S = g.size, c = new Canvas(g.x, g.y, g.w, 100, S, g.widthOf);
  const all = s.items.flatMap(i => [i.low, i.high]);
  const sc = niceScale(Math.min(s.base, ...all), Math.max(s.base, ...all));
  const vText = (v: number) => `${numText(v)}${s.unit}`;
  const labelW = Math.min(Math.max(...s.items.map(i => c.tw(i.label))) + 14, g.w * 0.34);
  const valW = Math.max(...s.items.flatMap(i => [c.tw(vText(i.low), true), c.tw(vText(i.high), true)])) + 10;
  const plotL = g.x + labelW + valW + 4, plotR = g.x + g.w - valW - 8;
  if (plotR - plotL < 120) fail('tornado', 'the figure is too narrow for its labels (raise width, or shorten the labels / unit)');
  const xOf = (v: number) => plotL + (v - sc.min) / (sc.max - sc.min) * (plotR - plotL);
  const barH = Math.max(24, S + 10), pitch = barH + 12, lineH = c.lineH();
  const wrapped = s.items.map(i => c.wrap(i.label, labelW - 14));
  const sameSide = (i: TornadoItem) => (i.low - s.base) * (i.high - s.base) > 0;
  const rowH = wrapped.map((l, k) => Math.max(sameSide(s.items[k]) ? 2 * pitch - 8 : pitch, l.length * lineH + 8));
  // legend: two swatches with the names of the cases, from the plot's left edge; the second goes on a row of its own when the two do not fit
  const sw = 14, itemW = (t: string) => sw + 6 + c.tw(t);
  for (const t of [s.lowLabel, s.highLabel]) if (itemW(t) > g.w) fail('tornado', `the legend name "${t}" is wider than the figure (shorten lowLabel / highLabel, or raise width)`);
  const legendAt: {x: number; row: number}[] = [];
  { let lx = Math.min(plotL, g.x + g.w - itemW(s.lowLabel)), row = 0;
    for (const t of [s.lowLabel, s.highLabel]) { if (legendAt.length && lx + itemW(t) > g.x + g.w) { lx = Math.min(plotL, g.x + g.w - itemW(t)); row++; } legendAt.push({x: lx, row}); lx += itemW(t) + 22; } }
  const legendRows = legendAt[legendAt.length - 1].row + 1;
  const headH = (S + 12) * (legendRows + 1) + 8, axisH = S + 16;
  const y0 = g.y + headH;
  c.h = g.height ?? Math.max(160, headH + rowH.reduce((a, b) => a + b, 0) + axisH + 4);
  if (g.height !== undefined && g.height < headH + rowH.reduce((a, b) => a + b, 0) + axisH) fail('tornado', `height ${g.height} is too small for ${s.items.length} rows (need at least ${headH + rowH.reduce((a, b) => a + b, 0) + axisH})`);
  const bodyB = y0 + rowH.reduce((a, b) => a + b, 0);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  ([[s.lowTone, s.lowLabel], [s.highTone, s.highLabel]] as const).forEach(([tone, text], i) => {
    const {x: lx, row} = legendAt[i];
    const cy = g.y + row * (S + 12) + Math.max(4 + sw / 2, Math.ceil(S * 0.64)); // the text's top stays in the figure at a large label size (a canvas)
    c.rect(lx, cy - sw / 2, sw, sw, {fill: tone});
    c.text(text, lx + sw + 6, c.mid(cy), 'start', 'text');
  });
  // grid and axis
  const tk = sc.ticks.map(v => ({v})), shown = thinTicks(tk, xOf, t => c.tw(numText(t.v)), 12);
  for (const t of tk) { c.line(xOf(t.v), y0, xOf(t.v), bodyB, {stroke: 'border'}); if (shown.has(t)) c.text(numText(t.v), xOf(t.v), bodyB + S + 8, 'middle', 'muted'); }
  // rows
  let y = y0;
  s.items.forEach((it, k) => {
    const cy = y + rowH[k] / 2, top = cy - barH / 2;
    c.lines(wrapped[k], g.x + labelW - 10, cy - (wrapped[k].length - 1) * lineH / 2 + S * 0.36, 'end', 'text', {of: it.id ?? `#${k}`});
    const xb = xOf(s.base), same = sameSide(it);
    const bars = [{v: it.low, tone: s.lowTone, name: s.lowLabel}, {v: it.high, tone: s.highTone, name: s.highLabel}];
    const geom = bars.map((b, j) => {
      const x1 = Math.min(xb, xOf(b.v)), x2 = Math.max(xb, xOf(b.v)), by = same ? cy - barH - 2 + j * (barH + 4) : top;
      // a result equal to the base has no bar (its number is still written)
      if (x2 - x1 >= 1) c.rect(r1(x1), r1(by), r1(x2 - x1), r1(barH), {fill: b.tone, solid: `${it.label} ${b.name}`, ...(it.id && j === 0 ? {id: it.id} : {}), of: it.id ?? `#${k}`});
      else if (it.id && j === 0) c.anchors.push({id: it.id, x: xb - 1, y: by, w: 2, h: barH});
      return {x1, x2, by};
    });
    bars.forEach((b, j) => {
      const {x1, x2, by} = geom[j], right = xOf(b.v) >= xb, text = vText(b.v);
      const out = right ? {x: x2 + 6, y: c.mid(by + barH / 2), anchor: 'start' as const} : {x: x1 - 6, y: c.mid(by + barH / 2), anchor: 'end' as const};
      const alt = right ? {x: x1 - 6, y: out.y, anchor: 'end' as const} : {x: x2 + 6, y: out.y, anchor: 'start' as const};
      if (!c.place(text, [out, alt], b.tone === 'muted' ? 'text' : b.tone, {bold: true, of: it.id ?? `#${k}`})) fail('tornado', `the value "${text}" of "${it.label}" has no room`);
    });
    y += rowH[k];
  });
  // the base line over the bars, its name above
  const xb = r1(xOf(s.base));
  c.line(xb, y0 - 6, xb, bodyB, {stroke: 'text', sw: 2});
  // its name centred on it, kept inside the figure when the base is near an edge
  const baseText = `${s.baseLabel} ${vText(s.base)}`, half = c.tw(baseText, true) / 2;
  if (2 * half > g.w) fail('tornado', `the base label "${baseText}" is wider than the figure (shorten baseLabel, or raise width)`);
  c.text(baseText, Math.min(Math.max(xb, g.x + half), g.x + g.w - half), y0 - 12, 'middle', 'text', {bold: true});
  void Canvas;
  return c.done();
}
