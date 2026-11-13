// A diagram as JSON data ("svg-diagram/spec"): the input for callers that must not run a `.ts` source, such as a public server taking
// diagrams from a model. A source is code (lib/load-source.ts imports it); a spec is data, checked against a schema and turned into builder
// calls from a fixed list. Each part below keeps its schema, its example and its builder together, so they change in one commit.
//
// Nothing here touches the disk or a process: this file imports only dsl-pure. Left out on purpose: image() and math() (files, MathJax),
// `slide` / `fill` (a measured slide), `today: 'auto'` (the build's date) and `icon` (a process-wide manifest).
import {causeTree, chevron, cloud, cycle, diagram, flowchart, funnel, gantt, journeyMap, mindmap, pyramid, quadrant, raci, sequence, stateDiagram, swimlane, table, valueChain, venn, whyWhyTree} from './dsl-pure.ts';
import type {RenderChecks} from './svg-lint.ts';
import {EMOJI_RE} from './tokens.ts';
import type {Diagram, Verdict} from './types/index.ts';

import {ARROW, BOX_TONE, CELL, DATE, EMPHASIS_TONE, LEGEND_EN, LINE, MAX_CAUSE_LINKS, MAX_CAUSE_NODES, MAX_EMOJI, MAX_ISSUES, MAX_NODE_WIDTH, MAX_QUOTED, MAX_SWIMLANE_COLS, MAX_TOTAL_TEXT, MAX_TREE_DEPTH, MAX_TREE_NODES, PART_EN, QUADRANT_GRID, SPEC_VERSION, SpecError, TEXT_TONE, axis, checkFlowEnd, count, dayOf, flowSteps, id, isDay, items, list, mustExist, object, oneOf, pair, text, treeItem, treeSize, uniqueIds, whyNode, whySize, withoutType} from './spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from './spec-kit.ts';
export {SPEC_VERSION, MAX_TOTAL_TEXT, MAX_EMOJI, MAX_SWIMLANE_COLS, MAX_TREE_DEPTH, MAX_TREE_NODES, MAX_CAUSE_NODES, MAX_CAUSE_LINKS, MAX_ISSUES, SpecError} from './spec-kit.ts';
export type {JsonSchema, SpecIssue} from './spec-kit.ts';
import {PARTS_R1} from './spec-parts/r1.ts';
import {PARTS_R2} from './spec-parts/r2.ts';
import {PARTS_R3} from './spec-parts/r3.ts';
import {PARTS_R4} from './spec-parts/r4.ts';
import {PARTS_R5} from './spec-parts/r5.ts';
import {PARTS_R6} from './spec-parts/r6.ts';
import {PARTS_R7} from './spec-parts/r7.ts';

