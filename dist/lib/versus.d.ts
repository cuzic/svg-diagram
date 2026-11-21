import type { ConnectBand, GroupBand, GroupRowBand, SpacerBand } from './types/containers.ts';
import type { Arrow, BandInput, Route } from './types/core.ts';
import type { BoxTone } from './types/text-bands.ts';
import type { Declares, IdsOf, Refers, RefsOf } from './strict.ts';
export interface VersusPart<C extends BandInput = BandInput, Id extends string = string> {
    children: C;
    title?: string;
    tone?: BoxTone;
    /** How an array of children is laid out: 'column' (default, stacked) or 'row' (side by side, equal widths). */
    direction?: 'column' | 'row';
    id?: Id;
    /** Stage the whole side (frame and contents) appears at. The arrows to the shared part follow the later of their two ends. */
    reveal?: number;
}
export interface VersusConnectLabels {
    left?: string;
    right?: string;
}
export interface VersusOpts {
    shared?: undefined;
}
export interface VersusSharedOpts<C extends BandInput = BandInput, Id extends string = string> {
    shared: VersusPart<C, Id> & {
        id: Id;
    };
    connectLabels?: VersusConnectLabels;
    /** Route of the two connectors (default 'straight'). Each drops plumb from the middle of its side onto the shared frame, so both routes draw a vertical line. */
    connectRoute?: Route;
    /** Arrowhead of the two connectors (default 'end'; 'none' for a plain line). */
    connectArrow?: Arrow;
}
type VersusResult<LC, RC, LI extends string, RI extends string, SC = never, SI extends string = never> = ((GroupRowBand | GroupBand | ConnectBand | SpacerBand) & Declares<IdsOf<LC> | IdsOf<RC> | IdsOf<SC> | LI | RI | SI> & Refers<RefsOf<LC> | RefsOf<RC> | RefsOf<SC>>)[];
export declare function versus<LC extends BandInput, RC extends BandInput, const LI extends string = never, const RI extends string = never>(left: VersusPart<LC, LI>, right: VersusPart<RC, RI>, opts?: VersusOpts): VersusResult<LC, RC, LI, RI>;
export declare function versus<LC extends BandInput, RC extends BandInput, SC extends BandInput, const LI extends string, const RI extends string, const SI extends string>(left: VersusPart<LC, LI> & {
    id: LI;
}, right: VersusPart<RC, RI> & {
    id: RI;
}, opts: VersusSharedOpts<SC, SI>): VersusResult<LC, RC, LI, RI, SC, SI>;
export {};
