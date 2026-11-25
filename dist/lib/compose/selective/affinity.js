import { band } from '../../band-def.js';
import { boxDefinition } from '../../bands/box.js';
import { gridDefinition } from '../../bands/grid.js';
import { groupDefinition } from '../../bands/group.js';
import { groupRowDefinition } from '../../bands/group-row.js';
import { affinity as build } from '../../dsl/affinity.js';
function selectGroup(group) {
    return band(groupDefinition, { ...group, children: group.children.map(child => {
            if (child.type === 'box')
                return band(boxDefinition, child);
            if (child.type === 'grid')
                return band(gridDefinition, { ...child, children: child.children.map(box => band(boxDefinition, box)) });
            if (child.type === 'grouprow')
                return selectRow(child);
            throw new Error(`affinity(): unexpected child "${child.type}"`);
        }) });
}
function selectRow(row) {
    return band(groupRowDefinition, { ...row, children: row.children.map(child => child.type === 'group' ? selectGroup(child) : band(boxDefinition, child)) });
}
export const affinity = (...args) => build(...args).map(selectRow);
