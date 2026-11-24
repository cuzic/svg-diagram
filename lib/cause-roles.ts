import type {EmphasisTone} from './types/core.ts';
import type {CauseRole} from './types/diagrams.ts';

/** What a role looks like when the node gives no tone. `double`: the box has a second outline (the finding of the figure). */
export const CAUSE_ROLES: Record<CauseRole, {tone: EmphasisTone; double?: boolean; dashed?: boolean}> = {
  effect: {tone: 'plain'},
  ude: {tone: 'danger'},
  root: {tone: 'accent', double: true},
  de: {tone: 'new'},
  injection: {tone: 'changed'},
  goal: {tone: 'accent', double: true},
  obstacle: {tone: 'plain'}, // drawn as a hexagon
  io: {tone: 'new'},
  action: {tone: 'changed'},
  start: {tone: 'accent', double: true},
  step: {tone: 'plain'},
  risk: {tone: 'danger'}, // drawn as a hexagon
  measure: {tone: 'changed'},
  precondition: {tone: 'removed'}, // a fact of the present nobody controls: the grey dashed box
  tipping: {tone: 'danger', double: true}, // where a negative branch tips over (ADR 0020 D1)
  trim: {tone: 'changed', dashed: true}, // the injection that cuts a negative branch: a dashed box
  need: {tone: 'solid'}, // an input of a transition tree's unit (current reality + need + action): the filled box, so that it is not the pale box of an io (ADR 0020 D2)
};
