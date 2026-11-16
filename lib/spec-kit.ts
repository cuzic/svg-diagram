// The pieces every spec part is written with (lib/spec.ts and lib/spec-parts/*.ts): the JSON Schema subset, the issue type, the schema
// helpers and the checks shared between parts. Like lib/spec.ts, nothing here touches the disk or a process.
export const SPEC_VERSION = 1;

/** All the text of a spec together, in characters. The per-field limits alone would allow a figure that takes seconds to lay out. */
export const MAX_TOTAL_TEXT = 6000;
/** Emoji in a whole spec. They cost far more to draw than other characters: a colour glyph is a picture, and a few hundred take many seconds. */
export const MAX_EMOJI = 30;
/** The columns a swimlane has room for at the figure's width. */
export const MAX_SWIMLANE_COLS = 8;
/** Levels under the root of a mind map, and nodes in the whole map. */
export const MAX_TREE_DEPTH = 4;
export const MAX_TREE_NODES = 60;
/** Entities and links of a cause tree. Untangling the arrows of an AND searches orders of the whole figure: at 40 entities that took 4.5 s of CPU on a worker (ADR 0053). */
export const MAX_CAUSE_NODES = 30;
export const MAX_CAUSE_LINKS = 45;
/** Issues reported at once: enough to work on, and a bad spec cannot make the answer huge. */
export const MAX_ISSUES = 20;
export const MAX_QUOTED = 80;

/** The subset of JSON Schema this file writes and validates. */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
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

export type Json = Record<string, unknown>;
export type Check = (part: Json, at: string, issues: SpecIssue[]) => void;

export const text = (description: string, maxLength = 120): JsonSchema => ({type: 'string', minLength: 1, maxLength, description});
export const id = (description: string): JsonSchema => ({type: 'string', minLength: 1, maxLength: 64, description});
export const object = (properties: Record<string, JsonSchema>, required: readonly string[], description?: string): JsonSchema => ({type: 'object', properties, required, additionalProperties: false, ...(description ? {description} : {})});
export const list = (items: JsonSchema, maxItems: number, minItems = 0): JsonSchema => ({type: 'array', items, minItems, maxItems});
export const oneOf = (...values: readonly string[]): JsonSchema => ({type: 'string', enum: values});
export const count = (description: string, maximum: number): JsonSchema => ({type: 'integer', minimum: 1, maximum, description});

export const BOX_TONE = oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger');
export const TEXT_TONE = oneOf('text', 'accent', 'muted', 'danger');
export const LINE = oneOf('solid', 'dashed', 'dotted');
export const EMPHASIS_TONE = oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger');
export const MAX_NODE_WIDTH: JsonSchema = {type: 'integer', minimum: 120, maximum: 400, description: 'The widest a box may grow, in px.'};
export const ARROW = oneOf('end', 'start', 'both', 'none');

export const items = (part: Json, key: string): Json[] => (part[key] as Json[] | undefined) ?? [];

/** Every `key` of `part[list]` once; a repeat is reported. Returns the set. */
export function uniqueIds(part: Json, listKey: string, at: string, issues: SpecIssue[], key = 'id'): Set<string> {
  const seen = new Set<string>();
  items(part, listKey).forEach((x, i) => {
    const v = x[key];
    if (typeof v !== 'string') return;
    if (seen.has(v)) issues.push({path: `${at}.${listKey}[${i}].${key}`, message: `"${v}" is used twice (ids must be unique)`});
    seen.add(v);
  });
  return seen;
}
export function mustExist(value: unknown, known: ReadonlySet<string>, path: string, what: string, issues: SpecIssue[]): void {
  if (typeof value === 'string' && !known.has(value)) issues.push({path, message: `"${value}" is not a ${what} (known: ${[...known].join(', ')})`});
}
/** A swimlane flow end: 'id', 'id:side' or 'id:side@t' with t from 0 to 1. Anything else would reach the layout as a coordinate that is not a number. */
export const FLOW_END = /^([^:@]+)(?::(?:left|right|top|bottom|center)(?:@(?:0(?:\.\d+)?|1(?:\.0+)?))?)?$/;
export function checkFlowEnd(ref: unknown, steps: ReadonlySet<string>, path: string, issues: SpecIssue[]): void {
  if (typeof ref !== 'string') return;
  const m = FLOW_END.exec(ref);
  if (!m) { issues.push({path, message: `"${ref}" must be 'id', 'id:side' or 'id:side@t' (side: left, right, top, bottom, center; t: 0 to 1)`}); return; }
  mustExist(m[1], steps, path, 'step id', issues);
}

export interface PartDef {
  type: string;
  description: string;
  schema: JsonSchema;
  example: Json;
  check: Check;
  build: (part: Json, at: string) => unknown;
  /** The list whose ids become anchors of the whole figure, so they must not repeat between parts. */
  anchors?: string;
  /** Options the part takes when the spec says `lang: 'en'` and the part does not give them. */
  en?: Json;
  /** English for the words this part puts in the legend (keys as in LEGEND_EN), for `lang: 'en'`. */
  legendEn?: Readonly<Record<string, string>>;
}

export const withoutType = ({type: _type, ...rest}: Json): Json => rest;

