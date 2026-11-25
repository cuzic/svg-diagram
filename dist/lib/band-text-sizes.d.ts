import type { LaidOutBand } from './types/index.ts';
import type { WrappedRun } from './types/text-bands.ts';
type TextSizes<B> = (band: B) => Iterable<number>;
export declare const sizesOf: (xs: readonly {
    size: number;
}[]) => number[];
/** A band's own text runs (what box / caption / banner carry); any band that has them. */
export declare const ownRunSizes: (band: LaidOutBand) => number[];
export declare const childRuns: (band: {
    children: readonly {
        wrappedRuns: WrappedRun[];
    }[];
}) => number[];
export declare const texts: TextSizes<{
    texts: readonly {
        size: number;
    }[];
}>;
export declare const textsAndLabels: TextSizes<{
    texts: readonly {
        size: number;
    }[];
    labels: readonly {
        size: number;
    }[];
}>;
export {};
