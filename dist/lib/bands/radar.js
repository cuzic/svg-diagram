import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutRadar, radarTexts } from '../charts-radar.js';
import { radar as build } from '../dsl/radar.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, radarTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutRadar(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function radar(axes, series, opts) {
    const data = build(axes, series, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const radarDefinition = definition;
