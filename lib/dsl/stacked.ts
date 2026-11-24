import type {StackColumn, StackedOpts} from '../charts-stacked.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {resolveStacked, stackedAlt} from '../charts-stacked.ts';
import type {StackMode} from '../charts-stacked.ts';
import type {ChartIds} from './chart-ids.ts';

export function stackedBand(who: string, columns: readonly StackColumn[], mode: StackMode, opts: StackedOpts): ChartBand {
  const spec = resolveStacked(who, columns, mode, opts);
  return {type: 'chart', kind: 'stacked', spec, alt: opts.alt ?? stackedAlt(spec), ids: columns.flatMap(c => c.id ? [c.id] : []), ...chartBandOptions(who, opts)};
}

/**
 * Stacked columns (積み上げ棒グラフ): each column cut into its parts, a number in every part; `percent: true` makes 100% columns.
 *   stackedBars([{label: '2023', parts: [{label: '国内', value: 60}, {label: '海外', value: 40}]}, ...], {unit: '億円'})
 */
export function stackedBars<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: StackedOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
export function stackedBars(columns: readonly StackColumn[], opts: StackedOpts = {}): ChartBand {
  const band = stackedBand('stackedBars', columns, opts.percent ? 'percent' : 'stacked', opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
/**
 * A mekko chart (マリメッコ図): the width of a column is its total, the height of a part its share of the column — so the area of a
 * part is its share of the whole. Every part prints its share; one too small for the number is left out and stays in the description.
 *   mekko([{label: 'A 社', parts: [{label: '製品', value: 70}, {label: '保守', value: 30}]}, ...], {unit: '億円'})
 */
export function mekko<const C extends readonly StackColumn[], const Id extends string = never>(columns: C, opts?: Omit<StackedOpts, 'percent'> & {id?: Id}): ChartBand & Declares<Id | ChartIds<C>> & HandleOf<Id> & AnchorsOf<ChartIds<C>>;
export function mekko(columns: readonly StackColumn[], opts: Omit<StackedOpts, 'percent'> = {}): ChartBand {
  const band = stackedBand('mekko', columns, 'mekko', opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
