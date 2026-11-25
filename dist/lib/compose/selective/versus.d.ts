import { DEF } from '../../band-def.ts';
import type { Band } from '../../types/index.ts';
import type { VersusOpts, VersusPart, VersusResult, VersusSharedOpts } from '../versus.ts';
export type { VersusConnectLabels, VersusOpts, VersusPart, VersusSharedOpts } from '../versus.ts';
type Selected = Band & {
    readonly [DEF]: object;
};
type Input = Selected | Selected[];
export declare function versus<LC extends Input, RC extends Input, const LI extends string = never, const RI extends string = never>(left: VersusPart<LC, LI>, right: VersusPart<RC, RI>, opts?: VersusOpts): (VersusResult<LC, RC, LI, RI>[number] & Selected)[];
export declare function versus<LC extends Input, RC extends Input, SC extends Input, const LI extends string, const RI extends string, const SI extends string>(left: VersusPart<LC, LI> & {
    id: LI;
}, right: VersusPart<RC, RI> & {
    id: RI;
}, opts: VersusSharedOpts<SC, SI>): (VersusResult<LC, RC, LI, RI, SC, SI>[number] & Selected)[];
