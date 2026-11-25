import { oneLine } from './diagram-description.js';
import { placeChart } from './chart-placement.js';
import { sizeOf } from './charts-base.js';
import { renderChart } from './charts-emit.js';
import { checkChart } from './charts-verify.js';
import { emojiSpan } from './emit-common.js';
import { snapGrid } from './layout-util.js';
import { scopeOf } from './scope-name.js';
import { anchorRects } from './verify-rects.js';
export const describeChart = (data) => ['chart', oneLine(data.alt)];
export function measureChart(data, { atoms, roles }, texts) {
    const size = sizeOf(data.labelRole, roles);
    for (const [text, weight] of texts)
        atoms(text, size, weight);
}
export function layoutSelectiveChart(data, { x, y, w, widthOf, roles, wrap, geometryScale = 1 }, layout) {
    const placed = placeChart(data, x, snapGrid(y), w, widthOf, roles, wrap, geometryScale, layout);
    const scope = scopeOf(data);
    const laid = scope ? { ...placed, scope } : placed;
    return { laid, h: laid.h, anchors: laid.anchors };
}
export const chartIds = (data) => data.ids;
export const emitChart = (laid, { theme, stage }) => renderChart(laid, theme, emojiSpan, stage);
export const verifyChart = {
    rects: laid => anchorRects(laid),
    check: (laid, { theme, tones, appearance }) => checkChart(laid, { day: theme, appearance }, tones)
        .map(message => ({ rule: 'chart', severity: 'problem', message })),
};
