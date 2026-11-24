import {wireframeFor} from './bands/wireframe-basic.ts';
import {screensBuilder, screensDefinition, stateMatrixBuilder} from './screens-definition.ts';
import {stateMatrixFindings} from './state-matrix-rules.ts';
import {appendScreen} from './wireframe-placement.ts';
import {collectScreenGridTextRequestsWith, collectStateMatrixTextRequestsWith, layoutScreenGridWith, layoutStateMatrixWith, makeWireframeRuntime} from './wireframe-layout-core.ts';
import type {WireframeDecorations, WireframeRuntime, WireframeWidgetRenderer} from './wireframe-layout-core.ts';

export type {WireframeDecorations, WireframeWidgetRenderer};
export {
  spacerRenderer, colRenderer, rowRenderer, cardRenderer,
  textRenderer, btnRenderer, chipRenderer, inputRenderer,
  selectRenderer, tabsRenderer, appbarRenderer, seekRenderer,
  kvRenderer, statRenderer, listRenderer, tableRenderer,
  alertRenderer, imageRenderer, videoRenderer, heatRenderer,
  pointcloudRenderer, chartRenderer, mapRenderer, dialogRenderer, toastRenderer,
} from './wireframe-layout-core.ts';

export {
  toggleRenderer, checkboxRenderer, sliderRenderer, batteryRenderer,
  signalRenderer, radioRenderer, robotRenderer, insightRenderer,
  regionRenderer, breadcrumbRenderer, fusionRenderer, compareRenderer,
  widgetStates, robotMarkers,
} from './wireframe-parts.ts';

/** Create a wireframe builder with only the supplied drawing and measurement callbacks. */
export function createWireframe(renderers: readonly WireframeWidgetRenderer[], decorations: WireframeDecorations = {}) {
  return wireframeFor(makeWireframeRuntime(renderers, decorations));
}

function screenDefinitionFor(
  runtime: WireframeRuntime,
  layout: typeof layoutScreenGridWith,
  collect: typeof collectScreenGridTextRequestsWith,
  findings?: Parameters<typeof screensDefinition>[2],
): ReturnType<typeof screensDefinition> {
  return screensDefinition(
    data => collect(data, runtime),
    (data, ctx, x, width) => appendScreen(layout(runtime, data, x, ctx.y, width, ctx.widthOf, ctx.tones, ctx.wrap), ctx),
    findings,
  );
}

/** Create a screen grid builder with only the supplied widgets and decorations. */
export function createScreenGrid(renderers: readonly WireframeWidgetRenderer[], decorations: WireframeDecorations = {}) {
  return screensBuilder(screenDefinitionFor(makeWireframeRuntime(renderers, decorations), layoutScreenGridWith, collectScreenGridTextRequestsWith));
}

/** Create a state matrix builder with only the supplied widgets and decorations. */
export function createStateMatrix(renderers: readonly WireframeWidgetRenderer[], decorations: WireframeDecorations = {}) {
  return stateMatrixBuilder(screenDefinitionFor(makeWireframeRuntime(renderers, decorations), layoutStateMatrixWith, collectStateMatrixTextRequestsWith, stateMatrixFindings));
}

/** Create screen and state matrix builders that share the supplied widget registry. */
export function createScreens(renderers: readonly WireframeWidgetRenderer[], decorations: WireframeDecorations = {}) {
  const runtime = makeWireframeRuntime(renderers, decorations);
  return {
    screens: screensBuilder(screenDefinitionFor(runtime, layoutScreenGridWith, collectScreenGridTextRequestsWith)),
    stateMatrix: stateMatrixBuilder(screenDefinitionFor(runtime, layoutStateMatrixWith, collectStateMatrixTextRequestsWith, stateMatrixFindings)),
  };
}
