import {band} from '../../band-def.ts';
import {planeDefinition} from '../../bands/plane.ts';
import {burnup as build, lines as buildLines} from '../../dsl/charts.ts';
import {defineBurnupPart} from '../burnup.ts';

const burnup = (...args: Parameters<typeof build>) => band(planeDefinition, build(...args));
const lines = (...args: Parameters<typeof buildLines>) => band(planeDefinition, buildLines(...args));

export const burnupPart = /* @__PURE__ */ defineBurnupPart(burnup, lines);
