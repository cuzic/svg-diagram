import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutHeatmap, heatmapTexts } from '../charts-heatmap.js';
import { heatmap as build } from '../dsl/heatmap.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, heatmapTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutHeatmap(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function heatmap(rows, cols, values, opts) {
    const data = build(rows, cols, values, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const heatmapDefinition = definition;
