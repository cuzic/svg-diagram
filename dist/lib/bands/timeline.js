import { texts } from '../band-text-sizes.js';
import { band } from '../band-def.js';
import { buildTimeline } from '../dsl/timeline.js';
import { renderTimeline } from '../emit-timeline.js';
import { layoutTimeline, timelineTexts } from '../timeline.js';
import { timelineProblems } from '../verify-timeline.js';
const definition = {
    type: 'timeline',
    selfDimming: true,
    offGrid: true,
    textSizes: texts,
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of timelineTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles }) {
        const laid = layoutTimeline(data, x, y, w, widthOf, roles);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme }) => renderTimeline(laid, theme),
    verify: {
        check: laid => timelineProblems(laid).map(message => ({ rule: 'timeline', severity: 'problem', message })),
    },
};
export function timeline(opts) {
    return band(definition, buildTimeline(opts));
}
/** @internal Definition used by the full renderer. */
export const timelineDefinition = definition;
