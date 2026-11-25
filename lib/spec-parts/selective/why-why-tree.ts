import {whyWhyTree} from '../../compose/selective/why-why-tree.ts';
import type {PartDef} from '../../spec-kit.ts';
import {defineWhyWhyTreePart} from '../why-why-tree.ts';

export const whyWhyTreePart: PartDef<ReturnType<typeof whyWhyTree>> = /* @__PURE__ */ defineWhyWhyTreePart(whyWhyTree);
