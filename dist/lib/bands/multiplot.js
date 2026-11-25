import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutMulti, multiTexts } from '../charts-multi.js';
import { hist2d as buildHist2d, jointplot as buildJointplot, kde2d as buildKde2d, pairplot as buildPairplot } from '../dsl/multiplot.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, multiTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutMulti(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function hist2d(data, opts) {
    const chart = buildHist2d(data, opts);
    return band(definition, chart);
}
export function jointplot(data, opts) {
    const chart = buildJointplot(data, opts);
    return band(definition, chart);
}
export function kde2d(data, opts) {
    const chart = buildKde2d(data, opts);
    return band(definition, chart);
}
export function pairplot(data, opts) {
    const chart = buildPairplot(data, opts);
    return band(definition, chart);
}
/** @internal Definition used by the full renderer. */
export const multiplotDefinition = definition;
