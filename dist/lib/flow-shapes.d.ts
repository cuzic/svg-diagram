import type { LoopBack } from './types/containers.ts';
import type { EmblemShape } from './emblem-shapes.ts';
import type { Anchor, Dimmed, FontFamily, Rect, RevealOpts, ScopeOpts, Roles, TextTone, WidthOf, WrapMode } from './types/core.ts';
import type { BoxTone } from './types/text-bands.ts';
export interface FlowStep {
    label: string;
    sub?: string;
    id?: string;
    tone?: BoxTone;
}
export interface ChevronOpts extends RevealOpts, ScopeOpts {
    loopBack?: LoopBack | readonly LoopBack[];
    id?: string;
    direction?: 'horizontal' | 'vertical';
    first?: 'pentagon' | 'chevron';
    gap?: number;
    current?: number;
    highlight?: number;
    width?: number;
}
export interface FunnelStage {
    label: string;
    value?: number;
    id?: string;
    tone?: BoxTone;
}
export interface FunnelOpts extends RevealOpts, ScopeOpts {
    id?: string;
    scale?: 'value' | 'even';
    showRate?: boolean;
    width?: number;
}
export interface CycleOpts extends RevealOpts, ScopeOpts {
    id?: string;
    centre?: string;
    direction?: 'cw' | 'ccw';
    width?: number;
}
export interface VennSet {
    name: string;
    label?: string;
    id?: string;
    tone?: TextTone;
}
export interface VennOverlap {
    sets: readonly string[];
    label: string;
}
export interface VennOpts extends RevealOpts, ScopeOpts {
    id?: string;
    overlaps?: readonly VennOverlap[];
    centre?: string;
    universe?: string | boolean;
    width?: number;
}
export interface ConcentricRing {
    label: string;
    description?: string;
    id?: string;
    tone?: TextTone;
}
export type { EmblemShape } from './emblem-shapes.ts';
export interface EmblemItem {
    label: string;
    sub?: string;
    shape?: EmblemShape;
    id?: string;
    tone?: BoxTone;
}
export interface EmblemOpts extends RevealOpts, ScopeOpts {
    id?: string; /** The shape of every item that does not name its own. */
    shape?: EmblemShape;
    gap?: number; /** The least width of a shape (the shapes grow to hold their text, all to the same size). */
    minSize?: number;
    width?: number;
}
export interface ConcentricOpts extends RevealOpts, ScopeOpts {
    id?: string;
    order?: 'outer-first' | 'inner-first';
    labels?: 'inside' | 'side';
    centre?: string;
    width?: number;
}
export interface ChevronBand extends ChevronOpts {
    type: 'chevron';
    steps: FlowStep[];
    direction: 'horizontal' | 'vertical';
    first: 'pentagon' | 'chevron';
    gap: number;
}
export interface FunnelBand extends FunnelOpts {
    type: 'funnel';
    stages: FunnelStage[];
    scale: 'value' | 'even';
    showRate: boolean;
}
export interface CycleBand extends CycleOpts {
    type: 'cycle';
    steps: FlowStep[];
    direction: 'cw' | 'ccw';
}
export interface VennBand extends VennOpts {
    type: 'venn';
    sets: VennSet[];
    overlaps: VennOverlap[];
}
export interface ConcentricBand extends ConcentricOpts {
    type: 'concentric';
    rings: ConcentricRing[];
    order: 'outer-first' | 'inner-first';
    labels: 'inside' | 'side';
}
export interface EmblemBand extends EmblemOpts {
    type: 'emblem';
    items: EmblemItem[];
    shape: EmblemShape;
    gap: number;
}
export type FlowShapeBand = ChevronBand | FunnelBand | CycleBand | VennBand | ConcentricBand | EmblemBand;
export interface FlowText extends Rect {
    text: string;
    tx: number;
    ty: number;
    size: number;
    weight: 400 | 700;
    anchor: 'start' | 'middle' | 'end';
    tone: TextTone;
}
export type FlowPrimitive = ({
    k: 'polygon';
    points: [number, number][];
    tone: BoxTone;
    strong?: boolean; /** the id of the item this is the frame of (ADR 0034: withNodeIds turns it into `dataNode`) */
    node?: string;
    dataNode?: string;
} & Dimmed) | ({
    k: 'circle';
    cx: number;
    cy: number;
    r: number;
    tone: TextTone;
    opacity?: number;
    dash?: string; /** Drawn as a box of this tone (filled, outlined) instead of a tinted ring. */
    fill?: BoxTone;
    node?: string;
    dataNode?: string;
} & Dimmed) | ({
    k: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
    tone: TextTone;
} & Dimmed) | ({
    k: 'path';
    d: string;
    tone: TextTone;
    arrow?: boolean;
    thin?: boolean; /** Drawn as a box of this tone (filled, outlined) instead of a line; `box` is the extent of what is drawn. */
    fill?: BoxTone;
    box?: Rect;
    node?: string;
    dataNode?: string;
} & Dimmed);
export interface LaidOutFlowShape extends Rect, Dimmed {
    type: FlowShapeBand['type'];
    id?: string;
    reveal?: number;
    until?: number;
    primitives: FlowPrimitive[];
    texts: FlowText[];
    anchors: Anchor[];
    labelBoxes: (Rect & {
        label: string;
    })[]; /** emblem: the bounding box of each shape that has an id (the checks' obstacle, which may be larger than its anchor). */
    bounds?: Anchor[];
}
export declare function chevronBand(steps: readonly FlowStep[], opts?: ChevronOpts): ChevronBand;
export declare function funnelBand(stages: readonly FunnelStage[], opts?: FunnelOpts): FunnelBand;
export declare function cycleBand(steps: readonly FlowStep[], opts?: CycleOpts): CycleBand;
export declare function vennBand(sets: readonly VennSet[], opts?: VennOpts): VennBand;
export declare function concentricBand(rings: readonly ConcentricRing[], opts?: ConcentricOpts): ConcentricBand;
export declare function emblemBand(items: readonly EmblemItem[], opts?: EmblemOpts): EmblemBand;
export declare const flowShapeIds: (b: FlowShapeBand) => string[];
export declare function flowShapeTexts(b: FlowShapeBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutFlowShape(b: FlowShapeBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutFlowShape;
