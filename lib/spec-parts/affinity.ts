import {items, list, object, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';
import {MAX_AFFINITY_CARDS, affinityGroup, cardsIn, checkAffinity} from './r4-common.ts';

export function defineAffinityPart<Result>(builder: (groups: never, opts: never) => Result): PartDef<Result> {
  return {
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
      const {groups, ...opts} = withoutType(part);
      // fewer groups than columns would leave the figure lopsided: as many columns as groups, up to the builder's 3
      return builder(groups as never, {cols: Math.min(3, (groups as unknown[]).length), ...opts} as never);
    },
  };
}
