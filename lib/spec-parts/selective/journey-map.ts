import {defineJourneyMapPart} from '../journey-map.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {journeyMap as build} from '../../dsl/qc-semantic.ts';

const journeyMap = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const journeyMapPart = /* @__PURE__ */ defineJourneyMapPart<ReturnType<typeof journeyMap>>(journeyMap);
