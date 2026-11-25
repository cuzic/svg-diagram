import {ARROW, BOX_TONE, LINE, MAX_SWIMLANE_COLS, SpecError, TEXT_TONE, checkFlowEnd, count, id, items, list, mustExist, object, text, uniqueIds, withoutType} from '../spec-kit.ts';
import type {PartDef, Json} from '../spec-kit.ts';

export function defineSwimlanePart<Result extends readonly {type: string; cols?: number}[]>(builder: (lanes: never, steps: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'swimlane',
    anchors: 'steps',
    description: 'A swimlane: who does what over time. Lanes are the actors, columns are time. A step without `col` goes in the column after the step written before it, in any lane, so give `col` to line steps up; at most 8 columns. A label on a flow needs room: it fits on a flow that crosses both a lane and a column, but rarely between two touching steps.',
    schema: object({
      type: {const: 'swimlane'},
      lanes: list(object({
        id: id('Referred to by steps.'),
        label: text('The name of the lane.', 60),
        tone: BOX_TONE,
      }, ['id', 'label']), 12, 1),
      steps: list(object({
        id: id('Needed to be the end of a flow.'),
        lane: id('A lane id.'),
        title: text('The text of the step.'),
        body: text('A second, smaller text.'),
        note: text('A small note.'),
        tag: text('A short tag on the corner.', 20),
        tone: BOX_TONE,
        col: count('The column, from 1.', MAX_SWIMLANE_COLS),
        span: count('How many columns it covers.', MAX_SWIMLANE_COLS),
        row: count('Stacks overlapping work in one lane, from 1.', 8),
      }, ['lane', 'title']), 50, 1),
      flows: list(object({
        from: id("A step id, or 'id:side' (left, right, top, bottom, center)."),
        to: id("A step id, or 'id:side'."),
        label: text('The text on the arrow.', 60),
        line: LINE,
        arrow: ARROW,
        tone: TEXT_TONE,
      }, ['from', 'to']), 60),
      phases: list(object({
        label: text('The name of the stage.', 60),
        from: count('The first column.', MAX_SWIMLANE_COLS),
        to: count('The last column.', MAX_SWIMLANE_COLS),
      }, ['label', 'from', 'to']), 20),
      colGap: {type: 'integer', minimum: 12, maximum: 96, description: 'The gap between columns in px (default 28). Raise it to make room for labels on flows between neighbouring columns.'},
      boundaries: list({oneOf: [
        object({after: id('A lane id: the line goes below it.'), label: text('The name of the line.', 40)}, ['after']),
        object({between: {type: 'array', items: id('A lane id.'), minItems: 2, maxItems: 2, description: 'Two neighbouring lane ids.'}, label: text('The name of the line.', 40)}, ['between']),
      ]}, 12),
    }, ['type', 'lanes', 'steps']),
    example: {type: 'swimlane', lanes: [{id: 'c', label: '顧客'}, {id: 's', label: '営業'}], steps: [{id: 'a', lane: 'c', title: '問い合わせる'}, {id: 'b', lane: 's', title: '見積もりを出す', col: 2}], flows: [{from: 'a', to: 'b'}]},
    check(part, at, issues) {
      const lanes = uniqueIds(part, 'lanes', at, issues), steps = uniqueIds(part, 'steps', at, issues);
      items(part, 'steps').forEach((s, i) => {
        mustExist(s['lane'], lanes, `${at}.steps[${i}].lane`, 'lane id', issues);
        if (typeof s['id'] === 'string' && /[:@]/.test(s['id'])) issues.push({path: `${at}.steps[${i}].id`, message: `"${s['id']}" must not contain ':' or '@' (a flow reads what follows them as a side and a position)`});
      });
      items(part, 'phases').forEach((p, i) => {
        if ((p['from'] as number) > (p['to'] as number)) issues.push({path: `${at}.phases[${i}].to`, message: `must not be before from (${String(p['from'])})`});
      });
      items(part, 'flows').forEach((f, i) => {
        checkFlowEnd(f['from'], steps, `${at}.flows[${i}].from`, issues);
        checkFlowEnd(f['to'], steps, `${at}.flows[${i}].to`, issues);
      });
      const order = items(part, 'lanes').map(l => l['id']);
      items(part, 'boundaries').forEach((b, i) => {
        if (b['after'] !== undefined) {
          mustExist(b['after'], lanes, `${at}.boundaries[${i}].after`, 'lane id', issues);
          if (b['after'] === order[order.length - 1]) issues.push({path: `${at}.boundaries[${i}].after`, message: `"${String(b['after'])}" is the last lane: there is no boundary below it`});
        }
        const between = (b['between'] as unknown[] | undefined) ?? [];
        between.forEach((l, j) => mustExist(l, lanes, `${at}.boundaries[${i}].between[${j}]`, 'lane id', issues));
        if (between.length === 2 && between.every(l => order.includes(l)) && order.indexOf(between[1]) - order.indexOf(between[0]) !== 1) issues.push({path: `${at}.boundaries[${i}].between`, message: 'must name two neighbouring lanes, the upper one first'});
      });
    },
    build(part, at) {
      const {lanes, steps, ...opts} = withoutType(part);
      // the spec counts rows from 1 (as it does col); swimlane() stacks sub-rows from 0
      const placed = (steps as Json[]).map(s => typeof s['row'] === 'number' ? {...s, row: s['row'] - 1} : s);
      const bands = builder(lanes as never, placed as never, opts as never);
      const cols = bands.find(b => b.type === 'swimlane')?.cols ?? 0;
      if (cols > MAX_SWIMLANE_COLS) throw new SpecError([{path: `${at}.steps`, message: `uses ${cols} columns; the limit is ${MAX_SWIMLANE_COLS}. Give steps that happen together the same col`}]);
      const late = items(part, 'phases').flatMap((p, i) => (p['to'] as number) > cols ? [{path: `${at}.phases[${i}].to`, message: `is ${String(p['to'])}, but the steps use ${cols} column(s)`}] : []);
      if (late.length) throw new SpecError(late);
      return bands;
    },
  };
}
