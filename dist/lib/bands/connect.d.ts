import type { BandDef, WithBandDef } from '../band-def.ts';
import { connect as buildConnect } from '../dsl/connect.ts';
import { bracket as buildBracket } from '../dsl/bracket.ts';
import { branch as buildBranch } from '../dsl/branch.ts';
import { callout as buildCallout } from '../dsl/callout.ts';
import type { BracketOpts, CalloutOpts } from '../dsl/connect.ts';
import type { BranchInput, ConnectInput, Ok } from '../strict.ts';
import type { ConnectBand, LaidOutConnect } from '../types/containers.ts';
export declare const connectDefinition: BandDef<ConnectBand, LaidOutConnect>;
export declare function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): WithBandDef<ReturnType<typeof buildConnect<F, T>>, LaidOutConnect>;
export declare function bracket<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: BracketOpts): WithBandDef<ReturnType<typeof buildBracket<F, T>>, LaidOutConnect>;
export declare function callout<const T extends string>(target: Ok<T>, opts: CalloutOpts): WithBandDef<ReturnType<typeof buildCallout<T>>, LaidOutConnect>;
export declare function branch<const F extends string, const T extends string>(from: Ok<F>, targets: (BranchInput & {
    to: Ok<T>;
})[], opts?: BranchInput): WithBandDef<ReturnType<typeof buildBranch<F, T>>[number], LaidOutConnect>[];
