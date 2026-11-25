import {TEXT_TONE, items, list, mustExist, object, text, uniqueIds, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineVennPart<Result>(builder: (sets: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'venn',
    description: 'A Venn diagram of two or three sets: what each has, and what they share. Overlaps are named by the names of their sets.',
    schema: object({
      type: {const: 'venn'},
      sets: list(object({name: text('The name of the set.', 20), label: text('What is only in this set.', 40), tone: TEXT_TONE}, ['name']), 3, 2),
      overlaps: list(object({sets: {type: 'array', items: text('A set name.', 20), minItems: 2, maxItems: 3}, label: text('What the sets share.', 40)}, ['sets', 'label']), 4),
      centre: text('What all the sets share.', 30),
      universe: text('The name of the whole, drawn as a frame.', 30),
    }, ['type', 'sets']),
    example: {type: 'venn', sets: [{name: '技術'}, {name: '顧客理解'}], overlaps: [{sets: ['技術', '顧客理解'], label: '価値'}], universe: 'チーム'},
    check(part, at, issues) {
      const names = uniqueIds(part, 'sets', at, issues, 'name');
      items(part, 'overlaps').forEach((o, i) => ((o['sets'] as unknown[] | undefined) ?? []).forEach((n, j) => mustExist(n, names, `${at}.overlaps[${i}].sets[${j}]`, 'set name', issues)));
    },
    build(part) {
      const {sets, ...opts} = withoutType(part);
      return builder(sets as never, opts as never);
    },
  };
}
