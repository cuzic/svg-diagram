import type { StatusBand, LaidOutStatus } from './types/containers.ts';
import type { DiagramData, FontFamily, Roles, WidthOf } from './types/core.ts';
/** The wording of the badge when `statusLabel` is not given. */
export declare const DEFAULT_STATUS_LABEL = "\u4E0B\u66F8\u304D";
/** The wording the badge shows. */
export declare const statusText: (d: Pick<DiagramData, 'status' | 'statusLabel'>) => string;
/** The same figure with the status strip as its first band (the input is not changed); without a status, the input itself. */
export declare function withStatus(d: DiagramData): DiagramData;
/** Every text this band draws, for measuring: [text, size, weight, font]. */
export declare function statusTexts(band: StatusBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutStatus(band: StatusBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutStatus;
