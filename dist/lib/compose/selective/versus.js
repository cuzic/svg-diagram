import { band, defOf, DEF } from '../../band-def.js';
import { connectDefinition } from '../../bands/connect.js';
import { groupDefinition } from '../../bands/group.js';
import { groupRowDefinition } from '../../bands/group-row.js';
import { rowDefinition } from '../../bands/row.js';
import { spacerDefinition } from '../../bands/spacer.js';
import { versus as build } from '../versus.js';
function attachGroup(data) {
    return band(groupDefinition, { ...data, children: data.children.map(attach) });
}
function attach(data) {
    if (defOf(data))
        return data;
    switch (data.type) {
        case 'group': return attachGroup(data);
        case 'grouprow': return band(groupRowDefinition, { ...data, children: data.children.map(child => child.type === 'group' && !defOf(child) ? attachGroup(child) : child) });
        case 'row': return band(rowDefinition, data);
        case 'spacer': return band(spacerDefinition, data);
        case 'connect': return band(connectDefinition, data);
        default: throw new Error(`versus(): import "${data.type}" from its svg-diagram/bands entry`);
    }
}
export function versus(left, right, opts = {}) {
    const data = opts.shared ? build({ ...left, id: left.id ?? '' }, { ...right, id: right.id ?? '' }, opts) : build(left, right);
    return data.map(attach);
}