const PARTS: readonly PartDef[] = [
  {
    type: 'flowchart',
    anchors: 'nodes',
    description: 'A flowchart: steps, decisions (a diamond holding the question) and start / end pills joined by arrows. Use for a process with branches or loops. Put Yes / No on the edges that leave a decision.',
    schema: object({
      type: {const: 'flowchart'},
      nodes: list(object({
        id: id('Referred to by edges.'),
        label: text('The text of the node.'),
        sub: text('A second, muted line.'),
        kind: {...oneOf('process', 'decision', 'terminator'), description: 'process: a step (default). decision: a diamond. terminator: a start / end pill.'},
        tone: oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'),
      }, ['id', 'label']), 40, 1),
      edges: list(object({
        from: id('A node id.'),
        to: id('A node id.'),
        label: text('The condition on the arrow.', 60),
        line: LINE,
        tone: oneOf('danger', 'accent', 'muted'),
        strong: {type: 'boolean', description: 'A thick arrow.'},
      }, ['from', 'to']), 60),
      dir: {...oneOf('right', 'down', 'auto'), description: 'The direction of the flow (default: down, turning when it does not fit).'},
    }, ['type', 'nodes', 'edges']),
    example: {type: 'flowchart', nodes: [{id: 'start', kind: 'terminator', label: '受付'}, {id: 'q', kind: 'decision', label: '在庫はある？'}, {id: 'ship', label: '発送する'}, {id: 'order', label: '取り寄せる'}], edges: [{from: 'start', to: 'q'}, {from: 'q', to: 'ship', label: 'Yes'}, {from: 'q', to: 'order', label: 'No'}]},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      items(part, 'edges').forEach((e, i) => {
        mustExist(e['from'], nodes, `${at}.edges[${i}].from`, 'node id', issues);
        mustExist(e['to'], nodes, `${at}.edges[${i}].to`, 'node id', issues);
      });
    },
    build(part) {
      const {nodes, edges, ...opts} = withoutType(part);
      return flowchart(nodes as never, edges as never, opts as never);
    },
  },
  {
    type: 'causeTree',
    anchors: 'nodes',
    description: "A Theory of Constraints logic tree or another cause-and-effect diagram: boxes joined by arrows from cause to effect. Set `tree`: 'crt' for a Current Reality Tree (undesirable effects as role ude at the top, root causes as role root at the bottom), 'frt' for a Future Reality Tree (changes as role injection, results as role de, facts nobody controls as role precondition), 'prt' for a Prerequisite Tree, 'tt' for a Transition Tree, 'nbr' for a Negative Branch. Give a link an array as `from` when the causes are only sufficient together (AND). Saying `tree` also turns on the checks for that kind of tree.",
    schema: object({
      type: {const: 'causeTree'},
      nodes: list(object({
        id: id('Referred to by links.'),
        label: text('One entity, written as a statement.'),
        sub: text('A second, muted line.'),
        role: {...oneOf('effect', 'ude', 'root', 'de', 'injection', 'precondition', 'goal', 'obstacle', 'io', 'action', 'need', 'tipping', 'trim'), description: "ude: undesirable effect. root: root cause. de: desirable effect. injection: the change put in. precondition: a fact nobody controls. goal, obstacle, io (intermediate objective): prerequisite tree. action, need: transition tree. tipping, trim: negative branch. Default effect."},
        tone: EMPHASIS_TONE,
      }, ['id', 'label']), MAX_CAUSE_NODES, 1),
      links: list(object({
        from: {oneOf: [id('The cause.'), {type: 'array', items: id('A cause.'), minItems: 2, maxItems: 5, description: 'Causes that are sufficient only together (AND).'}], description: 'A node id, or several for an AND.'},
        to: id('The effect.'),
        line: LINE,
        kind: {...oneOf('cause', 'blocks'), description: 'blocks: this entity cuts that one (a negative branch). Needs a single cause.'},
        back: {enum: [true], description: 'true: the return arrow of a loop. Needs a single cause; one per cycle.'},
      }, ['from', 'to']), MAX_CAUSE_LINKS),
      tree: {...oneOf('crt', 'frt', 'prt', 'tt', 'nbr'), description: 'Which kind of tree this is. It does not change the drawing; it turns on the checks for that kind.'},
      dir: {...oneOf('up', 'down', 'right', 'left', 'auto'), description: 'The way the arrows run (default up: causes at the bottom).'},
      coreDriver: {type: 'boolean', description: 'true: mark the starting entity that reaches the most undesirable effects.'},
      coreDriverLabel: text("The line under each starting entity with coreDriver: '{n}' is how many undesirable effects it reaches, '{total}' all of them.", 40),
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'nodes', 'links']),
    example: {type: 'causeTree', tree: 'crt', nodes: [{id: 'late', label: '納期に遅れる', role: 'ude'}, {id: 'wip', label: '仕掛りが多い'}, {id: 'kpi', label: '稼働率で評価される', role: 'root'}], links: [{from: 'kpi', to: 'wip'}, {from: 'wip', to: 'late'}]},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      items(part, 'links').forEach((l, i) => {
        const from = l['from'];
        if (Array.isArray(from)) {
          from.forEach((c, j) => mustExist(c, nodes, `${at}.links[${i}].from[${j}]`, 'node id', issues));
          for (const key of ['kind', 'back']) if (l[key] !== undefined && !(key === 'kind' && l[key] === 'cause')) issues.push({path: `${at}.links[${i}].${key}`, message: 'needs a single cause, not an AND'});
        } else mustExist(from, nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
      });
    },
    build(part) {
      const {nodes, links, ...opts} = withoutType(part);
      return causeTree(nodes as never, links as never, opts as never);
    },
  },
  {
    type: 'cloud',
    description: 'A Theory of Constraints conflict cloud (evaporating cloud): the common objective A, the needs B and C, and the conflicting wants D and D2. B needs D, C needs D2. List the assumptions behind an arrow, and the injection that makes one false.',
    schema: object({
      type: {const: 'cloud'},
      a: text('The common objective.'),
      b: text('The need that D serves.'),
      c: text('The need that D2 serves.'),
      d: text('One side of the conflict.'),
      d2: text('The other side of the conflict.'),
      assumptions: list(object({
        on: {...oneOf('ab', 'ac', 'bd', 'cd', 'dd'), description: 'The arrow: ab = B to A, ac = C to A, bd = D to B, cd = D2 to C, dd = the conflict between D and D2.'},
        text: text('Written so that it reads as a belief that could be false.'),
        injection: text('A change that makes the assumption false.'),
      }, ['on', 'text']), 12),
      conflictLabel: text('A word on the conflict arrow.', 20),
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'a', 'b', 'c', 'd', 'd2']),
    example: {type: 'cloud', a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする', assumptions: [{on: 'bd', text: '品質確保には長い検証が必須だ', injection: '自動テストで検証を短くする'}]},
    check() {},
    build(part) {
      const {a, b, c, d, d2, ...opts} = withoutType(part);
      return cloud({a, b, c, d, d2} as never, opts as never);
    },
  },
  {
    type: 'valueChain',
    description: "Porter's value chain: support activities across the top and primary activities along the bottom, with a margin arrow at the right end.",
    schema: object({
      type: {const: 'valueChain'},
      support: list(object({label: text('The activity.', 60), sub: text('What it covers.', 60), tone: EMPHASIS_TONE}, ['label']), 6),
      primary: list(object({label: text('The activity.', 60), sub: text('What it covers.', 60), tone: EMPHASIS_TONE}, ['label']), 8, 1),
      margin: {oneOf: [text('The label of the margin arrow.', 20), {type: 'boolean', enum: [false]}], description: 'The label of the arrow at the right end (default マージン), or false for none.'},
      titles: {type: 'array', items: text('A heading.', 20), minItems: 2, maxItems: 2, description: 'The headings of the support and the primary activities (default 支援活動, 主活動).'},
    }, ['type', 'primary']),
    example: {type: 'valueChain', support: [{label: '全般管理'}, {label: '人事・労務管理'}, {label: '技術開発'}, {label: '調達活動'}], primary: [{label: '購買物流'}, {label: '製造'}, {label: '出荷物流'}, {label: '販売・マーケティング'}, {label: 'サービス'}]},
    check() {},
    build(part) {
      const {support, primary, ...opts} = withoutType(part);
      return valueChain({...(support === undefined ? {} : {support}), primary} as never, opts as never);
    },
  },
  {
    type: 'mindmap',
    description: "A mind map: one root with branches, for organising a topic. `layout` also gives an org chart ('org'), an indented list ('list'), a brace map ('brace'), a fishbone cause-and-effect chart ('fishbone') and a timeline ('timeline').",
    schema: object({
      type: {const: 'mindmap'},
      root: treeItem(MAX_TREE_DEPTH),
      layout: {...oneOf('radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'), description: 'How the branches are laid out (default radial).'},
      edges: {enum: ['elbow', 'curve', 'straight', false], description: 'How a branch line is drawn (default elbow); false for none.'},
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'root']),
    example: {type: 'mindmap', root: {label: '在庫管理アプリ', tone: 'accent', children: [{label: '目的', children: [{label: '棚卸しの時間を半分に'}, {label: '欠品の防止'}]}, {label: '機能', children: [{label: 'バーコード読み取り'}, {label: '発注点アラート'}]}]}},
    check(part, at, issues) {
      const n = treeSize(part['root'] as Json);
      if (n > MAX_TREE_NODES) issues.push({path: `${at}.root`, message: `has ${n} nodes; the limit is ${MAX_TREE_NODES}`});
    },
    build(part) {
      const {root, ...opts} = withoutType(part);
      return mindmap(root as never, opts as never);
    },
  },
  {
    type: 'quadrant',
    description: "A matrix between two axes: 2x2 (or up to 4x4) cells, with items placed in a cell or at a coordinate, optionally as bubbles sized by a value. `preset` fills the axes and cells of a known framework: bcg (growth-share), ge (GE-McKinsey nine box), ansoff, nineBox (talent), impactEffort, risk (likelihood x impact), stakeholder (power x interest), positioning, eisenhower (urgent x important). The presets write their axes and cells in Japanese: with lang en, give x, y and cells instead.",
    schema: object({
      type: {const: 'quadrant'},
      preset: oneOf('bcg', 'ge', 'ansoff', 'nineBox', 'impactEffort', 'risk', 'stakeholder', 'positioning', 'eisenhower'),
      x: axis('The horizontal axis.'),
      y: axis('The vertical axis.'),
      grid: pair({type: 'integer', minimum: 1, maximum: QUADRANT_GRID}, 'Columns and rows (default 2 x 2, or the preset).'),
      cells: list(list(object({title: text('The caption of the cell.', 30), note: text('A note under it.', 60), tone: BOX_TONE}, []), QUADRANT_GRID), QUADRANT_GRID),
      items: list(object({
        label: text('The item.', 40),
        cell: pair({type: 'integer', minimum: 0, maximum: QUADRANT_GRID - 1}, '[column, row] from the top-left as drawn.'),
        at: pair({type: 'number', minimum: 0, maximum: 1}, '[x, y] from 0 to 1, 1 being high, instead of a cell.'),
        size: {type: 'number', minimum: 0, maximum: 1e12, description: 'A bubble whose area is proportional to it.'},
        tone: oneOf('accent', 'text', 'muted', 'danger'),
        group: text('Items of one group share a marker and are listed in a legend.', 20),
      }, ['label']), 40),
      crosshair: {type: 'boolean', description: 'true: no gaps between the cells, read as one plot.'},
    }, ['type']),
    example: {type: 'quadrant', preset: 'eisenhower', items: [{label: '障害の一次対応', cell: [0, 0]}, {label: '新人の育成計画', cell: [1, 0]}, {label: '定例会議の出席', cell: [0, 1]}, {label: 'ニュースの巡回', cell: [1, 1]}]},
    check(part, at, issues) {
      if (part['preset'] === undefined) for (const k of ['x', 'y']) if (part[k] === undefined) issues.push({path: `${at}.${k}`, message: 'is required without a preset: {title, low, high}'});
      const sized = items(part, 'items').map(it => it['size'] !== undefined);
      if (sized.includes(true)) sized.forEach((has, i) => { if (!has) issues.push({path: `${at}.items[${i}].size`, message: 'is required: give every item a size, or none (a bubble without one would read as a small value)'}); });
      items(part, 'items').forEach((it, i) => {
        if (it['cell'] === undefined && it['at'] === undefined) issues.push({path: `${at}.items[${i}]`, message: 'needs a cell ([column, row]) or a place (at: [x, y])'});
        if (it['cell'] !== undefined && it['at'] !== undefined) issues.push({path: `${at}.items[${i}].at`, message: 'give a cell or a place, not both'});
      });
    },
    build(part) {
      return quadrant(withoutType(part) as never);
    },
  },
  {
    type: 'chevron',
    description: 'Process steps as arrow shapes in a row (or a column): a sequence with no branches, such as the phases of a project. `current` marks the step in progress.',
    schema: object({
      type: {const: 'chevron'},
      steps: flowSteps(2, 8),
      direction: oneOf('horizontal', 'vertical'),
      current: {type: 'integer', minimum: 1, maximum: 8, description: 'The step in progress, from 1.'},
    }, ['type', 'steps']),
    example: {type: 'chevron', steps: [{label: '計画', sub: '要件を確認'}, {label: '実装', sub: '小さく作る'}, {label: '検証', sub: '品質を確認'}, {label: '公開', sub: '利用を開始'}], current: 2},
    check(part, at, issues) {
      const n = items(part, 'steps').length, c = part['current'];
      if (typeof c === 'number' && c > n) issues.push({path: `${at}.current`, message: `is ${c}, but there are ${n} steps`});
    },
    build(part) {
      const {steps, ...opts} = withoutType(part);
      return chevron(steps as never, opts as never);
    },
  },
  {
    type: 'cycle',
    description: 'Steps that repeat in a circle, such as PDCA: the last step leads back to the first. A word can sit in the centre.',
    schema: object({
      type: {const: 'cycle'},
      steps: flowSteps(3, 8),
      centre: text('A word in the middle.', 30),
      direction: {...oneOf('cw', 'ccw'), description: 'Clockwise (default) or counter-clockwise.'},
    }, ['type', 'steps']),
    example: {type: 'cycle', steps: [{label: 'Plan'}, {label: 'Do'}, {label: 'Check'}, {label: 'Act'}], centre: '継続改善'},
    check() {},
    build(part) {
      const {steps, ...opts} = withoutType(part);
      return cycle(steps as never, opts as never);
    },
  },
  {
    type: 'pyramid',
    description: 'Layers stacked from a wide base to a narrow top, such as a hierarchy of needs or of priorities. The first layer is the base, the last the top.',
    schema: object({
      type: {const: 'pyramid'},
      layers: list(text('A layer, the base first.', 40), 7, 2),
    }, ['type', 'layers']),
    example: {type: 'pyramid', layers: ['日々の業務', '戦術', '戦略', 'ビジョン']},
    check() {},
    build(part) {
      return pyramid(part['layers'] as never);
    },
  },
  {
    type: 'stateDiagram',
    anchors: 'states',
    description: 'A state diagram: the states something goes through and the events that move it, such as an order or a ticket. `initial` draws the start dot; a final state has a double outline.',
    schema: object({
      type: {const: 'stateDiagram'},
      states: list(object({
        id: id('Referred to by transitions.'),
        label: text('The state.', 40),
        sub: text('A second, muted line.', 60),
        tone: EMPHASIS_TONE,
        final: {type: 'boolean', description: 'true: an end state (double outline).'},
      }, ['id', 'label']), 25, 1),
      transitions: list(object({
        from: id('A state id.'),
        to: id('A state id (the same one for a loop).'),
        label: text('The event or condition.', 40),
        line: LINE,
        tone: oneOf('danger', 'accent', 'muted'),
      }, ['from', 'to']), 40),
      initial: id('The state that starts.'),
      dir: {...oneOf('right', 'down', 'auto'), description: 'The direction of the flow (default right, turning when it does not fit).'},
    }, ['type', 'states', 'transitions']),
    example: {type: 'stateDiagram', initial: 'new', states: [{id: 'new', label: '受付済み'}, {id: 'paid', label: '入金済み'}, {id: 'done', label: '完了', final: true}], transitions: [{from: 'new', to: 'paid', label: '入金'}, {from: 'paid', to: 'done', label: '出荷'}]},
    check(part, at, issues) {
      const states = uniqueIds(part, 'states', at, issues);
      items(part, 'transitions').forEach((t, i) => {
        mustExist(t['from'], states, `${at}.transitions[${i}].from`, 'state id', issues);
        mustExist(t['to'], states, `${at}.transitions[${i}].to`, 'state id', issues);
      });
      if (part['initial'] !== undefined) mustExist(part['initial'], states, `${at}.initial`, 'state id', issues);
    },
    build(part) {
      const {states, transitions, ...opts} = withoutType(part);
      return stateDiagram(states as never, transitions as never, opts as never);
    },
  },
  {
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
      return gantt(rows as never, opts as never);
    },
  },
  {
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
      return venn(sets as never, opts as never);
    },
  },
  {
    type: 'funnel',
    description: 'A funnel: stages that narrow, such as visits to orders. With values, the widths follow them and the rate between stages can be written.',
    schema: object({
      type: {const: 'funnel'},
      stages: list(object({label: text('The stage.', 30), value: {type: 'number', minimum: 0, maximum: 1e12}, tone: EMPHASIS_TONE}, ['label']), 7, 2),
      scale: {...oneOf('value', 'even'), description: 'value: widths follow the values. even: equal steps.'},
      showRate: {type: 'boolean', description: 'true: write the rate from each stage to the next.'},
    }, ['type', 'stages']),
    example: {type: 'funnel', scale: 'value', showRate: true, stages: [{label: '訪問', value: 1200}, {label: '問い合わせ', value: 420}, {label: '商談', value: 160}, {label: '成約', value: 52}]},
    check(part, at, issues) {
      const valued = items(part, 'stages').map(s => s['value'] !== undefined);
      if ((part['scale'] === 'value' || part['showRate'] === true) && valued.includes(false)) valued.forEach((v, i) => { if (!v) issues.push({path: `${at}.stages[${i}].value`, message: 'is required when the widths or the rates follow the values'}); });
    },
    build(part) {
      const {stages, ...opts} = withoutType(part);
      return funnel(stages as never, opts as never);
    },
  },
  {
    type: 'table',
    description: 'A table: columns with headings and rows of text or numbers, such as a comparison of options. A row can be an object with a tone to stand out.',
    schema: object({
      type: {const: 'table'},
      columns: list(object({label: text('The heading.', 30), flex: {type: 'integer', minimum: 1, maximum: 6, description: 'The share of the width (default 1).'}}, ['label']), 8, 1),
      rows: list({oneOf: [
        {type: 'array', items: CELL, minItems: 1, maxItems: 8, description: 'The cells, one per column.'},
        object({cells: {type: 'array', items: CELL, minItems: 1, maxItems: 8}, tone: BOX_TONE}, ['cells']),
      ]}, 30, 1),
      title: text('A title bar over the table.', 40),
      rowHeader: {type: 'boolean', description: 'true: the first column is a heading for its row.'},
      dense: {type: 'boolean', description: 'true: tighter rows.'},
    }, ['type', 'columns', 'rows']),
    example: {type: 'table', title: 'プランの比較', rowHeader: true, columns: [{label: '項目'}, {label: 'ライト'}, {label: 'スタンダード'}, {label: 'プロ'}], rows: [['月額', '980 円', '2,980 円', '9,800 円'], ['利用人数', '1 人', '10 人', '無制限'], {cells: ['サポート', 'メール', 'メール・チャット', '専任担当'], tone: 'accent'}]},
    check(part, at, issues) {
      const n = items(part, 'columns').length;
      (part['rows'] as unknown[]).forEach((r, i) => {
        const cells = Array.isArray(r) ? r : (r as Json)['cells'];
        if (Array.isArray(cells) && cells.length !== n) issues.push({path: `${at}.rows[${i}]`, message: `has ${cells.length} cells; the table has ${n} columns`});
      });
    },
    build(part) {
      const {columns, rows, ...opts} = withoutType(part);
      return table(columns as never, rows as never, opts as never);
    },
  },
  {
    type: 'journeyMap',
    description: "A customer journey map: the stages across the top, and rows (lanes) such as actions, touchpoints, feelings and issues. The lane with id 'emotion' holds a number from -2 (bad) to 2 (good) per stage and is drawn as a curve of feelings.",
    schema: object({
      type: {const: 'journeyMap'},
      stages: list(text('A stage.', 20), 8, 2),
      lanes: list(object({id: id('A name for the lane.'), label: text('What the lane holds.', 20), cells: {type: 'array', items: CELL, minItems: 1, maxItems: 8, description: 'One per stage.'}}, ['id', 'label', 'cells']), 8, 1),
      title: text('A title bar.', 40),
      corner: text('The top-left heading.', 30),
    }, ['type', 'stages', 'lanes']),
    example: {type: 'journeyMap', stages: ['認知', '検討', '購入', '利用'], lanes: [{id: 'act', label: '行動', cells: ['広告を見る', '比較する', '申し込む', '使う']}, {id: 'emotion', label: '感情', cells: [0, -1, 1, 2]}, {id: 'issue', label: '課題', cells: ['違いが不明', '送料が不明', '入力が多い', '使い方が不明']}]},
    check(part, at, issues) {
      const n = items(part, 'stages').length;
      uniqueIds(part, 'lanes', at, issues);
      items(part, 'lanes').forEach((l, i) => {
        const cells = l['cells'] as unknown[];
        if (cells.length !== n) issues.push({path: `${at}.lanes[${i}].cells`, message: `has ${cells.length} cells; there are ${n} stages`});
        if (l['id'] === 'emotion') cells.forEach((c, j) => { if (typeof c !== 'number' || c < -2 || c > 2) issues.push({path: `${at}.lanes[${i}].cells[${j}]`, message: 'a feeling is a number from -2 (bad) to 2 (good)'}); });
      });
    },
    build(part) {
      const {stages, lanes, ...opts} = withoutType(part);
      return journeyMap(stages as never, lanes as never, opts as never);
    },
  },
  {
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
      return raci(tasks as never, roles as never, assignments as never, opts as never);
    },
  },
  {
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
      return whyWhyTree(part['problem'] as string, part['whys'] as never, part['readingNote'] === undefined ? {} : {readingNote: part['readingNote'] as boolean});
    },
  },
  {
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
      const bands = swimlane(lanes as never, steps as never, opts as never) as unknown as {type: string; cols?: number}[];
      const cols = bands.find(b => b.type === 'swimlane')?.cols ?? 0;
      if (cols > MAX_SWIMLANE_COLS) throw new SpecError([{path: `${at}.steps`, message: `uses ${cols} columns; the limit is ${MAX_SWIMLANE_COLS}. Give steps that happen together the same col`}]);
      const late = items(part, 'phases').flatMap((p, i) => (p['to'] as number) > cols ? [{path: `${at}.phases[${i}].to`, message: `is ${String(p['to'])}, but the steps use ${cols} column(s)`}] : []);
      if (late.length) throw new SpecError(late);
      return bands;
    },
  },
  {
    type: 'sequence',
    description: 'A sequence diagram: messages between participants in time order. A step is a message (from, to, label), a self call (self, label), a note (note, over) or a divider (divider).',
    schema: object({
      type: {const: 'sequence'},
      actors: list(object({
        id: id('Referred to by steps.'),
        label: text('The name of the participant.', 60),
        tone: BOX_TONE,
      }, ['id', 'label']), 12, 1),
      steps: list({oneOf: [
        object({from: id('An actor id.'), to: id('An actor id.'), label: text('The message.'), line: oneOf('solid', 'dashed', 'dotted'), arrow: ARROW, tone: TEXT_TONE}, ['from', 'to', 'label']),
        object({self: id('An actor id.'), label: text('The call.'), line: LINE, tone: TEXT_TONE}, ['self', 'label']),
        object({note: text('The note.'), over: list(id('An actor id.'), 12, 1), tone: BOX_TONE}, ['note', 'over']),
        object({divider: text('The name of the phase.', 60)}, ['divider']),
      ]}, 50, 1),
      numbered: {type: 'boolean', description: 'false: do not number the messages.'},
    }, ['type', 'actors', 'steps']),
    example: {type: 'sequence', actors: [{id: 'u', label: '利用者'}, {id: 'api', label: 'API'}], steps: [{from: 'u', to: 'api', label: 'ログインする'}, {from: 'api', to: 'u', label: 'トークンを返す', line: 'dashed'}]},
    check(part, at, issues) {
      const actors = uniqueIds(part, 'actors', at, issues);
      items(part, 'steps').forEach((s, i) => {
        for (const key of ['from', 'to', 'self']) if (s[key] !== undefined) mustExist(s[key], actors, `${at}.steps[${i}].${key}`, 'actor id', issues);
        if (s['from'] !== undefined && s['from'] === s['to']) issues.push({path: `${at}.steps[${i}].to`, message: "is the same actor as from: write a self call (self, label) instead"});
        ((s['over'] as unknown[] | undefined) ?? []).forEach((a, j) => mustExist(a, actors, `${at}.steps[${i}].over[${j}]`, 'actor id', issues));
      });
    },
    build(part) {
      const {actors, steps, ...opts} = withoutType(part);
      return sequence(actors as never, steps as never, opts as never);
    },
  },
  ...PARTS_R1, ...PARTS_R2, ...PARTS_R3, ...PARTS_R4, ...PARTS_R5, ...PARTS_R6, ...PARTS_R7,
];

