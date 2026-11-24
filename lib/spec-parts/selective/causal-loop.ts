import {defineCausalLoopPart} from '../causal-loop.ts';
import {causalLoop} from '../../bands/causal.ts';

export const causalLoopPart = /* @__PURE__ */ defineCausalLoopPart<ReturnType<typeof causalLoop>>(causalLoop);
