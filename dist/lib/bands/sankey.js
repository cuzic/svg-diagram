import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutSankey, sankeyTexts } from '../charts-sankey.js';
import { sankey as build } from '../dsl/sankey.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, sankeyTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutSankey(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function sankey(nodes, links, opts) {
    const data = build(nodes, links, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const sankeyDefinition = definition;
