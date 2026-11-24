import {wireframeFor} from './bands/wireframe-basic.ts';
import {screensFor} from './screens-definition.ts';
import {appendScreen} from './wireframe-placement.ts';
import {collectTextRequestsWith, layoutScreensWith, makeWireframeRuntime} from './wireframe-layout-core.ts';
import type {WireframeDecorations, WireframeWidgetRenderer} from './wireframe-layout-core.ts';

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

/** Create screen and state matrix builders that share the supplied widget registry. */
export function createScreens(renderers: readonly WireframeWidgetRenderer[], decorations: WireframeDecorations = {}) {
  const runtime = makeWireframeRuntime(renderers, decorations);
  return screensFor(
    data => collectTextRequestsWith(data, runtime),
    (data, ctx, x, width) => appendScreen(layoutScreensWith(runtime, data, x, ctx.y, width, ctx.widthOf, ctx.tones, ctx.wrap), ctx),
  );
}
