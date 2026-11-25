import { defineLinesPart } from '../lines.js';
import { band } from '../../band-def.js';
import { planeDefinition } from '../../bands/plane.js';
import { lines as build } from '../../dsl/charts.js';
const lines = (...args) => band(planeDefinition, build(...args));
export const linesPart = /* @__PURE__ */ defineLinesPart(lines);
