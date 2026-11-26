// SPIKE: forest() chart band.
import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {band} from '../band-def.ts';
import type {BandDef} from '../band-def.ts';
import {forestAlt, forestTexts, layoutForest, resolveForest} from '../charts-forest.ts';
import type {ForestOpts, ForestRow, ForestSpec} from '../charts-forest.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {chartBandOptions} from '../chart-band-options.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, forestTexts(data.spec as ForestSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutForest(data.spec as ForestSpec, geom)),
  emit: emitSpotlightChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function forest(rows: readonly ForestRow[], opts: ForestOpts = {}) {
  const spec = resolveForest(rows, opts);
  const data: ChartBand = {type: 'chart', kind: 'forest' as never, spec: spec as never, alt: opts.alt ?? forestAlt(spec), ids: [], ...chartBandOptions('forest' as never, opts)};
  return band<typeof data, LaidOutChart>(definition, data);
}
export const forestDefinition: BandDef<ChartBand, LaidOutChart> = definition;