const partOf = (type: unknown): PartDef | undefined => PARTS.find(p => p.type === type);

/** The JSON Schema of a whole spec. */
export const specSchema: JsonSchema = object({
  version: {const: SPEC_VERSION, description: 'Always 1.'},
  lang: {...oneOf('ja', 'en'), description: "The language of the words the figure writes by itself (legends, headings such as 'Today'): ja (default) or en. Write your own text in the same language."},
  title: text('The accessible name of the figure. Drawn above it only with showTitle.', 120),
  showTitle: {type: 'boolean', description: 'true: draw the title above the figure.'},
  desc: text('A one-sentence description for screen readers.', 400),
  sourceLine: text('Where the content comes from, printed under the figure.', 120),
  theme: {...oneOf('blue', 'teal', 'amber'), description: 'Default blue.'},
  appearance: oneOf('light', 'dark'),
  density: oneOf('normal', 'compact'),
  legend: {enum: ['auto', false], description: "'auto' lists the notation used; false shows no legend."},
  parts: list({oneOf: PARTS.map(p => p.schema)}, 4, 1),
}, ['version', 'title', 'parts']);

/** The parts a spec can hold, for a caller that writes specs: what each is for, its schema and a small valid example. */
export function partCatalog(): {type: string; description: string; schema: JsonSchema; example: Json}[] {
  return PARTS.map(({type, description, schema, example}) => ({type, description, schema, example}));
}

