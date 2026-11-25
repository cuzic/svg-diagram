import { oneLine } from './diagram-description.js';
import { renderMath } from './emit-math.js';
import { snapGrid } from './layout-util.js';
import { layoutMath } from './math.js';
/** @internal Layout and emission of a formula that has already been converted to paths. */
export const mathDefinition = {
    type: 'math',
    describe: data => ['math', `数式: ${oneLine(data.alt)}`],
    layout(data, { x, y, w, roles, theme, tones }) {
        const laid = layoutMath(data, x, snapGrid(y), w, roles[data.role], theme, tones);
        return { laid, h: laid.h };
    },
    emit: renderMath,
};
