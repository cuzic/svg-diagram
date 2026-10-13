import {controlChartOpts} from '../qc-plane.ts';
import {ticksOf} from '../plane.ts';
import {checkSheetParts, matrixParts} from '../qc-table.ts';
import {fmeaParts, journeyMapParts, qfdParts, raciParts} from '../semantic-table.ts';
import {canvasBand} from '../canvas.ts';
import type {CanvasContent, CanvasKey, CanvasOpts, CanvasTemplate, LooseCanvasOpts} from '../canvas.ts';
import type {CheckItem, CheckSheetOpts, MatrixMark, MatrixOpts} from '../qc-table.ts';
import type {FmeaOpts, FmeaRow, JourneyLane, JourneyMapOpts, JourneyStage, QfdDemand, QfdOpts, RaciAssignment, RaciOpts} from '../semantic-table.ts';
import type {AttributeSample, ControlChartOpts, ControlType} from '../qc-plane.ts';
import type {PlaneBand, PlaneOpts, GridBand, TableBand} from '../types.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {plane} from './figures.ts';
import {table} from './sequence-table-swimlane.ts';

/**
 * A control chart (管理図) from the data: the centre line and the limits are worked out (3 sigma), points outside them are red crosses,
 * 7 in a row on one side of the centre line or 7 in a row rising / falling are red rings.
 *   'x' / 'mr'      individual values: the X chart and its moving range (data: number[])
 *   'xbar' / 'r'    subgroups of 2-10 measurements: the mean and the range (data: number[][])
 *   'p' / 'np' / 'u'  attributes per sample: [{n: 200, d: 6}, ...] (n inspected, d defective / defects)
 *   'c'             defects per unit (data: number[])
 *   controlChart('xbar', [[10.1, 10.0, 9.9], [10.2, 10.1, 10.0], ...], {limits: {cl: 10, ucl: 10.4, lcl: 9.6}})
 */
