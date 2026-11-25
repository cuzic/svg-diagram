import type { ConnectBand } from '../types/containers.ts';
import type { BranchInput, Ok, Refers } from '../strict.ts';
export declare function branch<const F extends string, const To extends string>(from: Ok<F>, targets: (BranchInput & {
    to: Ok<To>;
})[], opts?: BranchInput): (ConnectBand & Refers<F | To>)[];
