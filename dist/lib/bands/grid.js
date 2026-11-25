import { unionOf } from '../figure-metrics.js';
import { nameBoxChildren } from '../emit-node-ids.js';
import { layoutBoxLike } from '../layout-box-like.js';
import { childBoxes } from '../inventory-boxes.js';
import { canvasRegionFindings } from '../verify-grid.js';
import { childRects } from '../verify-rects.js';
import { frameLayoutFindings } from '../layout-metrics.js';
import { childRuns } from '../band-text-sizes.js';
import { band, DEF } from '../band-def.js';
import { grid as buildGrid } from '../dsl/grid.js';
import { childTextSvgDefs } from '../emit-box-defs.js';
import { gridSpotlight, renderGrid } from '../emit-grid.js';
import { layoutGridBand } from '../layout-grid.js';
export const gridDefinition = {
    type: 'grid',
    selfDimming: true,
    spotlight: gridSpotlight,
    inventory: childBoxes,
    svgDefs: childTextSvgDefs,
    textSizes: childRuns,
    internal: true,
    layoutBoxLike,
    layout: layoutGridBand,
    children: data => data.children,
    verify: {
        rects: childRects, figureExtent: laid => unionOf(laid.children), targets: laid => laid.children,
        diagramFindings: frameLayoutFindings, findings: canvasRegionFindings,
        wordedChildren: data => data.children.filter((_, i) => data.canvas?.worded[i]),
    },
    emit: (laid, env) => renderGrid(laid, env.theme, env.tones, env.roles, env.stage),
    nameNodes: nameBoxChildren,
};
export function grid(children, opts) {
    const data = buildGrid(children, opts);
    return band(gridDefinition, data);
}
