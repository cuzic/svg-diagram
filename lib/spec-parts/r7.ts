// Spec parts of round R7 (see lib/spec.ts): quality function deployment and the why-why table. Each keeps its schema, example,
// checks and builder together.
//
// Not in specs: stateMatrix. Its cells are wireframe parts (a screen in each state), and a spec has no wireframe vocabulary; the same
// grid with words in its cells is a `table`.
import {qfd, whyWhyTable} from '../dsl-pure.ts';
import {items, list, object, oneOf, text} from '../spec-kit.ts';
import type {Json, PartDef} from '../spec-kit.ts';

/** Chains of a why-why table, and the steps of each. */
export const MAX_WHY_CHAINS = 8;
export const MAX_WHY_STEPS = 5;

export const PARTS_R7: readonly PartDef[] = [
  {
    type: 'qfd',
    description: 'A quality function deployment (QFD, house of quality without the roof): customer demands as rows, each with its importance, against quality characteristics as columns, with ◎ (strong, 9), ○ (3) or △ (1) where a characteristic serves a demand. Each column gets a score, Σ importance x value, and its share in percent; the top characteristic is marked.',
    schema: object({
      type: {const: 'qfd'},
      demands: list(object({label: text('What the customer wants, in their words.', 40), importance: {type: 'number', minimum: 0, maximum: 10, description: 'How much it matters, usually 1 to 5.'}}, ['label', 'importance']), 12, 1),
      characteristics: list(text('A measurable quality characteristic of the product.', 20), 8, 1),
      relations: list({type: 'array', items: {...oneOf('◎', '○', '△', ''), description: "◎ strong, ○ medium, △ weak, '' none."}, minItems: 1, maxItems: 8, description: 'One per characteristic.'}, 12, 1),
      corner: text('The top-left heading (default 要求品質).', 30),
      title: text('A title bar over the table.', 40),
      highlight: {type: 'boolean', description: 'false: do not mark the top score.'},
    }, ['type', 'demands', 'characteristics', 'relations']),
    example: {type: 'qfd', demands: [{label: '持ちやすい', importance: 5}, {label: '電池が長持ち', importance: 4}, {label: '安い', importance: 3}], characteristics: ['重さ', '電池容量', '部品点数'], relations: [['◎', '△', ''], ['△', '◎', ''], ['', '○', '◎']]},
    en: {corner: 'Customer demand', labels: {importance: 'Importance', score: 'Score', relative: 'Relative %'}},
    check(part, at, issues) {
      const demands = items(part, 'demands').length, chars = items(part, 'characteristics').length, rows = part['relations'] as unknown[][];
      if (rows.length !== demands) issues.push({path: `${at}.relations`, message: `has ${rows.length} rows; there are ${demands} demands`});
      rows.forEach((r, i) => { if (r.length !== chars) issues.push({path: `${at}.relations[${i}]`, message: `has ${r.length} marks; there are ${chars} characteristics`}); });
    },
    build(part) {
      const {type: _t, demands, characteristics, relations, ...opts} = part;
      return qfd(demands as never, characteristics as never, relations as never, opts as never);
    },
  },
  {
    type: 'whyWhyTable',
    description: 'A why-why analysis as a table: the problem in the first column, then each chain of answers to "why?" across a row (why 1, why 2, ...), its root cause and what is done about it. Use it when the chains do not branch much; whyWhyTree draws the same analysis as a tree. A cause two chains share is written in each row.',
    schema: object({
      type: {const: 'whyWhyTable'},
      problem: text('The problem that happened.', 60),
      chains: list(object({
        whys: list(text('The answer to "why?" at this step: a fact, written as a statement.', 50), MAX_WHY_STEPS, 1),
        trueCause: text('The root cause this chain ends in.', 50),
        measure: text('What is done about the root cause.', 50),
      }, ['whys']), MAX_WHY_CHAINS, 1),
      title: text('A title bar over the table.', 40),
    }, ['type', 'problem', 'chains']),
    example: {type: 'whyWhyTable', problem: 'リリースが遅れた', chains: [{whys: ['修正に時間がかかった', '影響範囲が広かった', '検証が最後に集中していた'], trueCause: '検証を早い段階でしていない', measure: '結合テストを毎週回す'}]},
    en: {labels: {problem: 'Problem', why: 'Why', trueCause: 'Root cause', measure: 'Measure'}},
    check(part, at, issues) {
      items(part, 'chains').forEach((c: Json, i) => {
        if (c['measure'] !== undefined && c['trueCause'] === undefined) issues.push({path: `${at}.chains[${i}].measure`, message: 'needs a trueCause: a measure without a root cause treats the symptom'});
      });
    },
    build(part) {
      const {type: _t, problem, chains, ...opts} = part;
      return whyWhyTable(problem as string, chains as never, opts as never);
    },
  },
];
