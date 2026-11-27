import {MAX_LANES_TO_ORDER} from '../lane-order.ts';
import {ARROW, BOX_TONE, LINE, MAX_SWIMLANE_COLS, SpecError, TEXT_TONE, checkFlowEnd, count, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType} from '../spec-kit.ts';
import type {PartDef, Json} from '../spec-kit.ts';

/** A business process as a spec: steps with `kind`, in-band flows, and `cols: 'auto'` for columns that follow the flow. */
export const swimlaneAutoExample: Json = {type: 'swimlane', cols: 'auto', lanes: [{id: 'c', label: '顧客'}, {id: 's', label: '店舗'}], steps: [{id: 'st', lane: 'c', kind: 'start', title: '注文'}, {id: 'chk', lane: 's', title: '在庫を確認'}, {id: 'g', lane: 's', kind: 'xor', title: '在庫'}, {id: 'ship', lane: 's', title: '発送する'}, {id: 'e', lane: 'c', kind: 'end', title: '受け取り'}], flows: [{from: 'st', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'ship', label: 'あり'}, {from: 'ship', to: 'e', line: 'dashed'}]};

export function defineSwimlanePart<Result extends readonly {type: string; cols?: number}[]>(builder: (lanes: never, steps: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'swimlane',
    anchors: 'steps',
    description: 'A swimlane: who does what over time. Lanes are the actors, columns are time. A step without `col` goes in the column after the step written before it, in any lane, so give `col` to line steps up; at most 8 columns. A flow back to an earlier step of the same lane, to `id:bottom` or past a step in between, runs under the steps of that lane (the lane grows to hold them; `bend`, `bendOffset` or a start side other than bottom keeps the elbow). A label on a flow needs room: it fits on a flow that crosses both a lane and a column, but rarely between two touching steps. `cols: \'auto\'` draws a business process instead: the columns follow the flows, a step takes `kind` (task, a start / end event, xor / and / or gateway) with `title` / `body`, and a flow stays in the band (`from` / `to` / `label` / `line` only; `col` / `span` / `row`, `phases`, `boundaries` and `colGap` do not apply). `dir: \'v\'` (needs `cols: \'auto\'`) draws the lanes as columns with the flow running down. `fit: \'shrink\'` narrows a figure that is wider than its band until it fits (not with `dir: \'v\'`).',
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
        kind: {...oneOf('task', 'start', 'end', 'xor', 'and', 'or'), description: 'task (default), a start / end event, or a gateway: xor (exclusive), and (parallel), or (inclusive). A kind other than task needs cols: \'auto\'.'},
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
      cols: {...oneOf('auto'), description: '\'auto\': the columns follow the flows (a business process: steps with kind, flows in the band). Without it the columns are explicit time.'},
      dir: {...oneOf('h', 'v'), description: '\'v\' draws the lanes as columns with the flow running down (needs cols: \'auto\'); the default \'h\' draws the lanes as rows.'},
      fit: {...oneOf('shrink'), description: '\'shrink\': narrow a figure that is wider than its band until it fits (not with dir: \'v\', whose column width comes from the lanes).'},
    }, ['type', 'lanes', 'steps']),
    example: {type: 'swimlane', lanes: [{id: 'c', label: '顧客'}, {id: 's', label: '営業'}], steps: [{id: 'a', lane: 'c', title: '問い合わせる'}, {id: 'b', lane: 's', title: '見積もりを出す', col: 2}], flows: [{from: 'a', to: 'b'}]},
    check(part, at, issues) {
      const lanes = uniqueIds(part, 'lanes', at, issues), steps = uniqueIds(part, 'steps', at, issues);
      const auto = part['cols'] === 'auto';
      items(part, 'steps').forEach((s, i) => {
        mustExist(s['lane'], lanes, `${at}.steps[${i}].lane`, 'lane id', issues);
        if (typeof s['id'] === 'string' && /[:@]/.test(s['id'])) issues.push({path: `${at}.steps[${i}].id`, message: `"${s['id']}" must not contain ':' or '@' (a flow reads what follows them as a side and a position)`});
        if (auto) {
          if (s['id'] === undefined) issues.push({path: `${at}.steps[${i}].id`, message: `is required with cols: 'auto' (a flow names its steps by id)`});
          for (const key of ['col', 'span', 'row', 'note', 'tag']) {
            if (s[key] !== undefined) issues.push({path: `${at}.steps[${i}].${key}`, message: `needs explicit columns; drop ${key} or drop cols: 'auto'`});
          }
        } else if (s['kind'] !== undefined && s['kind'] !== 'task') {
          issues.push({path: `${at}.steps[${i}].kind`, message: `"${String(s['kind'])}" needs cols: 'auto' (drop kind for explicit columns)`});
        }
      });
      items(part, 'phases').forEach((p, i) => {
        if ((p['from'] as number) > (p['to'] as number)) issues.push({path: `${at}.phases[${i}].to`, message: `must not be before from (${String(p['from'])})`});
      });
      const kinds = new Map(items(part, 'steps').map(s => [s['id'], s['kind'] ?? 'task']));
      items(part, 'flows').forEach((f, i) => {
        checkFlowEnd(f['from'], steps, `${at}.flows[${i}].from`, issues);
        checkFlowEnd(f['to'], steps, `${at}.flows[${i}].to`, issues);
        if (auto) {
          for (const key of ['arrow', 'tone']) {
            if (f[key] !== undefined) issues.push({path: `${at}.flows[${i}].${key}`, message: `needs explicit columns (with cols: 'auto' a flow takes from, to, label, line only)`});
          }
          if (f['line'] !== undefined && f['line'] !== 'solid' && f['line'] !== 'dashed') issues.push({path: `${at}.flows[${i}].line`, message: `"${String(f['line'])}" needs explicit columns (with cols: 'auto' a flow is solid or dashed)`});
          for (const end of ['from', 'to']) {
            if (typeof f[end] === 'string' && /[:@]/.test(f[end])) issues.push({path: `${at}.flows[${i}].${end}`, message: `needs explicit columns; name a plain step id`});
          }
          if (f['from'] === f['to'] && typeof f['from'] === 'string') issues.push({path: `${at}.flows[${i}].to`, message: 'is the step the flow starts at: go back through a gateway instead'});
          if (kinds.get(f['from']) === 'end') issues.push({path: `${at}.flows[${i}].from`, message: `"${String(f['from'])}" is an end event: nothing flows out of it`});
          if (kinds.get(f['to']) === 'start') issues.push({path: `${at}.flows[${i}].to`, message: `"${String(f['to'])}" is a start event: nothing flows into it`});
        }
      });
      if (auto) {
        for (const key of ['phases', 'boundaries', 'colGap']) {
          if (part[key] !== undefined) issues.push({path: `${at}.${key}`, message: `needs explicit columns; drop ${key} or drop cols: 'auto'`});
        }
        const laneCount = items(part, 'lanes').length;
        if (laneCount > MAX_LANES_TO_ORDER) issues.push({path: `${at}.lanes`, message: `holds ${laneCount} lanes; with cols: 'auto' the limit is ${MAX_LANES_TO_ORDER} — split the flow into two figures`});
      } else if (part['dir'] === 'v') {
        issues.push({path: `${at}.dir`, message: `needs cols: 'auto' (dir: 'v' draws the lanes as columns)`});
      }
      // auto only: without cols: 'auto' the dir error above already fires, so a fit error would blame a bystander
      if (auto && part['dir'] === 'v' && part['fit'] !== undefined) issues.push({path: `${at}.fit`, message: `is for the horizontal figure; a vertical one (dir: 'v') takes its column width from the lanes`});
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
      // with cols: 'auto' the band carries no cols (the layers follow the flow), so the column limit below never fires for it (ADR 0086 D9)
      const cols = bands.find(b => b.type === 'swimlane')?.cols ?? 0;
      if (cols > MAX_SWIMLANE_COLS) throw new SpecError([{path: `${at}.steps`, message: `uses ${cols} columns; the limit is ${MAX_SWIMLANE_COLS}. Give steps that happen together the same col`}]);
      const late = items(part, 'phases').flatMap((p, i) => (p['to'] as number) > cols ? [{path: `${at}.phases[${i}].to`, message: `is ${String(p['to'])}, but the steps use ${cols} column(s)`}] : []);
      if (late.length) throw new SpecError(late);
      return bands;
    },
  };
}
