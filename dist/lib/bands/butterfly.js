import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutButterfly, butterflyTexts } from '../charts-butterfly.js';
import { butterfly as build } from '../dsl/butterfly.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, butterflyTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutButterfly(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function butterfly(rows, opts) {
    const data = build(rows, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const butterflyDefinition = definition;
