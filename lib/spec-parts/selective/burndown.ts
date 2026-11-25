import {band} from '../../band-def.ts';
import {planeDefinition} from '../../bands/plane.ts';
import {burndown as build, lines as buildLines} from '../../dsl/charts.ts';
import {defineBurndownPart} from '../burndown.ts';

const burndown = (...args: Parameters<typeof build>) => band(planeDefinition, build(...args));
const lines = (...args: Parameters<typeof buildLines>) => band(planeDefinition, buildLines(...args));

export const burndownPart = /* @__PURE__ */ defineBurndownPart(burndown, lines);