export function controlChart<const Id extends string = never>(type: ControlType, data: readonly (number | number[] | AttributeSample)[], opts?: ControlChartOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function controlChart(type: ControlType, data: readonly (number | number[] | AttributeSample)[], opts: ControlChartOpts = {}): PlaneBand {
  return plane(controlChartOpts(type, data, opts)) as PlaneBand;
}
/**
 * The X-bar chart and the R chart of the same subgroups, one above the other: `diagram().add(...xbarR(subgroups))`. `limits` and `yLabel`
 * can be given for each chart as `{xbar, r}`; a plain value is for the X-bar chart (the R chart keeps its own). `id` is the X-bar chart's.
 */
type PerChart<T> = T | {xbar?: T; r?: T};
export function xbarR(subgroups: readonly number[][], opts: Omit<ControlChartOpts, 'limits' | 'yLabel'> & {id?: string; limits?: PerChart<ControlChartOpts['limits']>; yLabel?: PerChart<string>} = {}): [PlaneBand, PlaneBand] {
  const {id, limits, yLabel, ...rest} = opts;
  const split = <T>(v: PerChart<T> | undefined, what: string): {xbar?: T; r?: T} => {
    const keys = v !== null && typeof v === 'object' ? Object.keys(v) : [];
    if (keys.some(k => k === 'xbar' || k === 'r') && !keys.every(k => k === 'xbar' || k === 'r')) throw new Error(`xbarR(): ${what} mixes xbar / r with other keys (${keys.join(', ')}); write {xbar: ..., r: ...} or one plain value`);
    return keys.length > 0 && keys.every(k => k === 'xbar' || k === 'r') ? v as {xbar?: T; r?: T} : {xbar: v as T | undefined};
  };
  const lim = split(limits, 'limits'), lab = split(yLabel, 'yLabel');
  const o1 = controlChartOpts('xbar', subgroups, {...rest, ...(id === undefined ? {} : {id}), ...(lim.xbar === undefined ? {} : {limits: lim.xbar}), ...(lab.xbar === undefined ? {} : {yLabel: lab.xbar})});
  const o2 = controlChartOpts('r', subgroups, {...rest, ...(lim.r === undefined ? {} : {limits: lim.r}), ...(lab.r === undefined ? {} : {yLabel: lab.r})});
  // the two charts are read down the page, sample by sample: they get the same left margin
  const labels = (o: PlaneOpts): string[] => ticksOf(o.y).map(t => t.label);
  return [plane({...o1, yTickSample: labels(o2)}), plane({...o2, yTickSample: labels(o1)})] as [PlaneBand, PlaneBand];
}
/**
 * A check sheet (チェックシート): the items down the side, the columns (days, machines, shifts) across, a column and a row of totals.
 * Without `counts` it is an empty sheet to fill in by hand (`boxes: true` puts a ☐ in each cell); with them each count is written as
 * tally marks (正丅 = 7; `as: 'number'` for digits, `'both'` for both).
 *   checkSheet([{label: '傷', counts: [3, 5, 2]}, {label: '汚れ', counts: [1, 0, 4]}], ['月', '火', '水'], {corner: '不良の種類'})
 */
export function checkSheet<const Id extends string = never>(items: readonly (string | CheckItem)[], columns: readonly string[], opts?: CheckSheetOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function checkSheet(items: readonly (string | CheckItem)[], columns: readonly string[], opts: CheckSheetOpts = {}): TableBand {
  const p = checkSheetParts(items, columns, opts);
  return table(p.columns, p.rows, p.opts);
}
/**
 * A matrix diagram (マトリックス図, L-shaped): the rows (ideas, causes, requirements) against the columns (criteria, measures) with a
 * ◎ ○ △ × where they relate. `weights` (the importance of each column) adds a row of them and a score per row — Σ weight x value,
 * ◎ 9 / ○ 3 / △ 1 / × 0 unless `values` says otherwise — and the best score is marked.
 *   matrix(['A 案', 'B 案'], ['コスト', '速さ', '品質'], [['○', '◎', '△'], ['◎', '△', '○']], {weights: [5, 3, 4], corner: '案 ＼ 評価'})
 */
export function matrix<const Id extends string = never>(rows: readonly string[], cols: readonly string[], cells: readonly (readonly MatrixMark[])[], opts?: MatrixOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function matrix(rows: readonly string[], cols: readonly string[], cells: readonly (readonly MatrixMark[])[], opts: MatrixOpts = {}): TableBand {
  const p = matrixParts(rows, cols, cells, opts);
  return table(p.columns, p.rows, p.opts);
}
/** A RACI responsibility chart. Every task normally needs exactly one A and at least one R. */
export function raci<const Id extends string = never>(tasks: readonly string[], roles: readonly string[], assignments: readonly (readonly RaciAssignment[])[], opts?: RaciOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function raci(tasks: readonly string[], roles: readonly string[], assignments: readonly (readonly RaciAssignment[])[], opts: RaciOpts = {}): TableBand {
  const p = raciParts(tasks, roles, assignments, opts), band = table(p.columns, p.rows, p.opts);
  if (p.emptyRoles.length) band.semanticWarnings = [`raci(): role column(s) have no assignments: ${p.emptyRoles.join(', ')}`];
  return band;
}
/** Failure mode and effects analysis. RPN is computed as S x O x D. */
export function fmea<const Id extends string = never>(rows: readonly FmeaRow[], opts?: FmeaOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function fmea(rows: readonly FmeaRow[], opts: FmeaOpts = {}): TableBand {
  const p = fmeaParts(rows, opts); return table(p.columns, p.rows, p.opts);
}
/** Quality function deployment: weighted customer demands against quality characteristics. */
export function qfd<const Id extends string = never>(demands: readonly QfdDemand[], characteristics: readonly string[], relations: readonly (readonly MatrixMark[])[], opts?: QfdOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function qfd(demands: readonly QfdDemand[], characteristics: readonly string[], relations: readonly (readonly MatrixMark[])[], opts: QfdOpts = {}): TableBand {
  const p = qfdParts(demands, characteristics, relations, opts); return table(p.columns, p.rows, p.opts);
}
/** Customer journey map. A lane whose id is `emotion` is validated and drawn with numeric, toned status marks. */
export function journeyMap<const Id extends string = never>(stages: readonly (string | JourneyStage)[], lanes: readonly JourneyLane[], opts?: JourneyMapOpts & {id?: Id}): TableBand & Declares<Id> & HandleOf<Id>;
export function journeyMap(stages: readonly (string | JourneyStage)[], lanes: readonly JourneyLane[], opts: JourneyMapOpts = {}): TableBand {
  const p = journeyMapParts(stages, lanes, opts), band = table(p.columns, p.rows, p.opts);
  if (p.emotionCurve) band.rowCurve = p.emotionCurve;
  return band;
}
/**
 * A fixed-region canvas from a named template: 'bmc' (Business Model Canvas), 'lean', 'vpc', 'swot', 'tows', 'errc', 'pest' (PESTLE with
 * `pestle: true`), 'threeC', 'sevenS', 'fiveForces', 'empathy', 'persona', 'a3'. `content` is the text of each region (a string, or an array
 * of short bullets) by region id; a wrong id is a type error (and throws, listing the valid ones). Each region is a box: with `id: 'c'` it
 * is the anchor 'c-<region>' for connect(), reveal and spotlight.
 *   canvas('swot', {strengths: ['技術力'], weaknesses: ['知名度'], opportunities: ['需要増'], threats: ['新規参入']}, {title: '現状分析'})
 */
export function canvas<const T extends CanvasTemplate, const Id extends string = never>(template: T, content: CanvasContent<T>, opts?: CanvasOpts<T> & {id?: Id}): GridBand & Declares<`${Id}-${CanvasKey<T>}`>;
export function canvas(template: CanvasTemplate, content: Record<string, string | readonly string[] | undefined>, opts: LooseCanvasOpts = {}): GridBand {
  return canvasBand(template, content, opts);
}
