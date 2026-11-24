// Spec parts of round R5 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// steps, versus, concentric, harvey, compare, burndown, burnup, mekko, butterfly, combo. A burndown / burnup counts days from 0: it never reads a clock.
import {box, burndown, burnup, butterfly, combo, compare, concentric, harvey, lines, mekko, steps} from '../dsl-pure.ts';
import {versus} from '../compose/versus.ts';
import type {PartDef} from '../spec-kit.ts';


import {defineConcentricPart} from './concentric.ts';
import {defineHarveyPart} from './harvey.ts';
import {defineComparePart} from './compare.ts';
import {defineMekkoPart} from './mekko.ts';
import {defineButterflyPart} from './butterfly.ts';
import {defineComboPart} from './combo.ts';
import {defineStepsPart} from './steps.ts';
import {defineVersusPart} from './versus.ts';
import {defineBurndownPart} from './burndown.ts';
import {defineBurnupPart} from './burnup.ts';
export const PARTS_R5: readonly PartDef[] = [
  defineStepsPart<ReturnType<typeof steps>>(steps),
  defineVersusPart<ReturnType<typeof versus>>(versus, box),
  defineConcentricPart<ReturnType<typeof concentric>>(concentric),
  defineHarveyPart<ReturnType<typeof harvey>>(harvey),
  defineComparePart<ReturnType<typeof compare>>(compare),
  defineBurndownPart<ReturnType<typeof burndown>>(burndown, lines),
  defineBurnupPart<ReturnType<typeof burnup>>(burnup, lines),
  defineMekkoPart<ReturnType<typeof mekko>>(mekko),
  defineButterflyPart<ReturnType<typeof butterfly>>(butterfly),
  defineComboPart<ReturnType<typeof combo>>(combo),
];
