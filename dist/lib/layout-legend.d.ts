import type { LaidOutLegend, LegendBand } from './types/containers.ts';
import type { Roles, WidthOf } from './types/core.ts';
export declare function layoutLegend(band: LegendBand, padX: number, top: number, cw: number, widthOf: WidthOf, roles: Roles): LaidOutLegend;
