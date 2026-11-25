import type {ComboOpts, ComboSeries} from '../charts-combo.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {comboAlt, resolveCombo} from '../charts-combo.ts';
import type {ChartIds} from './chart-ids.ts';

export function comboBand(categories: readonly string[], series: readonly ComboSeries[], opts: ComboOpts): ChartBand {
  const spec = resolveCombo(categories, series, opts);
  return {type: 'chart', kind: 'combo', spec, alt: opts.alt ?? comboAlt(spec), ids: series.flatMap(s => s.id ? [s.id] : []), ...chartBandOptions('combo', opts)};
}

/**
 * A combo chart (コンボチャート / 複合グラフ): bars (left axis) and lines (right axis by default) over the same categories; `stack: true` piles the bars.
 *   combo(['2022', '2023', '2024'], [{label: '売上', type: 'bar', values: [120, 150, 190]}, {label: '営業利益率', type: 'line', values: [8, 9.5, 12]}], {y: {unit: '億円'}, y2: {unit: '%'}})
 */
export function combo<const S extends readonly ComboSeries[], const Id extends string = never>(categories: readonly string[], series: S, opts?: ComboOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<S>> & HandleOf<Id> & AnchorsOf<ChartIds<S>>;
export function combo(categories: readonly string[], series: readonly ComboSeries[], opts: ComboOpts = {}): ChartBand {
  const band = comboBand(categories, series, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}
