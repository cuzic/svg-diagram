// A diagram as JSON data ("svg-diagram/spec"): the input for callers that must not run a `.ts` source, such as a public server taking
// diagrams from a model. A source is code (lib/load-source.ts imports it); a spec is data, checked against a schema and turned into builder
// calls from a fixed list. Each part below keeps its schema, its example and its builder together, so they change in one commit.
//
// Nothing here touches the disk or a process: this file imports only dsl-pure. Left out on purpose: image() and math() (files, MathJax),
// `slide` / `fill` (a measured slide), `today: 'auto'` (the build's date) and `icon` (a process-wide manifest).
import {diagram, flowchart, sequence, swimlane} from './dsl-pure.ts';
import type {Diagram, Verdict} from './types/index.ts';

export const SPEC_VERSION = 1;

/** All the text of a spec together, in characters. The per-field limits alone would allow a figure that takes seconds to lay out. */
export const MAX_TOTAL_TEXT = 6000;
/** Emoji in a whole spec. They cost far more to draw than other characters: a colour glyph is a picture, and a few hundred take many seconds. */
export const MAX_EMOJI = 30;
/** The columns a swimlane has room for at the figure's width. */
export const MAX_SWIMLANE_COLS = 8;
/** Issues reported at once: enough to work on, and a bad spec cannot make the answer huge. */
export const MAX_ISSUES = 20;

/** The subset of JSON Schema this file writes and validates. */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'integer' | 'boolean';
  description?: string;
  const?: string | number;
  enum?: readonly (string | number | boolean)[];
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
  additionalProperties?: false;
  items?: JsonSchema;
  oneOf?: readonly JsonSchema[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

/** What is wrong and where: `path` is written like `parts[0].nodes[2].label` ('' is the whole spec). */
export interface SpecIssue {path: string; message: string}

export class SpecError extends Error {
  readonly issues: readonly SpecIssue[];
  constructor(issues: readonly SpecIssue[]) {
    super(issues.map(i => `${i.path || '(spec)'}: ${i.message}`).join('\n'));
    this.name = 'SpecError';
    this.issues = issues;
  }
}

type Json = Record<string, unknown>;
type Check = (part: Json, at: string, issues: SpecIssue[]) => void;

const text = (description: string, maxLength = 120): JsonSchema => ({type: 'string', minLength: 1, maxLength, description});
const id = (description: string): JsonSchema => ({type: 'string', minLength: 1, maxLength: 64, description});
const object = (properties: Record<string, JsonSchema>, required: readonly string[], description?: string): JsonSchema => ({type: 'object', properties, required, additionalProperties: false, ...(description ? {description} : {})});
const list = (items: JsonSchema, maxItems: number, minItems = 0): JsonSchema => ({type: 'array', items, minItems, maxItems});
const oneOf = (...values: readonly string[]): JsonSchema => ({type: 'string', enum: values});
const count = (description: string, maximum: number): JsonSchema => ({type: 'integer', minimum: 1, maximum, description});

const BOX_TONE = oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger');
const TEXT_TONE = oneOf('text', 'accent', 'muted', 'danger');
const LINE = oneOf('solid', 'dashed', 'dotted');
const ARROW = oneOf('end', 'start', 'both', 'none');

const items = (part: Json, key: string): Json[] => (part[key] as Json[] | undefined) ?? [];

/** Every `key` of `part[list]` once; a repeat is reported. Returns the set. */
function uniqueIds(part: Json, listKey: string, at: string, issues: SpecIssue[], key = 'id'): Set<string> {
  const seen = new Set<string>();
  items(part, listKey).forEach((x, i) => {
    const v = x[key];
    if (typeof v !== 'string') return;
    if (seen.has(v)) issues.push({path: `${at}.${listKey}[${i}].${key}`, message: `"${v}" is used twice (ids must be unique)`});
    seen.add(v);
  });
  return seen;
}
function mustExist(value: unknown, known: ReadonlySet<string>, path: string, what: string, issues: SpecIssue[]): void {
  if (typeof value === 'string' && !known.has(value)) issues.push({path, message: `"${value}" is not a ${what} (known: ${[...known].join(', ')})`});
}
/** A swimlane flow end: 'id', 'id:side' or 'id:side@t' with t from 0 to 1. Anything else would reach the layout as a coordinate that is not a number. */
const FLOW_END = /^([^:@]+)(?::(?:left|right|top|bottom|center)(?:@(?:0(?:\.\d+)?|1(?:\.0+)?))?)?$/;
function checkFlowEnd(ref: unknown, steps: ReadonlySet<string>, path: string, issues: SpecIssue[]): void {
  if (typeof ref !== 'string') return;
  const m = FLOW_END.exec(ref);
  if (!m) { issues.push({path, message: `"${ref}" must be 'id', 'id:side' or 'id:side@t' (side: left, right, top, bottom, center; t: 0 to 1)`}); return; }
  mustExist(m[1], steps, path, 'step id', issues);
}

interface PartDef {
  type: string;
  description: string;
  schema: JsonSchema;
  example: Json;
  check: Check;
  build: (part: Json, at: string) => unknown;
  /** The list whose ids become anchors of the whole figure, so they must not repeat between parts. */
  anchors?: string;
}

const withoutType = ({type: _type, ...rest}: Json): Json => rest;

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
];

