import type { ConnectBand } from '../types/containers.ts';
import type { ConnectInput, Ok, Refers } from '../strict.ts';
export declare function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): ConnectBand & Refers<F | T>;
export { bracket, type BracketOpts } from './bracket.ts';
export { callout, type CalloutOpts } from './callout.ts';
export { branch } from './branch.ts';
