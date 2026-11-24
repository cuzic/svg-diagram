import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {layoutReg, regTexts} from '../charts-reg.ts';
import type {RegData, RegOpts, RegSpec} from '../charts-reg.ts';
import type {ChartBand, LaidOutChart} from '../charts.ts';
import {regplot as buildRegplot, residplot as buildResidplot} from '../dsl/regplot.ts';
import {describeChart, chartIds, emitChart, layoutSelectiveChart, measureChart, verifyChart} from '../selective-chart.ts';

const definition = {
  type: 'chart',
  describe: describeChart,
  textSizes: band => [band.size],
  ids: chartIds,
  measure: (data, env) => measureChart(data, env, regTexts(data.spec as RegSpec)),
  layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutReg(data.spec as RegSpec, geom)),
  emit: emitChart,
  verify: verifyChart,
} satisfies BandDef<ChartBand, LaidOutChart>;

export function regplot<const Id extends string = never>(
  data: RegData, opts?: RegOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildRegplot<Id>>, LaidOutChart> {
  const chart = buildRegplot<Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

export function residplot<const Id extends string = never>(
  data: RegData, opts?: RegOpts & {id?: Id},
): WithBandDef<ReturnType<typeof buildResidplot<Id>>, LaidOutChart> {
  const chart = buildResidplot<Id>(data, opts);
  return band<typeof chart, LaidOutChart>(definition, chart);
}

/** @internal Definition used by the full renderer. */
export const regplotDefinition: BandDef<ChartBand, LaidOutChart> = definition;
