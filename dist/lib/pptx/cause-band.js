import { register } from './adapter.js';
import { causeXml } from './cause.js';
/** A cause-and-effect band as shapes (./cause.ts); a dimmed one stays a picture. */
export const causePptx = (band, ctx) => {
    if (band.dim)
        return undefined;
    const { xml, glue } = causeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
    for (const g of glue)
        register(ctx, g.dslId, g.id, g.rect);
    return xml;
};
