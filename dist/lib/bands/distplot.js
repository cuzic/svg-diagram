import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutDist, distTexts } from '../charts-dist.js';
import { displot as buildDisplot, histplot as buildHistplot, kdeplot as buildKdeplot, ecdfplot as buildEcdfplot, rugplot as buildRugplot } from '../dsl/distplot.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, distTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutDist(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function displot(data, opts) {
    const chart = buildDisplot(data, opts);
    return band(definition, chart);
}
export function histplot(data, opts) {
    const chart = buildHistplot(data, opts);
    return band(definition, chart);
}
export function kdeplot(data, opts) {
    const chart = buildKdeplot(data, opts);
    return band(definition, chart);
}
export function ecdfplot(data, opts) {
    const chart = buildEcdfplot(data, opts);
    return band(definition, chart);
}
export function rugplot(data, opts) {
    const chart = buildRugplot(data, opts);
    return band(definition, chart);
}
/** @internal Definition used by the full renderer. */
export const distplotDefinition = definition;
