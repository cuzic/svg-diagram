import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { edgeBendFindings } from '../verify-edge-bends.js';
import { band } from '../band-def.js';
import { layoutPert, pertTexts } from '../semnet-pert.js';
import { pert as build } from '../dsl/pert.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, pertTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutPert(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: { ...verifyChart, diagramFindings: edgeBendFindings },
};
export function pert(tasks, opts) {
    const data = build(tasks, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const pertDefinition = definition;
