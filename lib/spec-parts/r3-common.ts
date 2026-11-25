import {items, mustExist, oneOf, withoutType} from '../spec-kit.ts';
import type {Json, JsonSchema, SpecIssue} from '../spec-kit.ts';

/** Nodes and arrows of the graph figures below. Their layouts search orders of the whole graph: these keep the worst allowed input near 2 s on a worker. */
export const MAX_BPMN_NODES = 30;
export const MAX_BPMN_FLOWS = 40;
export const MAX_CLASSES = 15;
export const MAX_CLASS_RELATIONS = 24;
export const MAX_PERT_TASKS = 20;
export const MAX_DEPENDENCY_NODES = 20;
export const MAX_DEPENDENCY_EDGES = 32;

/** A hidden marker the English defaults carry into build(): a few parts compute words of their own. */
export const EN_MARK = '_lang';
export const english = (part: Json): boolean => part[EN_MARK] === 'en';
export const withoutMarks = (part: Json): Json => { const {[EN_MARK]: _l, ...rest} = withoutType(part); return rest; };

/** The ids of `part[listKey]` that a path of `edgeKey` items names, checked at their places. */
export function checkEnds(part: Json, at: string, listKey: string, known: ReadonlySet<string>, what: string, issues: SpecIssue[], keys: readonly string[] = ['from', 'to']): void {
  items(part, listKey).forEach((e, i) => { for (const k of keys) mustExist(e[k], known, `${at}.${listKey}[${i}].${k}`, what, issues); });
}

/** The first cycle through `edges` (as ids, the first repeated at the end), or null. */
export function cycleOf(ids: readonly string[], edges: readonly (readonly [string, string])[]): string[] | null {
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
export const TL_DATE: JsonSchema = {type: 'string', minLength: 4, maxLength: 10, description: "'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'."};
export const TL_END: JsonSchema = {oneOf: [TL_DATE, {type: 'number', minimum: -1e9, maximum: 1e9}], description: 'A date (the date form) or a number (the number form).'};
export const TL_TONE = oneOf('accent', 'danger', 'muted');
export const DAY_MS = 86_400_000;
/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' as days, or null when it is not a real date. */
export function tlDay(v: unknown): number | null {
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
export const DATE_KEYS = ['now', 'deadline', 'marks', 'span', 'remaining'] as const;
export const NUMBER_KEYS = ['unit', 'step', 'lanes', 'events', 'spans'] as const;

export function checkTimeline(part: Json, at: string, issues: SpecIssue[]): void {
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
