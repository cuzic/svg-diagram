import * as builders from './wireframe-builders.ts';
import {dialogRenderer, toastRenderer, collectTextRequestsWith, layoutScreensWith, layoutWireframeWith, wireframeHelpers} from './wireframe-layout-core.ts';
import type {WireframeRuntime} from './wireframe-layout-core.ts';
import {installParts, robotMarkers, widgetStates} from './wireframe-parts.ts';
import type {Wf} from './types/wireframe-nodes.ts';

export const wf: Wf = {
  col: builders.col, row: builders.row, card: builders.card, spacer: builders.spacer,
  text: builders.text, btn: builders.btn, input: builders.input, select: builders.select,
  chip: builders.chip, tabs: builders.tabs, appbar: builders.appbar, seek: builders.seek,
  kv: builders.kv, stat: builders.stat, list: builders.list, table: builders.table,
  alert: builders.alert, map: builders.map, video: builders.video, heat: builders.heat,
  pointcloud: builders.pointcloud, chart: builders.chart, image: builders.image, dialog: builders.dialog,
  toast: builders.toast, fusion: builders.fusion, compare: builders.compare, region: builders.region,
  robot: builders.robot, battery: builders.battery, signal: builders.signal, insight: builders.insight,
  breadcrumb: builders.breadcrumb, toggle: builders.toggle, checkbox: builders.checkbox, radio: builders.radio,
  slider: builders.slider,
};

const helpers = wireframeHelpers();
const parts = installParts(helpers);
const runtime: WireframeRuntime = {
  draw: helpers.DRAW, nat: helpers.NAT, autoWidth: helpers.AUTO_W, states: widgetStates, robotMarkers,
  strings: parts.strings, always: parts.always, dialog: dialogRenderer, toast: toastRenderer,
};

export function collectTextRequests(band: Parameters<typeof collectTextRequestsWith>[0]) {
  return collectTextRequestsWith(band, runtime);
}

export function layoutWireframe(...args: Tail<Parameters<typeof layoutWireframeWith>>) {
  return layoutWireframeWith(runtime, ...args);
}

export function layoutScreens(...args: Tail<Parameters<typeof layoutScreensWith>>) {
  return layoutScreensWith(runtime, ...args);
}

type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never;
