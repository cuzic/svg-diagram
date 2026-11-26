import {EMPHASIS_TONE, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef} from '../spec-kit.ts';

const word = (description: string): JsonSchema => ({type: 'string', maxLength: 20, description});

export function defineDecisionLadderPart<Result>(builder: (steps: never, otherwise: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'decisionLadder',
    anchors: (part, at) => [
      ...items(part, 'steps').flatMap((_, i) => [{id: `q${i + 1}`, path: `${at}.steps[${i}]`}, {id: `a${i + 1}`, path: `${at}.steps[${i}]`}]),
      {id: 'otherwise', path: `${at}.otherwise`},
    ],
    description: 'A decision ladder: yes/no questions stacked down the left; each yes goes right to its answer, each no goes down to the next question, and the last no ends in the final box. Use it when the decisions form ONE chain (the first question that is yes decides) and the figure must stay small and readable on a 16:9 slide; use flowchart when a no branches elsewhere or the flow loops. Anchors: q1..qN (questions), a1..aN (answers), otherwise (the final box).',
    schema: object({
      type: {const: 'decisionLadder'},
      steps: list(object({
        q: text('The question, ending in ？ or ?.', 80),
        yes: text('The answer box its yes leads to.', 60),
        sub: text('A second, muted line in the answer box.', 60),
        tone: EMPHASIS_TONE,
        yesLabel: word("The word on this step's yes arrow, instead of the figure's `yes`."),
        noLabel: word("The word on this step's no arrow, instead of the figure's `no`."),
      }, ['q', 'yes']), 12, 1),
      otherwise: {oneOf: [text('Where the last no ends.', 60), object({label: text('Where the last no ends.', 60), sub: text('A second, muted line.', 60), tone: EMPHASIS_TONE}, ['label'])], description: 'The final box: a text, or {label, sub?, tone?}. Required.'},
      yes: word("The word on the arrows that go right to an answer (default 'はい'; an empty text puts none)."),
      no: word("The word on the arrows that go down to the next question (default 'いいえ'; an empty text puts none)."),
      question: {...oneOf('box', 'diamond'), description: "The shape of a question: 'box' (default, rounded) or 'diamond'."},
    }, ['type', 'steps', 'otherwise']),
    example: {type: 'decisionLadder', steps: [{q: '貸出票は書いてある？', yes: '窓口で受け付ける'}, {q: '館内で読むだけ？', yes: '閲覧席へ案内する', sub: '2 時間まで'}], otherwise: '後日の来館をお願いする'},
    check() {},
    build(part) {
      const {steps, otherwise, ...opts} = withoutType(part) as Json;
      return builder(steps as never, otherwise as never, opts as never);
    },
  };
}
