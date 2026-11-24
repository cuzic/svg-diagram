import {defineRelationDiagramPart} from '../relation-diagram.ts';
import {relationDiagram} from '../../bands/cause.ts';

export const relationDiagramPart = /* @__PURE__ */ defineRelationDiagramPart<ReturnType<typeof relationDiagram>>(relationDiagram);
