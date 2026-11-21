import { PALETTE, textColorOf } from '../tokens.js';
import { namedAs } from './prims.js';
import { emu, endSize, solidFill, arrowEnds, cxnSp } from './xml.js';
function cxnXfrm(x, withRot) {
    const rot = withRot && x.rot ? ` rot="${x.rot}"` : '';
    return `<a:xfrm${rot}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm>`;
}
const glueXml = (start, end) => `${start ? `<a:stCxn id="${start.id}" idx="${start.idx}"/>` : ''}${end ? `<a:endCxn id="${end.id}" idx="${end.idx}"/>` : ''}`;
const widthPx = (c) => c.weight === 'strong' ? 5 : 2;
const lineWidth = (c) => emu(widthPx(c));
/** A straight arrow between two boxes of a `row` band, 2.5px as the svg draws it. */
export function rowArrowXml(id, name, x, start, end) {
    return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, false)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2.5)}">${solidFill(PALETTE.text)}${arrowEnds('end', 2.5)}</a:ln>`);
}
/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export function connectorXml(id, c, x, day, tones, start, end) {
    const dash = c.line === 'dashed' ? '<a:prstDash val="dash"/>' : c.line === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
    const cmpd = c.line === 'double' ? ' cmpd="dbl"' : '';
    const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
    return cxnSp(id, namedAs('arrow', c.label ?? '', `${c.fromId} → ${c.toId}`), glueXml(start, end), `${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${lineWidth(c)}"${cmpd}>${solidFill(textColorOf(tones, c.tone, day))}${dash}${arrowEnds(c.arrow, widthPx(c))}</a:ln>`);
}
/** The fallback for a route no connector preset fits (and for annotations): a polyline, not glued. */
export function freeformXml(id, c, day, tones) {
    const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
    const path = c.points.map((p, i) => `<a:${i === 0 ? 'moveTo' : 'lnTo'}><a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/></a:${i === 0 ? 'moveTo' : 'lnTo'}>`).join('');
    return cxnSp(id, `freeform-${c.fromId}-${c.toId}`, undefined, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${lineWidth(c)}">${solidFill(textColorOf(tones, c.tone, day))}${arrowEnds(c.arrow, widthPx(c))}</a:ln>`);
}
/** A connector of a band's own lines (a tree's), in a colour and width of its own, with no arrowhead; glued where the ends are shapes. */
export function connectorShapeXml(id, name, x, color, widthPx, start, end, opts = {}) {
    const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
    const dash = dashOf(opts);
    return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${emu(widthPx)}">${solidFill(color)}${dash}${headsOf(opts, widthPx)}</a:ln>`);
}
// a diamond mark (UML composition) is drawn large, as the svg's is; a triangle or V is sized for the line (xml.ts endSize)
const endXml = (tag, t, widthPx, headPx) => { if (!t)
    return ''; const s = t === 'diamond' ? 'lg' : endSize(widthPx, headPx); return `<a:${tag} type="${t}" w="${s}" len="${s}"/>`; };
const headsOf = (o, widthPx) => o.ends ? endXml('headEnd', o.ends.start, widthPx, o.headPx?.start) + endXml('tailEnd', o.ends.end, widthPx, o.headPx?.end) : o.heads ? arrowEnds(o.heads, widthPx) : o.arrow ? arrowEnds('end', widthPx) : '';
const dashOf = (o) => o.dotted ? '<a:prstDash val="sysDot"/>' : o.dashed ? '<a:prstDash val="dash"/>' : '';
/** An open freeform path (no fill), not glued: a brace, or a line no connector preset fits. */
export function freeformPathXml(id, name, steps, color, widthPx, opts = {}) {
    const all = steps.flatMap(s => s.pts);
    const xs = all.map(p => p.x), ys = all.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
    const pt = (p) => `<a:pt x="${emu(p.x - x)}" y="${emu(p.y - y)}"/>`;
    const path = pathXml(steps, pt);
    return cxnSp(id, name, undefined, `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}" fill="none">${path}</a:path></a:pathLst></a:custGeom><a:ln w="${emu(widthPx)}">${solidFill(color)}${dashOf(opts)}${headsOf(opts, widthPx)}</a:ln>`);
}
const TAG = { M: 'moveTo', L: 'lnTo', Q: 'quadBezTo', C: 'cubicBezTo' };
/** The DrawingML of a path's steps, its points mapped by `pt`. */
export const pathXml = (steps, pt) => steps.map(s => s.op === 'Z' ? '<a:close/>' : `<a:${TAG[s.op]}>${s.pts.map(pt).join('')}</a:${TAG[s.op]}>`).join('');
