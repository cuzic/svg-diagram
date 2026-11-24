import {defineMekkoPart} from '../mekko.ts';
import {mekko} from '../../bands/stacked.ts';

export const mekkoPart = /* @__PURE__ */ defineMekkoPart<ReturnType<typeof mekko>>(mekko);
