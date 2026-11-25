import {MathTooWideError} from './math.ts';
import {OPT_IN_TEXT_MAX} from './tokens.ts';
import {analyzeFit} from './fit.ts';

export {fillTextSize, imageFillTextSize} from './slide-fill-text.ts';

export const UNMEASURED_FILL_NOTE = 'fill: true の図はスライドの空き寸法が要るため、既定の幅・倍率で描いた';

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

/** Supply as `fitter` when drawing into a numeric slide budget. */
export const slideFitter = {
  fontScale(maxHeight: number, largestOptInText: number, heightAt: (scale: number) => Promise<number>) {
    return findFillScale(maxHeight, fillScaleLimit(largestOptInText), heightAt);
  },
  analyzeFit,
};
