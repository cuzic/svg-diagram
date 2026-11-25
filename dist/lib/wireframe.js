import * as builders from './wireframe-builders.js';
import { dialogRenderer, toastRenderer, collectTextRequestsWith, collectScreenGridTextRequestsWith, collectStateMatrixTextRequestsWith, layoutScreensWith, layoutScreenGridWith, layoutStateMatrixWith, layoutWireframeWith, wireframeHelpers } from './wireframe-layout-core.js';
import { installParts, robotMarkers, widgetStates } from './wireframe-parts.js';
export const wf = {
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
const runtime = {
    draw: helpers.DRAW, nat: helpers.NAT, autoWidth: helpers.AUTO_W, states: widgetStates, robotMarkers,
    strings: parts.strings, always: parts.always, dialog: dialogRenderer, toast: toastRenderer,
};
export function collectTextRequests(band) {
    return collectTextRequestsWith(band, runtime);
}
export function collectScreenGridTextRequests(band) {
    return collectScreenGridTextRequestsWith(band, runtime);
}
export function collectStateMatrixTextRequests(band) {
    return collectStateMatrixTextRequestsWith(band, runtime);
}
export function layoutWireframe(...args) {
    return layoutWireframeWith(runtime, ...args);
}
export function layoutScreens(...args) {
    return layoutScreensWith(runtime, ...args);
}
export function layoutScreenGrid(...args) {
    return layoutScreenGridWith(runtime, ...args);
}
export function layoutStateMatrix(...args) {
    return layoutStateMatrixWith(runtime, ...args);
}
