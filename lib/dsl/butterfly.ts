import type {ButterflyOpts, ButterflyRow} from '../charts-butterfly.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {butterflyAlt, resolveButterfly} from '../charts-butterfly.ts';
import type {ChartIds} from './chart-ids.ts';

export function butterflyBand(rows: readonly ButterflyRow[], opts: ButterflyOpts): ChartBand {
  const spec = resolveButterfly(rows, opts);
  return {type: 'chart', kind: 'butterfly', spec, alt: opts.alt ?? butterflyAlt(spec), ids: spec.rows.flatMap(r => r.id ? [r.id] : []), ...chartBandOptions('butterfly', opts)};
}

/**
 * A butterfly chart (バタフライチャート): two groups' bars grow left and right from a column of item names, on one scale.
 *   butterfly([{label: '品質', left: 82, right: 74}, {label: '価格', left: 60, right: 88}], {leftLabel: '自社', rightLabel: '競合', unit: '点'})
 */
export function butterfly<const R extends readonly ButterflyRow[], const Id extends string = never>(rows: R, opts: ButterflyOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<R>> & HandleOf<Id> & AnchorsOf<ChartIds<R>>;
export function butterfly(rows: readonly ButterflyRow[], opts: ButterflyOpts): ChartBand {
  const band = butterflyBand(rows, opts);
  return withHandle(withAnchors(band, band.ids), opts?.id);
}
