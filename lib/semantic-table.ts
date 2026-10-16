// Tables whose cells have domain meaning. Like qc-table.ts, this module only
// computes table() parts; layout and rendering remain the ordinary table band.
import {markOf} from './qc-table.ts';
import type {MatrixMark} from './qc-table.ts';
import type {TextTone} from './types/core.ts';
import {standingHypotheses, unexplained} from './rca-rules.ts';
import type {TableCellSpec, TableColumn, TableOpts, TableRow} from './types/sequence-table-swimlane.ts';

type CommonOpts = Pick<TableOpts, 'title' | 'width' | 'dense' | 'id' | 'reveal' | 'until'>;
export interface SemanticTableParts {columns: TableColumn[]; rows: TableRow[]; opts: TableOpts}

// ---- RACI -------------------------------------------------------------------------------------------------------------------
export type RaciLetter = 'R' | 'A' | 'C' | 'I';
export type RaciAssignment = RaciLetter | `${RaciLetter}/${RaciLetter}` | string;
export interface RaciOpts extends CommonOpts {
  corner?: string;
  /** Permit a task without an Accountable role. The normal exactly-one-A check is otherwise enforced. */
  allowNoA?: boolean;
  /** Add a final row spelling out the four letters. */
  legend?: boolean;
}

const RACI_TONE: Record<RaciLetter, TextTone | undefined> = {R: 'danger', A: 'accent', C: 'muted', I: undefined};
function raciLetters(value: string, task: string, role: string): RaciLetter[] {
  if (typeof value !== 'string') throw new Error(`raci(): assignment for task "${task}" and role "${role}" must be R, A, C, I or a slash-separated combination`);
  const parts = value.trim() === '' ? [] : value.toUpperCase().split('/').map(s => s.trim());
  if (parts.some(x => !['R', 'A', 'C', 'I'].includes(x))) throw new Error(`raci(): assignment for task "${task}" and role "${role}" has unknown letter ${JSON.stringify(value)} (use R / A / C / I)`);
  if (new Set(parts).size !== parts.length) throw new Error(`raci(): assignment for task "${task}" and role "${role}" repeats a letter`);
  return parts as RaciLetter[];
}

export function raciParts(tasks: readonly string[], roles: readonly string[], assignments: readonly (readonly RaciAssignment[])[], opts: RaciOpts = {}): SemanticTableParts & {emptyRoles: string[]} {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error('raci(tasks, roles, assignments) needs at least one task');
  if (!Array.isArray(roles) || roles.length === 0) throw new Error('raci(tasks, roles, assignments) needs at least one role');
  if (assignments.length !== tasks.length) throw new Error(`raci(): assignments has ${assignments.length} rows for ${tasks.length} tasks`);
  const used = roles.map(() => false);
  const rows: TableRow[] = tasks.map((task, i) => {
    if (typeof task !== 'string' || !task.trim()) throw new Error(`raci(): task ${i + 1} needs a non-empty label`);
    const row = assignments[i];
    if (row.length !== roles.length) throw new Error(`raci(): task "${task}" has ${row.length} assignments for ${roles.length} roles`);
    const parsed = row.map((v, j) => raciLetters(v, task, roles[j]));
    parsed.forEach((v, j) => { if (v.length) used[j] = true; });
    const a = parsed.reduce((n, xs) => n + xs.filter(x => x === 'A').length, 0);
    const r = parsed.reduce((n, xs) => n + xs.filter(x => x === 'R').length, 0);
    if ((!opts.allowNoA && a !== 1) || (opts.allowNoA && a > 1)) throw new Error(`raci(): task "${task}" must have exactly one A${opts.allowNoA ? ' (or none with allowNoA)' : ''}; found ${a}`);
    if (r < 1) throw new Error(`raci(): task "${task}" must have at least one R`);
    return [task, ...parsed.map(xs => {
      const text = xs.join('/');
      const key = (xs.includes('A') ? 'A' : xs.includes('R') ? 'R' : xs.includes('C') ? 'C' : 'I') as RaciLetter;
      return {text, align: 'center' as const, bold: xs.includes('A') || xs.includes('R'), tone: RACI_TONE[key]};
    })];
  });
  if (opts.legend) {
    // all four letters always appear: with fewer than four role columns, several entries share a cell
    const entries = ['R: 実行責任', 'A: 説明責任', 'C: 相談先', 'I: 報告先'], per = Math.ceil(entries.length / roles.length);
    rows.push({cells: ['凡例', ...roles.map((_, j) => entries.slice(j * per, (j + 1) * per).join('\n'))], tone: 'muted'});
  }
  const {corner, allowNoA: _a, legend: _l, ...rest} = opts;
  return {columns: [{label: corner ?? 'タスク ＼ 役割', flex: 2, bold: true}, ...roles.map(label => ({label, align: 'center' as const}))], rows, opts: {...rest, rowHeader: true}, emptyRoles: roles.filter((_, i) => !used[i])};
}

