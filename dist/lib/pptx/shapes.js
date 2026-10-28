import { resolveBoxStyle } from '../emit-common.js';
import { BOX_PAD_X, BOX_PAD_Y } from '../layout-util.js';
import { emu, xfrm, solidFill, roundRectAdj, sp, attr } from './xml.js';
import { paragraphsOf, pitchOf } from './text.js';
/** The text-only box of a badge or label the layout does not carry as a box: one centred run on one line, never wrapped. */
export function plainBox(rect, text, o) {
    return { ...rect, ...(o.frame ? {} : { frame: false }), padX: o.padX, padY: o.padY, tone: o.tone, align: 'center', noWrap: true, wrappedRuns: [{ text, size: o.size, weight: o.weight, mono: false, lines: [text], lineYs: [o.size] }] };
}
/** A shape's fill and outline. */
const frameFill = (style) => `${solidFill(style.fill)}<a:ln w="${emu(2.5)}">${solidFill(style.stroke)}${style.dashed ? '<a:prstDash val="dash"/>' : ''}</a:ln>`;
export function boxXml(id, name, b, day, tones, fonts) {
    const style = resolveBoxStyle(tones, b.tone, day, b.dashed);
    const px = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
    const frame = b.frame !== false;
    const al = b.align ?? 'left';
    const align = al === 'center' ? 'ctr' : al === 'right' ? 'r' : 'l';
    const paras = paragraphsOf(b.wrappedRuns, b.tone, day, tones, align, fonts);
    // the first baseline is lineYs[0] below the content top (the svg puts text at band.y + padY + lineYs[i]); with exact line spacing the
    // baseline sits ~0.8 of the pitch below the line's top -- that factor is what S2 measures on a real PowerPoint
    const first = b.wrappedRuns[0];
    const topInset = first ? Math.max(0, py + (first.lineYs[0] ?? 0) - pitchOf(first) * 0.8) : py;
    const fill = frame ? frameFill(style) : '<a:noFill/><a:ln><a:noFill/></a:ln>';
    // the text area is wider than the layout's wrap width by 2px on the right (a rounding difference must not push a word to the next line)
    return sp(id, name, `${xfrm(b)}<a:prstGeom prst="${frame ? 'roundRect' : 'rect'}"><a:avLst>${frame ? `<a:gd name="adj" fmla="val ${roundRectAdj(b)}"/>` : ''}</a:avLst></a:prstGeom>${fill}`, `<a:bodyPr wrap="${b.noWrap ? 'none' : 'square'}" lIns="${emu(px)}" tIns="${emu(topInset)}" rIns="${emu(Math.max(0, px - 2))}" bIns="${emu(py)}" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras || '<a:p><a:endParaRPr lang="ja-JP"/></a:p>'}`);
}
/** The frame of a `group` band: an empty rounded rectangle the boxes inside sit on. */
export function groupFrameXml(id, name, r, tone, dashed, day, tones) {
    const style = resolveBoxStyle(tones, tone, day, dashed);
    return sp(id, name, `${xfrm(r)}<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${roundRectAdj(r)}"/></a:avLst></a:prstGeom>${frameFill(style)}`, '<a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p>');
}
/** `p:grpSp` whose child coordinate space is the slide's own (chOff = off), so children keep their absolute positions. */
export function groupXml(id, name, r, inner) {
    return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${attr(name)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(r.x)}" y="${emu(r.y)}"/><a:ext cx="${emu(r.w)}" cy="${emu(r.h)}"/><a:chOff x="${emu(r.x)}" y="${emu(r.y)}"/><a:chExt cx="${emu(r.w)}" cy="${emu(r.h)}"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`;
}
/** An invisible rectangle standing in for an image band, so connectors can still glue to it. */
export function anchorXml(id, name, r) {
    return sp(id, name, `${xfrm(r)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>`, '<a:bodyPr/><a:lstStyle/><a:p/>');
}
/** A PNG picture carrying its SVG twin as `svgBlip` (PowerPoint 2016+ draws the SVG, older readers the PNG). */
export function picXml(id, name, r, pngRid, svgRid) {
    return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${attr(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${pngRid}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRid}"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(r)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
