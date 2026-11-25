import {defineStrategyCanvasPart} from '../strategy-canvas.ts';
import {band} from '../../band-def.ts';
import {planeDefinition} from '../../bands/plane.ts';
import {strategyCanvas as build} from '../../dsl/charts.ts';

const strategyCanvas = (...args: Parameters<typeof build>) => band(planeDefinition, build(...args));

export const strategyCanvasPart = /* @__PURE__ */ defineStrategyCanvasPart<ReturnType<typeof strategyCanvas>>(strategyCanvas);
