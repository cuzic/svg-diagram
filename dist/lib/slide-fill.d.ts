import { analyzeFit } from './fit.ts';
export { fillTextSize, imageFillTextSize } from './slide-fill-text.ts';
export declare const UNMEASURED_FILL_NOTE = "fill: true \u306E\u56F3\u306F\u30B9\u30E9\u30A4\u30C9\u306E\u7A7A\u304D\u5BF8\u6CD5\u304C\u8981\u308B\u305F\u3081\u3001\u65E2\u5B9A\u306E\u5E45\u30FB\u500D\u7387\u3067\u63CF\u3044\u305F";
/** Keep opted-in large text within the ceiling. Ordinary roles can always try 1.8x. */
export declare function fillScaleLimit(largestOptInText: number): number;
export declare function findFillScale(maxHeight: number, limit: number, heightAt: (scale: number) => Promise<number>): Promise<number>;
/** Supply as `fitter` when drawing into a numeric slide budget. */
export declare const slideFitter: {
    fontScale(maxHeight: number, largestOptInText: number, heightAt: (scale: number) => Promise<number>): Promise<number>;
    analyzeFit: typeof analyzeFit;
};