// ---- FMEA -------------------------------------------------------------------------------------------------------------------
export interface FmeaRatings {s: number; o: number; d: number}
export interface FmeaRow extends FmeaRatings {
  item: string; mode: string; effect: string; cause: string; action: string;
  /** Ratings after the action. */
  after?: FmeaRatings;
}
export interface FmeaOpts extends CommonOpts {
  sort?: 'rpn'; threshold?: number; midThreshold?: number;
  labels?: Partial<Record<'item' | 'mode' | 'effect' | 'cause' | 'action' | 's' | 'o' | 'd' | 'rpn' | 'afterS' | 'afterO' | 'afterD' | 'afterRpn', string>>;
}
export interface FmeaComputedRow extends FmeaRow {rpn: number; afterRpn?: number}
const rating = (v: number, field: string, row: number): number => {
  if (!(Number.isInteger(v) && v >= 1 && v <= 10)) throw new Error(`fmea(): row ${row + 1} ${field} must be an integer from 1 to 10 (got ${v})`);
  return v;
};
export function fmeaComputed(rows: readonly FmeaRow[]): FmeaComputedRow[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('fmea(rows) needs at least one row');
  return rows.map((r, i) => {
    for (const k of ['item', 'mode', 'effect', 'cause', 'action'] as const) if (typeof r[k] !== 'string') throw new Error(`fmea(): row ${i + 1} ${k} must be text`);
    const s = rating(r.s, 'S', i), o = rating(r.o, 'O', i), d = rating(r.d, 'D', i);
    if (!r.after) return {...r, rpn: s * o * d};
    const as = rating(r.after.s, 'after S', i), ao = rating(r.after.o, 'after O', i), ad = rating(r.after.d, 'after D', i);
    return {...r, rpn: s * o * d, afterRpn: as * ao * ad};
  });
}
export function fmeaParts(input: readonly FmeaRow[], opts: FmeaOpts = {}): SemanticTableParts & {computed: FmeaComputedRow[]} {
  if (opts.sort !== undefined && opts.sort !== 'rpn') throw new Error(`fmea(): sort must be 'rpn' (got ${JSON.stringify(opts.sort)})`);
  const threshold = opts.threshold ?? 100, mid = opts.midThreshold ?? threshold / 2;
  if (!(Number.isFinite(threshold) && threshold > 0)) throw new Error('fmea(): threshold must be a number > 0');
  if (!(Number.isFinite(mid) && mid >= 0 && mid < threshold)) throw new Error('fmea(): midThreshold must be >= 0 and below threshold');
  let computed = fmeaComputed(input);
  if (opts.sort === 'rpn') computed = [...computed].sort((a, b) => b.rpn - a.rpn);
  const highest = Math.max(...computed.map(r => r.rpn));
  const hasAfter = computed.some(r => r.after !== undefined);
  // numeric columns are narrow (about two full-width characters with the after-action group), so their labels break by hand
  const lab = {item: '項目', mode: '故障\nモード', effect: '影響', cause: '原因', action: '対策', s: 'S\n深刻', o: 'O\n発生', d: 'D\n検出', rpn: 'RPN', afterS: '改善\nS', afterO: '改善\nO', afterD: '改善\nD', afterRpn: '改善\nRPN', ...opts.labels};
  // the highest RPN is the worst row: bold only (◎ would read as "excellent")
  const riskCell = (n: number, top = false): TableCellSpec => ({text: String(n), align: 'center', bold: top || n >= threshold, tone: n >= threshold ? 'danger' : n >= mid ? 'accent' : 'muted'});
  const rows: TableRow[] = computed.map(r => [r.item, r.mode, r.effect, r.cause, r.action, r.s, r.o, r.d, riskCell(r.rpn, r.rpn === highest), ...(hasAfter ? [r.after?.s ?? '', r.after?.o ?? '', r.after?.d ?? '', r.afterRpn === undefined ? '' : riskCell(r.afterRpn)] : [])]);
  const columns: TableColumn[] = [lab.item, lab.mode, lab.effect, lab.cause, lab.action].map(label => ({label, flex: 1.5}));
  columns.push(...[lab.s, lab.o, lab.d, lab.rpn].map(label => ({label, align: 'center' as const})));
  if (hasAfter) columns.push(...[lab.afterS, lab.afterO, lab.afterD, lab.afterRpn].map(label => ({label, align: 'center' as const})));
  const {sort: _s, threshold: _t, midThreshold: _m, labels: _l, ...rest} = opts;
  return {columns, rows, opts: rest, computed};
}

