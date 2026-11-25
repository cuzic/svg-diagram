import { defineStrategyCanvasPart } from '../strategy-canvas.js';
import { band } from '../../band-def.js';
import { planeDefinition } from '../../bands/plane.js';
import { strategyCanvas as build } from '../../dsl/charts.js';
const strategyCanvas = (...args) => band(planeDefinition, build(...args));
export const strategyCanvasPart = /* @__PURE__ */ defineStrategyCanvasPart(strategyCanvas);
