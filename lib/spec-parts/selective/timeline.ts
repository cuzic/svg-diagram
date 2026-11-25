import {defineTimelinePart} from '../timeline.ts';
import {timeline} from '../../bands/timeline.ts';

export const timelinePart = /* @__PURE__ */ defineTimelinePart<ReturnType<typeof timeline>>(timeline);
