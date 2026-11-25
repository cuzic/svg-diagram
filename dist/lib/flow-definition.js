import { renderFlowShape } from './emit-flow-shape.js';
import { placeFlowShape } from './flow-layout-core.js';
import { snapGrid } from './layout-util.js';
import { flowProblems } from './verify-flow.js';
export function measureFlow(data, { atoms, roles }, texts) {
    for (const [text, size, weight, font] of texts(data, roles))
        atoms(text, size, weight, font);
}
export function placeFlow(data, env, draw) {
    const { x, y, w, widthOf, roles, wrap } = env;
    const placed = placeFlowShape(data, x, snapGrid(y), w, widthOf, roles, wrap, draw);
    const laid = data.scope ? { ...placed, scope: data.scope } : placed;
    return { laid, h: laid.h, anchors: laid.anchors };
}
export function flowItemIds(items) {
    return items.flatMap(item => item.id ? [item.id] : []);
}
export const emitFlow = (laid, { theme, tones }) => renderFlowShape(laid, theme, tones);
export const verifyFlow = {
    check: laid => flowProblems(laid).map(message => ({ rule: 'flow', severity: 'problem', message })),
};