// ---- QFD --------------------------------------------------------------------------------------------------------------------
export interface QfdDemand {label: string; importance: number}
export interface QfdOpts extends CommonOpts {corner?: string; highlight?: boolean}
export interface QfdScores {raw: number[]; relative: number[]}
const qfdMark = (m: MatrixMark, where: string) => {
  try { return markOf(m, where); } catch (e) { throw new Error(`qfd(): ${e instanceof Error ? e.message.replace(/^matrix\(\):\s*/, '') : String(e)}`); }
};
export function qfdScores(demands: readonly QfdDemand[], relations: readonly (readonly MatrixMark[])[], characteristicCount: number): QfdScores {
  const normalized = relations.map((r, i) => r.map((m, j) => qfdMark(m, `the relation of "${demands[i]?.label}" x characteristic ${j + 1}`)));
  const value = {best: 9, ok: 3, mid: 1, ng: 0} as const;
  const raw = Array.from({length: characteristicCount}, (_, j) => normalized.reduce((sum, row, i) => sum + (row[j] ? value[row[j]] : 0) * demands[i].importance, 0));
  const total = raw.reduce((a, b) => a + b, 0);
  return {raw, relative: raw.map(v => total ? v * 100 / total : 0)};
}
export function qfdParts(demands: readonly QfdDemand[], characteristics: readonly string[], relations: readonly (readonly MatrixMark[])[], opts: QfdOpts = {}): SemanticTableParts & {scores: QfdScores} {
  if (!demands.length) throw new Error('qfd(demands, characteristics, relations) needs at least one demand');
  if (!characteristics.length) throw new Error('qfd(demands, characteristics, relations) needs at least one characteristic');
  if (relations.length !== demands.length) throw new Error(`qfd(): relations has ${relations.length} rows for ${demands.length} demands`);
  demands.forEach((d, i) => { if (!d.label?.trim()) throw new Error(`qfd(): demand ${i + 1} needs a label`); if (!(Number.isFinite(d.importance) && d.importance >= 0)) throw new Error(`qfd(): importance of "${d.label}" must be a number >= 0`); });
  const marks = relations.map((r, i) => { if (r.length !== characteristics.length) throw new Error(`qfd(): demand "${demands[i].label}" has ${r.length} relations for ${characteristics.length} characteristics`); return r.map((m, j) => qfdMark(m, `the relation of "${demands[i].label}" x "${characteristics[j]}"`)); });
  const scores = qfdScores(demands, relations, characteristics.length), top = Math.max(...scores.raw), unique = top > 0 && scores.raw.filter(x => x === top).length === 1;
  const rows: TableRow[] = demands.map((d, i) => [d.label, d.importance, ...marks[i].map(m => m ? {text: '', mark: m, align: 'center' as const} : {text: '', align: 'center' as const})]);
  // the top score is bold + accent, not ◎: ◎ already means a strong (9) relation in this table
  rows.push({cells: ['得点', '', ...scores.raw.map((n): TableCellSpec => unique && n === top && opts.highlight !== false ? {text: String(n), bold: true, tone: 'accent', align: 'center'} : {text: String(n), align: 'center'})], tone: 'muted'});
  rows.push({cells: ['相対 %', '', ...scores.relative.map(n => ({text: n.toFixed(1), align: 'center' as const}))], tone: 'muted'});
  const {corner, highlight: _h, ...rest} = opts;
  return {columns: [{label: corner ?? '要求品質', flex: 2, bold: true}, {label: '重要度', align: 'center'}, ...characteristics.map(label => ({label, align: 'center' as const}))], rows, opts: {...rest, rowHeader: true}, scores};
}

