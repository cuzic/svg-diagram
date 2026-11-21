import type { LaidOutDiagram } from './types/index.ts';
export { resolveTextColor, resolveBoxStyle } from './emit-common.ts';
export type { BoxStyle } from './emit-common.ts';
export { renderFlowShape } from './emit-figures.ts';
/** `parts`: mark each part's elements with `data-part` (ADR 0054), for the PowerPoint export; nothing else changes. */
export declare function emitSvg(laidOutDiagram: LaidOutDiagram, opts?: {
    reveal?: number;
    noRecolor?: boolean;
    nodeIds?: boolean;
    parts?: boolean;
}): string;
