import type { BandDef, PublicEnv } from './band-def.ts';
import type { FlowLayout } from './flow-layout-core.ts';
import type { FlowShapeBand, LaidOutFlowShape } from './flow-types.ts';
import type { FontFamily, Roles } from './types/core.ts';
type FlowDefinition = BandDef<FlowShapeBand, LaidOutFlowShape>;
type MeasureEnv = Parameters<NonNullable<FlowDefinition['measure']>>[1];
export declare function measureFlow<B extends FlowShapeBand>(data: B, { atoms, roles }: MeasureEnv, texts: (data: B, roles: Roles) => [string, number, number, FontFamily][]): void;
export declare function placeFlow<B extends FlowShapeBand>(data: B, env: PublicEnv, draw: FlowLayout<B>): {
    laid: LaidOutFlowShape | {
        type: FlowShapeBand['type'];
        id?: string;
        reveal?: number;
        until?: number;
        primitives: import("./flow-types.ts").FlowPrimitive[];
        texts: import("./flow-types.ts").FlowText[];
        anchors: import("./types/core.ts").Anchor[];
        labelBoxes: (import("./types/core.ts").Rect & {
            label: string;
        })[];
        bounds?: import("./types/core.ts").Anchor[];
        crossings?: string[];
        x: number;
        y: number;
        w: number;
        h: number;
        dim?: boolean;
        scope: string;
    };
    h: number;
    anchors: import("./types/core.ts").Anchor[];
};
export declare function flowItemIds(items: readonly {
    id?: string;
}[]): string[];
export declare const emitFlow: FlowDefinition['emit'];
export declare const verifyFlow: NonNullable<FlowDefinition['verify']>;
export {};
