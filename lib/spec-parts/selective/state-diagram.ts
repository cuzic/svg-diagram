import {defineStateDiagramPart} from '../state-diagram.ts';
import {stateDiagram} from '../../bands/states.ts';

export const stateDiagramPart = /* @__PURE__ */ defineStateDiagramPart<ReturnType<typeof stateDiagram>>(stateDiagram);
