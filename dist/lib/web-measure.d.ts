import type { Measured, MeasureRequest } from './types/core.ts';
type Req = Required<MeasureRequest>;
/**
 * Measures with getBBox() of a hidden SVG <text> in `host` (default: document.body, else the root element). Call `.dispose()` to remove the
 * hidden SVG. Measure after the fonts are loaded (`await document.fonts.ready`), and put `host` where it is displayed: a `display: none`
 * host measures everything as 0, which is reported here as an error rather than drawn.
 */
export declare function svgMeasurer(host?: Element): ((req: Req) => Measured) & {
    dispose(): void;
};
/** A measurer on a canvas context (no DOM): the width from measureText, the line height from the font's ascent and descent, each rounded. `ctx` defaults to a new OffscreenCanvas (or a <canvas> where there is none). */
export declare function canvasMeasurer(ctx?: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>): (req: Req) => Measured;
export {};
