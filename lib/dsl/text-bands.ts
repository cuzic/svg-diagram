import {walkBands} from '../rules.ts';
import {ROLES, OPT_IN_TEXT_MAX} from '../tokens.ts';
import type {RawBand, RawOpts} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import {assertNoReveal} from './shared.ts';

export {caption} from './caption.ts';
export {box} from './box.ts';
/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export function fillScaleLimit(bands: Band[]): number {
  const optIn = walkBands(bands).flatMap(b => b.type === 'banner' && b.headlineRole ? [ROLES[b.headlineRole]] : (b.type === 'bars' || b.type === 'plane') && b.labelRole ? [ROLES[b.labelRole]] : b.type === 'image' ? [b.labelRole, ...(b.marks ?? []).map(m => m.role), ...(b.labels ?? []).map(l => l.role)].flatMap(r => r ? [ROLES[r]] : []) : []);
  return Math.min(1.8, optIn.length ? OPT_IN_TEXT_MAX / Math.max(...optIn) : 1.8);
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
// Escape hatch. `draw(ctx)` must return a raw SVG fragment string; it
// receives its allocated origin/size and a couple of tone-aware helpers, but
// nothing stops it from emitting arbitrary markup — the fragment is passed
// through emit.ts unmodified. build() runs `lint-svg.ts --strict` on the
// finished file regardless, so an off-token color or sub-14px size written
// here still gets caught before the file is trusted — raw() only escapes
// layout, never the constraint system's verification step.
export function raw(opts: RawOpts): RawBand {
  assertNoReveal(opts, 'raw()');
  if (typeof opts.draw !== 'function') throw new Error('raw({draw}) needs a draw(ctx) function');
  return {type: 'raw', h: opts.h ?? 0, draw: opts.draw};
}
