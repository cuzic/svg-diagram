import {chartSpotlight, emitSpotlightChart} from '../emit-spotlight-chart.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutBubble, bubbleTexts} from '../charts-bubble.ts';
import type {BubblePoint, BubbleOpts, BubbleSpec} from '../charts-bubble.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {bubble as build} from '../dsl/bubble.ts';
import {describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  selfDimming: true,
  spotlight: chartSpotlight,
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, bubbleTexts(data.spec as BubbleSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutBubble(data.spec as BubbleSpec, geom)),
  emit: emitSpotlightChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function bubble<const P extends readonly BubblePoint[], const Id extends string = never>(
  points: P, opts?: BubbleOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<P, Id>>, LaidOutChart> {
  const data = build<P, Id>(points, opts);
  return band<typeof data, LaidOutChart>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const bubbleDefinition: BandDef<ChartBand, LaidOutChart> = definition;
