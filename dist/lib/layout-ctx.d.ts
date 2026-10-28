import type { ScopeTable } from './anchor-scope.ts';
import type { LaidOutConnect, ConnectBand } from './types/containers.ts';
import type { DiagramData, Rect, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { Band, LaidOutBand } from './types/index.ts';
import type { BannerBand, BoxBand, CaptionBand, WrappedRun } from './types/text-bands.ts';
import type { ToneEnv } from './tokens.ts';
/** A band after placeBoxLike(): its own fields plus geometry, wrapped text and (maybe) the tag pill. */
export type Placed<B> = B & Rect & {
    wrappedRuns: WrappedRun[];
    tagBox?: Rect;
    inkBox?: Rect;
};
/** What setBox() reads off a box to make its anchor (a node's anchor is its icon). */
export type AnchorSource = Rect & {
    type?: string;
    icon?: string;
    iconAt?: string;
    iconSize?: number;
    padY?: number;
};
/** What row / grouprow need to know about their children when sharing gaps and column slots. */
export type RowLike = {
    gap: number;
    cols?: number;
    justify?: string;
    children: (Band & {
        span?: number;
        col?: number;
    })[];
};
/** `wrap` / `keepWords` (WrapEnv): diagram({wrap}) (default 'phrase') and diagram({keepWords}), resolved by layoutWith (ADR 0031 §2). */
export interface LayoutCtx extends WrapEnv {
    readonly d: DiagramData;
    readonly roles: Roles;
    readonly widthOf: WidthOf;
    /** The diagram's tone overrides, resolved once by layoutWith (ADR 0031 §2). */
    readonly tones: ToneEnv;
    /** The cursor: the y the next band is placed at. */
    y: number;
    readonly laidOut: LaidOutBand[];
    /** id -> {x,y,w,h} */
    readonly anchors: Map<string, Rect>;
    /** a node's anchor is its icon; an arrow leaving its bottom starts under the label */
    readonly nodeBottoms: Map<string, number>;
    /** ids of rows and row columns: anchors that hold other boxes */
    readonly areaIds: Set<string>;
    readonly connects: LaidOutConnect[];
    /** connect()s that came before the boxes they name */
    readonly deferred: ConnectBand[];
    /** Every scoped item of the figure (ADR 0012); empty when no band has a `scope`. */
    readonly scopes: ScopeTable;
    setBox(id: string, c: AnchorSource, h: number): void;
    /** Throws the duplicate-id error. */
    claimed(id: string, what: string): never;
    /** anchors.set(name, rect), after throwing claimed(name, what) when the name is taken. `scope`: the band's own (the name is `scope.id`). */
    register(id: string, rect: Rect, what: string, scope?: string): void;
    placeBoxLike<B extends CaptionBand | BoxBand | BannerBand>(band: B, x: number, y: number, w: number, isBoxLike: boolean, scope?: string): Placed<B>;
    /** Lays `bands` out one after the other at x / width, from the cursor on. */
    stack(bands: Band[], x: number, w: number): void;
    /** The gap a row's children are laid out with (grown to fit labelled connectors between them). */
    gapForLabels(band: RowLike, cw: number): number;
}
export type BandLayoutHandler<B> = (band: B, ctx: LayoutCtx, x: number, w: number) => void;
/** One handler per band type, each checked against its own band type. */
export type BandLayoutHandlers = {
    [T in Band['type']]?: BandLayoutHandler<Extract<Band, {
        type: T;
    }>>;
};