/** Control characters (a line break too: every field is one line) and what XML forbids. */
const UNDRAWABLE = /[\p{Cc}\p{Cs}\ufffe\uffff]/u;
/** A value from the input, at a length a message can carry: a bad spec must not make the answer huge. */
const clip = (s: string): string => s.length <= MAX_QUOTED ? s : `${s.slice(0, MAX_QUOTED)}…`;
const describe = (v: unknown): string => v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : clip(JSON.stringify(v));
const join = (at: string, key: string): string => at ? `${at}.${clip(key)}` : clip(key);

function validate(s: JsonSchema, v: unknown, at: string, out: SpecIssue[]): void {
  if (s.oneOf) { validateOneOf(s.oneOf, v, at, out); return; }
  if (s.const !== undefined) { if (v !== s.const) out.push({path: at, message: `must be ${JSON.stringify(s.const)} (got ${describe(v)})`}); return; }
  if (s.enum && !s.enum.includes(v as never)) { out.push({path: at, message: `must be one of ${s.enum.map(x => JSON.stringify(x)).join(', ')} (got ${describe(v)})`}); return; }
  switch (s.type) {
    case 'string':
      if (typeof v !== 'string') { out.push({path: at, message: `must be a string (got ${describe(v)})`}); return; }
      if (s.minLength !== undefined && !v.trim()) out.push({path: at, message: 'must not be empty'});
      { const bad = UNDRAWABLE.exec(v); if (bad) out.push({path: at, message: `contains U+${(bad[0].codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0')}, which cannot be drawn: write plain text on one line`}); }
      if (s.maxLength !== undefined && v.length > s.maxLength) out.push({path: at, message: `is ${v.length} characters; the limit is ${s.maxLength}`});
      return;
    case 'integer':
      if (typeof v !== 'number' || !Number.isInteger(v)) { out.push({path: at, message: `must be an integer (got ${describe(v)})`}); return; }
      if ((s.minimum !== undefined && v < s.minimum) || (s.maximum !== undefined && v > s.maximum)) out.push({path: at, message: `must be between ${s.minimum} and ${s.maximum} (got ${v})`});
      return;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) { out.push({path: at, message: `must be a number (got ${describe(v)})`}); return; }
      if ((s.minimum !== undefined && v < s.minimum) || (s.maximum !== undefined && v > s.maximum)) out.push({path: at, message: `must be between ${s.minimum} and ${s.maximum} (got ${v})`});
      return;
    case 'boolean':
      if (typeof v !== 'boolean') out.push({path: at, message: `must be true or false (got ${describe(v)})`});
      return;
    case 'array':
      if (!Array.isArray(v)) { out.push({path: at, message: `must be an array (got ${describe(v)})`}); return; }
      if (s.minItems !== undefined && v.length < s.minItems) out.push({path: at, message: `needs at least ${s.minItems} item(s)`});
      if (s.maxItems !== undefined && v.length > s.maxItems) { out.push({path: at, message: `has ${v.length} items; the limit is ${s.maxItems}`}); return; }
      if (s.items) v.forEach((x, i) => validate(s.items as JsonSchema, x, `${at}[${i}]`, out));
      return;
    case 'object': {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) { out.push({path: at, message: `must be an object (got ${describe(v)})`}); return; }
      const o = v as Json, props = s.properties ?? {};
      for (const k of s.required ?? []) if (!Object.hasOwn(o, k)) out.push({path: join(at, k), message: 'is required'});
      for (const k of Object.keys(o)) {
        if (Object.hasOwn(props, k)) validate(props[k] as JsonSchema, o[k], join(at, k), out);
        else out.push({path: join(at, k), message: `is not a known field (known: ${Object.keys(props).join(', ')})`});
      }
      return;
    }
    default:
  }
}

