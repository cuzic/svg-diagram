// Spec parts of round R7 (see lib/spec.ts): quality function deployment and the why-why table. Each keeps its schema, example,
// checks and builder together.
//
// Not in specs: stateMatrix. Its cells are wireframe parts (a screen in each state), and a spec has no wireframe vocabulary; the same
// grid with words in its cells is a `table`.
import { qfd, whyWhyTable } from '../dsl-pure.js';
import { defineQfdPart } from './qfd.js';
import { defineWhyWhyTablePart } from './why-why-table.js';
export { MAX_WHY_CHAINS, MAX_WHY_STEPS } from './r7-common.js';
export const PARTS_R7 = [
    defineQfdPart(qfd),
    defineWhyWhyTablePart(whyWhyTable),
];
