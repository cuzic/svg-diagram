import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { selectedAxisFindings } from '../axis-selected.js';
import { band } from '../band-def.js';
import { layoutTornado, tornadoTexts, tornadoValueAxis } from '../charts-tornado.js';
import { tornado as build } from '../dsl/tornado.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    valueAxis: data => tornadoValueAxis(data.spec),
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, tornadoTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutTornado(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: { ...verifyChart, diagramFindings: selectedAxisFindings },
};
export function tornado(items, opts) {
    const data = build(items, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const tornadoDefinition = definition;
