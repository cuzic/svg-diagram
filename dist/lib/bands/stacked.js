import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { selectedAxisFindings } from '../axis-selected.js';
import { band } from '../band-def.js';
import { layoutStacked, stackedTexts, stackedValueAxis } from '../charts-stacked.js';
import { stackedBars as buildStacked, mekko as buildMekko } from '../dsl/stacked.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    valueAxis: data => stackedValueAxis(data.spec),
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, stackedTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutStacked(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: { ...verifyChart, diagramFindings: selectedAxisFindings },
};
export function stackedBars(columns, opts) {
    const data = buildStacked(columns, opts);
    return band(definition, data);
}
export function mekko(columns, opts) {
    const data = buildMekko(columns, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const stackedDefinition = definition;
