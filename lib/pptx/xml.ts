import {escapeAttr} from '../emit-common.ts';

export interface Rect {x: number; y: number; w: number; h: number}
export interface Fonts {sans: string; mono: string}

export const EMU = 9525; // 1px at 96dpi
export const emu = (px: number): number => Math.round(px * EMU);
export const hex = (c: string): string => c.replace('#', '').toUpperCase();

export const xfrm = (r: Rect): string => `<a:xfrm><a:off x="${emu(r.x)}" y="${emu(r.y)}"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm>`;
export const solidFill = (color: string): string => `<a:solidFill><a:srgbClr val="${hex(color)}"/></a:solidFill>`;
export const roundRectAdj = (r: Rect): number => Math.min(r.w, r.h) > 0 ? Math.round((8 / Math.min(r.w, r.h)) * 100000) : 0;

/** Escape for an attribute value (`escapeXml` leaves the quote alone). */
export const attr = escapeAttr;

/**
 * The size of a line end in PowerPoint, which draws it as a multiple of the line's width (at least about 2.65px, 0.7 mm): about 2, 3 and 5
 * for sm, med and lg (LibreOffice's import of DrawingML follows the same rule). The one nearest the svg's head: a marker 7 widths long
 * on a line, 16px on a strong (5px) one.
 */
export function endSize(widthPx: number, headPx = widthPx >= 5 ? 16 : 7 * widthPx): 'sm' | 'med' | 'lg' {
  const r = headPx / Math.max(widthPx, 2.65);
  return ([['sm', 2], ['med', 3], ['lg', 5]] as const).reduce((best, s) => Math.abs(s[1] - r) <= Math.abs(best[1] - r) ? s : best)[0];
}

/** The arrowheads of a line: `start` is the line's first point (`headEnd`), `end` its last (`tailEnd`), sized for a line `widthPx` wide. */
export function arrowEnds(arrow: 'start' | 'end' | 'both' | 'none' | undefined, widthPx: number): string {
  const s = endSize(widthPx), size = ` w="${s}" len="${s}"`;
  return `${arrow === 'start' || arrow === 'both' ? `<a:headEnd type="triangle"${size}/>` : ''}${arrow === 'end' || arrow === 'both' ? `<a:tailEnd type="triangle"${size}/>` : ''}`;
}

/** A shape's name as an attribute: escaped, and without the control characters XML 1.0 cannot hold (an internal id may start with one). */
const nameAttr = (name: string): string => attr([...name].filter(c => { const k = c.codePointAt(0) ?? 0; return k >= 32 || k === 9 || k === 10 || k === 13; }).join(''));

/** The `p:sp` / `p:cxnSp` wrappers every shape of the slide shares. */
export const sp = (id: number, name: string, spPr: string, txBody: string): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${nameAttr(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${spPr}</p:spPr><p:txBody>${txBody}</p:txBody></p:sp>`;
export const cxnSp = (id: number, name: string, glue: string | undefined, spPr: string): string =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${nameAttr(name)}"/>${glue === undefined ? '<p:cNvCxnSpPr/>' : `<p:cNvCxnSpPr>${glue}</p:cNvCxnSpPr>`}<p:nvPr/></p:nvCxnSpPr><p:spPr>${spPr}</p:spPr></p:cxnSp>`;
