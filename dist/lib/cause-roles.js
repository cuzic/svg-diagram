/** What a role looks like when the node gives no tone. `double`: the box has a second outline (the finding of the figure). */
export const CAUSE_ROLES = {
    effect: { tone: 'plain' },
    ude: { tone: 'danger' },
    root: { tone: 'accent', double: true },
    de: { tone: 'new' },
    injection: { tone: 'changed' },
    goal: { tone: 'accent', double: true },
    obstacle: { tone: 'plain' }, // drawn as a hexagon
    io: { tone: 'new' },
    action: { tone: 'changed' },
    start: { tone: 'accent', double: true },
    step: { tone: 'plain' },
    risk: { tone: 'danger' }, // drawn as a hexagon
    measure: { tone: 'changed' },
    precondition: { tone: 'removed' }, // a fact of the present nobody controls: the grey dashed box
    tipping: { tone: 'danger', double: true }, // where a negative branch tips over (ADR 0020 D1)
    trim: { tone: 'changed', dashed: true }, // the injection that cuts a negative branch: a dashed box
    need: { tone: 'solid' }, // an input of a transition tree's unit (current reality + need + action): the filled box, so that it is not the pale box of an io (ADR 0020 D2)
};
/** The 中核 badge (ADR 0015 D4): its height and its gap to the frame; emit-cause.ts draws it, the layout keeps the room. */
export const CORE_BADGE_H = 22, CORE_BADGE_W = 44, CORE_BADGE_GAP = 2;
/** How far inside the frame a `double` box's second outline runs (emit-cause.ts draws it): the box is that much taller at both ends, so
 *  the text keeps the same padding from the inner outline that a plain box keeps from its frame (#378). */
export const DOUBLE_INSET = 4;
