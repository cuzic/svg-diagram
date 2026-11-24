import {defineComparePart} from '../compare.ts';
import {compare} from '../../bands/compare.ts';

export const comparePart = /* @__PURE__ */ defineComparePart<ReturnType<typeof compare>>(compare);
