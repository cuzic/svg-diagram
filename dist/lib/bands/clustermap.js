import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutCluster, clusterTexts } from '../charts-cluster.js';
import { clustermap as buildClustermap } from '../dsl/clustermap.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, clusterTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCluster(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function clustermap(rows, cols, values, opts) {
    const chart = buildClustermap(rows, cols, values, opts);
    return band(definition, chart);
}
/** @internal Definition used by the full renderer. */
export const clustermapDefinition = definition;
