import {sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import {MAX_ISSUES, items} from './spec-kit.ts';
import type {Json, SpecIssue} from './spec-kit.ts';
import {join} from './spec-validation.ts';
import type {RenderChecks} from './svg-lint.ts';
import type {Issue, Verdict} from './types/verdicts.ts';

export const messageOf = (e: unknown): string => e instanceof Error ? e.message : String(e);

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
export function locateIn(v: unknown, at: string, message: string): string | null {
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

/** The field a message names, searching within its source part when marked. */
export function locateMessage(spec: unknown, message: string, loc?: SourceRef): string | null {
  return locateMessageWithSources(spec, message, loc);
}

function locateMessageWithSources(spec: unknown, message: string, loc?: SourceRef, related: readonly SourceRef[] = []): string | null {
  const parts = (spec as Json)['parts'] as unknown[];
  for (const ref of [loc, ...related]) {
    const at = ref?.specPath;
    if (at === undefined) continue;
    const index = Number(/^parts\[(\d+)\]$/.exec(at)?.[1]);
    const part = parts[index];
    if (part === undefined) continue;
    const path = linkOf([part], message, index) ?? locateIn(part, at, message);
    // Several matching fields can resolve to the part itself. Keep looking for a field.
    if (path !== null && path !== at) return path;
  }
  if (loc?.specPath !== undefined) return loc.specPath;
  const link = linkOf(parts, message);
  if (link) return link;
  const quoted = locateIn(spec, '', message);
  if (quoted) return quoted;
  if (parts.length === 1) return 'parts[0]';
  // a builder or layout message starts with the part's name: `swimlane(): 40 columns ...`
  const named = /^(\w+)\(/.exec(message)?.[1];
  const same = parts.flatMap((p, i) => (p as Json)['type'] === named ? [i] : []);
  return same.length === 1 ? `parts[${same[0]}]` : null;
}

/** A message about `connect(a:side -> b:side)`: the board link (ADR 0069 D4) that made it, when exactly one link joins a to b. */
const CONNECT_OF = /^connect\(([^\s:@]+)(?::\w+)?(?:@[\d.]+)? -> ([^\s:@)]+)/;
function linkOf(parts: readonly unknown[], message: string, firstIndex = 0): string | null {
  const m = CONNECT_OF.exec(message);
  if (!m) return null;
  const hits = parts.flatMap((p, i) => (p as Json)['type'] !== 'board' ? [] : items(p as Json, 'links').flatMap((l, j) => l['from'] === m[1] && l['to'] === m[2] ? [`parts[${firstIndex + i}].links[${j}]`] : []));
  return hits.length === 1 ? hits[0] as string : null;
}

/** The DSL's advice names options a spec does not have; this is the same advice in the fields a spec does have. */
const LABEL_HAS_NO_ROOM = / \(widen the gap between the boxes, shorten the label, or label a longer leg with route: 'elbow'\)$/;
const LABEL_ADVICE = 'Shorten or drop this label, raise colGap, or leave an empty column between the two steps.';
const COLUMNS_TOO_NARROW = /^(swimlane\(\): \d+ columns leave only -?\d+px each)\b.*$/s;
const COLUMNS_ADVICE = 'Lower colGap or use fewer columns.';
/** A figure too narrow for its band (flow-shapes.ts): a spec has no width, so only the rest of the advice (fewer sectors or steps, the circle). */
const WIDEN_DIAGRAM = /widen the diagram \(diagram\(\{width: \d+\}\) or more\), /;
/** An area of a board too narrow: a spec gives no diagram({width}) to widen it, but areas can take more rows. */
const AREA_TOO_NARROW = /^(areas: area "[^"]*" is only \d+px wide \(at least \d+px\)): .*$/s;
const AREA_ADVICE = 'Put the nodes in more rows (areas), give this column a larger share (cols), or use a smaller gap.';
function inSpecTerms(message: string): {message: string; fix?: string} {
  if (AREA_TOO_NARROW.test(message)) return {message: message.replace(AREA_TOO_NARROW, '$1'), fix: AREA_ADVICE};
  if (WIDEN_DIAGRAM.test(message)) return {message: message.replace(WIDEN_DIAGRAM, '')};
  if (LABEL_HAS_NO_ROOM.test(message)) return {message: message.replace(LABEL_HAS_NO_ROOM, ''), fix: LABEL_ADVICE};
  if (COLUMNS_TOO_NARROW.test(message)) return {message: message.replace(COLUMNS_TOO_NARROW, '$1'), fix: COLUMNS_ADVICE};
  return {message};
}

/** Why a figure could not be laid out, at its place and in the fields a spec has. */
export function layoutIssue(spec: unknown, error: unknown): SpecIssue {
  const raw = messageOf(error), loc = error instanceof Error ? sourceOf(error) : undefined;
  const {message, fix} = inSpecTerms(raw);
  return {path: locateMessage(spec, raw, loc) ?? '', message: fix ? `${message}. ${fix}` : message};
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
  const issues: Issue[] = verdict.issues ?? verdict.problems.map(message => ({message}));
  return {
    problems: issues.map(({message, loc}) => ({path: locateMessage(spec, message, loc), ...inSpecTerms(message), severity: 'problem' as const})),
    findings: verdict.findings.map(f => ({path: locateMessageWithSources(spec, f.message, f.loc, f.related), message: f.message, rule: f.rule, severity: f.severity, ...(f.data?.fix ? {fix: f.data.fix} : {})})),
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
