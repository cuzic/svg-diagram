import { band } from '../../band-def.js';
import { boxDefinition } from '../../bands/box.js';
import { gridDefinition } from '../../bands/grid.js';
import { canvas as build } from '../canvas.js';
export function canvas(template, content, opts) {
    const data = build(template, content, opts);
    return band(gridDefinition, { ...data, children: data.children.map(child => band(boxDefinition, child)) });
}
