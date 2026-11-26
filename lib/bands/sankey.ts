import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {band, walkDefinedBands} from '../band-def.ts';
import type {BandDef, DiagramFindings, WithBandDef} from '../band-def.ts';
import {definedDiagramTitle} from '../diagram-title.ts';
import {hiddenBarsTitleFindings} from '../verify-bars.ts';
import {layoutSankey, sankeyTexts} from '../charts-sankey.ts';
import type {SankeyOpts, SankeySpec, SankeyNode, SankeyLink} from '../charts-sankey.ts';
import type {Band} from '../types/index.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {sankey as build} from '../dsl/sankey.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

/** A sankey drawn with `values: false` keeps its values only in the alt text, so it needs a title like bars with hidden values. */
const sankeyValuesHidden = (b: Band): boolean => b.type === 'chart' && b.kind === 'sankey' && (b.spec as SankeySpec).values === false;
const hiddenValuesFindings: DiagramFindings = (diagram, stage) =>
  hiddenBarsTitleFindings(diagram, () => definedDiagramTitle(diagram, stage), walkDefinedBands, stage, sankeyValuesHidden);

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, sankeyTexts(data.spec as SankeySpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutSankey(data.spec as SankeySpec, geom)),
  emit: emitSpotlightChart,
  verify: {...verifyChart, diagramFindings: hiddenValuesFindings},
} satisfies BandDef<ChartBand, LaidOutChart>;

export function sankey<const N extends readonly (SankeyNode | string)[], const Id extends string = never>(
  nodes: N, links: readonly SankeyLink[], opts?: SankeyOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<N, Id>>, LaidOutChart> {
  const data = build<N, Id>(nodes, links, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const sankeyDefinition: BandDef<ChartBand, LaidOutChart> = definition;
