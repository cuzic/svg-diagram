import type { SvgBandDefs } from './emit-svg-core.ts';
import type { ToneEnv } from './tokens.ts';
import type { LaidOutLegend } from './types/containers.ts';
import type { Theme, Roles } from './types/core.ts';
export declare function legendSvgDefs(band: LaidOutLegend): SvgBandDefs;
export declare function renderLegend(band: LaidOutLegend, day: Theme, tones: ToneEnv, roles: Roles): string;
