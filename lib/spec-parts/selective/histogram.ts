import {defineHistogramPart} from '../histogram.ts';
import {histogram} from '../../bands/bars.ts';

export const histogramPart = /* @__PURE__ */ defineHistogramPart<ReturnType<typeof histogram>>(histogram);
