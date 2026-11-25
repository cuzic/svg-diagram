import {defineJourneyMapPart} from '../journey-map.ts';
import {journeyMap} from '../../bands/table.ts';

export const journeyMapPart = /* @__PURE__ */ defineJourneyMapPart<ReturnType<typeof journeyMap>>(journeyMap);
