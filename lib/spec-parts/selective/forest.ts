import {defineForestPart} from '../forest.ts';
import {forest} from '../../bands/forest.ts';

export const forestPart = /* @__PURE__ */ defineForestPart<ReturnType<typeof forest>>(forest);
