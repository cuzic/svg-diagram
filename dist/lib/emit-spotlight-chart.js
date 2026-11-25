import { renderChart } from './charts-emit.js';
import { emojiSpan } from './emit-common.js';
import { emitChart } from './selective-chart.js';
import { anchoredSpotlightTarget } from './emit-spotlight.js';
export const chartSpotlight = {
    targets: anchoredSpotlightTarget,
    dim(band, focus) {
        if (focus.contains(band))
            return;
        // A treemap group also lights the cells drawn inside it.
        const lit = new Set(band.anchors.filter(focus.contains).map(a => a.id));
        for (const item of band.items)
            if (item.k === 'rect' && typeof item.of === 'string' && focus.contains(item))
                lit.add(item.of);
        // Every element is keyed by its id or index.
        if (lit.size)
            band.dimIds = [...new Set(band.items.flatMap(i => i.of !== undefined ? [i.of].flat() : []))].filter(k => !lit.has(k));
        else
            band.dim = true;
    },
};
export const emitSpotlightChart = (laid, env) => env.dimFill ? renderChart(laid, env.theme, emojiSpan, env.stage, true) : emitChart(laid, env);
