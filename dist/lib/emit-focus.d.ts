import type { Theme } from './types/core.ts';
/** The colour of an arrow of a graph with `focus` (ADR 0051): lit (it touches a focused item) in the accent colour, the others muted; no focus: `plain`. */
export declare function focusInk(focused: readonly string[] | undefined, dim: boolean | undefined, day: Theme, plain: string): (from: string | readonly string[], to: string) => string;