/** The words the figures write by themselves (legends, headings), for `lang: 'en'`. Japanese is the default of svg-diagram. */
export const LEGEND_EN: Record<string, string> = {
  'line:solid': 'Solid', 'line:dashed': 'Dashed', 'line:dotted': 'Dotted', 'line:double': 'Double', 'arrow:both': 'Both ways', 'weight:strong': 'Main flow',
  'tone:new': 'New', 'tone:changed': 'Changed', 'tone:removed': 'Out of scope', 'tone:danger': 'Warning', 'tone:muted': 'Supporting', 'tone:accent': 'Emphasis', 'tone:solid': 'Focus', 'tone:solid-danger': 'Critical',
  'role:ude': 'Undesirable effect (UDE)', 'role:root': 'Root cause', 'role:de': 'Desirable effect (DE)', 'role:injection': 'Injection', 'role:precondition': 'Fact of reality', 'role:tipping': 'Tipping point', 'role:trim': 'Trim (injection)', 'role:need': 'Need', 'role:goal': 'Goal', 'role:io': 'Intermediate objective', 'role:obstacle': 'Obstacle', 'role:action': 'Action', 'role:start': 'Start', 'role:risk': 'Risk', 'role:measure': 'Measure',
  'edge:and': 'Causes together (AND)', 'edge:back': 'Feedback', 'edge:blocks': 'Cuts', 'mark:core': 'Core driver',
  'fta-event:basic': 'Basic event', 'fta-event:undeveloped': 'Undeveloped event', 'fta-event:house': 'House event', 'fta-event:condition': 'Condition', 'fta-gate:and': 'AND gate', 'fta-gate:or': 'OR gate', 'fta-gate:vote': 'Voting gate (k/n)', 'fta-gate:inhibit': 'Inhibit gate',
};
/** The options a part takes in English when the spec says `lang: 'en'` and the part does not give them. */
export const PART_EN: Record<string, Json> = {
  gantt: {todayLabel: 'Today'},
  raci: {corner: 'Task / Role', legendLabels: {title: 'Legend', R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed'}},
  journeyMap: {corner: 'Lane / Stage'},
  valueChain: {margin: 'Margin', titles: ['Support activities', 'Primary activities']},
  whyWhyTree: {readingNote: false},
  causeTree: {coreDriverLabel: 'reaches {n} of {total}', coreBadge: 'Core'},
  cloud: {separator: ': '},
  quadrant: {sizeLegend: 'Bubble area = size'},
};

export const treeItem = (levels: number): JsonSchema => object({
  label: text('The text of the node.'),
  sub: text('A second, muted line.'),
  tone: EMPHASIS_TONE,
  ...(levels > 0 ? {children: list(treeItem(levels - 1), 12)} : {}),
}, ['label']);
export const flowSteps = (min: number, max: number): JsonSchema => list(object({label: text('The step.', 40), sub: text('A second, muted line.', 60), tone: EMPHASIS_TONE}, ['label']), max, min);
export const pair = (items: JsonSchema, description: string): JsonSchema => ({type: 'array', items, minItems: 2, maxItems: 2, description});
export const axis = (description: string): JsonSchema => object({title: text('The name of the axis.', 30), low: text('The word at the low end.', 20), high: text('The word at the high end.', 20), reversed: {type: 'boolean', description: 'true: high is drawn first (left, or bottom for y).'}}, ['title'], description);
export const QUADRANT_GRID = 4;
export const DATE: JsonSchema = {type: 'string', minLength: 10, maxLength: 10, description: 'YYYY-MM-DD.'};
/** A real day written YYYY-MM-DD. */
export const isDay = (v: unknown): boolean => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
export const dayOf = (v: string): number => Date.parse(`${v}T00:00:00Z`) / 86_400_000;

export const whyNode = (levels: number): JsonSchema => object({
  why: text('The answer to "why?": a fact, written as a statement.', 60),
  trueCause: {enum: [true], description: 'true: a root cause (a double frame).'},
  measure: text('What is done about this root cause.', 60),
  ...(levels > 0 ? {because: list(whyNode(levels - 1), 4)} : {}),
}, ['why']);
export const whySize = (n: Json): number => 1 + (n['measure'] !== undefined ? 1 : 0) + items(n, 'because').reduce((k, c) => k + whySize(c), 0);
export const CELL: JsonSchema = {oneOf: [text('A cell.', 120), {type: 'number', minimum: -1e12, maximum: 1e12}]};

export const treeSize = (item: Json): number => 1 + items(item, 'children').reduce((n, c) => n + treeSize(c), 0);

/** A number as a chart takes it: finite, and not so large that the axis arithmetic loses it. */
export const NUM: JsonSchema = {type: 'number', minimum: -1e12, maximum: 1e12};
/** A number that is never below 0, such as a count or an amount. */
export const AMOUNT: JsonSchema = {type: 'number', minimum: 0, maximum: 1e12};
/** The tone of a chart mark. */
export const CHART_TONE = oneOf('accent', 'danger', 'muted', 'text');
/** Every list in `lists` of `part` has as many entries as `n`, reported at the list. */
export function sameLength(part: Json, at: string, n: number, what: string, issues: SpecIssue[], ...paths: readonly (readonly (string | number)[])[]): void {
  for (const p of paths) {
    let v: unknown = part; for (const k of p) v = (v as Record<string | number, unknown> | undefined)?.[k];
    if (Array.isArray(v) && v.length !== n) issues.push({path: `${at}${p.map(k => typeof k === 'number' ? `[${k}]` : `.${k}`).join('')}`, message: `has ${v.length} entries; there are ${n} ${what}`});
  }
}
