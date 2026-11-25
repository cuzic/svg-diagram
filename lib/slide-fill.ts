import {MathTooWideError} from './math.ts';
import {OPT_IN_TEXT_MAX} from './tokens.ts';
import type {Role, Roles} from './types/core.ts';
import type {ImageBand} from './types/image.ts';

export const UNMEASURED_FILL_NOTE = 'fill: true の図はスライドの空き寸法が要るため、既定の幅・倍率で描いた';

/** The unscaled size of a role explicitly opted into the extended text range. */
export function fillTextSize(roles: Roles, role?: Role): number {
  return role ? roles[role] : 0;
}

export function imageFillTextSize(data: Pick<ImageBand, 'labelRole' | 'marks' | 'labels'>, roles: Roles): number {
  let size = fillTextSize(roles, data.labelRole);
  for (const mark of data.marks ?? []) size = Math.max(size, fillTextSize(roles, mark.role));
  for (const label of data.labels ?? []) size = Math.max(size, fillTextSize(roles, label.role));
  return size;
}

/** Keep opted-in large text within the ceiling. Ordinary roles can always try 1.8x. */
export function fillScaleLimit(largestOptInText: number): number {
  return Math.min(1.8, OPT_IN_TEXT_MAX / largestOptInText);
}

export async function findFillScale(maxHeight: number, limit: number, heightAt: (scale: number) => Promise<number>): Promise<number> {
  // An unfit 1x layout still supplies the fit warning (or propagates its layout error).
  if (await heightAt(1) > maxHeight) return 1;
  let lo = 1, hi = limit;
  for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2;
    try {
      if (await heightAt(mid) <= maxHeight) lo = mid;
      else hi = mid;
    } catch (error) {
      if (!(error instanceof MathTooWideError)) throw error;
      hi = mid;
    }
  }
  return Math.floor(lo * 100) / 100;
}
