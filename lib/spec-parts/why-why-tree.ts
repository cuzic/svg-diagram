import {MAX_CAUSE_NODES, items, list, object, text, whyNode, whySize} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineWhyWhyTreePart<Result>(builder: (problem: string, whys: never, opts: {readingNote?: boolean}) => Result): PartDef<Result> {
  return {
    type: 'whyWhyTree',
    description: 'A why-why analysis (5 whys): the problem at the top, each answer to "why?" below the one it explains, root causes in a double frame, and what is done about each. Each answer should be a fact, not a person.',
    schema: object({
      type: {const: 'whyWhyTree'},
      problem: text('The problem that happened.', 60),
      readingNote: {type: 'boolean', description: 'false: leave out the lines under the tree that say how to read it.'},
      whys: list(whyNode(4), 4, 1),
    }, ['type', 'problem', 'whys']),
    example: {type: 'whyWhyTree', problem: 'リリースが遅れた', whys: [{why: '修正に時間がかかった', because: [{why: '検証が最後に集中していた', trueCause: true, measure: '結合テストを毎週回す'}]}]},
    check(part, at, issues) {
      const n = 1 + items(part, 'whys').reduce((k, w) => k + whySize(w), 0);
      if (n > MAX_CAUSE_NODES) issues.push({path: `${at}.whys`, message: `make ${n} boxes with the problem and the measures; the limit is ${MAX_CAUSE_NODES}`});
    },
    build(part) {
      return builder(part['problem'] as string, part['whys'] as never, part['readingNote'] === undefined ? {} : {readingNote: part['readingNote'] as boolean});
    },
  };
}
