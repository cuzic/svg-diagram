// Spec parts of round R6 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// QC charts from raw data: a histogram, a scatter diagram, a control chart, a check sheet, range bars and a box plot.
import { boxplot, checkSheet, controlChart, histogram, rangeBars, scatter } from '../dsl-pure.js';
import { defineHistogramPart } from './histogram.js';
import { defineScatterPart } from './scatter.js';
import { defineControlChartPart } from './control-chart.js';
import { defineCheckSheetPart } from './check-sheet.js';
import { defineRangeBarsPart } from './range-bars.js';
import { defineBoxplotPart } from './boxplot.js';
export const PARTS_R6 = [
    defineHistogramPart(histogram),
    defineScatterPart(scatter),
    defineControlChartPart(controlChart),
    defineCheckSheetPart(checkSheet),
    defineRangeBarsPart(rangeBars),
    defineBoxplotPart(boxplot),
];
