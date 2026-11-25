import { must } from './must.js';
export function rowLoopBack(row) {
    if (row.loopBack)
        return { loops: row.loopBack, anchor: (id, index) => `${id}#${index}` };
    return undefined;
}
export function chevronLoopBack(chevron) {
    if (!chevron.loopBack)
        return undefined;
    return { loops: chevron.loopBack, anchor(id, index) {
            const step = must(chevron.steps[index - 1]);
            return step.id ?? (step.id = `${id}__${index}`);
        } };
}
