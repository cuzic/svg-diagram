export function appendScreen(laid, ctx) {
    for (const { id, x, y, w, h } of laid.anchors) {
        if (id)
            ctx.register(id, { x, y, w, h }, `a ${laid.type} takes an id that another anchor already has`);
    }
    ctx.laidOut.push(laid);
    ctx.y += laid.h + ctx.d.gap;
}
