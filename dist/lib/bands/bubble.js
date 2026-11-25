import { chartSpotlight, emitSpotlightChart } from '../emit-spotlight-chart.js';
import { band } from '../band-def.js';
import { layoutBubble, bubbleTexts } from '../charts-bubble.js';
import { bubble as build } from '../dsl/bubble.js';
import { describeChart, chartIds, layoutSelectiveChart, measureChart, verifyChart } from '../selective-chart.js';
const definition = {
    type: 'chart',
    selfDimming: true,
    spotlight: chartSpotlight,
    describe: describeChart,
    textSizes: band => [band.size],
    ids: chartIds,
    measure: (data, env) => measureChart(data, env, bubbleTexts(data.spec)),
    layout: (data, env) => layoutSelectiveChart(data, env, geom => layoutBubble(data.spec, geom)),
    emit: emitSpotlightChart,
    verify: verifyChart,
};
export function bubble(points, opts) {
    const data = build(points, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const bubbleDefinition = definition;
