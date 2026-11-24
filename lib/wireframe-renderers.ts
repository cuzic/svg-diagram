import {wireframeFor} from './bands/wireframe-basic.ts';
import {makeWireframeRuntime} from './wireframe-layout-core.ts';
import type {WireframeWidgetRenderer} from './wireframe-layout-core.ts';

export type {WireframeWidgetRenderer};
export {
  spacerRenderer, colRenderer, rowRenderer, cardRenderer,
  textRenderer, btnRenderer, chipRenderer, inputRenderer,
  selectRenderer, tabsRenderer, appbarRenderer, seekRenderer,
  kvRenderer, statRenderer, listRenderer, tableRenderer,
  alertRenderer, imageRenderer, videoRenderer, heatRenderer,
  pointcloudRenderer, chartRenderer, mapRenderer,
} from './wireframe-layout-core.ts';

export {
  toggleRenderer, checkboxRenderer, sliderRenderer, batteryRenderer,
  signalRenderer, radioRenderer, robotRenderer, insightRenderer,
  regionRenderer, breadcrumbRenderer, fusionRenderer, compareRenderer,
} from './wireframe-parts.ts';

/** Create a wireframe builder with only the supplied drawing and measurement callbacks. */
export function createWireframe(renderers: readonly WireframeWidgetRenderer[]) {
  return wireframeFor(makeWireframeRuntime(renderers));
}
