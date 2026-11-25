import { snapGrid } from './layout-util.js';
export function layoutRaw(band, ctx, padX, cw) {
    const placed = { ...band, x: padX, y: snapGrid(ctx.y), w: cw };
    if (band.id)
        ctx.register(band.id, { x: placed.x, y: placed.y, w: placed.w, h: placed.h }, 'a raw band takes an id that another anchor already has');
    ctx.laidOut.push(placed);
    ctx.y += band.h + (band.h > 0 ? ctx.d.gap : 0);
}
