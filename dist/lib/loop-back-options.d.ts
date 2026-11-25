import type { LoopBack } from './types/containers.ts';
/**
 * Checks what the author wrote for a band of `n` steps and returns it with every end as a 1-based number. `ids` are the item ids of a chevron, which may
 * also be given instead of a number. Two loops must nest (one span inside the other) or touch at most at an end: partly overlapping spans cross.
 */
export declare function resolveLoopBacks(who: string, raw: LoopBack | readonly LoopBack[], n: number, ids?: readonly (string | undefined)[]): LoopBack[];