// ---- customer journey -------------------------------------------------------------------------------------------------------
export interface JourneyStage {label: string}
export interface JourneyLane {id: string; label: string; cells: readonly (string | number)[]}
export interface JourneyMapOpts extends CommonOpts {corner?: string; emotionRange?: readonly [number, number]}
export function journeyMapParts(stagesIn: readonly (string | JourneyStage)[], lanes: readonly JourneyLane[], opts: JourneyMapOpts = {}): SemanticTableParts & {emotionCurve?: {row: number; values: number[]; min: number; max: number}} {
  if (!stagesIn.length) throw new Error('journeyMap(stages, lanes) needs at least one stage');
  if (!lanes.length) throw new Error('journeyMap(stages, lanes) needs at least one lane');
  const stages = stagesIn.map((s, i) => typeof s === 'string' ? s : s.label);
  if (stages.some(s => !s?.trim())) throw new Error('journeyMap(): every stage needs a non-empty label');
  const range = opts.emotionRange ?? [-2, 2];
  if (!(range.length === 2 && Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[0] < range[1])) throw new Error('journeyMap(): emotionRange must be [min, max] with min < max');
  const seen = new Set<string>();
  let emotionCurve: {row: number; values: number[]; min: number; max: number} | undefined;
  const rows: TableRow[] = lanes.map((lane, i) => {
    if (!lane.id?.trim() || !lane.label?.trim()) throw new Error(`journeyMap(): lane ${i + 1} needs id and label`);
    if (seen.has(lane.id)) throw new Error(`journeyMap(): duplicate lane id "${lane.id}"`); seen.add(lane.id);
    if (lane.cells.length !== stages.length) throw new Error(`journeyMap(): lane "${lane.label}" has ${lane.cells.length} cells for ${stages.length} stages`);
    if (lane.id !== 'emotion') return [lane.label, ...lane.cells];
    const values = lane.cells.map((v, j): number => {
      if (!(typeof v === 'number' && Number.isFinite(v) && v >= range[0] && v <= range[1])) throw new Error(`journeyMap(): emotion at stage "${stages[j]}" must be a number from ${range[0]} to ${range[1]} (got ${String(v)})`);
      return v;
    });
    emotionCurve = {row: i, values, min: range[0], max: range[1]};
    return {h: 80, cells: [lane.label, ...values.map((v): TableCellSpec => {
      const mid = (range[0] + range[1]) / 2;
      return {text: `${v > 0 ? '+' : ''}${v}`, align: 'center', vAlign: 'top', bold: v !== mid, tone: v > mid ? 'accent' : v < mid ? 'danger' : 'muted', mark: v > mid ? 'best' : v < mid ? 'ng' : 'mid'};
    })]};
  });
  const {corner, emotionRange: _r, ...rest} = opts;
  return {columns: [{label: corner ?? 'レーン ＼ ステージ', flex: 1.6, bold: true}, ...stages.map(label => ({label, align: 'center' as const}))], rows, opts: {...rest, rowHeader: true}, ...(emotionCurve ? {emotionCurve} : {})};
}

