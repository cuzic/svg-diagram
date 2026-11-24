import {defineLinesPart} from '../lines.ts';
import {band} from '../../band-def.ts';
import {planeDefinition} from '../../bands/plane.ts';
import {lines as build} from '../../dsl/charts.ts';

const lines = (...args: Parameters<typeof build>) => band(planeDefinition, build(...args));

export const linesPart = /* @__PURE__ */ defineLinesPart<ReturnType<typeof lines>>(lines);
