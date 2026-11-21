// The pieces every spec part is written with (lib/spec.ts and lib/spec-parts/*.ts): the JSON Schema subset, the issue type, the schema
// helpers and the checks shared between parts. Like lib/spec.ts, nothing here touches the disk or a process.
export const SPEC_VERSION = 1;
/**
 * The range of a spec's canvas (ADR 0057 D2): from the default slide (1280 wide) up to 4K, and text from the default font floor (a spec
 * cannot lower it: renderSpec keeps fontFloor 14) up to the default slide's 24px. Every example of partCatalog() draws without a problem
 * anywhere in it (test/spec.test.ts). Past it the text outgrows layouts whose sizes do not scale with it yet (a loop-back's route, a
 * causal loop's delay mark), and a canvas narrower than a document figure (940) leaves the wider parts no room.
 */
export const CANVAS_LIMITS = { width: [1280, 3840], height: [360, 2160], minText: [14, 24] };
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
/** The figure's own width a spec may give (ADR 0059): narrower than the document's 940 only (a wider figure is a `canvas`, ADR 0057). */
export const SPEC_WIDTH = { min: 320, max: 940 };
export const MAX_QUOTED = 80;
export class SpecError extends Error {
    issues;
    constructor(issues) {
        super(issues.map(i => `${i.path || '(spec)'}: ${i.message}`).join('\n'));
        this.name = 'SpecError';
        this.issues = issues;
    }
}
/**
 * A file's JSON without the `$schema` an editor reads (ADR 0071): a spec, a figure file and a deck may start with it, and the checks
 * never see it. Only a string is taken out: anything else is left for the checks to report as an unknown field, as site.json does.
 */
