import {defineBarsPart} from '../bars.ts';
import {bars} from '../../bands/bars.ts';

export const barsPart = /* @__PURE__ */ defineBarsPart<ReturnType<typeof bars>>(bars);
