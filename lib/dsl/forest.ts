import type {ForestOpts, ForestRow} from '../charts-forest.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {forestAlt, resolveForest} from '../charts-forest.ts';

/** The ids written on the rows (a heading row has none). */
export type ForestIds<R extends readonly ForestRow[]> = Extract<R[number] extends infer Row ? Row extends {id: infer I} ? I : never : never, string>;

export function forestBand(rows: readonly ForestRow[], opts: ForestOpts = {}): ChartBand {
  const spec = resolveForest(rows, opts);
  return {type: 'chart', kind: 'forest', spec, alt: opts.alt ?? forestAlt(spec), ids: spec.rows.flatMap(r => 'id' in r && r.id ? [r.id] : []), ...chartBandOptions('forest', opts)};
}

/**
 * A forest plot (フォレストプロット): one row per study with its estimate and interval, a reference line (1 = no difference), the
 * numbers in a column on the right, optional heading rows and a summary diamond. A ratio is on a log scale by default; for a difference
 * write `{scale: 'linear', ref: 0}`.
 *   forest([{heading: '東'}, {label: '会場 A', estimate: 1.5, low: 1.2, high: 1.9}, {label: '全体', estimate: 1.3, low: 1.1, high: 1.5, summary: true}], {favours: ['対照が良い', '新方式が良い']})
 */
export function forest<const R extends readonly ForestRow[], const Id extends string = never>(rows: R, opts?: ForestOpts & {id?: Id}): ChartBand & Declares<Id | ForestIds<R>> & HandleOf<Id> & AnchorsOf<ForestIds<R>>;
export function forest(rows: readonly ForestRow[], opts: ForestOpts = {}): ChartBand {
  const band = forestBand(rows, opts);
  return withHandle(withAnchors(band, band.ids), opts?.id);
}
