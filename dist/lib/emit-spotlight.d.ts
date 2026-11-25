import type { SpotlightHooks } from './band-def.ts';
import type { ScopeTable } from './scope-table.ts';
import type { DiagramData, Dimmed, Rect } from './types/core.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
type SpotlightOption = Pick<DiagramData, 'spotlight'>;
type SpotlightOf<T> = (band: T) => SpotlightHooks<never, object> | undefined;
export declare function spotlightIds({ spotlight }: SpotlightOption): string[];
/** How a bar outside the spotlight is drawn: a dotted outline (default) or a pale fill. */
export declare function spotlightDim({ spotlight }: SpotlightOption): 'outline' | 'fill';
export declare function spotlightEdges({ spotlight }: SpotlightOption): 'touching' | 'between';
export declare function litEdge(between: boolean, from: boolean, to: boolean): boolean;
/** Adds the internal dim flag after geometry is fixed. */
export declare function applySpotlightWith(d: LaidOutDiagram, spotlightOf: SpotlightOf<LaidOutBand>, scopes: ScopeTable, missingTarget?: (ids: string[]) => never): void;
/** Mute a band whose emitter does not handle dimming itself. */
export declare function dimBandSvg(svg: string): string;
/** Find parts by the same scoped name the layout registers. */
export declare function anchoredSpotlightTarget(band: {
    anchors: readonly (Rect & {
        id: string;
    })[];
}, id: string): Rect[];
type Container = Dimmed & {
    children: (Rect & Dimmed)[];
};
export declare const dimChildren: NonNullable<SpotlightHooks<never, Container>['dim']>;
export {};
