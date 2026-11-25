import {flowchart} from '../../bands/states.ts';
import {defineFlowchartPart} from '../flowchart.ts';

export const flowchartPart = /* @__PURE__ */ defineFlowchartPart<ReturnType<typeof flowchart>>(flowchart);
