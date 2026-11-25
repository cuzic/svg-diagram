import { appendPlacedBand } from './layout-placed.js';
import { snapGrid } from './layout-util.js';
import { layoutCauseBand } from './toc.js';
import { canvasFontScale } from './tokens.js';
/** ADR 0070 D7: scale an independent cause tree's lines with canvas text, unless the whole-figure retry drops the scale. */
export function placeCause(band, ctx, x, width) {
    const { canvas, maxDisplayHeight } = ctx.d;
    const scale = canvas ? canvasFontScale(canvas.minText) : 1;
    const useScale = scale > 1 && band.base === undefined && band.layerFrom === undefined;
    const dropped = useScale && ctx.lines.seen++ < ctx.lines.drop;
    const env = {
        ...ctx, ...(useScale && !dropped ? { lineScale: scale } : {}),
        ...(ctx.lines.exchange ? { tallerSeen: () => { ctx.lines.taller = true; } } : { exchange: false }),
    };
    const placed = layoutCauseBand(band, x, snapGrid(ctx.y), width, ctx.widthOf, ctx.roles, env, canvas?.height ?? maxDisplayHeight, canvas !== undefined);
    if (dropped)
        placed.lineScaleDropped = true;
    appendPlacedBand(band, placed, ctx, 'a cause tree takes an id that another anchor already has', 'a cause tree node takes an id that another anchor already has');
}
