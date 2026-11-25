import {defineCauseTreePart} from '../cause-tree.ts';
import {causeTree} from '../../bands/cause.ts';

export const causeTreePart = /* @__PURE__ */ defineCauseTreePart<ReturnType<typeof causeTree>>(causeTree);
