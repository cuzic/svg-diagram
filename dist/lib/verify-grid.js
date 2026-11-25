import { at } from './finding-rules.js';
export function canvasRegionFindings(b) {
    if (!b.canvas?.requireAll || !b.canvas.empty.length)
        return [];
    return [{ ...at(b), rule: 'canvas-region-empty', severity: 'warn', message: `canvas("${b.canvas.template}") の領域 ${b.canvas.empty.join('、')} に内容がない。書くか、requireAll を外す` }];
}
export const gridRules = /* @__PURE__ */ Object.freeze({
    'canvas-region-empty': { doc: 'canvas() の領域に内容がない（requireAll: 全領域を埋める指定）', scope: 'band' },
});