/** The branch is the one whose `const` fields match and whose required fields are all there, so the issues are about that branch. */
function validateOneOf(branches: readonly JsonSchema[], v: unknown, at: string, out: SpecIssue[]): void {
  // a choice between kinds of value (a text or a list, a list or an object): the kind of the value says which
  const isObject = typeof v === 'object' && v !== null && !Array.isArray(v);
  const kindOf = (b: JsonSchema): boolean => b.type === 'array' ? Array.isArray(v) : b.type === 'integer' || b.type === 'number' ? typeof v === 'number' : b.type !== 'object' && b.type !== undefined && typeof v === b.type;
  const objects = branches.filter(b => b.type === 'object');
  if (!isObject || objects.length === 0) {
    const hit = branches.find(kindOf);
    if (hit) validate(hit, v, at, out);
    else out.push({path: at, message: `must be ${[...new Set(branches.map(b => b.type === 'object' ? 'an object' : `a ${b.type}`))].join(' or ')} (got ${describe(v)})`});
    return;
  }
  const o = v as Json;
  const constsOf = (b: JsonSchema) => Object.entries(b.properties ?? {}).filter(([, p]) => p.const !== undefined);
  if (objects.every(b => constsOf(b).length > 0)) {
    const hit = objects.find(b => constsOf(b).every(([k, p]) => o[k] === p.const));
    if (hit) { validate(hit, v, at, out); return; }
    const key = (constsOf(objects[0] as JsonSchema)[0] as [string, JsonSchema])[0];
    out.push({path: join(at, key), message: `must be one of ${objects.map(b => JSON.stringify(b.properties?.[key]?.const)).join(', ')} (got ${describe(o[key])})`});
    return;
  }
  const hit = objects.find(b => (b.required ?? []).every(k => Object.hasOwn(o, k)));
  if (hit) { validate(hit, v, at, out); return; }
  out.push({path: at, message: `must have the fields of one of these forms: ${objects.map(b => (b.required ?? []).join(' + ')).join(' / ')}`});
}

