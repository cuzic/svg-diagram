// Measurers for a web page. A measurer gives renderInBrowser() the width and height of a run of text; a page that measures another way
// (a Worker, a server) gives its own function.
//
// svgMeasurer() is the one to use: it reads getBBox() of an SVG <text>, which is how lib/measure.ts measures in Chromium and what the
// browser draws the figure's own <text> with, so a box sized from it holds the text. canvasMeasurer() is lighter (no DOM) but approximate:
// canvas reports the first font's ascent and descent, while an SVG text box grows with the fallback fonts (mono + CJK, emoji), and it
// is a fraction of a pixel narrower in some fonts. Draw with the same fonts you measure with (FONT_STACKS).
import { FONT_STACKS } from './tokens.js';
const SVG_NS = 'http://www.w3.org/2000/svg';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
// The hidden SVG sits in the page, so it would inherit the page's text styling; the figure is drawn without it (an <img>, its own element).
const RESET = 'position:absolute;left:-9999px;top:0;visibility:hidden;letter-spacing:normal;word-spacing:normal;font-style:normal;font-variant:normal;font-stretch:normal;font-kerning:auto;font-feature-settings:normal;text-transform:none;text-indent:0;white-space:normal';
/**
 * Measures with getBBox() of a hidden SVG <text> in `host` (default: document.body, else the root element). Call `.dispose()` to remove the
 * hidden SVG. Measure after the fonts are loaded (`await document.fonts.ready`), and put `host` where it is displayed: a `display: none`
 * host measures everything as 0, which is reported here as an error rather than drawn.
 */
export function svgMeasurer(host) {
    const root = host ?? document.body ?? document.documentElement;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('style', RESET);
    svg.setAttribute('aria-hidden', 'true');
    root.appendChild(svg);
    const text = document.createElementNS(SVG_NS, 'text');
    // otherwise a whitespace-only run collapses to nothing. In the XML namespace: setAttribute('xml:space') on an element made by createElementNS is a plain attribute with that name, which is ignored
    text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    text.setAttribute('x', '0');
    text.setAttribute('y', '100');
    svg.appendChild(text);
    const measure = ({ text: t, size, weight, font }) => {
        // inline style, not attributes: a page rule such as `text {font-family: ...}` (a figure's own <style>, put in the page) beats a presentation attribute
        const st = text.style;
        st.fontFamily = FONT_STACKS[font];
        st.fontSize = `${size}px`;
        st.fontWeight = String(weight);
        text.textContent = t;
        const b = text.getBBox();
        return { w: b.width, h: b.height };
    };
    if (measure({ text: 'Hg', size: 16, weight: 400, font: 'sans' }).w <= 0) {
        svg.remove();
        throw new Error('svgMeasurer: the hidden SVG measured nothing — its host is not displayed (display: none) or the page has no layout yet; pass a displayed `host`');
    }
    return Object.assign(measure, { dispose: () => svg.remove() });
}
/** A measurer on a canvas context (no DOM): the width from measureText, the line height from the font's ascent and descent, each rounded. `ctx` defaults to a new OffscreenCanvas (or a <canvas> where there is none). */
export function canvasMeasurer(ctx) {
    const c = ctx ?? (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas')).getContext('2d');
    return ({ text, size, weight, font }) => {
        c.font = `${weight} ${size}px ${FONT_STACKS[font]}`;
        const m = c.measureText(text);
        // fontBoundingBox* is missing before Firefox 116: the actual box of the run, then a plain line height, rather than a NaN height
        const up = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? size * 0.88, down = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? size * 0.24;
        return { w: m.width, h: Math.round(up) + Math.round(down) };
    };
}
