import { escapeAttr } from '../emit-common.js';
export const EMU = 9525; // 1px at 96dpi
export const emu = (px) => Math.round(px * EMU);
export const hex = (c) => c.replace('#', '').toUpperCase();
export const xfrm = (r) => `<a:xfrm><a:off x="${emu(r.x)}" y="${emu(r.y)}"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm>`;
export const solidFill = (color) => `<a:solidFill><a:srgbClr val="${hex(color)}"/></a:solidFill>`;
export const roundRectAdj = (r) => Math.min(r.w, r.h) > 0 ? Math.round((8 / Math.min(r.w, r.h)) * 100000) : 0;
/** Escape for an attribute value (`escapeXml` leaves the quote alone). */
export const attr = escapeAttr;
/** The arrowheads of a line: `start` is the line's first point (`headEnd`), `end` its last (`tailEnd`). */
export function arrowEnds(arrow, sized) {
    const size = sized ? ' w="med" len="med"' : '';
    return `${arrow === 'start' || arrow === 'both' ? `<a:headEnd type="triangle"${size}/>` : ''}${arrow === 'end' || arrow === 'both' ? `<a:tailEnd type="triangle"${size}/>` : ''}`;
}
/** The `p:sp` / `p:cxnSp` wrappers every shape of the slide shares. */
export const sp = (id, name, spPr, txBody) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${attr(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${spPr}</p:spPr><p:txBody>${txBody}</p:txBody></p:sp>`;
export const cxnSp = (id, name, glue, spPr) => `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${attr(name)}"/>${glue === undefined ? '<p:cNvCxnSpPr/>' : `<p:cNvCxnSpPr>${glue}</p:cNvCxnSpPr>`}<p:nvPr/></p:nvCxnSpPr><p:spPr>${spPr}</p:spPr></p:cxnSp>`;
