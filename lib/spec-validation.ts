import {EMOJI_RE} from './tokens.ts';
import {MAX_ISSUES, MAX_QUOTED, items} from './spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from './spec-kit.ts';

/** Control characters (a line break too: every field is one line) and what XML forbids. */
const UNDRAWABLE = /[\p{Cc}\p{Cs}\ufffe\uffff]/u;
/** A value from the input, at a length a message can carry: a bad spec must not make the answer huge. */
const clip = (s: string): string => s.length <= MAX_QUOTED ? s : `${s.slice(0, MAX_QUOTED)}…`;
const describe = (v: unknown): string => v === undefined ? 'nothing' : v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : clip(JSON.stringify(v));
export const join = (at: string, key: string): string => at ? `${at}.${clip(key)}` : clip(key);

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
  const hit = objects.find(b => (b.required ?? []).every(k => Object.hasOwn(o, k))) ?? (objects.length === 1 ? objects[0] : undefined); // one object form: its own issues say what is missing
  if (hit) { validate(hit, v, at, out); return; }
  out.push({path: at, message: `must have the fields of one of these forms: ${objects.map(b => (b.required ?? []).join(' + ')).join(' / ')}`});
}

/** What the emitter draws as emoji, so a character cannot be cheap to the count and costly to draw. */
const EMOJI_ALL = new RegExp(EMOJI_RE.source, 'gu');
export function countEmoji(v: unknown): number {
  if (typeof v === 'string') return v.match(EMOJI_ALL)?.length ?? 0;
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + countEmoji(x), 0);
  return typeof v === 'object' && v !== null ? Object.values(v).reduce((n: number, x) => n + countEmoji(x), 0) : 0;
}

export function totalText(v: unknown): number {
  if (typeof v === 'string') return v.length;
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + totalText(x), 0);
  return typeof v === 'object' && v !== null ? Object.values(v).reduce((n: number, x) => n + totalText(x), 0) : 0;
}

/** The ids that become anchors of the figure, against each other across parts (a repeat inside a part is reported by that part). */
export function checkAnchors(parts: readonly Json[], issues: SpecIssue[], partOf: (type: unknown) => PartDef | undefined): void {
  const first = new Map<string, number>();
  parts.forEach((part, i) => {
    const def = partOf(part['type']), key = def?.anchors, at = `parts[${i}]`;
    if (!key) return;
    const ids = typeof key === 'function' ? key(part, at) : items(part, key).flatMap((x, j) => typeof x['id'] === 'string' ? [{id: x['id'], path: `${at}.${key}[${j}].id`}] : []);
    for (const {id: v, path} of ids) {
      const seen = first.get(v);
      if (seen === undefined) first.set(v, i);
      else if (seen !== i) issues.push({path, message: `"${v}" is already used in parts[${seen}] (ids must be unique in the figure)${def?.anchorsHint ? `: ${def.anchorsHint}` : ''}`});
    }
  });
}

export const capped = (issues: SpecIssue[]): SpecIssue[] => issues.length <= MAX_ISSUES ? issues : [...issues.slice(0, MAX_ISSUES), {path: '', message: `and ${issues.length - MAX_ISSUES} more of the same kind: fix these first`}];
/** The schema check alone (no part rules), for inputs that hold specs, such as a deck (lib/deck-spec.ts). */
export function validateAgainst(schema: JsonSchema, value: unknown, at = ''): SpecIssue[] {
  const out: SpecIssue[] = [];
  validate(schema, value, at, out);
  return out;
}
