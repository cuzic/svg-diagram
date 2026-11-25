import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutCompare, compareTexts } from '../charts-compare.js';
import { compare as build } from '../dsl/compare.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, compareTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCompare(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function compare(rows, cols, cells, opts) {
    const data = build(rows, cols, cells, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const compareDefinition = definition;
