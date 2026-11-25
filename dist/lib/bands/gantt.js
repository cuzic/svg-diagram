import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { gantt as buildGantt } from '../dsl/gantt.js';
import { ganttBarGeometry, renderGantt } from '../emit-gantt.js';
import { ganttTexts, layoutGantt } from '../gantt.js';
import { snapGrid } from '../layout-util.js';
import { figureRects } from '../verify-rects.js';
import { ganttProblems } from '../verify-gantt.js';
const withToday = (data, today) => data.today === 'auto' && today !== undefined ? { ...data, today } : data;
const definition = {
    type: 'gantt',
    selfDimming: true,
    textSizes: texts,
    ids: data => data.rows.flatMap(row => 'id' in row && row.id ? [row.id] : []),
    measure(data, { atoms, roles, today }) {
        for (const [text, size, weight, font] of ganttTexts(withToday(data, today), roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, today, geometryScale }) {
        const laid = layoutGantt(withToday(data, today), x, snapGrid(y), w, widthOf, roles, geometryScale);
        return { laid, h: laid.h, anchors: laid.anchors };
    },
    locations: {
        // Only tasks with IDs have anchors, so the anchor index need not be the bar index.
        itemRect(laid, rect) {
            const bar = laid.bars.find(b => b.x === rect.x && b.y === rect.y && b.w === rect.w && b.h === rect.h);
            return bar && !bar.milestone ? ganttBarGeometry(bar) : undefined;
        },
    },
    emit(laid, { theme }) {
        return renderGantt(laid, theme);
    },
    verify: {
        rects: figureRects,
        check: laid => ganttProblems(laid).map(message => ({ rule: 'gantt', severity: 'problem', message })),
    },
};
export function gantt(rows, opts) {
    const data = buildGantt(rows, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const ganttDefinition = definition;
