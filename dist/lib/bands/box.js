import { node as buildNode } from '../dsl/node.js';
import { nameBoxNode } from '../emit-node-ids.js';
import { stat as buildStat } from '../dsl/stat.js';
import { ownRunSizes } from '../band-text-sizes.js';
import { boxItems } from '../inventory-boxes.js';
import { oneLine } from '../diagram-description.js';
import { frameLayoutFindings } from '../layout-metrics.js';
import { band, walkDefinedBands } from '../band-def.js';
import { box as buildBox } from '../dsl/box.js';
import { textSvgDefs } from '../emit-box-defs.js';
import { boxSpotlight, renderBox } from '../emit-box.js';
import { layoutBoxLike, layoutBoxLikeBand } from '../layout-box-like.js';
import { styledAtoms, textRuns } from '../layout-text.js';
import { TAG_SIZE } from '../tokens.js';
import { boxLikeContrastProblems, boxSizeFindings, nowrapProblems, statFitFindings } from '../verify-box-like.js';
import { ownRect } from '../verify-rects.js';
const selectedBoxSizeFindings = ({ bands }) => boxSizeFindings(walkDefinedBands(bands));
/** Shared by every band that is drawn as a box, so a check runs once per diagram. */
export const boxDiagramFindings = [frameLayoutFindings, selectedBoxSizeFindings, statFitFindings];
export const boxDefinition = {
    type: 'box',
    selfDimming: true,
    spotlight: boxSpotlight,
    textSizes: ownRunSizes,
    inventory: boxItems,
    svgDefs: textSvgDefs,
    describe: data => data.title ? ['box', oneLine(data.title)] : undefined,
    measure(data, { atoms, roles }) {
        if (data.tag)
            atoms(data.tag, roles.tag ?? TAG_SIZE, 700);
        if (data.stamp)
            atoms(data.stamp, roles.note, 400);
        for (const run of textRuns(data, roles)) {
            const font = run.mono ? 'mono' : 'sans';
            for (let size = run.fit && run.nowrap ? run.fit.min : run.size; size <= run.size; size++) {
                for (const { text, weight } of styledAtoms(run))
                    atoms(text, size, weight, font);
            }
        }
    },
    internal: true,
    layoutBoxLike,
    layout: layoutBoxLikeBand,
    nameNodes: nameBoxNode,
    locations: { drawsFrame: laid => laid.frame !== false },
    emit(laid, { theme, tones, roles }) {
        return renderBox(laid, theme, tones, roles);
    },
    verify: {
        tones: data => [data.tone ?? 'plain'],
        legendNotation: data => data,
        diagramFindings: boxDiagramFindings,
        rects: ownRect,
        check: laid => nowrapProblems(laid).map(message => ({ rule: 'nowrap', severity: 'problem', message })),
        contrast: (laid, { theme, tones, appearance }) => boxLikeContrastProblems(laid, laid.tone ?? 'plain', theme, tones, appearance),
    },
};
export function box(opts) {
    const data = buildBox(opts);
    return band(boxDefinition, data);
}
export function node(opts) {
    const data = buildNode(opts);
    return band(boxDefinition, data);
}
export function stat(value, label, opts) {
    const data = buildStat(value, label, opts);
    return band(boxDefinition, data);
}
export { icon } from '../icon-registry.js';
export { em } from '../rich.js';