export const withoutSchemaField = (v) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v) || typeof v['$schema'] !== 'string')
        return v;
    const { $schema: _schema, ...rest } = v;
    return rest;
};
export const text = (description, maxLength = 120) => ({ type: 'string', minLength: 1, maxLength, description });
export const id = (description) => ({ type: 'string', minLength: 1, maxLength: 64, description });
export const object = (properties, required, description) => ({ type: 'object', properties, required, additionalProperties: false, ...(description ? { description } : {}) });
export const list = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems });
export const oneOf = (...values) => ({ type: 'string', enum: values });
export const count = (description, maximum) => ({ type: 'integer', minimum: 1, maximum, description });
export const BOX_TONE = oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger');
export const TEXT_TONE = oneOf('text', 'accent', 'muted', 'danger');
export const LINE = oneOf('solid', 'dashed', 'dotted');
export const EMPHASIS_TONE = oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger');
export const MAX_NODE_WIDTH = { type: 'integer', minimum: 120, maximum: 400, description: 'The widest a box may grow, in px.' };
export const ARROW = oneOf('end', 'start', 'both', 'none');
export const items = (part, key) => part[key] ?? [];
/** Every `key` of `part[list]` once; a repeat is reported. Returns the set. */
export function uniqueIds(part, listKey, at, issues, key = 'id') {
    const seen = new Set();
    items(part, listKey).forEach((x, i) => {
        const v = x[key];
        if (typeof v !== 'string')
            return;
        if (seen.has(v))
            issues.push({ path: `${at}.${listKey}[${i}].${key}`, message: `"${v}" is used twice (ids must be unique)` });
        seen.add(v);
    });
    return seen;
}
export function mustExist(value, known, path, what, issues) {
    if (typeof value === 'string' && !known.has(value))
        issues.push({ path, message: `"${value}" is not a ${what} (known: ${[...known].join(', ')})` });
}
/** A swimlane flow end: 'id', 'id:side' or 'id:side@t' with t from 0 to 1. Anything else would reach the layout as a coordinate that is not a number. */
export const FLOW_END = /^([^:@]+)(?::(?:left|right|top|bottom|center)(?:@(?:0(?:\.\d+)?|1(?:\.0+)?))?)?$/;
export function checkFlowEnd(ref, steps, path, issues) {
    if (typeof ref !== 'string')
        return;
    const m = FLOW_END.exec(ref);
    if (!m) {
        issues.push({ path, message: `"${ref}" must be 'id', 'id:side' or 'id:side@t' (side: left, right, top, bottom, center; t: 0 to 1)` });
        return;
    }
    mustExist(m[1], steps, path, 'step id', issues);
}
export const withoutType = ({ type: _type, ...rest }) => rest;
/** The words the figures write by themselves (legends, headings), for `lang: 'en'`. Japanese is the default of svg-diagram. */
export const LEGEND_EN = {
    'line:solid': 'Solid', 'line:dashed': 'Dashed', 'line:dotted': 'Dotted', 'line:double': 'Double', 'arrow:both': 'Both ways', 'weight:strong': 'Main flow',
    'tone:new': 'New', 'tone:changed': 'Changed', 'tone:removed': 'Out of scope', 'tone:danger': 'Warning', 'tone:muted': 'Supporting', 'tone:accent': 'Emphasis', 'tone:solid': 'Focus', 'tone:solid-danger': 'Critical',
    'role:ude': 'Undesirable effect (UDE)', 'role:root': 'Root cause', 'role:de': 'Desirable effect (DE)', 'role:injection': 'Injection', 'role:precondition': 'Fact of reality', 'role:tipping': 'Tipping point', 'role:trim': 'Trim (injection)', 'role:need': 'Need', 'role:goal': 'Goal', 'role:io': 'Intermediate objective', 'role:obstacle': 'Obstacle', 'role:action': 'Action', 'role:start': 'Start', 'role:risk': 'Risk', 'role:measure': 'Measure',
    'edge:and': 'Causes together (AND)', 'edge:back': 'Feedback', 'edge:blocks': 'Cuts', 'mark:core': 'Core driver',
    'fta-event:basic': 'Basic event', 'fta-event:undeveloped': 'Undeveloped event', 'fta-event:house': 'House event', 'fta-event:condition': 'Condition', 'fta-gate:and': 'AND gate', 'fta-gate:or': 'OR gate', 'fta-gate:vote': 'Voting gate (k/n)', 'fta-gate:inhibit': 'Inhibit gate',
};
/** The options a part takes in English when the spec says `lang: 'en'` and the part does not give them. */
export const PART_EN = {
    gantt: { todayLabel: 'Today' },
    raci: { corner: 'Task / Role', legendLabels: { title: 'Legend', R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' } },
    journeyMap: { corner: 'Lane / Stage' },
    valueChain: { margin: 'Margin', titles: ['Support activities', 'Primary activities'] },
    whyWhyTree: { readingNote: false },
    causeTree: { coreDriverLabel: 'reaches {n} of {total}', coreBadge: 'Core' },
    cloud: { separator: ': ' },
    quadrant: { sizeLegend: 'Bubble area = size' },
};
export const treeItem = (levels) => object({
    label: text('The text of the node.'),
    sub: text('A second, muted line.'),
    tone: EMPHASIS_TONE,
    ...(levels > 0 ? { children: list(treeItem(levels - 1), 12) } : {}),
}, ['label']);
export const flowSteps = (min, max) => list(object({ label: text('The step.', 40), sub: text('A second, muted line.', 60), tone: EMPHASIS_TONE }, ['label']), max, min);
export const pair = (items, description) => ({ type: 'array', items, minItems: 2, maxItems: 2, description });
export const axis = (description) => object({ title: text('The name of the axis.', 30), low: text('The word at the low end.', 20), high: text('The word at the high end.', 20), reversed: { type: 'boolean', description: 'true: high is drawn first (left, or bottom for y).' } }, ['title'], description);
export const QUADRANT_GRID = 4;
export const DATE = { type: 'string', minLength: 10, maxLength: 10, description: 'YYYY-MM-DD.' };
/** A real day written YYYY-MM-DD. */
export const isDay = (v) => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return false;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
export const dayOf = (v) => Date.parse(`${v}T00:00:00Z`) / 86_400_000;
export const whyNode = (levels) => object({
    why: text('The answer to "why?": a fact, written as a statement.', 60),
    trueCause: { enum: [true], description: 'true: a root cause (a double frame).' },
    measure: text('What is done about this root cause.', 60),
    ...(levels > 0 ? { because: list(whyNode(levels - 1), 4) } : {}),
}, ['why']);
export const whySize = (n) => 1 + (n['measure'] !== undefined ? 1 : 0) + items(n, 'because').reduce((k, c) => k + whySize(c), 0);
export const CELL = { oneOf: [text('A cell.', 120), { type: 'number', minimum: -1e12, maximum: 1e12 }] };
export const treeSize = (item) => 1 + items(item, 'children').reduce((n, c) => n + treeSize(c), 0);
/** A number as a chart takes it: finite, and not so large that the axis arithmetic loses it. */
export const NUM = { type: 'number', minimum: -1e12, maximum: 1e12 };
/** A number that is never below 0, such as a count or an amount. */
export const AMOUNT = { type: 'number', minimum: 0, maximum: 1e12 };
/** The tone of a chart mark. */
export const CHART_TONE = oneOf('accent', 'danger', 'muted', 'text');
/** Every list in `lists` of `part` has as many entries as `n`, reported at the list. */
export function sameLength(part, at, n, what, issues, ...paths) {
    for (const p of paths) {
        let v = part;
        for (const k of p)
            v = v?.[k];
        if (Array.isArray(v) && v.length !== n)
            issues.push({ path: `${at}${p.map(k => typeof k === 'number' ? `[${k}]` : `.${k}`).join('')}`, message: `has ${v.length} entries; there are ${n} ${what}` });
    }
}
/** A step / ring / sector named by its 1-based number or its label (or id) (ADR 0065). */
export const STEP_REF = (description) => ({ oneOf: [{ type: 'integer', minimum: 1, maximum: 8 }, { type: 'string', minLength: 1, maxLength: 40 }], description });
/** An issue where `v` is neither a number within `n` nor the label or id of one of `xs`, or is the label or id of two of them (ADR 0065). */
export function refIssue(v, n, xs, path, what, issues) {
    if (v === undefined)
        return;
    const names = xs.flatMap(x => [x['label'], x['id']]).filter((x, i, all) => typeof x === 'string' && all.indexOf(x) === i);
    const named = typeof v === 'number' ? [] : xs.flatMap((x, k) => x['label'] === v || x['id'] === v ? [k + 1] : []);
    if (named.length > 1)
        issues.push({ path, message: `names ${named.length} of the ${what} (${named.join(', ')}: a label or id twice); give its number, or an id of its own` });
    else if (typeof v === 'number' ? v > n : !named.length)
        issues.push({ path, message: `is not one of the ${n} ${what} (a number from 1, or a name: ${names.map(x => JSON.stringify(x)).join(', ') || 'none are named'})` });
}
