import { fitLineScale } from '../layout-cause-fit.js';
import { must } from '../must.js';
import { qualify, scopeOf } from '../scope-name.js';
import { nameCauseNodes } from '../emit-node-ids.js';
import { layoutFitRules, layoutFitVerification } from '../verify-layout-fit.js';
import { edgeBendFindings } from '../verify-edge-bends.js';
import { parallelEdgeFindings } from '../verify-cause-spacing.js';
import { densityRestorationFindings } from '../verify-density.js';
import { texts } from '../band-text-sizes.js';
import { analysisFindings } from '../finding-rules.js';
import { tocFindings, tocLegendFinding } from '../toc-rules.js';
import { band, walkDefinedBands } from '../band-def.js';
import { causeTree as buildTree, pdpc as buildPdpc, relationDiagram as buildRelation } from '../dsl/cause.js';
import { renderCause } from '../emit-cause.js';
import { placeCause } from '../layout-cause.js';
import { causeTexts } from '../toc.js';
import { causeFindings } from '../verify-cause.js';
import { anchorRects } from '../verify-rects.js';
export { transitionUnits } from '../dsl/cause.js';
const tocDiagramFindings = d => {
    const causes = walkDefinedBands(d.bands).filter(b => b.type === 'cause');
    const findings = causes.flatMap(b => analysisFindings(b, tocFindings(b), d.tocCheck === 'strict' ? 'warn' : 'info'));
    // Match the legacy TOC pass: a single diagram-wide suggestion precedes the tree findings.
    if (d.legend === undefined && causes.some(b => b.tree !== undefined))
        findings.unshift(tocLegendFinding());
    return findings;
};
export const causeDefinition = {
    type: 'cause',
    selfDimming: true,
    textSizes: texts,
    ids: data => data.nodes.filter(node => !data.unanchored?.includes(node.id)).map(node => node.id),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of causeTexts(data, roles))
            atoms(text, size, weight, font);
    },
    internal: true,
    fitLineScale,
    layout: placeCause,
    emit: (laid, { theme, tones }) => renderCause(laid, theme, tones),
    locations: {
        drawsFrame: (laid, item) => item !== undefined && !must(laid.nodes[item]).hex,
        synthetic: (laid, id) => laid.unanchored?.some(name => qualify(scopeOf(laid), name) === id) === true,
    },
    nameNodes: nameCauseNodes,
    rules: layoutFitRules,
    verify: {
        ...layoutFitVerification,
        diagramFindings: [tocDiagramFindings, densityRestorationFindings, parallelEdgeFindings, edgeBendFindings],
        findings: (data, { rcaCheck }) => analysisFindings(data, data.rca?.findings ?? [], rcaCheck === 'strict' ? 'warn' : 'info'),
        rects: laid => anchorRects(laid),
        check(laid) {
            const { problems, warnings } = causeFindings(laid);
            return [
                ...problems.map(message => ({ rule: 'cause', severity: 'problem', message })),
                ...warnings.map(message => ({ rule: 'cause', severity: 'warn', message })),
            ];
        },
    },
};
function define(data) {
    return band(causeDefinition, data);
}
export function causeTree(nodes, links, opts) {
    return define(buildTree(nodes, links, opts));
}
export function pdpc(nodes, links, opts) {
    return define(buildPdpc(nodes, links, opts));
}
export function relationDiagram(nodes, links, opts) {
    return define(buildRelation(nodes, links, opts));
}
