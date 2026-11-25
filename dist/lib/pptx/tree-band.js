import { register } from './adapter.js';
import { treeXml } from './tree.js';
/** A tree as shapes (./tree.ts); a dimmed one stays a picture, as the muted look is not mapped yet. */
export const treePptx = (band, ctx) => {
    if (band.dim)
        return undefined;
    const { xml, glue } = treeXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next);
    for (const g of glue)
        register(ctx, g.dslId, g.id, g.rect);
    return xml;
};
