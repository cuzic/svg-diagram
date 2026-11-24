// Spec parts of round R6 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// QC charts from raw data: a histogram, a scatter diagram, a control chart, a check sheet, range bars and a box plot.
import {boxplot, checkSheet, controlChart, histogram, rangeBars, scatter} from '../dsl-pure.ts';
import type {PartDef} from '../spec-kit.ts';
import {defineHistogramPart} from './histogram.ts';
import {defineScatterPart} from './scatter.ts';
import {defineControlChartPart} from './control-chart.ts';
import {defineCheckSheetPart} from './check-sheet.ts';
import {defineRangeBarsPart} from './range-bars.ts';
import {defineBoxplotPart} from './boxplot.ts';

export const PARTS_R6: readonly PartDef[] = [
  defineHistogramPart<ReturnType<typeof histogram>>(histogram),
  defineScatterPart<ReturnType<typeof scatter>>(scatter),
  defineControlChartPart<ReturnType<typeof controlChart>>(controlChart),
  defineCheckSheetPart<ReturnType<typeof checkSheet>>(checkSheet),
  defineRangeBarsPart<ReturnType<typeof rangeBars>>(rangeBars),
  defineBoxplotPart<ReturnType<typeof boxplot>>(boxplot),
];
