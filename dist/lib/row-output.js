import { nameBoxChildren } from './emit-node-ids.js';
import { rowItems } from './inventory-boxes.js';
import { childRects } from './verify-rects.js';
import { frameLayoutFindings } from './layout-metrics.js';
import { childRuns } from './band-text-sizes.js';
import { rowSpotlight, renderRow, rowSvgDefs } from './emit-row.js';
/**
 * A placed `row` (what areas() and grouprow() lay their cells out as), without the row() builder's own parts: the definition
 * `outputDefinitions` of the bands that place rows points at, so a figure with an areas() has the row's hooks (node ids, rects, drawing).
 */
export const rowOutputDefinition = {
    type: 'row',
    selfDimming: true,
    spotlight: rowSpotlight,
    inventory: rowItems,
    svgDefs: rowSvgDefs,
    textSizes: childRuns,
    internal: true,
    layout: () => { throw new Error('a placed row is laid out by the band that places it'); },
    children: data => data.children,
    verify: { rects: childRects, targets: laid => laid.children, diagramFindings: frameLayoutFindings },
    emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
    nameNodes: nameBoxChildren,
};
