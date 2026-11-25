import type { ChartGeom, LaidOutChartPart } from './charts-base.ts';
import type { ChartBand, LaidOutChart } from './charts.ts';
import type { Roles, WidthOf, WrapMode } from './types/core.ts';
export declare function placeChart(band: ChartBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, wrap: WrapMode, geom: number, layout: (g: ChartGeom) => LaidOutChartPart): LaidOutChart;
