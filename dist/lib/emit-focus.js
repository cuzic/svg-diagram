import { PALETTE, colorOf } from './tokens.js';
/** The colour of an arrow of a graph with `focus` (ADR 0051): lit (it touches a focused item) in the accent colour, the others muted; no focus: `plain`. */
export function focusInk(focused, dim, day, plain) {
    if (!focused || dim)
        return () => plain;
    const f = new Set(focused);
    return (from, to) => (typeof from === 'string' ? [from] : from).some(x => f.has(x)) || f.has(to) ? colorOf('accent', day) : PALETTE.muted;
}
