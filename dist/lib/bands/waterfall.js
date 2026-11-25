import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { selectedAxisFindings } from '../axis-selected.js';
import { band } from '../band-def.js';
import { layoutWaterfall, waterfallTexts, waterfallValueAxis } from '../charts-waterfall.js';
import { waterfall as build } from '../dsl/waterfall.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    valueAxis: data => waterfallValueAxis(data.spec),
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, waterfallTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutWaterfall(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: { ...verifyChart, diagramFindings: selectedAxisFindings },
};
export function waterfall(steps, opts) {
    const data = build(steps, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const waterfallDefinition = definition;
