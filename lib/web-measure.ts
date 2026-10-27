// Measurers for a web page. A measurer gives renderInBrowser() the width and height of a run of text; a page that measures another way
// (a Worker, a server) gives its own function.
//
// svgMeasurer() is the one to use: it reads getBBox() of an SVG <text>, which is how lib/measure.ts measures in Chromium and what the
// browser draws the figure's own <text> with, so a box sized from it holds the text. canvasMeasurer() is lighter (no DOM) but approximate:
// canvas reports the first font's ascent and descent, while an SVG text box grows with the fallback fonts (mono + CJK, emoji), and it
// is a fraction of a pixel narrower in some fonts. Draw with the same fonts you measure with (FONT_STACKS).
import {FONT_STACKS} from './tokens.ts';
import type {Measured, MeasureRequest} from './types/core.ts';

type Req = Required<MeasureRequest>;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Measures with getBBox() of a hidden SVG <text> in `host` (default: document.body). Call `.dispose()` to remove the hidden SVG. */
export function svgMeasurer(host?: Element): ((req: Req) => Measured) & {dispose(): void} {
  const root = host ?? document.body;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('style', 'position:absolute;left:-9999px;top:0;visibility:hidden');
  svg.setAttribute('aria-hidden', 'true');
  root.appendChild(svg);
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('xml:space', 'preserve'); // otherwise a whitespace-only run collapses to nothing
  text.setAttribute('x', '0'); text.setAttribute('y', '100');
  svg.appendChild(text);
  const measure = ({text: t, size, weight, font}: Req): Measured => {
    text.setAttribute('font-family', FONT_STACKS[font]);
    text.setAttribute('font-size', String(size));
    text.setAttribute('font-weight', String(weight));
    text.textContent = t;
    const b = (text as unknown as SVGGraphicsElement).getBBox();
    return {w: b.width, h: b.height};
  };
  return Object.assign(measure, {dispose: () => svg.remove()});
}

/** A measurer on a canvas context (no DOM): the width from measureText, the line height from the font's ascent and descent, each rounded. `ctx` defaults to a new OffscreenCanvas (or a <canvas> where there is none). */
export function canvasMeasurer(ctx?: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>): (req: Req) => Measured {
  const c = ctx ?? (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas')).getContext('2d') as CanvasRenderingContext2D;
  return ({text, size, weight, font}) => {
    c.font = `${weight} ${size}px ${FONT_STACKS[font]}`;
    const m = c.measureText(text);
    // fontBoundingBox* is missing before Firefox 116: the actual box of the run, then a plain line height, rather than a NaN height
    const up = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? size * 0.88, down = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? size * 0.24;
    return {w: m.width, h: Math.round(up) + Math.round(down)};
  };
}
