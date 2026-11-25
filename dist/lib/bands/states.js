import { layoutFitRules, layoutFitVerification, layoutFitFindings } from '../verify-layout-fit.js';
import { must } from '../must.js';
import { edgeBendFindings } from '../verify-edge-bends.js';
import { densityRestorationFindings } from '../verify-density.js';
import { flowchartFindings } from '../verify-flowchart.js';
import { textsAndLabels } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { flowchart as buildFlowchart, stateDiagram as buildStateDiagram } from '../dsl/states.js';
import { renderStates } from '../emit-states.js';
import { snapGrid } from '../layout-util.js';
import { scopeOf } from '../scope-name.js';
import { layoutStatesBand, statesTexts } from '../states.js';
import { statesProblems } from '../verify-base.js';
import { anchorRects } from '../verify-rects.js';
export const statesDefinition = {
    type: 'states',
    selfDimming: true,
    textSizes: textsAndLabels,
    ids: data => data.states.map(item => item.id),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of statesTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap, keepWords = false, space, canvas }) {
        const scope = scopeOf(data);
        const placed = layoutStatesBand(data, x, snapGrid(y), w, widthOf, roles, { wrap, keepWords, space }, canvas?.height);
        const laid = scope ? { ...placed, scope } : placed;
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    emit: (laid, { theme, tones }) => renderStates(laid, theme, tones),
    locations: { drawsFrame: (laid, item) => item !== undefined && !must(laid.nodes[item]).circle },
    rules: layoutFitRules,
    verify: {
        ...layoutFitVerification,
        diagramFindings: [densityRestorationFindings, edgeBendFindings],
        rects: laid => anchorRects(laid),
        layoutFindings: laid => [...layoutFitFindings(laid), ...flowchartFindings(laid)],
        check: laid => statesProblems(laid).map(message => ({ rule: 'states', severity: 'problem', message })),
    },
};
export function stateDiagram(states, transitions, opts) {
    const data = buildStateDiagram(states, transitions, opts);
    return band(statesDefinition, data);
}
export function flowchart(nodes, edges, opts) {
    const data = buildFlowchart(nodes, edges, opts);
    return band(statesDefinition, data);
}
