import type { SvgBandDefs } from './emit-svg-core.ts';
import type { WrappedRun } from './types/text-bands.ts';
export declare function textSvgDefs(band: {
    wrappedRuns: readonly WrappedRun[];
}): SvgBandDefs;
export declare function childTextSvgDefs(band: {
    children: readonly {
        wrappedRuns: readonly WrappedRun[];
    }[];
}): SvgBandDefs;
