import type { GroupBand, GroupRowBand, RowOpts } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare function normalizeRowChildren(rawChildren: Band[]): (BoxBand | GroupBand)[];
export declare function buildMixedRow(children: (BoxBand | GroupBand)[], opts: RowOpts): GroupRowBand;
