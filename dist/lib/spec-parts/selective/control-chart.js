import { defineControlChartPart } from '../control-chart.js';
import { band } from '../../band-def.js';
import { planeDefinition } from '../../bands/plane.js';
import { controlChart as build } from '../../dsl/qc-semantic.js';
const controlChart = (...args) => band(planeDefinition, build(...args));
export const controlChartPart = /* @__PURE__ */ defineControlChartPart(controlChart);
