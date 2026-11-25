import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutHarvey, harveyTexts } from '../charts-harvey.js';
import { harvey as build } from '../dsl/harvey.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, harveyTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutHarvey(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function harvey(rows, cols, values, opts) {
    const data = build(rows, cols, values, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const harveyDefinition = definition;
