import {defineScatterPart} from '../scatter.ts';
import {band} from '../../band-def.ts';
import {planeDefinition} from '../../bands/plane.ts';
import {scatter as build} from '../../dsl/scatter.ts';

const scatter = (...args: Parameters<typeof build>) => band(planeDefinition, build(...args));

export const scatterPart = /* @__PURE__ */ defineScatterPart<ReturnType<typeof scatter>>(scatter);
