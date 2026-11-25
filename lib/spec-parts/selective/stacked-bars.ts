import {defineStackedBarsPart} from '../stacked-bars.ts';
import {stackedBars} from '../../bands/stacked.ts';

export const stackedBarsPart = /* @__PURE__ */ defineStackedBarsPart<ReturnType<typeof stackedBars>>(stackedBars);
