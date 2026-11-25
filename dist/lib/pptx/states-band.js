import { register } from './adapter.js';
import { statesXml } from './states.js';
/** A state diagram or flowchart as shapes (./states.ts); a dimmed one, or one with icons, stays a picture. */
export const statesPptx = (band, ctx) => {
    if (band.dim || band.icons.length)
        return undefined;
    const { xml, glue } = statesXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
    for (const g of glue)
        register(ctx, g.dslId, g.id, g.rect);
    return xml;
};
