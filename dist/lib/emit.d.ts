import type { LaidOutDiagram } from './types/index.ts';
export { resolveTextColor, resolveBoxStyle } from './emit-common.ts';
export type { BoxStyle } from './emit-common.ts';
export { renderFlowShape } from './emit-figures.ts';
export declare function emitSvg(laidOutDiagram: LaidOutDiagram, opts?: {
    reveal?: number;
    noRecolor?: boolean;
    nodeIds?: boolean;
}): string;
