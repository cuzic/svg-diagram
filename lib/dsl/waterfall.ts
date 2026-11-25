import type {ChartBand} from '../charts.ts';
import type {WaterfallOpts, WaterfallStep} from '../charts-waterfall.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {resolveWaterfall, waterfallAlt} from '../charts-waterfall.ts';
import type {ChartIds} from './chart-ids.ts';

export function waterfallBand(steps: readonly WaterfallStep[], opts: WaterfallOpts = {}): ChartBand {
  const spec = resolveWaterfall(steps, opts);
  return {type: 'chart', kind: 'waterfall', spec, alt: opts.alt ?? waterfallAlt(spec), ids: steps.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('waterfall', opts)};
}

/**
 * A waterfall chart (ウォーターフォール図): a start value, the changes that lead from it, subtotals / a total. Bars float; an increase
 * rises from the level before it, a decrease hangs from it, connectors carry the level on. Every bar prints its value with its sign.
 *   waterfall([{label: '前期', value: 1000}, {label: '価格', value: 120}, {label: '数量', value: -80}, {label: '今期', kind: 'total'}], {unit: '万円'})
 */
export function waterfall<const S extends readonly WaterfallStep[], const Id extends string = never>(steps: S, opts?: WaterfallOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
export function waterfall(steps: readonly WaterfallStep[], opts: WaterfallOpts = {}): ChartBand {
  const band = waterfallBand(steps, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
