// Shared typing for the per-band-type handler tables of the laid-out stage (emit-handlers.ts, verify-handlers.ts, fit-handlers.ts).
// A table is satisfied against `{[T in LaidOutType]: Handler<LaidOutOf<T>>}`: each key is checked against its own band type,
// and a missing key is a compile error.

import type {LaidOutBand} from './types.ts';

export type LaidOutType = LaidOutBand['type'];
export type LaidOutOf<T extends LaidOutType> = Extract<LaidOutBand, {type: T}>;
