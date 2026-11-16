// Spec parts of round R4 (see lib/spec.ts): quality, risk and problem-solving figures. Each keeps its schema, example, checks and builder
// together. A part whose builder writes words of its own in Japanese gets `en` (merged into the part for `lang: 'en'`); `lang` in a part
// is only ever set that way, never by the caller (the schema does not list it), and is taken off before the builder sees the options.
import {affinity, bowtie, causalLoop, faultTree, fmea, isIsNot, matrix, pdpc, relationDiagram, table} from '../dsl-pure.ts';
import {matrixParts} from '../qc-table.ts';
import {EMPHASIS_TONE, LINE, MAX_CAUSE_LINKS, MAX_CAUSE_NODES, MAX_NODE_WIDTH, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from '../spec-kit.ts';

/** Events of a fault tree, `ref`s included, and how deep it goes below the top event. */
export const MAX_FTA_EVENTS = 30;
export const MAX_FTA_DEPTH = 5;
/** Factors and arrows of a relations diagram: its layout untangles crossings like a cause tree's. */
export const MAX_RELATION_NODES = 20;
export const MAX_RELATION_LINKS = 40;
/** Variables and links of a causal loop diagram, and the loops it may hold: every simple loop is found, named and drawn. Left to right,
 *  9 variables already leave their labels no room at the figure's width. */
export const MAX_CAUSAL_NODES = 8;
export const MAX_CAUSAL_LINKS = 14;
export const MAX_CAUSAL_LOOPS = 8;
/** Cards of an affinity diagram, in all its groups. */
export const MAX_AFFINITY_CARDS = 40;

/** Taken off a part before its options reach a builder: `lang` is what `en` adds, never the caller. */
const english = (part: Json): boolean => part['lang'] === 'en';
const optionsOf = (part: Json): Json => { const {lang: _lang, ...rest} = withoutType(part); return rest; };

// ---- fault tree ---------------------------------------------------------------------------------------------------------------
const FTA_KIND = {...oneOf('event', 'basic', 'undeveloped', 'house', 'condition'), description: 'event (default when it has a gate): a rectangle with a gate under it. basic: a basic event (circle). undeveloped: not broken down further (diamond). house: a condition that is on or off (state). condition: the condition of an inhibit gate.'};
const ftaEvent = (levels: number): JsonSchema => object({
  id: id('Needed for `ref` to draw this event again.'),
  label: text('The event, written as a statement.', 60),
  sub: text('A second, muted line.', 60),
  kind: FTA_KIND,
  gate: {...oneOf('and', 'or', 'vote', 'inhibit'), description: 'The gate under this event: and (all inputs), or (any input), vote (k of the inputs), inhibit (the one input, while `condition` holds).'},
  k: {type: 'integer', minimum: 1, maximum: 8, description: 'vote: how many inputs make the event happen.'},
  ...(levels > 0 ? {children: list(ftaEvent(levels - 1), 8), condition: ftaEvent(0)} : {}),
  p: {type: 'number', minimum: 0, maximum: 1, description: 'The probability of a basic, undeveloped or condition event (for quant).'},
  state: {type: 'boolean', description: 'A house event: true = it always happens, false = it never does.'},
  ref: id('Draw the event with this id again (a basic, undeveloped, house or condition event); nothing else may be written with it.'),
}, []);
function checkFta(e: Json, at: string, ids: Map<string, string>, refs: [string, string][], count: {n: number}, depth: number, issues: SpecIssue[]): void {
  count.n++;
  if (depth > MAX_FTA_DEPTH) { issues.push({path: at, message: `is ${depth} levels below the top event; the limit is ${MAX_FTA_DEPTH}`}); return; }
  if (e['ref'] !== undefined) {
    const extra = Object.keys(e).filter(k => k !== 'ref');
    if (extra.length) issues.push({path: `${at}.${extra[0]}`, message: 'a {ref} draws another event again: write nothing else with it'});
    refs.push([e['ref'] as string, `${at}.ref`]);
    return;
  }
  if (e['label'] === undefined) issues.push({path: at, message: 'needs a label (or a ref to another event)'});
  if (typeof e['id'] === 'string') { if (ids.has(e['id'])) issues.push({path: `${at}.id`, message: `"${e['id']}" is used twice (ids must be unique)`}); else ids.set(e['id'], (e['kind'] as string | undefined) ?? 'event'); }
  const children = items(e, 'children'), gate = e['gate'] as string | undefined, kind = e['kind'] as string | undefined;
  if (gate !== undefined && kind !== undefined && kind !== 'event') issues.push({path: `${at}.kind`, message: `a ${kind} event has no gate under it: leave out kind (or gate)`});
  if (gate !== undefined && children.length === 0) issues.push({path: `${at}.children`, message: `the ${gate} gate needs its inputs here`});
  if (gate === undefined && children.length) issues.push({path: `${at}.gate`, message: 'is needed: the children are the inputs of a gate (and, or, vote or inhibit)'});
  if (gate === undefined && kind === undefined && depth > 0) issues.push({path: `${at}.kind`, message: "is needed for an event with no gate: basic, undeveloped, house or condition"});
  if (gate === 'vote' && (typeof e['k'] !== 'number' || (e['k'] as number) > children.length)) issues.push({path: `${at}.k`, message: `a vote gate needs k from 1 to the number of inputs (${children.length})`});
  if (gate !== 'vote' && e['k'] !== undefined) issues.push({path: `${at}.k`, message: 'goes only with gate: vote'});
  if (gate === 'inhibit' && (children.length !== 1 || e['condition'] === undefined)) issues.push({path: `${at}.${children.length !== 1 ? 'children' : 'condition'}`, message: 'an inhibit gate takes exactly one input in children and one condition'});
  if (gate !== 'inhibit' && e['condition'] !== undefined) issues.push({path: `${at}.condition`, message: 'goes only with gate: inhibit'});
  if (e['state'] !== undefined && kind !== 'house') issues.push({path: `${at}.state`, message: 'goes only with kind: house'});
  children.forEach((c, i) => checkFta(c, `${at}.children[${i}]`, ids, refs, count, depth + 1, issues));
  if (e['condition'] !== undefined) {
    const c = e['condition'] as Json;
    if (c['ref'] === undefined && c['kind'] !== 'condition') issues.push({path: `${at}.condition.kind`, message: "must be 'condition'"});
    checkFta(c, `${at}.condition`, ids, refs, count, depth + 1, issues);
  }
}

/** The words a fault tree writes by itself, in English. */
const FTA_EN = {
  singlePoint: 'Single point of failure', undevelopedAlone: 'Undeveloped, alone to the top', houseTrue: 'Assumed to always happen', houseFalse: 'Assumed never to happen',
  period: 'Period: {period}. ', topP: 'Probability of the top event: {p}', topBound: 'Probability of the top event ≤ {p} (an upper bound: more than {n} shared basic events)', assumption: '. Basic events are assumed independent.',
};

// ---- causal loop: count the simple loops with a budget, so a dense graph is refused before the builder enumerates them ------------
function loopCount(nodes: readonly string[], links: readonly Json[], limit: number): number {
  const out = new Map(nodes.map(n => [n, [] as string[]]));
  for (const l of links) out.get(l['from'] as string)?.push(l['to'] as string);
  let found = 0, steps = 0;
  const index = new Map(nodes.map((n, i) => [n, i]));
  for (const [si, start] of nodes.entries()) {
    const seen = new Set([start]);
    const visit = (at: string): void => {
      for (const to of out.get(at) ?? []) {
        if (found > limit || ++steps > 200_000) { found = limit + 1; return; }
        if (to === start) found++;
        else if (!seen.has(to) && (index.get(to) ?? -1) >= si) { seen.add(to); visit(to); seen.delete(to); }
      }
    };
    visit(start);
  }
  return found;
}

const POLARITY = {...oneOf('+', '-'), description: "+: more of from makes more of to. -: more of from makes less of to."};

// ---- affinity --------------------------------------------------------------------------------------------------------------
const affinityGroup = (levels: number): JsonSchema => object({
  title: text('The name of the group: what its cards have in common, as a short sentence.', 40),
  cards: list(text('One idea or fact.', 40), 10),
  ...(levels > 0 ? {groups: list(affinityGroup(levels - 1), 4)} : {}),
}, ['title']);
const cardsIn = (g: Json): number => items(g, 'cards').length + items(g, 'groups').reduce((n, c) => n + cardsIn(c), 0);
function checkAffinity(g: Json, at: string, issues: SpecIssue[]): void {
  if (!items(g, 'cards').length && !items(g, 'groups').length) issues.push({path: `${at}.cards`, message: 'a group needs cards or smaller groups'});
  items(g, 'groups').forEach((c, i) => checkAffinity(c, `${at}.groups[${i}]`, issues));
}

// ---- English words the table builders write by themselves --------------------------------------------------------------------
const FMEA_EN = {item: 'Item', mode: 'Failure\nmode', effect: 'Effect', cause: 'Cause', action: 'Action', s: 'S\nSev.', o: 'O\nOcc.', d: 'D\nDet.', rpn: 'RPN', afterS: 'After\nS', afterO: 'After\nO', afterD: 'After\nD', afterRpn: 'After\nRPN'};
const IS_IS_NOT_EN = {dim: 'Dimension', is: 'IS', isNot: 'IS NOT (could be, but is absent)', distinct: 'Distinction', change: 'Change'};
const DIM_EN: Record<string, string> = {what: 'What (object, defect)', where: 'Where', when: 'When', extent: 'Extent (size, number)'};
const MATRIX_EN: Record<string, string> = {'評価点': 'Score', '合計': 'Total', '重み': 'Weight'};

export const PARTS_R4: readonly PartDef[] = [
  {
    type: 'faultTree',
    description: 'A fault tree (FTA): the top event (the failure to prevent) at the top, a logic gate under each event (and, or, vote, inhibit) and its inputs below, down to basic events (circles) and undeveloped events (diamonds). An event with no gate needs a kind. `{ref: id}` repeats a basic event that feeds two gates. cutSets marks the events that alone cause the top event; quant works out its probability from every basic event\'s p.',
    schema: object({
      type: {const: 'faultTree'},
      top: ftaEvent(MAX_FTA_DEPTH),
      cutSets: {type: 'boolean', description: 'true: mark the single points of failure (events that alone cause the top event).'},
      quant: {type: 'boolean', description: 'true: work out the probability of the top event (every basic and undeveloped event needs p).'},
      quantPeriod: text('The period p is over, such as 1 年間 (with quant).', 20),
      maxNodeW: {type: 'integer', minimum: 80, maximum: 400, description: 'The widest an event box may grow, in px (default 200, narrowed when the tree is too wide).'},
    }, ['type', 'top']),
    example: {type: 'faultTree', top: {label: 'サービスが止まる', gate: 'or', children: [{label: 'DB が止まる', gate: 'and', children: [{label: '主系の故障', kind: 'basic'}, {label: '切り替えの失敗', kind: 'basic'}]}, {label: 'アプリの全台停止', kind: 'undeveloped'}]}},
    en: {words: FTA_EN},
    check(part, at, issues) {
      const ids = new Map<string, string>(), refs: [string, string][] = [], count = {n: 0};
      const top = part['top'] as Json;
      if (top['ref'] !== undefined) { issues.push({path: `${at}.top.ref`, message: 'the top event cannot be a ref'}); return; }
      if (top['gate'] === undefined) issues.push({path: `${at}.top.gate`, message: 'the top event needs a gate and the events under it'});
      checkFta(top, `${at}.top`, ids, refs, count, 0, issues);
      if (count.n > MAX_FTA_EVENTS) issues.push({path: `${at}.top`, message: `holds ${count.n} events; the limit is ${MAX_FTA_EVENTS}`});
      for (const [r, path] of refs) {
        const kind = ids.get(r);
        if (kind === undefined) issues.push({path, message: `"${r}" is not the id of an event (known: ${[...ids.keys()].join(', ')})`});
        else if (kind === 'event') issues.push({path, message: `"${r}" has a gate under it; only a basic, undeveloped, house or condition event can be drawn again`});
      }
      if (part['quantPeriod'] !== undefined && part['quant'] !== true) issues.push({path: `${at}.quantPeriod`, message: 'goes with quant: true'});
    },
    build(part) {
      const {top, ...opts} = optionsOf(part);
      return faultTree(top as never, opts as never);
    },
  },
  {
    type: 'bowtie',
    description: 'A bow-tie diagram for a risk: the top event (the moment control is lost) in the middle under its hazard, the threats that cause it on the left with the preventive barriers between them and it, and the consequences on the right with the barriers that limit them. The figure is one row of boxes across: keep every label short (about 10 characters), and give at most two barriers per threat or consequence; one fits best.',
    schema: object({
      type: {const: 'bowtie'},
      hazard: text('What is kept under control, drawn above the top event.', 40),
      top: text('The top event: the loss of control.', 40),
      threats: list(object({label: text('A cause of the top event.', 40), barriers: list(text('A preventive barrier, in the order the threat meets it.', 20), 2)}, ['label']), 6, 1),
      consequences: list(object({label: text('A result of the top event.', 40), barriers: list(text('A barrier that limits it, in the order it is met.', 20), 2)}, ['label']), 6, 1),
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'top', 'threats', 'consequences']),
    example: {type: 'bowtie', hazard: '顧客の個人情報', top: '個人情報が漏えいする', threats: [{label: '不正アクセス', barriers: ['多要素認証']}, {label: '誤送信', barriers: ['宛先の確認']}], consequences: [{label: '信用の低下', barriers: ['速やかな公表']}]},
    check() {},
    build(part) {
      const {hazard, top, threats, consequences, ...opts} = optionsOf(part);
      return bowtie({...(hazard === undefined ? {} : {hazard}), top, threats, consequences} as never, opts as never);
    },
  },
  {
    type: 'fmea',
    description: 'An FMEA table (failure mode and effects analysis): for each item, how it can fail, the effect, the cause and the action, rated S (severity), O (occurrence) and D (detection) from 1 to 10. RPN = S x O x D is worked out and coloured against the threshold; `after` gives the ratings once the action is taken.',
    schema: object({
      type: {const: 'fmea'},
      rows: list(object({
        item: text('The part or the process step.', 30),
        mode: text('How it fails.', 40),
        effect: text('What the failure causes.', 40),
        cause: text('Why it fails.', 40),
        action: text('What is done about it.', 40),
        s: {type: 'integer', minimum: 1, maximum: 10, description: 'Severity, 1 to 10.'},
        o: {type: 'integer', minimum: 1, maximum: 10, description: 'Occurrence, 1 to 10.'},
        d: {type: 'integer', minimum: 1, maximum: 10, description: 'Detection, 1 (sure to be found) to 10.'},
        after: object({s: {type: 'integer', minimum: 1, maximum: 10}, o: {type: 'integer', minimum: 1, maximum: 10}, d: {type: 'integer', minimum: 1, maximum: 10}}, ['s', 'o', 'd'], 'The ratings after the action.'),
      }, ['item', 'mode', 'effect', 'cause', 'action', 's', 'o', 'd']), 12, 1),
      title: text('A title bar over the table.', 40),
      sort: {...oneOf('rpn'), description: 'rpn: the highest RPN first.'},
      threshold: {type: 'integer', minimum: 1, maximum: 1000, description: 'An RPN at or above it is red (default 100).'},
      dense: {type: 'boolean', description: 'true: tighter rows.'},
    }, ['type', 'rows']),
    example: {type: 'fmea', rows: [{item: '駆動軸', mode: '摩耗', effect: '搬送が止まる', cause: '潤滑不足', action: '定期給油', s: 8, o: 5, d: 4}]},
    en: {labels: FMEA_EN},
    check() {},
    build(part) {
      const {rows, ...opts} = optionsOf(part);
      return fmea(rows as never, opts as never);
    },
  },
  {
    type: 'isIsNot',
    description: "A Kepner-Tregoe IS / IS NOT table: for what, where, when and extent, what the problem IS and what it could be but IS NOT, the distinction between the two, and what changed around that distinction. dim is 'what', 'where', 'when', 'extent' or a heading of your own. At least one row needs a distinction.",
    schema: object({
      type: {const: 'isIsNot'},
      rows: list(object({
        dim: text("'what', 'where', 'when', 'extent', or a heading of your own.", 20),
        is: text('What the problem is.', 60),
        isNot: text('What it could be, but is not.', 60),
        distinct: text('What sets IS apart from IS NOT.', 60),
        change: text('What changed around that distinction.', 60),
      }, ['dim', 'is', 'isNot']), 8, 1),
      title: text('A title bar over the table.', 40),
      dense: {type: 'boolean', description: 'true: tighter rows.'},
    }, ['type', 'rows']),
    example: {type: 'isIsNot', rows: [{dim: 'what', is: 'API A のタイムアウト', isNot: 'API B は正常', distinct: 'A だけ外部の DB を使う', change: '接続設定を変えた'}, {dim: 'when', is: '月曜の朝', isNot: 'ほかの曜日', distinct: '週次バッチの直後'}]},
    en: {lang: 'en', labels: IS_IS_NOT_EN},
    check(part, at, issues) {
      if (items(part, 'rows').every(r => r['distinct'] === undefined)) issues.push({path: `${at}.rows`, message: 'no row has a distinct: name at least one sharp difference between IS and IS NOT'});
    },
    build(part) {
      const {rows, ...opts} = optionsOf(part);
      const list = english(part) ? (rows as Json[]).map(r => ({...r, dim: DIM_EN[r['dim'] as string] ?? r['dim']})) : rows;
      return isIsNot(list as never, opts as never);
    },
  },
  {
    type: 'matrix',
    description: 'A matrix diagram (L-shaped): options or causes as rows against criteria as columns, with ◎ (strong), ○, △ or × where they meet. With weights (the importance of each column), every row gets a score, Σ weight x value with ◎ 9, ○ 3, △ 1, × 0, and the best is marked.',
    schema: object({
      type: {const: 'matrix'},
      rows: list(text('A row heading.', 40), 12, 1),
      cols: list(text('A column heading.', 20), 8, 1),
      cells: list({type: 'array', items: {...oneOf('◎', '○', '△', '×', ''), description: "◎, ○, △, × or '' for none."}, minItems: 1, maxItems: 8}, 12, 1),
      weights: list({type: 'number', minimum: 0, maximum: 100}, 8, 1),
      corner: text('The top-left heading, such as 案 ＼ 評価項目.', 30),
      title: text('A title bar over the table.', 40),
      total: {type: 'boolean', description: 'true: a score per row also without weights.'},
    }, ['type', 'rows', 'cols', 'cells']),
    example: {type: 'matrix', corner: '案 ＼ 評価', rows: ['A 案', 'B 案'], cols: ['コスト', '効果', '早さ'], cells: [['○', '◎', '△'], ['◎', '△', '○']], weights: [5, 4, 3]},
    en: {lang: 'en'},
    check(part, at, issues) {
      const rows = items(part, 'rows').length, cols = items(part, 'cols').length, cells = part['cells'] as unknown[][];
      if (cells.length !== rows) issues.push({path: `${at}.cells`, message: `has ${cells.length} rows; there are ${rows} rows`});
      cells.forEach((r, i) => { if (r.length !== cols) issues.push({path: `${at}.cells[${i}]`, message: `has ${r.length} cells; there are ${cols} columns`}); });
      const w = part['weights'] as unknown[] | undefined;
      if (w && w.length !== cols) issues.push({path: `${at}.weights`, message: `has ${w.length} weights; there are ${cols} columns`});
    },
    build(part) {
      const {rows, cols, cells, ...opts} = optionsOf(part);
      if (!english(part)) return matrix(rows as never, cols as never, cells as never, opts as never);
      // the builder writes its score and weight headings in Japanese: the same table, with those words in English
      const p = matrixParts(rows as never, cols as never, cells as never, opts as never);
      const en = (s: unknown): unknown => typeof s === 'string' ? MATRIX_EN[s] ?? s : s;
      const columns = p.columns.map(c => ({...c, label: en(c.label) as string}));
      const body = p.rows.map(r => Array.isArray(r) ? r.map(en) : {...r, cells: (r as {cells: unknown[]}).cells.map(en)});
      return table(columns, body as never, p.opts);
    },
  },
  {
    type: 'pdpc',
    anchors: 'nodes',
    description: 'A PDPC (process decision program chart): the steps from the start to the goal, what could go wrong on the way (role risk, a hexagon) and what to do then (role measure). The main path is solid; arrows into or out of a risk or a measure are dashed. A measure usually leads back to a step or on to the goal.',
    schema: object({
      type: {const: 'pdpc'},
      nodes: list(object({
        id: id('Referred to by links.'),
        label: text('The step, risk or measure.', 60),
        sub: text('A second, muted line.', 60),
        role: {...oneOf('start', 'step', 'risk', 'measure', 'goal'), description: 'Default step.'},
        tone: EMPHASIS_TONE,
      }, ['id', 'label']), MAX_CAUSE_NODES, 2),
      links: list(object({from: id('A node id.'), to: id('A node id.'), line: LINE}, ['from', 'to']), MAX_CAUSE_LINKS, 1),
      dir: {...oneOf('down', 'right'), description: 'down (default): from the top; right: from the left.'},
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'nodes', 'links']),
    example: {type: 'pdpc', nodes: [{id: 's', label: '着手', role: 'start'}, {id: 'a', label: '試作する'}, {id: 'r', label: '強度が足りない', role: 'risk'}, {id: 'm', label: '材質を変える', role: 'measure'}, {id: 'g', label: '量産開始', role: 'goal'}], links: [{from: 's', to: 'a'}, {from: 'a', to: 'g'}, {from: 'a', to: 'r'}, {from: 'r', to: 'm'}, {from: 'm', to: 'a'}]},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      items(part, 'links').forEach((l, i) => {
        mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
        if (l['from'] === l['to']) issues.push({path: `${at}.links[${i}].to`, message: 'is the same node as from'});
      });
      const roles = items(part, 'nodes').map(n => n['role']);
      if (!roles.includes('goal')) issues.push({path: `${at}.nodes`, message: "needs a node with role 'goal': the PDPC is the way to it"});
    },
    build(part) {
      const {nodes, links, ...opts} = optionsOf(part);
      return pdpc(nodes as never, links as never, opts as never);
    },
  },
  {
    type: 'relationDiagram',
    anchors: 'nodes',
    description: "A relations diagram: the factors of a tangled problem and arrows from cause to effect, which may cross and go back. Each factor shows how many arrows leave and enter it; the factor with the most leaving arrows (2 or more) is marked as the key cause. `problem` names the result being analysed (red).",
    schema: object({
      type: {const: 'relationDiagram'},
      nodes: list(object({id: id('Referred to by links.'), label: text('A factor, written as a statement.', 40), sub: text('A second, muted line.', 40)}, ['id', 'label']), MAX_RELATION_NODES, 2),
      links: list(object({from: id('The cause.'), to: id('The effect.'), line: LINE}, ['from', 'to']), MAX_RELATION_LINKS, 1),
      problem: {oneOf: [id('The problem node.'), {type: 'array', items: id('A problem node.'), minItems: 1, maxItems: 3}], description: 'The node id (or ids) of the problem being analysed.'},
      counts: {type: 'boolean', description: 'false: do not write the arrow counts under each factor.'},
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'nodes', 'links', 'problem']),
    example: {type: 'relationDiagram', problem: 'late', nodes: [{id: 'late', label: '納期に遅れる'}, {id: 'rush', label: '急ぎの割り込み'}, {id: 'plan', label: '計画が守られない'}, {id: 'est', label: '見積もりが甘い'}], links: [{from: 'est', to: 'plan'}, {from: 'plan', to: 'rush'}, {from: 'rush', to: 'late'}, {from: 'plan', to: 'late'}, {from: 'est', to: 'rush'}]},
    en: {lang: 'en'},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues), seen = new Set<string>();
      items(part, 'links').forEach((l, i) => {
        mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
        if (l['from'] === l['to']) issues.push({path: `${at}.links[${i}].to`, message: 'is the same node as from'});
        const key = `${String(l['from'])}>${String(l['to'])}`;
        if (seen.has(key)) issues.push({path: `${at}.links[${i}]`, message: 'repeats an earlier link'});
        seen.add(key);
      });
      const p = part['problem'];
      (Array.isArray(p) ? p : [p]).forEach((x, i) => mustExist(x, nodes, Array.isArray(p) ? `${at}.problem[${i}]` : `${at}.problem`, 'node id', issues));
    },
    build(part) {
      const {nodes, links, ...opts} = optionsOf(part);
      if (!english(part) || opts['counts'] === false) return relationDiagram(nodes as never, links as never, opts as never);
      // the builder writes the counts in Japanese: write them here in English, and let it mark the key cause as usual
      const ls = links as Json[], n = (id: unknown, end: 'from' | 'to'): number => ls.filter(l => l[end] === id).length;
      const withCounts = (nodes as Json[]).map(x => ({...x, sub: `${x['sub'] ? `${String(x['sub'])}  ` : ''}Out ${n(x['id'], 'from')} · In ${n(x['id'], 'to')}`}));
      return relationDiagram(withCounts as never, ls as never, {...opts, counts: false} as never);
    },
  },
  {
    type: 'affinity',
    description: 'An affinity diagram (KJ method): cards of ideas or facts gathered into groups, each group named by a short sentence that says what its cards have in common. A group can be made of smaller groups (two levels below the top).',
    schema: object({
      type: {const: 'affinity'},
      groups: list(affinityGroup(2), 9, 1),
      cols: {type: 'integer', minimum: 1, maximum: 4, description: 'Groups side by side (default 3, or fewer when there are fewer groups).'},
      cardCols: {type: 'integer', minimum: 1, maximum: 3, description: 'Cards side by side inside a group (default 1).'},
    }, ['type', 'groups']),
    example: {type: 'affinity', groups: [{title: '準備が足りない', cards: ['段取りが決まっていない', '資料が古い']}, {title: '連絡が遅い', cards: ['報告が遅れる', '共有の場がない']}]},
    check(part, at, issues) {
      items(part, 'groups').forEach((g, i) => checkAffinity(g, `${at}.groups[${i}]`, issues));
      const n = items(part, 'groups').reduce((k, g) => k + cardsIn(g), 0);
      if (n > MAX_AFFINITY_CARDS) issues.push({path: `${at}.groups`, message: `hold ${n} cards; the limit is ${MAX_AFFINITY_CARDS}`});
    },
    build(part) {
      const {groups, ...opts} = optionsOf(part);
      // fewer groups than columns would leave the figure lopsided: as many columns as groups, up to the builder's 3
      return affinity(groups as never, {cols: Math.min(3, (groups as unknown[]).length), ...opts} as never);
    },
  },
  {
    type: 'causalLoop',
    anchors: 'nodes',
    description: "A causal loop diagram (systems thinking): variables joined by arrows marked + (they move the same way) or - (the opposite way); a delay is marked ||. Every closed loop is found and named R (reinforcing: an even number of -) or B (balancing: odd). Interventions are levers outside the loops, acting on a variable. layout 'ring' draws a figure that is exactly one loop as a circle.",
    schema: object({
      type: {const: 'causalLoop'},
      nodes: list(object({id: id('Referred to by links.'), label: text('A variable: something that can rise or fall.', 30)}, ['id', 'label']), MAX_CAUSAL_NODES, 2),
      links: list(object({from: id('A node id.'), to: id('A node id.'), polarity: POLARITY, delay: {type: 'boolean', description: 'true: the effect comes late (||).'}, label: text('A short note on the arrow.', 20)}, ['from', 'to', 'polarity']), MAX_CAUSAL_LINKS, 1),
      interventions: list(object({id: id('A name for the lever.'), label: text('The lever.', 30), to: {oneOf: [id('A node id.'), {type: 'array', items: id('A node id.'), minItems: 1, maxItems: 3}]}, polarity: POLARITY, delay: {type: 'boolean'}}, ['id', 'label', 'to', 'polarity']), 3),
      layout: {...oneOf('layered', 'ring'), description: 'layered (default), or ring for a figure that is exactly one loop.'},
      direction: {...oneOf('LR', 'TB'), description: 'LR (default): left to right; TB: top to bottom.'},
    }, ['type', 'nodes', 'links']),
    example: {type: 'causalLoop', nodes: [{id: 'q', label: 'サービス品質'}, {id: 's', label: '顧客満足'}, {id: 'o', label: '受注量'}, {id: 'l', label: '業務負荷'}], links: [{from: 'q', to: 's', polarity: '+'}, {from: 's', to: 'o', polarity: '+', delay: true}, {from: 'o', to: 'l', polarity: '+'}, {from: 'l', to: 'q', polarity: '-'}]},
    check(part, at, issues) {
      const before = issues.length, nodes = uniqueIds(part, 'nodes', at, issues), seen = new Set<string>();
      items(part, 'links').forEach((l, i) => {
        mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
        const key = `${String(l['from'])}>${String(l['to'])}`;
        if (seen.has(key)) issues.push({path: `${at}.links[${i}]`, message: 'repeats an earlier link'});
        seen.add(key);
      });
      items(part, 'interventions').forEach((v, i) => {
        if (nodes.has(v['id'] as string)) issues.push({path: `${at}.interventions[${i}].id`, message: `"${String(v['id'])}" is already a node id`});
        const to = v['to'];
        (Array.isArray(to) ? to : [to]).forEach((t, j) => mustExist(t, nodes, Array.isArray(to) ? `${at}.interventions[${i}].to[${j}]` : `${at}.interventions[${i}].to`, 'node id', issues));
      });
      if (part['layout'] === 'ring' && part['direction'] !== undefined) issues.push({path: `${at}.direction`, message: 'does not go with layout ring'});
      if (issues.length > before) return;
      const loops = loopCount(items(part, 'nodes').map(n => n['id'] as string), items(part, 'links'), MAX_CAUSAL_LOOPS);
      if (loops > MAX_CAUSAL_LOOPS) issues.push({path: `${at}.links`, message: `make more than ${MAX_CAUSAL_LOOPS} loops; draw the main loops only (each loop is named and drawn)`});
    },
    build(part) {
      const {nodes, links, ...opts} = optionsOf(part);
      return causalLoop(nodes as never, links as never, opts as never);
    },
  },
];
