import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { CloudBand, LaidOutCloud } from './types/diagrams.ts';
export declare function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutCloud;
