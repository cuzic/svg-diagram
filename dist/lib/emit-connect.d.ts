import type { SpotlightHooks } from './band-def.ts';
import type { SvgBandDefs } from './emit-svg-core.ts';
import type { ToneEnv } from './tokens.ts';
import type { LaidOutConnect, ConnectBand } from './types/containers.ts';
import type { Roles, Theme } from './types/core.ts';
export declare function connectorSvgDefs(connects: readonly LaidOutConnect[], day: Theme, tones: ToneEnv): SvgBandDefs & {
    markers: string;
};
export declare function renderConnect(c: LaidOutConnect, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare const connectSpotlight: SpotlightHooks<ConnectBand, LaidOutConnect>;
