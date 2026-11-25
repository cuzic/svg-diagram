import {walkBands} from '../legend-notation.ts';
import {fillScaleLimit as scaleLimit, fillTextSize, imageFillTextSize} from '../slide-fill.ts';
import {ROLES} from '../tokens.ts';
import type {Band} from '../types/index.ts';

export {caption} from './caption.ts';
export {box} from './box.ts';
/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands: Band[]): number {
  let largest = 0;
  for (const b of walkBands(bands)) {
    if (b.type === 'banner') largest = Math.max(largest, fillTextSize(ROLES, b.headlineRole));
    else if (b.type === 'bars' || b.type === 'plane') largest = Math.max(largest, fillTextSize(ROLES, b.labelRole));
    else if (b.type === 'image') largest = Math.max(largest, imageFillTextSize(b, ROLES));
  }
  return scaleLimit(largest);
}
export {stat} from './stat.ts';
export {banner} from './banner.ts';
// A labelled frame around other bands (a network zone, a service boundary, a
// release phase). children: any bands (row, grid, box, nested group...).
// tone: 'muted' (default, grey fill) | 'accent' | 'plain' (white) | 'danger';
// dashed: draw the boundary dashed (default true for 'plain' = a trust/zone line).
// frame: false draws no frame and no title (pad 0): a bare container, e.g. to put a table / plane / banner in a row() without a doubled outline.
// Types: the ids (and connect() refs) of the children are exposed to add().
export {group} from './group.ts';
export {legend} from './legend.ts';
export {raw} from './raw.ts';
