import {defineGanttPart} from '../gantt.ts';
import {gantt} from '../../bands/gantt.ts';

export const ganttPart = /* @__PURE__ */ defineGanttPart<ReturnType<typeof gantt>>(gantt);
