import type { Role, Roles } from './types/core.ts';
import type { ImageBand } from './types/image.ts';
/** The unscaled size of a role explicitly opted into the extended text range. */
export declare function fillTextSize(roles: Roles, role?: Role): number;
export declare function imageFillTextSize(data: Pick<ImageBand, 'labelRole' | 'marks' | 'labels'>, roles: Roles): number;
