// Spec parts of round R3 (see lib/spec.ts): each keeps its schema, example, checks and builder together.
// Systems and plans: a BPMN process, a class diagram, a PERT network, a time axis, a tree and a dependency network.
import {bpmn, classDiagram, dependencyNetwork, pert, timeline, tree} from '../dsl-pure.ts';
import {BOX_TONE, EMPHASIS_TONE, MAX_NODE_WIDTH, MAX_TREE_DEPTH, MAX_TREE_NODES, id, items, list, mustExist, object, oneOf, text, treeItem, treeSize, uniqueIds, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';

/** Nodes and arrows of the graph figures below. Their layouts search orders of the whole graph: these keep the worst allowed input near 2 s on a worker. */
export const MAX_BPMN_NODES = 30;
export const MAX_BPMN_FLOWS = 40;
export const MAX_CLASSES = 15;
export const MAX_CLASS_RELATIONS = 24;
export const MAX_PERT_TASKS = 20;
export const MAX_DEPENDENCY_NODES = 20;
export const MAX_DEPENDENCY_EDGES = 32;

/** A hidden marker the English defaults carry into build(): a few parts compute words of their own. */
const EN_MARK = '_lang';
const english = (part: Json): boolean => part[EN_MARK] === 'en';
const withoutMarks = (part: Json): Json => { const {[EN_MARK]: _l, ...rest} = withoutType(part); return rest; };

/** The ids of `part[listKey]` that a path of `edgeKey` items names, checked at their places. */
function checkEnds(part: Json, at: string, listKey: string, known: ReadonlySet<string>, what: string, issues: SpecIssue[], keys: readonly string[] = ['from', 'to']): void {
  items(part, listKey).forEach((e, i) => { for (const k of keys) mustExist(e[k], known, `${at}.${listKey}[${i}].${k}`, what, issues); });
}

/** The first cycle through `edges` (as ids, the first repeated at the end), or null. */
function cycleOf(ids: readonly string[], edges: readonly (readonly [string, string])[]): string[] | null {
  const out = new Map<string, string[]>(ids.map(i => [i, []]));
  for (const [a, b] of edges) out.get(a)?.push(b);
  const state = new Map<string, 1 | 2>(), stack: string[] = [];
  const visit = (n: string): string[] | null => {
    state.set(n, 1); stack.push(n);
    for (const m of out.get(n) ?? []) {
      if (state.get(m) === 1) return [...stack.slice(stack.indexOf(m)), m];
      if (!state.has(m)) { const c = visit(m); if (c) return c; }
    }
    state.set(n, 2); stack.pop();
    return null;
  };
  for (const n of ids) if (!state.has(n)) { const c = visit(n); if (c) return c; }
  return null;
}

// ---- timeline ----
const TL_DATE: JsonSchema = {type: 'string', minLength: 4, maxLength: 10, description: "'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'."};
const TL_END: JsonSchema = {oneOf: [TL_DATE, {type: 'number', minimum: -1e9, maximum: 1e9}], description: 'A date (the date form) or a number (the number form).'};
const TL_TONE = oneOf('accent', 'danger', 'muted');
const DAY_MS = 86_400_000;
/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' as days, or null when it is not a real date. */
function tlDay(v: unknown): number | null {
  const m = typeof v === 'string' ? /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(v) : null;
  if (!m) return null;
  const y = Number(m[1]), mo = m[2] ? Number(m[2]) : 1, d = m[3] ? Number(m[3]) : 1, t = Date.UTC(y, mo - 1, d), back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t / DAY_MS : null;
}
/** The English of the span the figure writes from now to the deadline ("1 year 3 months left"), counted the way lib/timeline.ts counts. */
export function remainingEn(from: string, to: string): string {
  const a = tlDay(from) as number, b = tlDay(to) as number;
  if (a === b) return 'Due today';
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const l = new Date(lo * DAY_MS), h = new Date(hi * DAY_MS);
  let months = (h.getUTCFullYear() - l.getUTCFullYear()) * 12 + h.getUTCMonth() - l.getUTCMonth();
  if (h.getUTCDate() < l.getUTCDate()) months--;
  const n = (k: number, unit: string) => `${k} ${unit}${k === 1 ? '' : 's'}`;
  const span = months < 1 ? n(hi - lo, 'day') : months < 12 ? n(months, 'month') : `${n(Math.floor(months / 12), 'year')}${months % 12 ? ` ${n(months % 12, 'month')}` : ''}`;
  return a < b ? `${span} left` : `${span} overdue`;
}
const DATE_KEYS = ['now', 'deadline', 'marks', 'span', 'remaining'] as const;
const NUMBER_KEYS = ['unit', 'step', 'lanes', 'events', 'spans'] as const;

function checkTimeline(part: Json, at: string, issues: SpecIssue[]): void {
  const numeric = typeof part['from'] === 'number' || typeof part['to'] === 'number' || part['unit'] !== undefined;
  const wrong = (numeric ? DATE_KEYS : NUMBER_KEYS).filter(k => part[k] !== undefined);
  for (const k of wrong) issues.push({path: `${at}.${k}`, message: numeric ? `belongs to the date form (from and to as dates); this timeline has numbers` : `belongs to the number form (unit, from and to as numbers); this timeline has dates`});
  if (numeric) {
    if (part['unit'] === undefined) issues.push({path: `${at}.unit`, message: "is required for a number axis ('ms', 's', '日', or '' for none)"});
    const from = part['from'], to = part['to'];
    for (const [k, v] of [['from', from], ['to', to]] as const) if (typeof v !== 'number') issues.push({path: `${at}.${k}`, message: 'must be a number, as the other end is'});
    if (typeof from !== 'number' || typeof to !== 'number') return;
    if (!(from < to)) { issues.push({path: `${at}.to`, message: `must be greater than from (${from})`}); return; }
    const step = part['step'];
    if (typeof step === 'number' && (to - from) / step > 40) issues.push({path: `${at}.step`, message: `gives ${Math.ceil((to - from) / step)} ticks; at most 40`});
    const lanes = new Set(items(part, 'lanes') as unknown as string[]);
    if (lanes.size !== items(part, 'lanes').length) issues.push({path: `${at}.lanes`, message: 'names a lane twice'});
    const inAxis = (v: unknown, path: string) => { if (typeof v === 'number' && (v < from || v > to)) issues.push({path, message: `${v} is outside the axis (${from} to ${to})`}); };
    const laneOk = (l: unknown, path: string) => { if (l !== undefined) mustExist(l, lanes, path, 'lane', issues); };
    items(part, 'events').forEach((e, i) => { inAxis(e['at'], `${at}.events[${i}].at`); laneOk(e['lane'], `${at}.events[${i}].lane`); });
    items(part, 'spans').forEach((s, i) => {
      inAxis(s['from'], `${at}.spans[${i}].from`); inAxis(s['to'], `${at}.spans[${i}].to`); laneOk(s['lane'], `${at}.spans[${i}].lane`);
      if (typeof s['from'] === 'number' && typeof s['to'] === 'number' && !(s['from'] < s['to'])) issues.push({path: `${at}.spans[${i}].to`, message: `must be greater than from (${s['from']})`});
    });
    return;
  }
  for (const k of ['now', 'deadline'] as const) if (part[k] === undefined) issues.push({path: `${at}.${k}`, message: `is required for a date axis (${k === 'now' ? "{at: '2026-10'}: today, always written out" : "{at: '2027-03', label: 'サポート終了'}"})`});
  const days: Record<string, number | null> = {};
  for (const k of ['from', 'to'] as const) { days[k] = tlDay(part[k]); if (days[k] === null) issues.push({path: `${at}.${k}`, message: `${JSON.stringify(part[k])} is not a real date written 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'`}); }
  const from = days['from'], to = days['to'];
  if (from != null && to != null && !(from < to)) { issues.push({path: `${at}.to`, message: `must be after from (${String(part['from'])})`}); return; }
  const onAxis = (v: unknown, path: string) => {
    const d = tlDay(v);
    if (d === null) issues.push({path, message: `${JSON.stringify(v)} is not a real date written 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'`});
    else if ((from != null && d < from) || (to != null && d > to)) issues.push({path, message: `${String(v)} is outside the axis (${String(part['from'])} to ${String(part['to'])})`});
  };
  for (const k of ['now', 'deadline'] as const) { const v = part[k] as Json | undefined; if (v) onAxis(v['at'], `${at}.${k}.at`); }
  items(part, 'marks').forEach((m, i) => onAxis(m['at'], `${at}.marks[${i}].at`));
}

export const PARTS_R3: readonly PartDef[] = [
  {
    type: 'bpmn',
    anchors: 'nodes',
    description: "A business process in BPMN style: lanes (who) as rows, tasks, a start and an end event, and gateways (xor: one way, and: all ways in parallel, or: some ways) joined by flows. A flow out of a gateway carries its condition as a label; a dashed flow is a message between lanes. The columns follow the flow; a wide figure is narrowed to fit.",
    schema: object({
      type: {const: 'bpmn'},
      lanes: list(object({id: id('Referred to by nodes.'), label: text('Who works in the lane.', 30), tone: BOX_TONE}, ['id', 'label']), 8, 1),
      nodes: list(object({
        id: id('Referred to by flows.'),
        lane: id('A lane id.'),
        kind: {...oneOf('task', 'start', 'end', 'xor', 'and', 'or'), description: 'task (default), start / end event, or a gateway: xor (exclusive), and (parallel), or (inclusive).'},
        label: text('The task (required for a task); under the shape for an event or a gateway.', 40),
        sub: text('A second, muted line of a task.', 40),
        tone: EMPHASIS_TONE,
      }, ['id', 'lane']), MAX_BPMN_NODES, 1),
      flows: list(object({
        from: id('A node id.'),
        to: id('A node id.'),
        label: text('The condition, on a flow out of a gateway.', 30),
        line: {...oneOf('solid', 'dashed'), description: 'dashed: a message between lanes.'},
      }, ['from', 'to']), MAX_BPMN_FLOWS),
    }, ['type', 'lanes', 'nodes', 'flows']),
    example: {type: 'bpmn', lanes: [{id: 'c', label: '顧客'}, {id: 's', label: '店舗'}], nodes: [{id: 'st', lane: 'c', kind: 'start', label: '注文'}, {id: 'chk', lane: 's', label: '在庫を確認'}, {id: 'g', lane: 's', kind: 'xor'}, {id: 'ship', lane: 's', label: '発送する'}, {id: 'sorry', lane: 's', label: 'お詫びを送る'}, {id: 'e', lane: 'c', kind: 'end'}], flows: [{from: 'st', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'ship', label: '在庫あり'}, {from: 'g', to: 'sorry', label: '在庫なし'}, {from: 'ship', to: 'e'}, {from: 'sorry', to: 'e', line: 'dashed'}]},
    check(part, at, issues) {
      const lanes = uniqueIds(part, 'lanes', at, issues), nodes = uniqueIds(part, 'nodes', at, issues);
      items(part, 'nodes').forEach((n, i) => {
        mustExist(n['lane'], lanes, `${at}.nodes[${i}].lane`, 'lane id', issues);
        if ((n['kind'] ?? 'task') === 'task' && n['label'] === undefined) issues.push({path: `${at}.nodes[${i}].label`, message: 'is required for a task'});
        if (n['sub'] !== undefined && (n['kind'] ?? 'task') !== 'task') issues.push({path: `${at}.nodes[${i}].sub`, message: 'is only for a task'});
      });
      const kind = new Map(items(part, 'nodes').map(n => [n['id'], n['kind'] ?? 'task']));
      items(part, 'flows').forEach((f, i) => {
        mustExist(f['from'], nodes, `${at}.flows[${i}].from`, 'node id', issues);
        mustExist(f['to'], nodes, `${at}.flows[${i}].to`, 'node id', issues);
        if (f['from'] === f['to'] && typeof f['from'] === 'string') issues.push({path: `${at}.flows[${i}].to`, message: 'is the node the flow starts at: go back through a gateway instead'});
        if (kind.get(f['from']) === 'end') issues.push({path: `${at}.flows[${i}].from`, message: `"${String(f['from'])}" is an end event: nothing flows out of it`});
        if (kind.get(f['to']) === 'start') issues.push({path: `${at}.flows[${i}].to`, message: `"${String(f['to'])}" is a start event: nothing flows into it`});
      });
    },
    build(part) {
      const {lanes, nodes, flows} = withoutMarks(part);
      return bpmn(lanes as never, nodes as never, flows as never, {fit: 'shrink'});
    },
  },
  {
    type: 'classDiagram',
    anchors: 'classes',
    description: "A UML class diagram: classes with attributes and methods, and relations. inherit and implement run from the child to the parent (triangle at the parent); compose and aggregate put the diamond on `from`, the whole; arrow is a directed association, depend a dashed dependency, assoc a plain line. Parents are placed above.",
    schema: object({
      type: {const: 'classDiagram'},
      classes: list(object({
        id: id('The class name, referred to by relations (shown unless name is given).'),
        name: text('The shown name, when it differs from the id.', 40),
        stereotype: text('Shown above the name in «»: interface, enum ...', 20),
        abstract: {type: 'boolean', description: 'true: an abstract class.'},
        attrs: list(text("One attribute: '- id: number'.", 60), 10),
        methods: list(text("One method: '+ save(): void'.", 60), 10),
        tone: EMPHASIS_TONE,
      }, ['id']), MAX_CLASSES, 1),
      relations: list(object({
        from: id('A class id (the child, or the whole for compose / aggregate).'),
        to: id('A class id.'),
        kind: {...oneOf('assoc', 'arrow', 'inherit', 'implement', 'compose', 'aggregate', 'depend'), description: 'Default assoc.'},
        label: text('The name of the relation.', 30),
        fromMult: text("Multiplicity at from: '1', '0..*'.", 8),
        toMult: text('Multiplicity at to.', 8),
      }, ['from', 'to']), MAX_CLASS_RELATIONS),
      dir: {...oneOf('down', 'right', 'auto'), description: 'down: parents on top (default, turning when it does not fit); right: left to right.'},
    }, ['type', 'classes', 'relations']),
    example: {type: 'classDiagram', classes: [{id: 'Animal', abstract: true, methods: ['+ speak(): string']}, {id: 'Dog', attrs: ['- name: string'], methods: ['+ speak(): string']}, {id: 'Owner', attrs: ['- name: string']}], relations: [{from: 'Dog', to: 'Animal', kind: 'inherit'}, {from: 'Owner', to: 'Dog', kind: 'aggregate', fromMult: '1', toMult: '0..*'}]},
    check(part, at, issues) {
      const classes = uniqueIds(part, 'classes', at, issues);
      checkEnds(part, at, 'relations', classes, 'class id', issues);
      const up = items(part, 'relations').flatMap(r => r['kind'] === 'inherit' || r['kind'] === 'implement' ? [[r['from'], r['to']] as [string, string]] : []);
      const loop = cycleOf([...classes], up);
      if (loop) issues.push({path: `${at}.relations`, message: `inherit / implement go round in a circle: ${loop.join(' -> ')}`});
      items(part, 'relations').forEach((r, i) => { if (r['from'] === r['to'] && (r['kind'] === 'inherit' || r['kind'] === 'implement')) issues.push({path: `${at}.relations[${i}].to`, message: 'a class cannot be its own parent'}); });
    },
    build(part) {
      const {classes, relations, ...opts} = withoutMarks(part);
      return classDiagram(classes as never, relations as never, opts as never);
    },
  },
  {
    type: 'pert',
    anchors: 'tasks',
    description: 'A PERT network (activity on node): tasks with a duration and the tasks that must finish first. The earliest and latest start and finish, the slack and the critical path (zero slack, drawn in red) are worked out. No task may depend on itself, directly or round a circle.',
    schema: object({
      type: {const: 'pert'},
      tasks: list(object({
        id: id('Referred to by predecessors.'),
        label: text('The task.', 30),
        duration: {type: 'number', minimum: 0, maximum: 1e6, description: 'How long it takes, in `unit`.'},
        predecessors: list(id('A task id that must finish first.'), 8),
      }, ['id', 'label', 'duration']), MAX_PERT_TASKS, 1),
      unit: {type: 'string', maxLength: 6, description: "Written after every duration: '日', 'h', 'w'."},
      compact: {type: 'boolean', description: 'true: only the duration and the slack in each box, not ES / EF / LS / LF.'},
      direction: {...oneOf('LR', 'TB'), description: 'LR: left to right (default); TB: top to bottom.'},
    }, ['type', 'tasks']),
    example: {type: 'pert', unit: '日', tasks: [{id: 'a', label: '要件定義', duration: 5}, {id: 'b', label: '設計', duration: 4, predecessors: ['a']}, {id: 'c', label: '環境構築', duration: 2, predecessors: ['a']}, {id: 'd', label: '実装', duration: 8, predecessors: ['b', 'c']}]},
    check(part, at, issues) {
      const tasks = uniqueIds(part, 'tasks', at, issues);
      items(part, 'tasks').forEach((t, i) => {
        const ps = (t['predecessors'] as unknown[] | undefined) ?? [];
        ps.forEach((p, j) => {
          mustExist(p, tasks, `${at}.tasks[${i}].predecessors[${j}]`, 'task id', issues);
          if (ps.indexOf(p) !== j) issues.push({path: `${at}.tasks[${i}].predecessors[${j}]`, message: `"${String(p)}" is named twice`});
        });
      });
      const loop = cycleOf([...tasks], items(part, 'tasks').flatMap(t => ((t['predecessors'] as string[] | undefined) ?? []).map(p => [p, t['id'] as string] as [string, string])));
      if (loop) issues.push({path: `${at}.tasks`, message: `the predecessors go round in a circle: ${loop.join(' -> ')}`});
    },
    build(part) {
      const {tasks, ...opts} = withoutMarks(part);
      return pert(tasks as never, opts as never);
    },
    en: {durationLabel: 'Duration', slackLabel: 'Slack'},
  },
  {
    type: 'timeline',
    description: "A time axis, in one of two forms. Date form: from and to as dates ('YYYY', 'YYYY-MM', 'YYYY-MM-DD'), now (today, always written out) and the deadline the figure is about; the time left between them is written ('あと 1 年 3 か月'); marks add other dates. Number form: unit ('ms', '日' ...), from and to as numbers, lanes (rows), events (dots) and spans (bars, or a dimension line with dim).",
    schema: object({
      type: {const: 'timeline'},
      from: TL_END,
      to: TL_END,
      now: object({at: TL_DATE, label: text('Default 現在 (Now in English).', 20)}, ['at'], 'Date form: today. Always written out.'),
      deadline: object({at: TL_DATE, label: text('What ends then.', 30), line: {...oneOf('full'), description: "'full': a line through the whole figure."}}, ['at', 'label'], 'Date form: the date the figure is about.'),
      marks: list(object({at: TL_DATE, label: text('What happens then.', 30), tone: TL_TONE}, ['at', 'label']), 8),
      span: {...oneOf('bar', 'fill'), description: 'Date form: how the time left is drawn (default bar).'},
      remaining: {oneOf: [text('The words for the time left.', 30), {type: 'boolean', enum: [false]}], description: 'Date form: the words for the time left (default worked out), or false for none.'},
      unit: {type: 'string', maxLength: 6, description: "Number form: written after every value ('' for none)."},
      step: {type: 'number', minimum: 1e-9, maximum: 1e9, description: 'Number form: the tick spacing.'},
      lanes: list(text('A row, top to bottom.', 20), 6, 1),
      events: list(object({at: {type: 'number', minimum: -1e9, maximum: 1e9}, label: text('What happens.', 30), lane: text('A lane.', 20), tone: TL_TONE}, ['at', 'label']), 20),
      spans: list(object({from: {type: 'number', minimum: -1e9, maximum: 1e9}, to: {type: 'number', minimum: -1e9, maximum: 1e9}, label: text('The text on it.', 30), lane: text('A lane.', 20), tone: TL_TONE, dim: {type: 'boolean', description: 'true: a dimension line with its length written above.'}}, ['from', 'to']), 20),
    }, ['type', 'from', 'to']),
    example: {type: 'timeline', from: '2026-01', to: '2027-12', now: {at: '2026-10'}, deadline: {at: '2027-06', label: '旧システムのサポート終了'}, marks: [{at: '2027-01', label: '移行開始'}]},
    en: {[EN_MARK]: 'en'},
    check: checkTimeline,
    build(part) {
      const opts = withoutMarks(part);
      if (english(part) && typeof opts['from'] === 'string') {
        const now = opts['now'] as Json, deadline = opts['deadline'] as Json;
        return timeline({...opts, now: {label: 'Now', ...now}, ...(opts['remaining'] === undefined ? {remaining: remainingEn(now['at'] as string, deadline['at'] as string)} : {})} as never);
      }
      return timeline(opts as never);
    },
  },
  {
    type: 'tree',
    description: 'A tree of boxes joined by lines, such as an organization, a breakdown of work (WBS) or a category hierarchy: the root at the top (or the left with dir right), each node with its children below it.',
    schema: object({
      type: {const: 'tree'},
      root: treeItem(MAX_TREE_DEPTH),
      dir: {...oneOf('down', 'right', 'auto'), description: 'down: top to bottom (default, turning when it does not fit); right: left to right, for many siblings.'},
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'root']),
    example: {type: 'tree', root: {label: 'Web サイト刷新', tone: 'accent', children: [{label: '設計', children: [{label: '情報設計'}, {label: 'デザイン'}]}, {label: '開発', children: [{label: '画面'}, {label: 'CMS'}]}, {label: '公開', children: [{label: '移行'}]}]}},
    check(part, at, issues) {
      const n = treeSize(part['root'] as Json);
      if (n > MAX_TREE_NODES) issues.push({path: `${at}.root`, message: `has ${n} nodes; the limit is ${MAX_TREE_NODES}`});
    },
    build(part) {
      const {root, ...opts} = withoutMarks(part);
      return tree(root as never, opts as never);
    },
  },
  {
    type: 'dependencyNetwork',
    anchors: 'nodes',
    description: 'A dependency network: things (services, modules, teams) and typed arrows between them: depends, uses, blocks or relates. A node kind and each arrow type are named in a legend; a weight thickens the arrow.',
    schema: object({
      type: {const: 'dependencyNetwork'},
      nodes: list(object({id: id('Referred to by edges.'), label: text('The thing.', 30), kind: text('Its kind, named in the legend (nodes of a kind share a colour). At most 4 kinds, or 3 when some nodes have none.', 20)}, ['id', 'label']), MAX_DEPENDENCY_NODES, 1),
      edges: list(object({
        from: id('A node id.'),
        to: id('A node id.'),
        type: {...oneOf('depends', 'uses', 'blocks', 'relates'), description: 'The kind of arrow, each drawn differently.'},
        weight: {type: 'number', minimum: 0, maximum: 30, description: 'Thickens the arrow (and is written on it).'},
        label: text('The text on the arrow (default: the name of its type).', 30),
      }, ['from', 'to', 'type']), MAX_DEPENDENCY_EDGES),
      typeLabels: object({depends: text('', 20), uses: text('', 20), blocks: text('', 20), relates: text('', 20)}, [], 'The names of the arrow types in the legend (default 依存する, 利用する, 阻害する, 関連する).'),
      direction: {...oneOf('LR', 'TB'), description: 'LR: left to right (default); TB: top to bottom.'},
    }, ['type', 'nodes', 'edges']),
    example: {type: 'dependencyNetwork', nodes: [{id: 'web', label: 'Web 画面', kind: '画面'}, {id: 'api', label: '注文 API', kind: 'サービス'}, {id: 'db', label: '注文 DB', kind: 'データ'}], edges: [{from: 'web', to: 'api', type: 'uses'}, {from: 'api', to: 'db', type: 'depends'}]},
    en: {[EN_MARK]: 'en'},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      checkEnds(part, at, 'edges', nodes, 'node id', issues);
      items(part, 'edges').forEach((e, i) => { if (e['from'] === e['to'] && typeof e['from'] === 'string') issues.push({path: `${at}.edges[${i}].to`, message: 'is the node the arrow starts at'}); });
      // four colours tell kinds apart, and a node with no kind takes the fourth
      const kinds = [...new Set(items(part, 'nodes').flatMap(n => typeof n['kind'] === 'string' ? [n['kind']] : []))];
      const room = items(part, 'nodes').some(n => n['kind'] === undefined) ? 3 : 4;
      if (kinds.length > room) issues.push({path: `${at}.nodes`, message: `use ${kinds.length} kinds (${kinds.join(', ')}); at most ${room} can be told apart by colour${room === 3 ? ' while some nodes have no kind' : ''}`});
    },
    build(part) {
      const {nodes, edges, typeLabels, ...opts} = withoutMarks(part);
      const names = english(part) ? {depends: 'depends on', uses: 'uses', blocks: 'blocks', relates: 'relates to'} : {depends: '依存する', uses: '利用する', blocks: '阻害する', relates: '関連する'};
      return dependencyNetwork(nodes as never, edges as never, {...opts, edgeTypes: {...names, ...(typeLabels as Json | undefined)}} as never);
    },
  },
];
