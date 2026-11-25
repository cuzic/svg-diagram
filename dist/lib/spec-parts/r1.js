// Spec parts of round R1 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Charts of numbers: bars, lines, stacked bars, a waterfall, a radar chart and a Pareto chart.
import { bars, lines, pareto, radar, stackedBars, waterfall } from '../dsl-pure.js';
import { defineBarsPart } from './bars.js';
import { defineLinesPart } from './lines.js';
import { defineStackedBarsPart } from './stacked-bars.js';
import { defineWaterfallPart } from './waterfall.js';
import { defineRadarPart } from './radar.js';
import { defineParetoPart } from './pareto.js';
export const PARTS_R1 = [
    defineBarsPart(bars),
    defineLinesPart(lines),
    defineStackedBarsPart(stackedBars),
    defineWaterfallPart(waterfall),
    defineRadarPart(radar),
    defineParetoPart(pareto),
];
