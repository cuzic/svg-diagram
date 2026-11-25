/** Remember a DSL id so connectors can glue to this shape. */
export const register = (ctx, dslId, id, rect) => {
    if (dslId)
        ctx.glue.set(dslId, { id, rect });
};
