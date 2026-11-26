import {decisionLadder} from '../../bands/states.ts';
import {defineDecisionLadderPart} from '../decision-ladder.ts';

export const decisionLadderPart = /* @__PURE__ */ defineDecisionLadderPart<ReturnType<typeof decisionLadder>>(decisionLadder);
