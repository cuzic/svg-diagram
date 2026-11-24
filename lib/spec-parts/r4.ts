// Spec parts of round R4 (see lib/spec.ts): quality, risk and problem-solving figures. Each keeps its schema, example, checks and builder
// together. A part whose builder writes words of its own in Japanese gets `en` (merged into the part for `lang: 'en'`); `lang` in a part
// is only ever set that way, never by the caller (the schema does not list it), and is taken off before the builder sees the options.
import {affinity, bowtie, causalLoop, faultTree, fmea, isIsNot, matrix, pdpc, relationDiagram, table} from '../dsl-pure.ts';
import {items, list, object} from '../spec-kit.ts';
import {MAX_AFFINITY_CARDS, optionsOf, affinityGroup, cardsIn, checkAffinity} from './r4-common.ts';
import type {PartDef} from '../spec-kit.ts';
import {defineFaultTreePart} from './fault-tree.ts';
import {defineBowtiePart} from './bowtie.ts';
import {defineFmeaPart} from './fmea.ts';
import {defineIsIsNotPart} from './is-is-not.ts';
import {defineMatrixPart} from './matrix.ts';
import {definePdpcPart} from './pdpc.ts';
import {defineRelationDiagramPart} from './relation-diagram.ts';
import {defineCausalLoopPart} from './causal-loop.ts';
export {MAX_FTA_EVENTS, MAX_FTA_DEPTH, MAX_RELATION_NODES, MAX_RELATION_LINKS, MAX_CAUSAL_NODES, MAX_CAUSAL_LINKS, MAX_CAUSAL_LOOPS, MAX_AFFINITY_CARDS} from './r4-common.ts';

export const PARTS_R4: readonly PartDef[] = [
  defineFaultTreePart<ReturnType<typeof faultTree>>(faultTree),
  defineBowtiePart<ReturnType<typeof bowtie>>(bowtie),
  defineFmeaPart<ReturnType<typeof fmea>>(fmea),
  defineIsIsNotPart<ReturnType<typeof isIsNot>>(isIsNot),
  defineMatrixPart<ReturnType<typeof matrix> | ReturnType<typeof table>>(matrix, table),
  definePdpcPart<ReturnType<typeof pdpc>>(pdpc),
  defineRelationDiagramPart<ReturnType<typeof relationDiagram>>(relationDiagram),
  {
    type: 'affinity',
    description: 'An affinity diagram (KJ method): cards of ideas or facts gathered into groups, each group named by a short sentence that says what its cards have in common. A group can be made of smaller groups (two levels below the top).',
    schema: object({
      type: {const: 'affinity'},
      groups: list(affinityGroup(2), 9, 1),
      cols: {type: 'integer', minimum: 1, maximum: 4, description: 'Groups side by side (default 3, or fewer when there are fewer groups).'},
      cardCols: {type: 'integer', minimum: 1, maximum: 3, description: 'Cards side by side inside a group (default 1).'},
    }, ['type', 'groups']),
    example: {type: 'affinity', groups: [{title: '準備が足りない', cards: ['段取りが決まっていない', '資料が古い']}, {title: '連絡が遅い', cards: ['報告が遅れる', '共有の場がない']}]},
    check(part, at, issues) {
      items(part, 'groups').forEach((g, i) => checkAffinity(g, `${at}.groups[${i}]`, issues));
      const n = items(part, 'groups').reduce((k, g) => k + cardsIn(g), 0);
      if (n > MAX_AFFINITY_CARDS) issues.push({path: `${at}.groups`, message: `hold ${n} cards; the limit is ${MAX_AFFINITY_CARDS}`});
    },
    build(part) {
      const {groups, ...opts} = optionsOf(part);
      // fewer groups than columns would leave the figure lopsided: as many columns as groups, up to the builder's 3
      return affinity(groups as never, {cols: Math.min(3, (groups as unknown[]).length), ...opts} as never);
    },
  },
  defineCausalLoopPart<ReturnType<typeof causalLoop>>(causalLoop),
];