// ---- IS / IS NOT (Kepner-Tregoe problem specification, ADR 0026 D2) ---------------------------------------------------------
export type IsIsNotDim = 'what' | 'where' | 'when' | 'extent' | (string & {});
export interface IsIsNotInputRow {dim: IsIsNotDim; is: string; isNot: string; /** What sets IS apart from IS NOT. */ distinct?: string; /** What changed recently, around that difference (a different question). */ change?: string}
export interface IsIsNotOpts extends CommonOpts {labels?: Partial<Record<'dim' | 'is' | 'isNot' | 'distinct' | 'change', string>>}
const DIM_LABELS: Record<string, string> = {what: '何に（対象・欠陥）', where: 'どこで', when: 'いつ', extent: '程度（大きさ・数）'};
export const isIsNotDimLabel = (dim: string): string => DIM_LABELS[dim] ?? dim;

function checkIsIsNotRows(rows: readonly IsIsNotInputRow[], who: string): void {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${who}(rows) needs at least one row`);
  rows.forEach((r, i) => {
    if (!r || typeof r.dim !== 'string' || !r.dim.trim()) throw new Error(`${who}(): row ${i + 1} needs a dim ('what' | 'where' | 'when' | 'extent', or your own heading)`);
    for (const k of ['is', 'isNot'] as const) if (typeof r[k] !== 'string') throw new Error(`${who}(): row ${i + 1} (${r.dim}) ${k} must be text`);
    for (const k of ['distinct', 'change'] as const) if (r[k] !== undefined && typeof r[k] !== 'string') throw new Error(`${who}(): row ${i + 1} (${r.dim}) ${k} must be text`);
  });
}

export function isIsNotParts(rows: readonly IsIsNotInputRow[], opts: IsIsNotOpts = {}): SemanticTableParts {
  checkIsIsNotRows(rows, 'isIsNot');
  const lab = {dim: '観点', is: 'IS（である）', isNot: 'IS NOT（であってもおかしくないが、ない）', distinct: '違い', change: '変化', ...opts.labels};
  const {labels: _l, ...rest} = opts;
  return {
    columns: [{label: lab.dim, flex: 1, bold: true}, {label: lab.is, flex: 2}, {label: lab.isNot, flex: 2}, {label: lab.distinct, flex: 2}, {label: lab.change, flex: 2}],
    rows: rows.map(r => [isIsNotDimLabel(r.dim), r.is, r.isNot, r.distinct ?? '', r.change ?? '']),
    opts: rest,
  };
}

export interface IsIsNotHypothesisInput {text: string; /** One per row of the specification: can this cause explain that row's IS and IS NOT? */ results: readonly ('yes' | 'ifAssumed' | 'no')[]; assumes?: readonly string[]}
export interface IsIsNotTestsOpts extends CommonOpts {labels?: Partial<Record<'hypothesis' | 'unexplained' | 'assumptions' | 'fewest', string>>}
const RESULT_TEXT = {yes: '説明できる', ifAssumed: '仮定すれば', no: 'できない'} as const;

export function isIsNotTestsParts(rows: readonly IsIsNotInputRow[], hypotheses: readonly IsIsNotHypothesisInput[], opts: IsIsNotTestsOpts = {}): SemanticTableParts & {hypotheses: IsIsNotHypothesisInput[]} {
  checkIsIsNotRows(rows, 'isIsNotTests');
  if (!Array.isArray(hypotheses) || hypotheses.length === 0) throw new Error('isIsNotTests(rows, hypotheses) needs at least one hypothesis');
  hypotheses.forEach((h, i) => {
    if (!h || typeof h.text !== 'string' || !h.text.trim()) throw new Error(`isIsNotTests(): hypothesis ${i + 1} needs a text`);
    const results = h.results as readonly string[] | undefined;
    if (!Array.isArray(results) || results.length !== rows.length) throw new Error(`isIsNotTests(): hypothesis "${h.text}" has ${Array.isArray(results) ? results.length : 'no'} results for ${rows.length} rows (one per row of the specification)`);
    results.forEach((r: string, j: number) => { if (!Object.hasOwn(RESULT_TEXT, r)) throw new Error(`isIsNotTests(): hypothesis "${h.text}", row ${j + 1}: result must be 'yes' | 'ifAssumed' | 'no' (got ${JSON.stringify(r)})`); });
    if (h.assumes !== undefined && (!Array.isArray(h.assumes) || (h.assumes as readonly unknown[]).some(a => typeof a !== 'string' || !a.trim()))) throw new Error(`isIsNotTests(): hypothesis "${h.text}": assumes is a list of texts`);
    if (h.results.includes('ifAssumed') && !h.assumes?.length) throw new Error(`isIsNotTests(): hypothesis "${h.text}" has 'ifAssumed' results but no assumes (what has to be assumed?)`);
  });
  const lab = {hypothesis: '仮説（原因の候補）', unexplained: '説明できない行', assumptions: '仮定の数', fewest: '最少の仮定', ...opts.labels};
  const {standing, fewest} = standingHypotheses(hypotheses);
  const columns: TableColumn[] = [{label: lab.hypothesis, flex: 3}, ...rows.map(r => ({label: isIsNotDimLabel(r.dim), align: 'center' as const, flex: 1.5})), {label: lab.unexplained, align: 'center'}, {label: lab.assumptions, align: 'center'}];
  const body: TableRow[] = hypotheses.map((h, i) => {
    const bold = standing.has(i); // a row that explains everything: bold and in words (the figure does not choose the cause)
    const note = [h.assumes?.length ? `仮定: ${h.assumes.join('、')}` : '', fewest.has(i) ? lab.fewest : ''].filter(Boolean);
    const cell = (text: string, align?: 'center'): TableCellSpec => ({text, bold, ...(align ? {align} : {})});
    return [cell([h.text, ...note].join('\n')), ...(h.results as readonly ('yes' | 'ifAssumed' | 'no')[]).map(r => cell(RESULT_TEXT[r], 'center')), cell(String(unexplained(h)), 'center'), cell(String(h.assumes?.length ?? 0), 'center')];
  });
  const {labels: _l, ...rest} = opts;
  return {columns, rows: body, opts: rest, hypotheses: [...hypotheses]};
}

// ---- why-why (ADR 0026 D3, the table) ---------------------------------------------------------------------------------------
export interface WhyWhyChain {whys: readonly string[]; /** The root cause this chain ends in (a sentence). */ trueCause?: string; /** What is done about the root cause. */ measure?: string}
export interface WhyWhyTableOpts extends CommonOpts {labels?: Partial<Record<'problem' | 'why' | 'trueCause' | 'measure', string>>}

export function whyWhyTableParts(problem: string, chains: readonly WhyWhyChain[], opts: WhyWhyTableOpts = {}): SemanticTableParts {
  if (typeof problem !== 'string' || !problem.trim()) throw new Error('whyWhyTable(problem, chains) needs the problem as text');
  if (!Array.isArray(chains) || chains.length === 0) throw new Error('whyWhyTable(problem, chains) needs at least one chain');
  chains.forEach((c, i) => {
    if (!c || !Array.isArray(c.whys) || c.whys.length === 0) throw new Error(`whyWhyTable(): chain ${i + 1} needs whys (the answers to "なぜ?", one per step)`);
    (c.whys as readonly unknown[]).forEach((w, j) => { if (typeof w !== 'string' || !w.trim()) throw new Error(`whyWhyTable(): chain ${i + 1}, why ${j + 1} needs text`); });
    for (const k of ['trueCause', 'measure'] as const) if (c[k] !== undefined && typeof c[k] !== 'string') throw new Error(`whyWhyTable(): chain ${i + 1} ${k} must be text`);
  });
  const n = Math.max(...chains.map(c => c.whys.length));
  const lab = {problem: '問題', why: 'なぜ', trueCause: '真因', measure: '対策', ...opts.labels};
  const columns: TableColumn[] = [{label: lab.problem, flex: 1.5, bold: true}, ...Array.from({length: n}, (_, i) => ({label: `${lab.why} ${i + 1}`, flex: 1.5})), {label: lab.trueCause, flex: 1.5}, {label: lab.measure, flex: 1.5}];
  const rows: TableRow[] = chains.map(c => [
    problem,
    ...Array.from({length: n}, (_, i) => c.whys[i] ?? ''),
    {text: c.trueCause ?? '', bold: true, tone: 'accent'} as TableCellSpec,
    c.measure ?? '',
  ]);
  const {labels: _l, ...rest} = opts;
  return {columns, rows, opts: rest};
}
