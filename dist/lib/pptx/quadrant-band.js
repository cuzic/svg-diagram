import { register } from './adapter.js';
import { quadrantXml } from './quadrant.js';
/** A quadrant as shapes (./quadrant.ts); a dimmed one stays a picture. */
export const quadrantPptx = (band, ctx) => {
    if (band.dim)
        return undefined;
    const { xml, glue } = quadrantXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
    for (const g of glue)
        register(ctx, g.dslId, g.id, g.rect);
    return xml;
};