/** What the emitter draws as emoji, so a character cannot be cheap to the count and costly to draw. */
const EMOJI_ALL = new RegExp(EMOJI_RE.source, 'gu');
function countEmoji(v: unknown): number {
  if (typeof v === 'string') return v.match(EMOJI_ALL)?.length ?? 0;
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + countEmoji(x), 0);
  return typeof v === 'object' && v !== null ? Object.values(v).reduce((n: number, x) => n + countEmoji(x), 0) : 0;
}

function totalText(v: unknown): number {
  if (typeof v === 'string') return v.length;
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + totalText(x), 0);
  return typeof v === 'object' && v !== null ? Object.values(v).reduce((n: number, x) => n + totalText(x), 0) : 0;
}

/** The ids that become anchors of the figure, against each other across parts (a repeat inside a part is reported by that part). */
function checkAnchors(parts: readonly Json[], issues: SpecIssue[]): void {
  const first = new Map<string, number>();
  parts.forEach((part, i) => {
    const key = partOf(part['type'])?.anchors;
    if (!key) return;
    items(part, key).forEach((x, j) => {
      const v = x['id'];
      if (typeof v !== 'string') return;
      const seen = first.get(v);
      if (seen === undefined) first.set(v, i);
      else if (seen !== i) issues.push({path: `parts[${i}].${key}[${j}].id`, message: `"${v}" is already used in parts[${seen}] (ids must be unique in the figure)`});
    });
  });
}

