// Spec parts of round R1 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Charts of numbers: bars, lines, stacked bars, a waterfall, a radar chart and a Pareto chart.
import {bars, lines, pareto, radar, stackedBars, waterfall} from '../dsl-pure.ts';
import type {PartDef} from '../spec-kit.ts';
import {defineBarsPart} from './bars.ts';
import {defineLinesPart} from './lines.ts';
import {defineStackedBarsPart} from './stacked-bars.ts';
import {defineWaterfallPart} from './waterfall.ts';
import {defineRadarPart} from './radar.ts';
import {defineParetoPart} from './pareto.ts';

export const PARTS_R1: readonly PartDef[] = [
  defineBarsPart<ReturnType<typeof bars>>(bars),
  defineLinesPart<ReturnType<typeof lines>>(lines),
  defineStackedBarsPart<ReturnType<typeof stackedBars>>(stackedBars),
  defineWaterfallPart<ReturnType<typeof waterfall>>(waterfall),
  defineRadarPart<ReturnType<typeof radar>>(radar),
  defineParetoPart<ReturnType<typeof pareto>>(pareto),
];
