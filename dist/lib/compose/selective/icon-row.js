import { band } from '../../band-def.js';
import { boxDefinition } from '../../bands/box.js';
import { rowDefinition } from '../../bands/row.js';
import { iconRow as build } from '../icon-row.js';
export function iconRow(items, opts) {
    const data = build(items, opts);
    return band(rowDefinition, { ...data, children: data.children.map(child => band(boxDefinition, child)) });
}
