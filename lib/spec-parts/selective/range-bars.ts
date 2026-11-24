import {defineRangeBarsPart} from '../range-bars.ts';
import {rangeBars} from '../../bands/bars.ts';

export const rangeBarsPart = /* @__PURE__ */ defineRangeBarsPart<ReturnType<typeof rangeBars>>(rangeBars);
