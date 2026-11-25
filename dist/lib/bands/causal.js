import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { edgeBendFindings } from '../verify-edge-bends.js';
import { band } from '../band-def.js';
import { layoutCausal, causalTexts } from '../semnet-causal.js';
import { causalLoop as build } from '../dsl/causal.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, causalTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCausal(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: { ...verifyChart, diagramFindings: edgeBendFindings },
};
export function causalLoop(nodes, links, opts) {
    const data = build(nodes, links, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const causalDefinition = definition;
