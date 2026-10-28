import type { DiagramData } from './types/core.ts';
/** Resolve inheritance once, before the one full layout shared by every stage. The per-band-type parts live in reveal-handlers.ts. */
export declare function prepareReveal(d: DiagramData): number;
export declare const visibleAt: (x: object & {
    reveal?: number;
    until?: number;
}, stage: number | undefined) => boolean;
