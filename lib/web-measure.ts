// The reference Measurer for a web page: the width of a run of text from canvas.measureText, the line height from the font's own ascent and
// descent, each rounded to a whole pixel (what Chromium gives a line of text; lib/font-metrics.ts does the same from the font files).
// A page that measures another way (a hidden DOM node, a server) gives renderInBrowser() its own function.
import {FONT_STACKS} from './tokens.ts';
import type {Measured, MeasureRequest} from './types/core.ts';

/** A measurer on a canvas context. `ctx` defaults to a new OffscreenCanvas (or a <canvas> where there is none). */
export function canvasMeasurer(ctx?: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>): (req: Required<MeasureRequest>) => Measured {
  const c = ctx ?? (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas')).getContext('2d') as CanvasRenderingContext2D;
  return ({text, size, weight, font}) => {
    c.font = `${weight} ${size}px ${FONT_STACKS[font]}`;
    const m = c.measureText(text);
    return {w: m.width, h: Math.round(m.fontBoundingBoxAscent) + Math.round(m.fontBoundingBoxDescent)};
  };
}
