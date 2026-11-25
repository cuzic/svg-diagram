import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutCombo, comboTexts } from '../charts-combo.js';
import { combo as build } from '../dsl/combo.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, comboTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCombo(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function combo(categories, series, opts) {
    const data = build(categories, series, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const comboDefinition = definition;
