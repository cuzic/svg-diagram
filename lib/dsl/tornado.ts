import type {TornadoItem, TornadoOpts} from '../charts-tornado.ts';
import type {ChartBand} from '../charts.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {resolveTornado, tornadoAlt} from '../charts-tornado.ts';
import type {ChartIds} from './chart-ids.ts';

export function tornadoBand(items: readonly TornadoItem[], opts: TornadoOpts): ChartBand {
  const spec = resolveTornado(items, opts);
  return {type: 'chart', kind: 'tornado', spec, alt: opts.alt ?? tornadoAlt(spec), ids: spec.items.flatMap(i => i.id ? [i.id] : []), ...chartBandOptions('tornado', opts)};
}

/**
 * A tornado chart (トルネード図): the result in the low and the high case of each input, as two bars from the base result, the input
 * the result is most sensitive to first. Values are printed at the ends of the bars.
 *   tornado([{label: '原材料費', low: 850, high: 1150}, {label: '為替', low: 940, high: 1060}], {base: 1000, unit: '百万円'})
 */
export function tornado<const I extends readonly TornadoItem[], const Id extends string = never>(items: I, opts: TornadoOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<I>> & HandleOf<Id> & AnchorsOf<ChartIds<I>>;
export function tornado(items: readonly TornadoItem[], opts: TornadoOpts): ChartBand {
  const band = tornadoBand(items, opts);
  return withHandle(withAnchors(band, band.ids), opts?.id);
}
