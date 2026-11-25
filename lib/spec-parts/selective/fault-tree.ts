import {defineFaultTreePart} from '../fault-tree.ts';
import {faultTree} from '../../bands/fta.ts';

export const faultTreePart = /* @__PURE__ */ defineFaultTreePart<ReturnType<typeof faultTree>>(faultTree);
