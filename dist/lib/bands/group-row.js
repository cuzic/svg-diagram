import { rowItems } from '../inventory-boxes.js';
import { childRects } from '../verify-rects.js';
import { frameLayoutFindings } from '../layout-metrics.js';
import { childRuns } from '../band-text-sizes.js';
import { band, DEF } from '../band-def.js';
import { buildMixedRow, normalizeRowChildren } from '../dsl/mixed-row.js';
import { validateRowOptions } from '../dsl/row-options.js';
import { rowSpotlight, renderRow, rowSvgDefs } from '../emit-row.js';
import { layoutGroupRow } from '../layout-group-row.js';
import { rowOutputDefinition } from '../row-output.js';
export const groupRowDefinition = {
    type: 'grouprow',
    selfDimming: true,
    spotlight: rowSpotlight,
    inventory: rowItems,
    svgDefs: rowSvgDefs,
    textSizes: childRuns,
    internal: true,
    layout: layoutGroupRow,
    children: data => data.children,
    outputDefinitions: { row: rowOutputDefinition },
    verify: { rects: childRects, targets: laid => laid.children, diagramFindings: frameLayoutFindings },
    emit: (laid, env) => renderRow(laid, env.theme, env.tones, env.roles, env.stage),
};
export function groupRow(children, opts = {}) {
    validateRowOptions(opts);
    const normalized = normalizeRowChildren(children);
    if (!normalized.some(child => child?.type === 'group'))
        throw new Error('bands/group-row: 少なくとも一つの group() を渡してください。箱だけの行には bands/row を使えます');
    const data = buildMixedRow(normalized, opts);
    return band(groupRowDefinition, data);
}