export const capped = (issues: SpecIssue[]): SpecIssue[] => issues.length <= MAX_ISSUES ? issues : [...issues.slice(0, MAX_ISSUES), {path: '', message: `and ${issues.length - MAX_ISSUES} more of the same kind: fix these first`}];
const messageOf = (e: unknown): string => e instanceof Error ? e.message : String(e);

/** Checks `input` all the way, builders included: a builder has rules of its own, and only it knows the columns a swimlane ends up with. */
function assemble(input: unknown): {diagram: Diagram | null; issues: SpecIssue[]} {
  const issues: SpecIssue[] = [];
  validate(specSchema, input, '', issues);
  if (issues.length) return {diagram: null, issues: capped(issues)}; // everything below assumes the shapes are right
  const chars = totalText(input);
  if (chars > MAX_TOTAL_TEXT) return {diagram: null, issues: [{path: '', message: `holds ${chars} characters of text; the limit is ${MAX_TOTAL_TEXT}`}]};
  const emoji = countEmoji(input);
  if (emoji > MAX_EMOJI) return {diagram: null, issues: [{path: '', message: `holds ${emoji} emoji; the limit is ${MAX_EMOJI}`}]};
  const {parts, version: _version, lang, ...given} = input as Json;
  const english = lang === 'en';
  // the description a reader of the screen hears is generated in Japanese: in English it is the title, unless one is given
  const opts = english ? {legendLabels: {...Object.assign({}, ...PARTS.map(p => p.legendEn ?? {})), ...LEGEND_EN}, desc: given['title'], ...given} : given;
  const enOf = (type: unknown): Json | undefined => PART_EN[type as string] ?? partOf(type)?.en;
  const list = (parts as Json[]).map(p => english && enOf(p['type']) ? {...enOf(p['type']), ...p} : p);
  list.forEach((part, i) => (partOf(part['type']) as PartDef).check(part, `parts[${i}]`, issues));
  checkAnchors(list, issues);
  if (issues.length) return {diagram: null, issues: capped(issues)};
  let d: Diagram;
  try { d = diagram({theme: 'blue', ...opts} as never) as unknown as Diagram; }
  catch (e) { return {diagram: null, issues: [{path: '', message: messageOf(e)}]}; }
  list.forEach((part, i) => {
    const at = `parts[${i}]`;
    try { d.add((partOf(part['type']) as PartDef).build(part, at) as never); }
    catch (e) {
      if (e instanceof SpecError) issues.push(...e.issues);
      else issues.push({path: locateIn(part, at, messageOf(e)) ?? at, message: messageOf(e)});
    }
  });
  return issues.length ? {diagram: null, issues: capped(issues)} : {diagram: d, issues};
}

/** Every problem with `input`, each with its place; empty when specToDiagram() can take it. */
export function validateSpec(input: unknown): SpecIssue[] {
  return assemble(input).issues;
}

/** The Diagram a valid spec describes (not drawn yet). Throws SpecError, with places, for anything wrong. */
export function specToDiagram(input: unknown): Diagram {
  const {diagram: d, issues} = assemble(input);
  if (!d) throw new SpecError(issues);
  return d;
}

