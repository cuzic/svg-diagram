import {flowSteps, items, object, oneOf, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineChevronPart<Result>(builder: (steps: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'chevron',
    description: 'Process steps as arrow shapes in a row (or a column): a sequence with no branches, such as the phases of a project. `current` marks the step in progress.',
    schema: object({
      type: {const: 'chevron'},
      steps: flowSteps(2, 12),
      direction: oneOf('horizontal', 'vertical'),
      rows: {oneOf: [{type: 'integer', minimum: 1, maximum: 4}, {type: 'string', enum: ['auto']}], description: "Wrap a horizontal chevron onto this many rows. 'auto': the fewest rows (up to 4) where no step's text wraps."},
      perRow: {type: 'integer', minimum: 1, maximum: 8, description: 'How many steps one row holds (horizontal only). Not together with rows.'},
      current: {type: 'integer', minimum: 1, maximum: 12, description: 'The step in progress, from 1.'},
    }, ['type', 'steps']),
    example: {type: 'chevron', steps: [{label: '計画', sub: '要件を確認'}, {label: '実装', sub: '小さく作る'}, {label: '検証', sub: '品質を確認'}, {label: '公開', sub: '利用を開始'}], current: 3},
    check(part, at, issues) {
      const n = items(part, 'steps').length, c = part['current'], {rows, perRow} = part;
      if (typeof c === 'number' && c > n) issues.push({path: `${at}.current`, message: `is ${c}, but there are ${n} steps`});
      const vertical = part['direction'] === 'vertical';
      if (rows !== undefined && perRow !== undefined) { issues.push({path: `${at}.perRow`, message: 'is given together with rows; use either rows or perRow, not both'}); return; }
      if (vertical && rows !== undefined) issues.push({path: `${at}.rows`, message: "does not apply to direction 'vertical', which does not wrap; make it horizontal or remove rows"});
      if (vertical && perRow !== undefined) issues.push({path: `${at}.perRow`, message: "does not apply to direction 'vertical', which does not wrap; make it horizontal or remove perRow"});
      if (n <= 8) return;
      if (vertical) issues.push({path: `${at}.steps`, message: `has ${n} steps; a vertical chevron holds up to 8`});
      else if (perRow === undefined && (rows === undefined || rows === 1)) issues.push({path: `${at}.steps`, message: `has ${n} steps; more than 8 in one row need rows (or 'auto') or perRow to wrap`});
    },
    build(part) {
      // the spec counts steps from 1 (as `steps` and loopBack do); chevron() takes a zero-based index
      const {steps, current, ...opts} = withoutType(part);
      return builder(steps as never, {...opts, ...(typeof current === 'number' ? {current: current - 1} : {})} as never);
    },
  };
}
