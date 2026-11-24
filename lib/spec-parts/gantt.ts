import {DATE, dayOf, id, isDay, items, list, mustExist, object, oneOf, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineGanttPart<Result>(builder: (rows: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'gantt',
    anchors: 'rows',
    description: 'A Gantt chart: tasks as bars on a calendar, grouped by sections, with milestones, progress and arrows from the tasks a task waits for. Dates are YYYY-MM-DD; give `today` to draw the line of today.',
    schema: object({
      type: {const: 'gantt'},
      rows: list({oneOf: [
        object({section: text('The name of a group of tasks.', 40)}, ['section']),
        object({
          label: text('The task.', 40),
          id: id('Needed to be named in `after`.'),
          start: DATE,
          end: {...DATE, description: 'The last day (inclusive). Or give days.'},
          days: {type: 'integer', minimum: 1, maximum: 730, description: 'How many days, instead of end.'},
          milestone: {type: 'boolean', description: 'true: one day, drawn as a diamond.'},
          progress: {type: 'number', minimum: 0, maximum: 1, description: 'How much is done, 0 to 1.'},
          after: {oneOf: [id('A task id.'), {type: 'array', items: id('A task id.'), minItems: 1, maxItems: 5}], description: 'The tasks this one waits for.'},
          tone: oneOf('danger', 'accent', 'muted'),
        }, ['label', 'start']),
      ]}, 30, 1),
      today: {...DATE, description: 'Today, for the line of today (YYYY-MM-DD).'},
      todayLabel: text('The word on the line of today.', 20),
      from: {...DATE, description: 'Where the calendar starts (default: the first start).'},
      to: {...DATE, description: 'Where the calendar ends (default: the last end).'},
    }, ['type', 'rows']),
    example: {type: 'gantt', today: '2026-10-26', rows: [{section: '設計'}, {id: 'req', label: '要件定義', start: '2026-10-05', end: '2026-10-16', progress: 1}, {id: 'ui', label: '画面設計', start: '2026-10-19', end: '2026-10-30', progress: 0.5, after: 'req'}, {section: '開発'}, {id: 'app', label: '実装', start: '2026-11-02', end: '2026-11-20', after: 'ui'}, {label: 'リリース', start: '2026-11-24', milestone: true, after: 'app'}]},
    check(part, at, issues) {
      const tasks = items(part, 'rows').filter(r => r['section'] === undefined);
      const ids = new Set(tasks.flatMap(t => typeof t['id'] === 'string' ? [t['id']] : []));
      items(part, 'rows').forEach((r, i) => {
        if (r['section'] !== undefined) return;
        for (const k of ['start', 'end']) if (r[k] !== undefined && !isDay(r[k])) issues.push({path: `${at}.rows[${i}].${k}`, message: `"${String(r[k])}" is not a day written YYYY-MM-DD`});
        if (r['end'] !== undefined && r['days'] !== undefined) issues.push({path: `${at}.rows[${i}].days`, message: 'give end or days, not both'});
        if (isDay(r['start']) && isDay(r['end']) && dayOf(r['end'] as string) < dayOf(r['start'] as string)) issues.push({path: `${at}.rows[${i}].end`, message: 'is before start'});
        if (r['milestone'] !== true && r['end'] === undefined && r['days'] === undefined) issues.push({path: `${at}.rows[${i}]`, message: 'needs end, days, or milestone: true'});
        const after = r['after'];
        (Array.isArray(after) ? after : after === undefined ? [] : [after]).forEach((a, j) => mustExist(a, ids, Array.isArray(after) ? `${at}.rows[${i}].after[${j}]` : `${at}.rows[${i}].after`, 'task id', issues));
      });
      for (const k of ['today', 'from', 'to']) if (part[k] !== undefined && !isDay(part[k])) issues.push({path: `${at}.${k}`, message: `"${String(part[k])}" is not a day written YYYY-MM-DD`});
      const days = tasks.flatMap(t => [t['start'], t['end']]).filter(isDay).map(v => dayOf(v as string));
      if (days.length && Math.max(...days) - Math.min(...days) > 1100) issues.push({path: `${at}.rows`, message: 'span more than three years: split the plan, or give it in larger steps'});
    },
    build(part) {
      const {rows, ...opts} = withoutType(part);
      return builder(rows as never, opts as never);
    },
  };
}
