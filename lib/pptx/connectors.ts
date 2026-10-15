import {escapeXml} from '../emit-common.ts';
import {PALETTE, textColorOf} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import type {ConnXfrm, Pt} from './geom.ts';
import {emu, hex} from './xml.ts';

export interface Glue {id: number; idx: number}
function cxnXfrm(x: ConnXfrm, withRot: boolean): string {
  const rot = withRot && x.rot ? ` rot="${x.rot}"` : '';
  return `<a:xfrm${rot}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm>`;
}

const glueXml = (start?: Glue, end?: Glue): string =>
  `${start ? `<a:stCxn id="${start.id}" idx="${start.idx}"/>` : ''}${end ? `<a:endCxn id="${end.id}" idx="${end.idx}"/>` : ''}`;

/** A straight arrow between two boxes of a `row` band. */
export function rowArrowXml(id: number, name: string, x: ConnXfrm, start?: Glue, end?: Glue): string {
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvCxnSpPr>${glueXml(start, end)}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${cxnXfrm(x, false)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2)}"><a:solidFill><a:srgbClr val="${hex(PALETTE.text)}"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`;
}

/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export function connectorXml(id: number, c: LaidOutConnect, x: ConnXfrm, day: LaidOutDiagram['day'], start?: Glue, end?: Glue): string {
  const strong = c.weight === 'strong';
  const dash = c.line === 'dashed' ? '<a:prstDash val="dash"/>' : c.line === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
  const cmpd = c.line === 'double' ? ' cmpd="dbl"' : '';
  const head = c.arrow === 'end' || c.arrow === 'both' ? '<a:tailEnd type="triangle" w="med" len="med"/>' : '';
  const tail = c.arrow === 'start' || c.arrow === 'both' ? '<a:headEnd type="triangle" w="med" len="med"/>' : '';
  const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="connect-${escapeXml(c.fromId)}-${escapeXml(c.toId)}"/><p:cNvCxnSpPr>${glueXml(start, end)}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${emu(strong ? 5 : 2)}"${cmpd}><a:solidFill><a:srgbClr val="${hex(textColorOf(c.tone, day))}"/></a:solidFill>${dash}${tail}${head}</a:ln></p:spPr></p:cxnSp>`;
}

/** The fallback for a route no connector preset fits (and for annotations): a polyline, not glued. */
export function freeformXml(id: number, c: LaidOutConnect, day: LaidOutDiagram['day']): string {
  const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
  const path = c.points.map((p, i) => i === 0 ? `<a:moveTo><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:moveTo>` : `<a:lnTo><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:lnTo>`).join('');
  const color = hex(textColorOf(c.tone, day));
  const head = c.arrow === 'start' || c.arrow === 'both' ? '<a:headEnd type="triangle"/>' : '';
  const tail = c.arrow === 'end' || c.arrow === 'both' ? '<a:tailEnd type="triangle"/>' : '';
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="freeform-${escapeXml(c.fromId)}-${escapeXml(c.toId)}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${emu(c.weight === 'strong' ? 5 : 2)}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${head}${tail}</a:ln></p:spPr></p:cxnSp>`;
}
