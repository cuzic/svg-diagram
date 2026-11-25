import { areasPrelayout } from '../layout-areas-gaps.js';
import { rowItems } from '../inventory-boxes.js';
import { childRects } from '../verify-rects.js';
import { frameLayoutFindings } from '../layout-metrics.js';
import { childRuns } from '../band-text-sizes.js';
import { band, defOf, DEF } from '../band-def.js';
import { areas as buildAreas } from '../dsl/areas.js';
import { rowSpotlight, renderRow, rowSvgDefs } from '../emit-row.js';
import { layoutAreas } from '../layout-areas.js';
import { groupDefinition } from './group.js';
import { rowOutputDefinition } from '../row-output.js';
const definition = {
    type: 'areas',
    selfDimming: true,
    spotlight: rowSpotlight,
    inventory: rowItems,
    svgDefs: rowSvgDefs,
    textSizes: childRuns,
    internal: true,
    layout: layoutAreas,
    areasPrelayout,
    children: data => data.children,
    outputDefinitions: { row: rowOutputDefinition },
    verify: { rects: childRects, targets: laid => laid.children, diagramFindings: frameLayoutFindings },
    emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
};
export function areas(template, cells, opts) {
    const data = buildAreas(template, cells, opts);
    data.children = data.children.map(child => child.type === 'group' && !defOf(child) ? band(groupDefinition, child) : child);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const areasDefinition = definition;
