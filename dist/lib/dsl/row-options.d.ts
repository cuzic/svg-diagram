import type { GroupBand, GroupRowBand, RowBand, RowOpts } from '../types/containers.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare function validateRowOptions(opts: RowOpts): void;
export declare function withRowHandle<T extends RowBand | GroupRowBand>(band: T, opts: RowOpts): T;
export declare function spanRow<C extends BoxBand | GroupBand>(children: C[], cols: number | number[] | undefined): {
    cols: number | undefined;
    kids: C[];
};
