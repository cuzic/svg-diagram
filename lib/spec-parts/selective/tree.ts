import {defineTreePart} from '../tree.ts';
import {tree} from '../../bands/tree.ts';

export const treePart = /* @__PURE__ */ defineTreePart<ReturnType<typeof tree>>(tree);
