import type { Roles } from './types/core.ts';
import type { LaidOutBox } from './types/text-bands.ts';
export declare const ringed: (band: Pick<LaidOutBox, 'dim' | 'tone'>) => boolean;
/** Where a box's step badge is: its centre and radius, the number's size and baseline (the title's own). The svg and the PPTX place it alike. */
export declare function stepBadgeAt(band: Pick<LaidOutBox, 'x' | 'y' | 'w' | 'wrappedRuns' | 'padX' | 'padY' | 'align' | 'iconAt' | 'titleW' | 'icon'>, roles?: Roles): {
    cx: number;
    cy: number;
    r: number;
    size: number;
    baseline: number;
};
