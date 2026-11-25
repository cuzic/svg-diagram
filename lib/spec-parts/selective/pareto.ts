import {defineParetoPart} from '../pareto.ts';
import {pareto} from '../../bands/bars.ts';

export const paretoPart = /* @__PURE__ */ defineParetoPart<ReturnType<typeof pareto>>(pareto);
