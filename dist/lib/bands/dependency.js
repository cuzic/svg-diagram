import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { edgeBendFindings } from '../verify-edge-bends.js';
import { band } from '../band-def.js';
import { layoutDependency, dependencyTexts } from '../semnet-dependency.js';
import { dependencyNetwork as build } from '../dsl/dependency.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, dependencyTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutDependency(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: { ...verifyChart, diagramFindings: edgeBendFindings },
};
export function dependencyNetwork(nodes, edges, opts) {
    const data = build(nodes, edges, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const dependencyDefinition = definition;
