import { band } from '../../band-def.js';
import { planeDefinition } from '../../bands/plane.js';
import { burndown as build, lines as buildLines } from '../../dsl/charts.js';
import { defineBurndownPart } from '../burndown.js';
const burndown = (...args) => band(planeDefinition, build(...args));
const lines = (...args) => band(planeDefinition, buildLines(...args));
export const burndownPart = /* @__PURE__ */ defineBurndownPart(burndown, lines);
