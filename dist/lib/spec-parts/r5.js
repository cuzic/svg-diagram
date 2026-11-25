// Spec parts of round R5 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// steps, versus, concentric, harvey, compare, burndown, burnup, mekko, butterfly, combo. A burndown / burnup counts days from 0: it never reads a clock.
import { box, burndown, burnup, butterfly, combo, compare, concentric, harvey, lines, mekko, steps } from '../dsl-pure.js';
import { versus } from '../compose/versus.js';
import { defineConcentricPart } from './concentric.js';
import { defineHarveyPart } from './harvey.js';
import { defineComparePart } from './compare.js';
import { defineMekkoPart } from './mekko.js';
import { defineButterflyPart } from './butterfly.js';
import { defineComboPart } from './combo.js';
import { defineStepsPart } from './steps.js';
import { defineVersusPart } from './versus.js';
import { defineBurndownPart } from './burndown.js';
import { defineBurnupPart } from './burnup.js';
export const PARTS_R5 = [
    defineStepsPart(steps),
    defineVersusPart(versus, box),
    defineConcentricPart(concentric),
    defineHarveyPart(harvey),
    defineComparePart(compare),
    defineBurndownPart(burndown, lines),
    defineBurnupPart(burnup, lines),
    defineMekkoPart(mekko),
    defineButterflyPart(butterfly),
    defineComboPart(combo),
];
