import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutReg, regTexts } from '../charts-reg.js';
import { regplot as buildRegplot, residplot as buildResidplot } from '../dsl/regplot.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, regTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutReg(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function regplot(data, opts) {
    const chart = buildRegplot(data, opts);
    return band(definition, chart);
}
export function residplot(data, opts) {
    const chart = buildResidplot(data, opts);
    return band(definition, chart);
}
/** @internal Definition used by the full renderer. */
export const regplotDefinition = definition;
