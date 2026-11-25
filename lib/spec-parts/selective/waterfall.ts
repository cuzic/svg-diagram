import {defineWaterfallPart} from '../waterfall.ts';
import {waterfall} from '../../bands/waterfall.ts';

export const waterfallPart = /* @__PURE__ */ defineWaterfallPart<ReturnType<typeof waterfall>>(waterfall);
