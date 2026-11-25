import { recolor } from '../tokens.js';
import { register } from './adapter.js';
import { imageRids } from './package.js';
import { namedAs } from './prims.js';
import { anchorXml, groupXml, picXml } from './shapes.js';
/** A band's group: its type, numbered from the second of that type on the slide (`chart`, `chart 2`), and its DSL id (ADR 0054 D7). */
function bandName(ctx, type, dslId) {
    const n = (ctx.count.get(type) ?? 0) + 1;
    ctx.count.set(type, n);
    return namedAs(n > 1 ? `${type} ${n}` : type, '', dslId);
}
/** Use editable shapes when the supplied converter can read the SVG, or embed it with a PNG fallback. */
export function drawBandFallback(band, ctx, index, getPicture, convert, onPicture) {
    const fallback = convert ? getPicture() : undefined;
    const shapes = fallback && convert ? convert(fallback.picture.svg, ctx.fonts, ctx.next) : null;
    const id = 'id' in band ? band.id : undefined;
    let drawn;
    if (shapes !== null && fallback) {
        drawn = groupXml(ctx.next(), bandName(ctx, band.type, id), fallback.rect, shapes);
    }
    else {
        onPicture?.();
        const { picture, rect } = fallback ?? getPicture();
        const rids = imageRids(ctx.pictures.length);
        const paint = (svg) => recolor(ctx.tones, svg, ctx.ld.appearance);
        ctx.pictures.push({ svg: paint(picture.svg), pngSvg: paint(picture.pngSvg) });
        drawn = picXml(ctx.next(), `${band.type}-${index}`, rect, rids.png, rids.svg);
    }
    if (!id || !('h' in band))
        return drawn;
    const anchor = { x: band.x, y: band.y, w: band.w, h: band.h }, anchorId = ctx.next();
    register(ctx, id, anchorId, anchor);
    return drawn + anchorXml(anchorId, `anchor-${id}`, anchor);
}
