import { appendScreen } from './wireframe-placement.js';
import { layoutScreenGrid, layoutScreens, layoutStateMatrix, layoutWireframe } from './wireframe.js';
export function placeWireframe(data, ctx, x, w) {
    appendScreen(layoutWireframe(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}
export function placeScreens(data, ctx, x, w) {
    appendScreen(layoutScreens(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}
export function placeScreenGrid(data, ctx, x, w) {
    appendScreen(layoutScreenGrid(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}
export function placeStateMatrix(data, ctx, x, w) {
    appendScreen(layoutStateMatrix(data, x, ctx.y, w, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
}
