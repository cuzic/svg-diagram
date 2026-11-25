import { wireframeFor } from './bands/wireframe-basic.js';
import { screensBuilder, screensDefinition, stateMatrixBuilder } from './screens-definition.js';
import { stateMatrixFindings } from './state-matrix-rules.js';
import { appendScreen } from './wireframe-placement.js';
import { collectScreenGridTextRequestsWith, collectStateMatrixTextRequestsWith, layoutScreenGridWith, layoutStateMatrixWith, makeWireframeRuntime } from './wireframe-layout-core.js';
export { spacerRenderer, colRenderer, rowRenderer, cardRenderer, textRenderer, btnRenderer, chipRenderer, inputRenderer, selectRenderer, tabsRenderer, appbarRenderer, seekRenderer, kvRenderer, statRenderer, listRenderer, tableRenderer, alertRenderer, imageRenderer, videoRenderer, heatRenderer, pointcloudRenderer, chartRenderer, mapRenderer, dialogRenderer, toastRenderer, } from './wireframe-layout-core.js';
export { toggleRenderer, checkboxRenderer, sliderRenderer, batteryRenderer, signalRenderer, radioRenderer, robotRenderer, insightRenderer, regionRenderer, breadcrumbRenderer, fusionRenderer, compareRenderer, widgetStates, robotMarkers, } from './wireframe-parts.js';
/** Create a wireframe builder with only the supplied drawing and measurement callbacks. */
export function createWireframe(renderers, decorations = {}) {
    return wireframeFor(makeWireframeRuntime(renderers, decorations));
}
function screenDefinitionFor(runtime, layout, collect, findings) {
    return screensDefinition(data => collect(data, runtime), (data, ctx, x, width) => appendScreen(layout(runtime, data, x, ctx.y, width, ctx.widthOf, ctx.tones, ctx.wrap), ctx), findings);
}
/** Create a screen grid builder with only the supplied widgets and decorations. */
export function createScreenGrid(renderers, decorations = {}) {
    return screensBuilder(screenDefinitionFor(makeWireframeRuntime(renderers, decorations), layoutScreenGridWith, collectScreenGridTextRequestsWith));
}
/** Create a state matrix builder with only the supplied widgets and decorations. */
export function createStateMatrix(renderers, decorations = {}) {
    return stateMatrixBuilder(screenDefinitionFor(makeWireframeRuntime(renderers, decorations), layoutStateMatrixWith, collectStateMatrixTextRequestsWith, stateMatrixFindings));
}
/** Create screen and state matrix builders that share the supplied widget registry. */
export function createScreens(renderers, decorations = {}) {
    const runtime = makeWireframeRuntime(renderers, decorations);
    return {
        screens: screensBuilder(screenDefinitionFor(runtime, layoutScreenGridWith, collectScreenGridTextRequestsWith)),
        stateMatrix: stateMatrixBuilder(screenDefinitionFor(runtime, layoutStateMatrixWith, collectStateMatrixTextRequestsWith, stateMatrixFindings)),
    };
}
