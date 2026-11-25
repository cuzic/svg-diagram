import { walkAnyBands } from '../full-definitions.js';
import { fillScaleLimit as scaleLimit, fillTextSize, imageFillTextSize } from '../slide-fill.js';
import { ROLES } from '../tokens.js';
/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands) {
    let largest = 0;
    for (const b of walkAnyBands(bands)) {
        if (b.type === 'banner')
            largest = Math.max(largest, fillTextSize(ROLES, b.headlineRole));
        else if (b.type === 'bars' || b.type === 'plane')
            largest = Math.max(largest, fillTextSize(ROLES, b.labelRole));
        else if (b.type === 'image')
            largest = Math.max(largest, imageFillTextSize(b, ROLES));
    }
    return scaleLimit(largest);
}
