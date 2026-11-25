import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutCat, catTexts } from '../charts-cat.js';
import { catplot as buildCatplot, boxplot as buildBoxplot, violinplot as buildViolinplot, stripplot as buildStripplot, swarmplot as buildSwarmplot, pointplot as buildPointplot, barplot as buildBarplot } from '../dsl/catplot.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, catTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutCat(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function catplot(data, opts) {
    const chart = buildCatplot(data, opts);
    return band(definition, chart);
}
export function boxplot(data, opts) {
    const chart = buildBoxplot(data, opts);
    return band(definition, chart);
}
export function violinplot(data, opts) {
    const chart = buildViolinplot(data, opts);
    return band(definition, chart);
}
export function stripplot(data, opts) {
    const chart = buildStripplot(data, opts);
    return band(definition, chart);
}
export function swarmplot(data, opts) {
    const chart = buildSwarmplot(data, opts);
    return band(definition, chart);
}
export function pointplot(data, opts) {
    const chart = buildPointplot(data, opts);
    return band(definition, chart);
}
export function barplot(data, opts) {
    const chart = buildBarplot(data, opts);
    return band(definition, chart);
}
/** @internal Definition used by the full renderer. */
export const catplotDefinition = definition;
