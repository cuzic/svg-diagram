import {defineControlChartPart} from '../control-chart.ts';
import {band} from '../../band-def.ts';
import {planeDefinition} from '../../bands/plane.ts';
import {controlChart as build} from '../../dsl/qc-semantic.ts';

const controlChart = (...args: Parameters<typeof build>) => band(planeDefinition, build(...args));

export const controlChartPart = /* @__PURE__ */ defineControlChartPart<ReturnType<typeof controlChart>>(controlChart);
