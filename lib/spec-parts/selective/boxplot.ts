import {defineBoxplotPart} from '../boxplot.ts';
import {boxplot} from '../../bands/catplot.ts';

export const boxplotPart = /* @__PURE__ */ defineBoxplotPart<ReturnType<typeof boxplot>>(boxplot);
