import type { LaidOutConnect } from './types/containers.ts';
import type { connectorSvgDefs } from './emit-connect.ts';
import type { checkConnectionGeometry } from './verify-connect-geometry.ts';
import type { layoutBoxLike } from './layout-box-like.ts';
import type { fitLineScale } from './layout-cause-fit.ts';
import type { prepareConnectorGaps } from './layout-connect-gaps.ts';
import type { areasPrelayout } from './layout-areas-gaps.ts';
import type { loopBackConnectors } from './loop-back-connectors.ts';
import type { LoopBackSource } from './loop-back-source.ts';
import type { connectorInventory } from './inventory-lines.ts';
import type { InventoryContext } from './inventory-core.ts';
import type { BandDescription } from './diagram-description.ts';
import type { LegendNotationBand } from './legend-notation.ts';
import type { ValueAxis } from './axis-comparison.ts';
import type { SvgBandDefs } from './emit-svg-core.ts';
import type { resolveConnect } from './layout-connect.ts';
import type { BandLayoutHandler } from './layout-ctx.ts';
import type { RevealHandler } from './reveal-warnings.ts';
import type { ToneEnv } from './tokens.ts';
import type { Anchor, Appearance, ColorKey, DiagramData, FontFamily, FontWeight, Rect, RevealOpts, Roles, ScopeOpts, SlideCanvas, TextTone, Theme, WidthOf, WrapMode } from './types/core.ts';
import type { Band, LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { InventoryItem } from './types/inventory.ts';
import type { CheckRect, Finding } from './types/verdicts.ts';
export type DiagramFindings = (diagram: LaidOutDiagram, stage?: number) => Finding[];
export declare const DEF_API = "0.1";
export declare const DEF: unique symbol;
export declare const EXTERNAL: unique symbol;
export interface PublicEnv extends Pick<Rect, 'x' | 'y' | 'w'> {
    widthOf: WidthOf;
    roles: Roles;
    theme: Theme;
    tones: ToneEnv;
    wrap: WrapMode;
    keepWords?: boolean;
    space?: number;
    today?: string;
    canvas?: SlideCanvas;
    geometryScale?: number;
}
export interface TextItem {
    x: number;
    y: number;
    text: string;
    size: number;
    weight?: FontWeight;
    font?: FontFamily;
    anchor?: 'start' | 'middle' | 'end';
    tone?: TextTone;
    lines?: string[];
    w?: number;
    part?: string;
    reveal?: number;
}
interface MeasureEnv {
    readonly roles: Roles;
    readonly today?: string;
    atoms(text: string, size: number, weight: number, font?: FontFamily): void;
}
interface EmitEnv {
    readonly stage?: number;
    readonly dimFill?: boolean;
    readonly theme: Theme;
    readonly roles: Roles;
    readonly tones: ToneEnv;
    color(key: ColorKey): string;
}
export interface VerifyCtx {
    readonly theme: Theme;
    readonly tones: ToneEnv;
    readonly appearance?: Appearance;
    readonly rcaCheck?: DiagramData['rcaCheck'];
    readonly dimFill?: boolean;
    readonly connects: readonly {
        readonly fromId: string;
        readonly toId: string;
        readonly segments: readonly Readonly<Rect>[];
    }[];
}
interface BandFinding {
    rule: string;
    severity: 'problem' | 'warn' | 'info';
    message: string;
    where?: string;
}
interface SpotlightFocus {
    readonly ids: ReadonlySet<string>;
    contains(rect: Rect): boolean;
}
export interface SpotlightHooks<D, L extends object> {
    /** A placed band's own id is scoped, like the steps in a swimlane. */
    scopedId?: true;
    /** Placed parts addressed by an id, optionally restricted to connector endpoints. */
    targets?(laid: L, id: string, endpoint: boolean): readonly Rect[];
    /** Apply the spotlight to a placed band's internal parts. */
    dim?(laid: L, focus: SpotlightFocus): void;
    /** Pre-layout connector endpoints for the automatic legend. */
    endpoints?(data: D): readonly [string, string];
}
interface BandHooks<D, L extends object> {
    type: string;
    readonly [EXTERNAL]?: true;
    emit(laid: L, env: EmitEnv): string;
    /** The emitter draws its own dim state. */
    selfDimming?: true;
    spotlight?: SpotlightHooks<D, L>;
    svgDefs?(laid: L): SvgBandDefs;
    loopBackSource?(data: D): LoopBackSource | undefined;
    measure?(data: D, env: MeasureEnv): void;
    textSizes?(laid: L): Iterable<number>;
    /** Largest unscaled text size opted into the extended role range. */
    fillTextSize?(data: D, unscaledRoles: Roles): number;
    valueAxis?(data: D): ValueAxis | undefined;
    verify?: {
        /** @internal Authored samples for the diagram-wide grayscale comparison. */
        tones?(data: D): readonly string[];
        /** @internal Placed samples for the diagram-wide grayscale comparison. */
        layoutTones?(laid: L): readonly string[];
        /** @internal A participant in the diagram-wide legend completeness check. */
        legendNotation?(data: D): LegendNotationBand;
        /** @internal Children whose visible labels already explain their notation. */
        wordedChildren?(data: D): readonly Band[];
        figureExtent?(laid: L): Rect | null;
        targets?(laid: L): readonly Extract<LaidOutBand, Rect>[];
        rects?(laid: L): CheckRect[];
        findings?(data: D, ctx: VerifyCtx): Finding[];
        layoutFindings?(laid: L, ctx: VerifyCtx): Finding[];
        diagramFindings?: DiagramFindings | readonly DiagramFindings[];
        check?(laid: L, ctx: VerifyCtx): BandFinding[];
        contrast?(laid: L, ctx: VerifyCtx): string[];
        acceptHint?(rule: string): string | undefined;
    };
    /** An inferred SVG title, with headlines before group headings and figure labels. */
    title?(data: D): readonly [priority: 0 | 1 | 2, text: string | undefined] | undefined;
    describe?(data: D, stage?: number): BandDescription | undefined;
    ids?(data: D): string[];
    reveal?: RevealHandler<D>;
    revealElements?(data: D, start: number, end?: number): {
        last: number;
        warnings: string[];
        items?: readonly {
            id?: string;
            reveal?: number;
            until?: number;
        }[];
    };
    inventory?(laid: L, ctx: InventoryContext): InventoryItem[];
    rules?: Record<string, {
        doc: string;
        scope: 'band' | 'band-grouped' | 'diagram';
    }>;
    docs?: {
        summary: string;
        usage: string;
        example: unknown;
    };
    children?(data: D): Band[];
    generated?(data: D): Band[];
    stackWidth?(data: D, width: number): number;
    nodeIds?: 'host' | 'self';
    /** Trusted only: the placed band with `dataNode` on each node it draws as a plain frame (emitSvg({nodeIds: true})); a band without the hook names none. */
    nameNodes?(laid: L): object;
    /** Trusted only: how the location map (ADR 0072 D6) reads a placed band. */
    locations?: {
        /** Whether the band (`item` undefined) or one of its items is drawn as a frame, which the map insets. Default: no. */
        drawsFrame?(laid: L, item?: number): boolean;
        /** The drawn geometry of the item whose anchor is `rect`; undefined keeps the anchor's own (framed or not). */
        itemRect?(laid: L, rect: Rect, index: number): Rect | undefined;
        /** An anchor the maker named itself: no source node belongs to it. */
        synthetic?(laid: L, id: string): boolean;
    };
    rectsQualified?: boolean;
    offGrid?: boolean;
}
interface PublicLayout<D, L extends object> {
    internal?: never;
    layout(data: D, env: PublicEnv): {
        h: number;
        anchors?: Anchor[];
        texts?: TextItem[];
        paper?: boolean;
        laid: L & Rect;
    };
}
interface InternalLayout<D> {
    internal: true;
    layoutBoxLike?: typeof layoutBoxLike;
    fitLineScale?: typeof fitLineScale;
    decorateCaptions?(data: DiagramData): Band[];
    areasPrelayout?: typeof areasPrelayout;
    /** The bands this one lays out as placed bands of another type, by that type: a placed band of the type is handled by this definition (its own type's one). */
    outputDefinitions?: Readonly<Record<string, BandDef<any, any>>>;
    revealConnector?(placed: LaidOutConnect, ids: ReadonlyMap<string, {
        start: number;
        end?: number;
    }>): LaidOutConnect;
    resolveConnect?: typeof resolveConnect;
    checkConnectionGeometry?: typeof checkConnectionGeometry;
    connectorDefs?: typeof connectorSvgDefs;
    connectorGaps?: typeof prepareConnectorGaps;
    connectorInventory?: typeof connectorInventory;
    loopBackConnectors?: typeof loopBackConnectors;
    mapLoopBackChildren?(data: D, expand: (children: Band[]) => Band[]): void;
    layout(...args: Parameters<BandLayoutHandler<D>>): void;
}
export type BandDef<D = unknown, L extends object = Rect> = BandHooks<D, L> & (PublicLayout<D, L> | InternalLayout<D>);
type ExternalType = `${string}:${string}`;
type ExternalBand<T> = T extends ExternalType ? {
    type: T;
    id?: string;
} & ScopeOpts & RevealOpts : never;
export type BandValue<T extends Band['type'] | ExternalType> = (Extract<Band, {
    type: T;
}> | ExternalBand<T>) & {
    readonly [DEF]: BandDef;
};
export declare function assertTrustedBandFields(def: Pick<BandDef, 'type' | 'internal' | 'nodeIds' | 'rectsQualified' | typeof EXTERNAL> & {
    nameNodes?: unknown;
    locations?: unknown;
}): void;
export type WithBandDef<D, L extends object> = D & {
    readonly [DEF]: BandDef<D, L>;
};
export declare function band<D extends {
    type: string;
}, L extends object>(def: BandDef<D, L>, data: D): WithBandDef<D, L>;
export declare const isDefKey: (key: PropertyKey) => boolean;
export declare function defOf(b: object): BandDef | undefined;
export declare function definedNestedBandsOf(band: Band): readonly Band[];
/** Visit selected bands and their nested content in input order. */
export declare function walkDefinedBands(bands: readonly Band[], out?: Band[]): Band[];
/** Copy a band with its prototype, definition and non-enumerable handles. */
export declare function copyBand<T extends object>(b: T): T;
/**
 * Recursively strip definition keys from arrays and plain objects for comparisons.
 * Other objects are returned by reference. Accessors are preserved without stripping their getter results.
 */
export declare function plain<T>(v: T): T;
export {};
