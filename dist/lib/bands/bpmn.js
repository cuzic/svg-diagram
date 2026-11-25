import { edgeBendFindings } from '../verify-edge-bends.js';
import { must } from '../must.js';
import { nameBpmnNodes } from '../emit-node-ids.js';
import { narrowTextFindings } from '../verify-shrink.js';
import { textsAndLabels } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { bpmnTexts, layoutBpmn } from '../bpmn.js';
import { layoutBpmnVertical } from '../bpmn-vertical.js';
import { bpmn as build } from '../dsl/bpmn.js';
import { renderBpmn } from '../emit-bpmn.js';
import { snapGrid } from '../layout-util.js';
import { scopeOf } from '../scope-name.js';
import { bpmnProblems } from '../verify-bpmn.js';
import { anchorRects } from '../verify-rects.js';
const definition = {
    type: 'bpmn',
    selfDimming: true,
    textSizes: textsAndLabels,
    ids: data => data.nodes.map(item => item.id),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of bpmnTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap, keepWords = false, space }) {
        const scope = scopeOf(data);
        const placed = (data.dir === 'v' ? layoutBpmnVertical : layoutBpmn)(data, x, snapGrid(y), w, widthOf, roles, { wrap, keepWords, space });
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    emit: (laid, { theme, tones }) => renderBpmn(laid, theme, tones),
    locations: { drawsFrame: (laid, item) => item !== undefined && must(laid.nodes[item]).kind === 'task' },
    nameNodes: nameBpmnNodes,
    verify: {
        diagramFindings: edgeBendFindings,
        rects: laid => anchorRects(laid),
        layoutFindings: narrowTextFindings,
        check: laid => bpmnProblems(laid).map(message => ({ rule: 'bpmn', severity: 'problem', message })),
    },
};
export function bpmn(lanes, nodes, flows, opts) {
    const data = build(lanes, nodes, flows, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const bpmnDefinition = definition;
