import { layoutFitRules, layoutFitVerification } from '../verify-layout-fit.js';
import { nameTreeNodes } from '../emit-node-ids.js';
import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { mindmap as buildMindmap, tree as buildTree } from '../dsl/tree.js';
import { renderTree } from '../emit-tree.js';
import { layoutTree } from '../layout-tree.js';
import { treeItems, treeTexts } from '../tree.js';
import { treeRects } from '../verify-tree.js';
const definition = {
    type: 'tree',
    selfDimming: true,
    textSizes: texts,
    internal: true,
    layout: layoutTree,
    ids: data => treeItems(data.root).flatMap(node => node.id ? [node.id] : []),
    children: data => treeItems(data.root).flatMap(node => node.band ? [node.band] : []),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of treeTexts(data, roles))
            atoms(text, size, weight, font);
    },
    emit: (laid, { theme, tones, stage }) => renderTree(laid, theme, tones, stage),
    locations: { drawsFrame: (_laid, item) => item !== undefined },
    nameNodes: nameTreeNodes,
    rules: layoutFitRules,
    verify: { ...layoutFitVerification, rects: treeRects },
};
export function tree(root, opts) {
    const data = buildTree(root, opts);
    return band(definition, data);
}
export function mindmap(root, opts) {
    const data = buildMindmap(root, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const treeDefinition = definition;
