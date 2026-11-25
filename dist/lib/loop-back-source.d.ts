import type { LoopBack, RowBand } from './types/containers.ts';
import type { ChevronBand } from './flow-types.ts';
export interface LoopBackSource {
    loops: LoopBack | readonly LoopBack[];
    anchor(id: string, index: number): string;
}
export declare function rowLoopBack(row: RowBand): LoopBackSource | undefined;
export declare function chevronLoopBack(chevron: ChevronBand): LoopBackSource | undefined;
