import {items, list, object, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineRaciPart<Result>(builder: (tasks: never, roles: never, assignments: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'raci',
    description: 'A RACI chart: who is Responsible, Accountable, Consulted and Informed for each task. Each task has exactly one A and at least one R. A cell can hold several letters, such as A/R.',
    schema: object({
      type: {const: 'raci'},
      tasks: list(text('A task.', 40), 15, 1),
      roles: list(text('A role.', 20), 8, 1),
      assignments: list({type: 'array', items: {type: 'string', maxLength: 7, description: "R, A, C, I, a combination such as 'A/R', or '' for none."}, minItems: 1, maxItems: 8}, 15, 1),
      title: text('A title bar.', 40),
      corner: text('The top-left heading.', 30),
      legend: {type: 'boolean', description: 'true: add a row that spells out the four letters.'},
    }, ['type', 'tasks', 'roles', 'assignments']),
    example: {type: 'raci', title: 'RACI 責任分担表', legend: true, tasks: ['要件定義', '画面設計', 'リリース判定'], roles: ['PM', 'デザイン', '開発', '事業責任者'], assignments: [['R', 'C', 'C', 'A'], ['A', 'R', 'C', 'I'], ['R', 'I', 'C', 'A']]},
    check(part, at, issues) {
      const tasks = items(part, 'tasks').length, roles = items(part, 'roles').length, rows = part['assignments'] as unknown[][];
      if (rows.length !== tasks) issues.push({path: `${at}.assignments`, message: `has ${rows.length} rows; there are ${tasks} tasks`});
      rows.forEach((r, i) => {
        if (r.length !== roles) issues.push({path: `${at}.assignments[${i}]`, message: `has ${r.length} cells; there are ${roles} roles`});
        r.forEach((c, j) => { if (typeof c === 'string' && !/^\s*(?:[RACI](?:\s*\/\s*[RACI])*)?\s*$/i.test(c)) issues.push({path: `${at}.assignments[${i}][${j}]`, message: `"${c}" must be R, A, C, I, letters joined by /, or empty`}); });
        if (r.every(c => typeof c === 'string') && r.filter(c => /A/i.test(c as string)).length !== 1) issues.push({path: `${at}.assignments[${i}]`, message: 'needs exactly one A (Accountable)'});
        if (r.every(c => typeof c === 'string') && !r.some(c => /R/i.test(c as string))) issues.push({path: `${at}.assignments[${i}]`, message: 'needs at least one R (Responsible)'});
      });
    },
    build(part) {
      const {tasks, roles, assignments, ...opts} = withoutType(part);
      return builder(tasks as never, roles as never, assignments as never, opts as never);
    },
  };
}
