import type { LaidOutBand } from './types/index.ts';
export type LaidOutType = LaidOutBand['type'];
export type LaidOutOf<T extends LaidOutType> = Extract<LaidOutBand, {
    type: T;
}>;
