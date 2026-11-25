import { layoutBoxLike } from '../layout-box-like.js';
import { groupItems } from '../inventory-boxes.js';
import { frameLayoutFindings } from '../layout-metrics.js';
import { band, DEF } from '../band-def.js';
import { group as buildGroup } from '../dsl/group.js';
import { renderGroup } from '../emit-group.js';
import { layoutGroup } from '../layout-group.js';
import { groupTitleBand } from '../layout-util.js';
import { captionDefinition } from './caption.js';
export const groupDefinition = {
    type: 'group',
    selfDimming: true,
    mapLoopBackChildren(data, expand) { data.children = expand(data.children); },
    inventory: groupItems,
    title: data => data.title ? [1, data.title] : undefined,
    internal: true,
    layoutBoxLike,
    layout: layoutGroup,
    children: data => data.children,
    stackWidth: (data, width) => width - 2 * (data.pad ?? 16),
    generated: data => data.title ? [band(captionDefinition, groupTitleBand(data))] : [],
    measure(data, { atoms, roles }) {
        if (data.stamp)
            atoms(data.stamp, roles.note, 400);
    },
    verify: { rects: () => [], targets: () => [], diagramFindings: frameLayoutFindings },
    emit: (laid, env) => renderGroup(laid, env.theme, env.tones, env.roles),
    locations: { drawsFrame: laid => laid.frame !== false },
};
export function group(children, opts) {
    const data = buildGroup(children, opts);
    return band(groupDefinition, data);
}
