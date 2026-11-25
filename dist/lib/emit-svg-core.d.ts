import type { ToneEnv } from './tokens.ts';
import type { LaidOutConnect } from './types/containers.ts';
import type { Roles, Theme } from './types/core.ts';
import type { LaidOutDiagram, LaidOutBand } from './types/index.ts';
import type { connectorSvgDefs } from './emit-connect.ts';
export interface SvgBandDefs {
    mono?: boolean;
    arrow?: boolean;
    dimArrow?: boolean;
    strongArrow?: boolean;
    dimStrongArrow?: boolean;
}
export interface SvgServices {
    defsNeeded: (band: LaidOutBand) => SvgBandDefs;
    renderBand: (band: LaidOutBand, theme: Theme, tones: ToneEnv, roles: Roles, stage?: number, dimFill?: boolean) => string;
    connectorDefs?: typeof connectorSvgDefs;
    renderConnect: (connect: LaidOutConnect, theme: Theme, tones: ToneEnv, roles: Roles) => string;
    diagramTitle: (diagram: LaidOutDiagram) => string;
    diagramDesc: (diagram: LaidOutDiagram, reveal?: number) => string;
    spotlightDim: (diagram: LaidOutDiagram) => 'outline' | 'fill';
}
export declare function emitSvgWith(services: SvgServices, laidOutDiagram: LaidOutDiagram, opts?: {
    reveal?: number;
    noRecolor?: boolean;
}): string;
