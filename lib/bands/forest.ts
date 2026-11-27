import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {band} from '../band-def.ts';
import type {BandDef, DiagramFindings, WithBandDef} from '../band-def.ts';
import {forestTexts, layoutForest} from '../charts-forest.ts';
import type {ForestOpts, ForestRow, ForestSpec} from '../charts-forest.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {forest as build} from '../dsl/forest.ts';
import type {ForestIds} from '../dsl/forest.ts';
import {at} from '../finding-rules.ts';
import type {LaidOutBand} from '../types/index.ts';
import type {Finding} from '../types/verdicts.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

/** forest-clipped / forest-weight-partial: what the layout noticed (info: the figure is drawn as specified). */
const forestFindings: DiagramFindings = d => {
  const out: Finding[] = [];
  const visit = (bands: readonly LaidOutBand[]) => {
    for (const b of bands) {
      if (b.type === 'row' || b.type === 'grid') visit(b.children);
      else if (b.type === 'chart' && b.kind === 'forest') for (const n of b.notes ?? []) out.push({...at(b), rule: n.rule, severity: 'info', message: n.message});
    }
  };
  visit(d.laidOut);
  return out;
};

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
  verify: {...verifyChart, diagramFindings: forestFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function forest<const R extends readonly ForestRow[], const Id extends string = never>(
  rows: R, opts?: ForestOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<R, Id>>, LaidOutChart> {
  const data = build<R, Id>(rows, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const forestDefinition: BandDef<ChartBand, LaidOutChart> = definition;
export type {ForestIds};
