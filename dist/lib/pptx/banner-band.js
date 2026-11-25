import { register } from './adapter.js';
import { stampBadge, textOf } from './box-decoration.js';
import { namedAs } from './prims.js';
import { boxXml, groupXml } from './shapes.js';
export const bannerPptx = (banner, ctx) => {
    const id = ctx.next();
    register(ctx, banner.id, id, banner);
    const text = textOf(banner);
    const main = boxXml(id, namedAs('box', text, banner.id), banner, ctx.ld.day, ctx.tones, ctx.fonts);
    if (!banner.stamp)
        return main;
    const stamp = stampBadge(ctx, banner, banner.stamp);
    return groupXml(ctx.next(), namedAs('node', text, banner.id), banner, main + stamp);
};
