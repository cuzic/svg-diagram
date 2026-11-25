export type BalloonKind = 'say' | 'think' | 'shout' | 'narration';
export interface BalloonBody {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface BalloonTail {
    /** The point the tail ends in. */
    tip: readonly [number, number];
    /** Half the width of the wedge where it leaves the body (default 8). */
    halfWidth?: number;
}
export interface BalloonOutline {
    /** The closed outline, clockwise from the top edge. */
    d: string;
    /** Where the wedge meets the body (left out when there is no tail). */
    base?: [[number, number], [number, number]];
}
/** The corner radius of a body: `say` and `think` (the same shape, dashed) are rounded to the ends (at most 24), `shout` is nearly square, `narration` is square. */
export declare const balloonRadius: (kind: BalloonKind, h: number) => number;
export declare function balloonPath(body: BalloonBody, kind: BalloonKind, tail?: BalloonTail): BalloonOutline;
