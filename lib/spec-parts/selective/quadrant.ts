import {defineQuadrantPart} from '../quadrant.ts';
import {quadrant} from '../../bands/quadrant.ts';

export const quadrantPart = /* @__PURE__ */ defineQuadrantPart<ReturnType<typeof quadrant>>(quadrant);
