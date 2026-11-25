import type { WithBandDef } from '../../band-def.ts';
import { affinity as build } from '../../dsl/affinity.ts';
import type { GroupRowBand, LaidOutRow } from '../../types/containers.ts';
export declare const affinity: (...args: Parameters<typeof build>) => WithBandDef<GroupRowBand, LaidOutRow>[];
export type { AffinityGroup, AffinityOpts } from '../../dsl/affinity.ts';
