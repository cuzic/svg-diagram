import { band } from '../../band-def.js';
import { planeDefinition } from '../../bands/plane.js';
import { burnup as build, lines as buildLines } from '../../dsl/charts.js';
import { defineBurnupPart } from '../burnup.js';
const burnup = (...args) => band(planeDefinition, build(...args));
const lines = (...args) => band(planeDefinition, buildLines(...args));
export const burnupPart = /* @__PURE__ */ defineBurnupPart(burnup, lines);
