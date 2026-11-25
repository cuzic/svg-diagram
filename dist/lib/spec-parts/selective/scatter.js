import { defineScatterPart } from '../scatter.js';
import { band } from '../../band-def.js';
import { planeDefinition } from '../../bands/plane.js';
import { scatter as build } from '../../dsl/scatter.js';
const scatter = (...args) => band(planeDefinition, build(...args));
export const scatterPart = /* @__PURE__ */ defineScatterPart(scatter);
