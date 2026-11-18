// The mutable state a band handler works on while layoutBands() walks the stack top-to-bottom, and the handler type itself.
// Handlers (lib/layout-handlers.ts) take the band, this context and the x / width they are placed at; they push what they lay
// out to `ctx.laidOut`, register anchors, and advance `ctx.y`.
export {};
