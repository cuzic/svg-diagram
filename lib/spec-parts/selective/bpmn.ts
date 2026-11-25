import {defineBpmnPart} from '../bpmn.ts';
import {bpmn} from '../../bands/bpmn.ts';

export const bpmnPart = /* @__PURE__ */ defineBpmnPart<ReturnType<typeof bpmn>>(bpmn);
