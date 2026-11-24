import {band} from '../../band-def.ts';
import {captionDefinition} from '../../bands/caption.ts';
import {causeDefinition} from '../../bands/cause.ts';
import {whyWhyTree as build} from '../../dsl/diagrams.ts';
import {defineWhyWhyTreePart} from '../why-why-tree.ts';

const whyWhyTree = (...args: Parameters<typeof build>) => build(...args).map(item =>
  item.type === 'cause' ? band(causeDefinition, item) : band(captionDefinition, item));

export const whyWhyTreePart = /* @__PURE__ */ defineWhyWhyTreePart(whyWhyTree);