const TEXT_FIELDS: ReadonlySet<string> = new Set(['id', 'label', 'sub', 'title', 'desc', 'sourceLine', 'body', 'note', 'tag', 'divider']);
function leaves(v: unknown, at: string, out: [string, string][]): void {
  if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${at}[${i}]`, out));
  else if (typeof v === 'object' && v !== null) for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'string') { if (TEXT_FIELDS.has(k)) out.push([x, join(at, k)]); }
    else leaves(x, join(at, k), out);
  }
}
const QUOTED = /"([^"]+)"|「([^」]+)」|'([^']+)'/g;
/** What a message quotes, without the ellipsis of a shortened text. */
const quotedIn = (message: string): string[] => [...message.matchAll(QUOTED)].map(m => (m[1] ?? m[2] ?? m[3] ?? '').replace(/(…|\.\.\.)$/, ''));
/** The closest place the texts share: one text, or the part they are all in. */
function commonPlace(hits: readonly [string, string][]): string | null {
  if (hits.length === 1) return (hits[0] as [string, string])[1];
  const partOfPath = (p: string) => /^parts\[\d+\]/.exec(p)?.[0] ?? null;
  const first = partOfPath((hits[0] as [string, string])[1]);
  return first && hits.every(h => partOfPath(h[1]) === first) ? first : null;
}
/**
 * The place of the text that `message` quotes, or null. Only quoted text counts: a word of the message itself ("Yes / No", "diagram.svg")
 * is not a mention. An exact match is taken first, then the start of a text (the checks shorten long ones), then a piece of it (a wrapped line).
 */
function locateIn(v: unknown, at: string, message: string): string | null {
  const found: [string, string][] = [];
  leaves(v, at, found);
  for (const q of quotedIn(message)) {
    const tests: ((s: string) => boolean)[] = [s => s === q];
    if (q.length >= 2) tests.push(s => s.startsWith(q), s => s.includes(q));
    for (const test of tests) {
      const hits = found.filter(f => test(f[0]));
      if (hits.length === 0) continue;
      const place = commonPlace(hits);
      if (place) return place;
      break; // the same text in several parts: this quote says nothing, another may
    }
  }
  return null;
}

/** A message from drawing or checking, with the place in the spec it is about. `path` is null when the message names nothing in the spec. */
export interface LocatedMessage {
  path: string | null;
  message: string;
  rule?: string;
  severity?: 'problem' | 'warn' | 'info';
  fix?: string;
}

/** Where in `spec` a message is about: the text that it quotes, the only part there is, or the only part of the kind it names. */
export function locateMessage(spec: unknown, message: string): string | null {
  const parts = (spec as Json)['parts'] as unknown[];
  const quoted = locateIn(spec, '', message);
  if (quoted) return quoted;
  if (parts.length === 1) return 'parts[0]';
  // a builder or layout message starts with the part's name: `swimlane(): 40 columns ...`
  const named = /^(\w+)\(/.exec(message)?.[1];
  const same = parts.flatMap((p, i) => (p as Json)['type'] === named ? [i] : []);
  return same.length === 1 ? `parts[${same[0]}]` : null;
}

/** The DSL's advice names options a spec does not have; this is the same advice in the fields a spec does have. */
const LABEL_HAS_NO_ROOM = / \(widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow'\)$/;
const LABEL_ADVICE = 'Shorten or drop this label, raise colGap, or leave an empty column between the two steps.';
const COLUMNS_TOO_NARROW = /^(swimlane\(\): \d+ columns leave only -?\d+px each)\b.*$/s;
const COLUMNS_ADVICE = 'Lower colGap or use fewer columns.';
function inSpecTerms(message: string): {message: string; fix?: string} {
  if (LABEL_HAS_NO_ROOM.test(message)) return {message: message.replace(LABEL_HAS_NO_ROOM, ''), fix: LABEL_ADVICE};
  if (COLUMNS_TOO_NARROW.test(message)) return {message: message.replace(COLUMNS_TOO_NARROW, '$1'), fix: COLUMNS_ADVICE};
  return {message};
}

/** Why a figure could not be laid out, at its place and in the fields a spec has. */
export function layoutIssue(spec: unknown, raw: string): SpecIssue {
  const {message, fix} = inSpecTerms(raw);
  return {path: locateMessage(spec, raw) ?? '', message: fix ? `${message}. ${fix}` : message};
}

/** Every text field that holds `char`. */
export function fieldsHolding(spec: unknown, char: string): string[] {
  const found: [string, string][] = [];
  leaves(spec, '', found);
  return found.filter(([text]) => text.includes(char)).map(([, at]) => at);
}

/** The same limit on the messages of a drawn figure as on the issues of a spec. */
export function cappedMessages(list: LocatedMessage[]): LocatedMessage[] {
  return list.length <= MAX_ISSUES ? list : [...list.slice(0, MAX_ISSUES), {path: null, message: `and ${list.length - MAX_ISSUES} more of the same kind: fix these first`}];
}

/** A renderDiagram() verdict in the spec's terms: what failed (`problems`) and what was noticed (`findings`), each with its place. */
export function locateVerdict(spec: unknown, verdict: Verdict): {problems: LocatedMessage[]; findings: LocatedMessage[]} {
  return {
    problems: verdict.problems.map(raw => ({path: locateMessage(spec, raw), ...inSpecTerms(raw), severity: 'problem' as const})),
    findings: verdict.findings.map(f => ({path: locateMessage(spec, f.message), message: f.message, rule: f.rule, severity: f.severity, ...(f.data?.fix ? {fix: f.data.fix} : {})})),
  };
}

/** What the checks found, as lines a model or a person can act on: `errors` fail `svg-diagram lint`, `advisories` are heuristics it only reports. */
export function lintMessages(c: RenderChecks): {errors: string[]; advisories: string[]} {
  return {
    errors: [
      ...c.contrast.map(x => `low contrast: "${x.txt}" (${x.fg} on ${x.bg})`),
      ...(c.overflow ? [`content runs past the canvas by ${c.overflow.dx}px horizontally and ${c.overflow.dy}px vertically`] : []),
      ...c.textOverlap.map(x => `text over text: "${x.a}" and "${x.b}"`),
    ],
    advisories: [
      ...c.containerOverflow.map(x => `text out of its box by ${x.over}px: "${x.txt}"`),
      ...c.covered.map(x => `"${x.txt}" is ${x.how === 'covers' ? 'covered' : 'crossed'} by ${x.by}`),
    ],
  };
}


export interface RenderSpecResult {
  /** false when the spec is invalid, or the figure failed verification or the checks on the drawing. */
  ok: boolean;
  /** Null when nothing could be drawn. When only the checks failed, this is the picture that was drawn. */
  svg: string | null;
  width: number;
  height: number;
  /** The spec could not be used or laid out, or the figure is too tall; nothing was returned to draw. */
  issues: SpecIssue[];
  /** What failed in the drawn figure. */
  problems: LocatedMessage[];
  /** Advice that does not fail the figure. */
  findings: LocatedMessage[];
}

