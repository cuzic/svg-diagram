import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutTreemap, treemapTexts } from '../charts-treemap.js';
import { treemap as build } from '../dsl/treemap.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, treemapTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutTreemap(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function treemap(tree, opts) {
    const data = build(tree, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const treemapDefinition = definition;