const partOf = (type: unknown): PartDef | undefined => PARTS.find(p => p.type === type);

/** The JSON Schema of a whole spec. */
export const specSchema: JsonSchema = object({
  version: {const: SPEC_VERSION, description: 'Always 1.'},
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
const describe = (v: unknown): string => v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : JSON.stringify(v);
const join = (at: string, key: string): string => at ? `${at}.${key}` : key;

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
  if (typeof v !== 'object' || v === null || Array.isArray(v)) { out.push({path: at, message: `must be an object (got ${describe(v)})`}); return; }
  const o = v as Json;
  const constsOf = (b: JsonSchema) => Object.entries(b.properties ?? {}).filter(([, p]) => p.const !== undefined);
  const consts = branches.filter(b => constsOf(b).length > 0);
  if (consts.length === branches.length) {
    const hit = branches.find(b => constsOf(b).every(([k, p]) => o[k] === p.const));
    if (hit) { validate(hit, v, at, out); return; }
    const key = (constsOf(branches[0] as JsonSchema)[0] as [string, JsonSchema])[0];
    out.push({path: join(at, key), message: `must be one of ${branches.map(b => JSON.stringify(b.properties?.[key]?.const)).join(', ')} (got ${describe(o[key])})`});
    return;
  }
  const hit = branches.find(b => (b.required ?? []).every(k => Object.hasOwn(o, k)));
  if (hit) { validate(hit, v, at, out); return; }
  out.push({path: at, message: `must have the fields of one of these forms: ${branches.map(b => (b.required ?? []).join(' + ')).join(' / ')}`});
}

function countEmoji(v: unknown): number {
  if (typeof v === 'string') return v.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
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

const capped = (issues: SpecIssue[]): SpecIssue[] => issues.length <= MAX_ISSUES ? issues : [...issues.slice(0, MAX_ISSUES), {path: '', message: `and ${issues.length - MAX_ISSUES} more of the same kind: fix these first`}];
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
  const {parts, version: _version, ...opts} = input as Json;
  const list = parts as Json[];
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

const TEXT_FIELDS: ReadonlySet<string> = new Set(['id', 'label', 'sub', 'title', 'body', 'note', 'tag', 'divider']);
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
function inSpecTerms(message: string): {message: string; fix?: string} {
  return LABEL_HAS_NO_ROOM.test(message) ? {message: message.replace(LABEL_HAS_NO_ROOM, ''), fix: LABEL_ADVICE} : {message};
}

/** A renderDiagram() verdict in the spec's terms: what failed (`problems`) and what was noticed (`findings`), each with its place. */
export function locateVerdict(spec: unknown, verdict: Verdict): {problems: LocatedMessage[]; findings: LocatedMessage[]} {
  return {
    problems: verdict.problems.map(raw => ({path: locateMessage(spec, raw), ...inSpecTerms(raw), severity: 'problem' as const})),
    findings: verdict.findings.map(f => ({path: locateMessage(spec, f.message), message: f.message, rule: f.rule, severity: f.severity, ...(f.data?.fix ? {fix: f.data.fix} : {})})),
  };
}
