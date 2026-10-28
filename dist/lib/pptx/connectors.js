import { PALETTE, textColorOf } from '../tokens.js';
import { emu, solidFill, arrowEnds, cxnSp } from './xml.js';
function cxnXfrm(x, withRot) {
    const rot = withRot && x.rot ? ` rot="${x.rot}"` : '';
    return `<a:xfrm${rot}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm>`;
}
const glueXml = (start, end) => `${start ? `<a:stCxn id="${start.id}" idx="${start.idx}"/>` : ''}${end ? `<a:endCxn id="${end.id}" idx="${end.idx}"/>` : ''}`;
const lineWidth = (c) => emu(c.weight === 'strong' ? 5 : 2);
/** A straight arrow between two boxes of a `row` band. */
export function rowArrowXml(id, name, x, start, end) {
    return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, false)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2)}">${solidFill(PALETTE.text)}${arrowEnds('end', false)}</a:ln>`);
}
/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export function connectorXml(id, c, x, day, tones, start, end) {
    const dash = c.line === 'dashed' ? '<a:prstDash val="dash"/>' : c.line === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
    const cmpd = c.line === 'double' ? ' cmpd="dbl"' : '';
    const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
    return cxnSp(id, `connect-${c.fromId}-${c.toId}`, glueXml(start, end), `${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${lineWidth(c)}"${cmpd}>${solidFill(textColorOf(tones, c.tone, day))}${dash}${arrowEnds(c.arrow, true)}</a:ln>`);
}
/** The fallback for a route no connector preset fits (and for annotations): a polyline, not glued. */
export function freeformXml(id, c, day, tones) {
    const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
    const path = c.points.map((p, i) => `<a:${i === 0 ? 'moveTo' : 'lnTo'}><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:${i === 0 ? 'moveTo' : 'lnTo'}>`).join('');
    return cxnSp(id, `freeform-${c.fromId}-${c.toId}`, undefined, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${lineWidth(c)}">${solidFill(textColorOf(tones, c.tone, day))}${arrowEnds(c.arrow, false)}</a:ln>`);
}
