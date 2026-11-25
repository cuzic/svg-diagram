export type Pt = readonly [number, number];
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type BalloonShape = 'rect' | 'round' | 'ellipse' | 'cloud';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface BalloonOpts {
    /** Corner radius of 'round'. Defaults to one sixth of the shorter side. */
    radius?: number;
    /** Half the wedge width in follow mode for rect and round. Defaults to clamp(side / 4, 12, 28) / 2. */
    halfWidth?: number;
    /** Follow the tip along the edge, or use the Office preset's fixed base. */
    base?: 'follow' | 'office';
}
interface Dot {
    c: Pt;
    r: number;
}
export interface Balloon {
    /** The closed outline, including the wedge for rect, round and ellipse. */
    d: string;
    /** Where the tail meets the body. For a cloud, both points are the start of the trail. */
    base?: [Pt, Pt];
    tip?: Pt;
    side?: Side;
    /** The cloud's trail, starting at the body. */
    dots?: Dot[];
    /** The distance from the midpoint of the base to the tip. */
    length: number;
    /** The shortest cloud trail that fits the three circles and their clearances. */
    minLength?: number;
    /** The angle of the wedge in degrees. A cloud has no wedge and returns 0. */
    apex: number;
    /** Whether the supplied tip is inside the body. Rect and round use the strict bounding rectangle. */
    inside: boolean;
}
/** Generate the outline from finite inputs within ±1e6 px and positive dimensions. A non-finite tip omits the tail. */
export declare function balloonOutline(shape: BalloonShape, body: Rect, tip?: Pt, opts?: BalloonOpts): Balloon;
/** Sample the actual cloud outline at per points per arc. */
export declare function cloudPolygon(body: Rect, per?: number): Pt[];
/** The three Office trail radii, from body to tip. */
export declare function cloudRadii(ss: number): [number, number, number];
/** Largest centred rectangle in the body's proportions with its corners and side midpoints inside the cloud. */
export declare function cloudTextRect(body: Rect): Rect;
/** Office adjustments express the offset from the centre in 1/100000 of the width and height. A non-finite tip has no adjustments. */
export declare function officeAdj(body: Rect, tip: Pt): [number, number] | undefined;
export {};
