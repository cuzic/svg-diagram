import { steps as buildSteps } from '../steps.js';
import { boxDefinition } from './box.js';
import { rowLoopBack } from '../loop-back-source.js';
import { band, DEF } from '../band-def.js';
import { boxRow as buildRow } from '../dsl/box-row.js';
import { rowOutputDefinition } from '../row-output.js';
import { layoutRow } from '../layout-row.js';
export const rowDefinition = {
    ...rowOutputDefinition,
    layout: layoutRow,
    loopBackSource: rowLoopBack,
};
export function row(children, opts) {
    const data = buildRow(children, opts);
    return band(rowDefinition, data);
}
export function steps(items, opts) {
    const data = buildSteps(items, opts);
    data.children = data.children.map(child => band(boxDefinition, child));
    return band(rowDefinition, data);
}
