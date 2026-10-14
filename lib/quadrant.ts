// quadrant(): a classification matrix — 2x2, 3x3 or any N x M cells between two axes — with items placed in a cell or at a
// coordinate, optional bubble sizes (area proportional to the value), movement arrows and the named presets of management
// frameworks (BCG, GE-McKinsey, Ansoff, the nine-box ...). Everything is placed by this file, so nothing overlaps:
//   * a cell with a caption keeps a header strip; items live below it (a coordinate item is mapped into the body of its cell),
//   * an item without a coordinate is laid out in its cell (a row-wrapped flow, then a search outwards from the centre),
//   * an item that would sit on another item, a label or a caption is moved to the nearest free spot of its own cell; when a cell
//     is too crowded the rows grow (a `height` is a minimum), and when growing does not help the layout throws and says which item.
// The rating of a cell is always written (its title / note), the groups are told apart by shape AND colour, and the size of a bubble
// has a legend: colour is never the only carrier of meaning.
import {textWidth} from './atoms.ts';
import {wrapText} from './wrap.ts';
import type {Anchor, Dimmed, FontFamily, Rect, RevealOpts, Roles, WidthOf} from './types/core.ts';
import type {BoxTone} from './types/text-bands.ts';

// ---------------------------------------------------------------------------------------------------------------------------
// input types
// ---------------------------------------------------------------------------------------------------------------------------

export type QuadrantPreset = 'bcg' | 'ge' | 'ansoff' | 'nineBox' | 'impactEffort' | 'risk' | 'stakeholder' | 'positioning' | 'eisenhower';
export const QUADRANT_PRESETS: readonly QuadrantPreset[] = ['bcg', 'ge', 'ansoff', 'nineBox', 'impactEffort', 'risk', 'stakeholder', 'positioning', 'eisenhower'];

/** An axis: its name, the words at its low / high end, and whether high is drawn first (left / bottom for a reversed y). */
export interface QuadrantAxis {
  title: string;
  /** The end where the values are low (e.g. '低'). */
  low?: string;
  high?: string;
  /** x: high on the left. y: high at the bottom. Item coordinates stay in value space (1 = high), whatever the direction. */
  reversed?: boolean;
}
export type QuadrantTone = BoxTone;
/** One cell: a caption (title, always text), a note under it and a tone. Written as `cells[row][col]`, rows from the top as drawn. */
export interface QuadrantCell {title?: string; note?: string; tone?: QuadrantTone}
export type QuadrantItemTone = 'accent' | 'text' | 'muted' | 'danger';
export interface QuadrantItem {
  /** An anchor for connect() / spotlight. */
  id?: string;
  label: string;
  /** The cell it belongs to, [col, row] counted from the top-left as drawn; laid out inside the cell without overlaps. */
  cell?: [col: number, row: number];
  /** Or its coordinates [x, y], 0..1, in value space (1 = high, whichever way the axis is drawn). */
  at?: [x: number, y: number];
  /** Bubble area is proportional to it. Items without one get the smallest bubble. */
  size?: number;
  tone?: QuadrantItemTone;
  /** Items of one group share a marker shape + colour and are listed in a legend. */
  group?: string;
}
/** An arrow end: an item id or a coordinate [x, y] (value space, 0..1). */
export type QuadrantEnd = string | [x: number, y: number];
/** A movement (portfolio shift): from → to. */
export interface QuadrantArrow {from: QuadrantEnd; to: QuadrantEnd; label?: string; dashed?: boolean}
export interface QuadrantOpts extends RevealOpts {
  /** A spotlight target and a connect() endpoint (the whole figure); each item's id is an anchor too. */
  id?: string;
  /** Fills the axes, grid, captions and tones of a named framework; anything given here overrides it. */
  preset?: QuadrantPreset;
  x?: Partial<QuadrantAxis>;
  y?: Partial<QuadrantAxis>;
  /** [columns, rows]; default 2 x 2, or the shape of `cells`, or the preset's. */
  grid?: [cols: number, rows: number];
  cells?: (QuadrantCell | undefined)[][];
  items?: readonly QuadrantItem[];
  arrows?: readonly QuadrantArrow[];
  /** What the bubble area stands for ('売上'), and its unit ('億円'), for the size legend. */
  sizeTitle?: string;
  sizeUnit?: string;
  /** The order the groups are listed in the legend (default: first use). */
  groups?: readonly string[];
  /** No gaps between the cells: the cells read as one plot cut by a crosshair. */
  crosshair?: boolean;
  /** Least height of the plot (px); the rows grow when the items need more room. */
  height?: number;
  width?: number;
  /** Cells [col, row] (from the top-left as drawn) that are empty on purpose, or true for all: quadrant-empty-cell does not report them. */
  allowEmpty?: true | readonly (readonly [col: number, row: number])[];
}

export interface QuadrantBand {
  type: 'quadrant';
  id?: string;
  reveal?: number;
  until?: number;
  x: QuadrantAxis;
  y: QuadrantAxis;
  cols: number;
  rows: number;
  /** [row][col], every slot filled. */
  cells: QuadrantCell[][];
  items: QuadrantItem[];
  arrows: QuadrantArrow[];
  sizeTitle?: string;
  sizeUnit?: string;
  groups: string[];
  crosshair: boolean;
  height?: number;
  width?: number;
  allowEmpty?: true | [number, number][];
}

// ---------------------------------------------------------------------------------------------------------------------------
// laid-out types
// ---------------------------------------------------------------------------------------------------------------------------

export type QuadrantShape = 'circle' | 'square' | 'diamond' | 'triangle';
export type QuadrantInk = 'text' | 'muted' | 'accent' | 'danger';
export interface QuadrantText {text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; size: number; bold: boolean; fill: QuadrantInk; /** index into bubbles: dims with its bubble */ item?: number}
export interface QuadrantBubble {
  x: number; y: number; /** area radius */ r: number; /** the radius of the circle that holds the shape */ cr: number; shape: QuadrantShape; tone: QuadrantInk;
  /** drawn as an outline (groups 5 to 8) */ hollow: boolean;
  /** index into cells: the cell the item belongs to (verify checks that it stays inside) */ cell: number;
  id?: string; label: string; dim?: boolean;
}
export type QuadrantBoxKind = 'item' | 'arrow' | 'caption' | 'axis' | 'legend';
export interface LaidOutQuadrant extends Rect, Dimmed {
  type: 'quadrant';
  id?: string;
  reveal?: number;
  until?: number;
  plot: Rect;
  crosshair: boolean;
  cells: (Rect & {tone: QuadrantTone})[];
  /** The lines of a crosshair (the inner cell borders). */
  lines: {x1: number; y1: number; x2: number; y2: number}[];
  texts: QuadrantText[];
  bubbles: QuadrantBubble[];
  arrows: {x1: number; y1: number; x2: number; y2: number; dashed: boolean; tip: {dx: number; dy: number}}[];
  /** The backing of an arrow's label. */
  chips: Rect[];
  /** Markers of the legend (a group's shape, a reference bubble). */
  marks: {x: number; y: number; r: number; shape: QuadrantShape; tone: QuadrantInk; ring: boolean; hollow?: boolean}[];
  anchors: Anchor[];
  /** Every text, as a rect: verify.ts reports two that overlap or one that leaves the figure. */
  labelBoxes: (Rect & {label: string; kind: QuadrantBoxKind; /** an item label: index into bubbles */ item?: number})[];
  /** Items that were moved off their coordinates to keep clear of others, with the distance (px). */
  moved: {id?: string; label: string; px: number}[];
  /** Items whose size is so small that the bubble is drawn at the least radius (its area is then larger than the value says). */
  floored: string[];
  /** Cells that hold no item and are not listed in allowEmpty: "title [col, row]", 0-based from the top-left (as allowEmpty takes them). */
  emptyCells: string[];
}

// ---------------------------------------------------------------------------------------------------------------------------
// presets
// ---------------------------------------------------------------------------------------------------------------------------

interface PresetDef {x: QuadrantAxis; y: QuadrantAxis; grid: [number, number]; cells: QuadrantCell[][]; crosshair?: boolean; height?: number}
const c = (title: string, note: string | undefined, tone: QuadrantTone): QuadrantCell => ({title, ...(note ? {note} : {}), tone});

const RISK_RATING = [['低', '低', '中'], ['低', '中', '高'], ['中', '高', '重大']]; // [likelihood-1][impact-1]
const RISK_TONE: Record<string, QuadrantTone> = {低: 'plain', 中: 'changed', 高: 'accent', 重大: 'danger'};
const RISK_NOTE = ['低', '中', '高'], RISK_IMPACT = ['小', '中', '大'];
const riskCells = (): QuadrantCell[][] => [2, 1, 0].map(l => [0, 1, 2].map(i => {
  const rating = RISK_RATING[l][i];
  return c(`リスク ${rating}`, `発生 ${RISK_NOTE[l]} × 影響 ${RISK_IMPACT[i]}`, RISK_TONE[rating]);
}));

const PRESETS: Record<QuadrantPreset, PresetDef> = {
  bcg: {
    x: {title: '相対市場シェア', low: '低', high: '高', reversed: true}, y: {title: '市場成長率', low: '低', high: '高'}, grid: [2, 2],
    cells: [[c('花形', '投資して地位を守る', 'accent'), c('問題児', '選んで育てるか、撤退する', 'changed')], [c('金のなる木', '収穫して他へ回す', 'accent'), c('負け犬', '縮小・撤退を検討する', 'muted')]],
  },
  ge: {
    x: {title: '事業の競争力', low: '弱い', high: '強い', reversed: true}, y: {title: '業界の魅力度', low: '低い', high: '高い'}, grid: [3, 3],
    cells: [
      [c('投資・成長', '魅力 高 × 競争力 強', 'accent'), c('投資・成長', '魅力 高 × 競争力 中', 'accent'), c('選別的投資', '魅力 高 × 競争力 弱', 'changed')],
      [c('投資・成長', '魅力 中 × 競争力 強', 'accent'), c('選別的投資', '魅力 中 × 競争力 中', 'changed'), c('収穫・撤退', '魅力 中 × 競争力 弱', 'muted')],
      [c('選別的投資', '魅力 低 × 競争力 強', 'changed'), c('収穫・撤退', '魅力 低 × 競争力 中', 'muted'), c('収穫・撤退', '魅力 低 × 競争力 弱', 'muted')],
    ],
  },
  ansoff: {
    x: {title: '製品', low: '既存', high: '新規'}, y: {title: '市場', low: '既存', high: '新規', reversed: true}, grid: [2, 2],
    cells: [[c('市場浸透', '既存の市場に既存の製品で攻める', 'accent'), c('新製品開発', '既存の市場に新製品を出す', 'changed')], [c('新市場開拓', '既存の製品を新しい市場へ', 'changed'), c('多角化', '新製品を新しい市場へ（最も高リスク）', 'danger')]],
  },
  // the usual talent grid: performance across (low -> high), potential up (low -> high); the star is top-right
  nineBox: {
    x: {title: '業績', low: '低い', high: '高い'}, y: {title: '潜在能力', low: '低い', high: '高い'}, grid: [3, 3],
    cells: [
      [c('原石', '業績 低 × 潜在 高', 'muted'), c('有望株', '業績 中 × 潜在 高', 'changed'), c('スター', '業績 高 × 潜在 高', 'accent')],
      [c('要改善', '業績 低 × 潜在 中', 'muted'), c('堅実人材', '業績 中 × 潜在 中', 'plain'), c('中核人材', '業績 高 × 潜在 中', 'changed')],
      [c('要対応', '業績 低 × 潜在 低', 'removed'), c('貢献人材', '業績 中 × 潜在 低', 'plain'), c('専門人材', '業績 高 × 潜在 低', 'plain')],
    ],
  },
  impactEffort: {
    x: {title: '実行容易性', low: '難しい', high: '易しい'}, y: {title: 'インパクト', low: '小さい', high: '大きい'}, grid: [2, 2],
    cells: [[c('大型案件', '効果は大きいが難しい。計画して挑む', 'changed'), c('クイックウィン', '効果が大きく易しい。まずやる', 'accent')], [c('後回し', '効果が小さく難しい。手を付けない', 'muted'), c('ついでに', '効果は小さいが易しい。余力で', 'changed')]],
  },
  risk: {x: {title: '影響度', low: '小', high: '大'}, y: {title: '発生可能性', low: '低', high: '高'}, grid: [3, 3], cells: riskCells()},
  stakeholder: {
    x: {title: '関心度', low: '低い', high: '高い'}, y: {title: '影響力', low: '小さい', high: '大きい'}, grid: [2, 2],
    cells: [[c('満足させる', '影響力は大。要望を先に聞く', 'changed'), c('重点管理', '影響力も関心も大。密に連携する', 'accent')], [c('監視', '最小限の労力で見守る', 'muted'), c('情報提供', '関心は大。こまめに知らせる', 'changed')]],
  },
  positioning: {
    x: {title: '価格', low: '安い', high: '高い'}, y: {title: '機能の充実度', low: '少ない', high: '多い'}, grid: [2, 2],
    cells: [[c('', undefined, 'plain'), c('', undefined, 'plain')], [c('', undefined, 'plain'), c('', undefined, 'plain')]], crosshair: true, height: 400,
  },
  eisenhower: {
    x: {title: '緊急度', low: '低い', high: '高い', reversed: true}, y: {title: '重要度', low: '低い', high: '高い'}, grid: [2, 2],
    cells: [[c('今すぐやる', '重要で緊急。自分で片付ける', 'accent'), c('計画してやる', '重要だが急がない。日程に入れる', 'accent')], [c('任せる', '緊急だが重要でない。人に頼む', 'plain'), c('やめる', '重要でも緊急でもない。減らす', 'muted')]],
  },
};

// ---------------------------------------------------------------------------------------------------------------------------
// validation and normalising
// ---------------------------------------------------------------------------------------------------------------------------

const MAX_GRID = 8;
const SHAPES: QuadrantShape[] = ['circle', 'square', 'diamond', 'triangle'];
const GROUP_TONES: QuadrantInk[] = ['accent', 'text', 'danger', 'muted'];
const ITEM_TONES: readonly QuadrantItemTone[] = ['accent', 'text', 'muted', 'danger'];
const CELL_TONES: readonly QuadrantTone[] = ['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'];
/** The radius of the circle that holds a shape of area pi r^2. */
const HOLD: Record<QuadrantShape, number> = {circle: 1, square: 1.26, diamond: 1.26, triangle: 1.56};

/** The marker of the n-th group: a shape and a colour, and from the fifth group on a hollow shape, so that no two groups differ
 *  by colour alone (up to 8). */
const groupStyle = (gi: number): {shape: QuadrantShape; tone: QuadrantInk; hollow: boolean} => ({shape: SHAPES[gi % SHAPES.length], tone: GROUP_TONES[(gi + Math.floor(gi / SHAPES.length)) % GROUP_TONES.length], hollow: gi >= SHAPES.length});

const defined = <T extends object>(o: T | undefined): Partial<T> => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Validates the options, applies the preset and returns the band. Every error names the item / option. */
export function quadrantBand(opts: QuadrantOpts): QuadrantBand {
  if (!opts || typeof opts !== 'object') throw new Error('quadrant({...}) takes an options object');
  if (opts.preset !== undefined && !QUADRANT_PRESETS.includes(opts.preset)) throw new Error(`quadrant(): unknown preset "${opts.preset}" (${QUADRANT_PRESETS.join(' / ')})`);
  const p = opts.preset ? PRESETS[opts.preset] : undefined;
  const shape = opts.grid ?? p?.grid ?? (opts.cells ? [Math.max(2, ...opts.cells.map(r => r.length)), Math.max(1, opts.cells.length)] as [number, number] : [2, 2]);
  const [cols, rows] = shape;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > MAX_GRID || rows > MAX_GRID) throw new Error(`quadrant(): grid must be whole numbers [cols, rows] from 1 to ${MAX_GRID} (got [${cols}, ${rows}])`);
  if (cols * rows < 2) throw new Error('quadrant(): a grid of one cell is not a matrix');
  const axis = (k: 'x' | 'y'): QuadrantAxis => {
    const a = {...p?.[k], ...defined(opts[k])} as Partial<QuadrantAxis>;
    if (!a.title) throw new Error(`quadrant(): axis ${k} needs a title (${k}: {title: '市場成長率', low: '低', high: '高'})`);
    return a as QuadrantAxis;
  };
  const x = axis('x'), y = axis('y');
  // the preset's captions only fit the preset's own grid
  const base = p && p.grid[0] === cols && p.grid[1] === rows ? p.cells : undefined;
  if (opts.cells) {
    if (opts.cells.length > rows) throw new Error(`quadrant(): cells has ${opts.cells.length} rows but the grid has ${rows}`);
    opts.cells.forEach((r, i) => { if (r.length > cols) throw new Error(`quadrant(): cells row ${i + 1} has ${r.length} cells but the grid has ${cols} columns`); });
  }
  const cells: QuadrantCell[][] = Array.from({length: rows}, (_r, r) => Array.from({length: cols}, (_c, k) => {
    const merged = {...base?.[r]?.[k], ...defined(opts.cells?.[r]?.[k])};
    for (const key of ['title', 'note'] as const) if (merged[key] === '') delete merged[key];
    return merged;
  }));
  cells.forEach((row, r) => row.forEach((cell, k) => {
    if (cell.tone !== undefined && !CELL_TONES.includes(cell.tone)) throw new Error(`quadrant(): cell [${k}, ${r}] has tone "${String(cell.tone)}" (${CELL_TONES.join(' / ')})`);
  }));
  const items = (opts.items ?? []).map((it): QuadrantItem => ({...it}));
  const ids = new Set<string>();
  items.forEach((it, i) => {
    const what = `quadrant() item ${i + 1}${it?.label ? ` "${it.label}"` : ''}`;
    if (!it || typeof it.label !== 'string' || !it.label) throw new Error(`${what}: needs a label`);
    if ((it.cell === undefined) === (it.at === undefined)) throw new Error(`${what}: give exactly one of cell: [col, row] or at: [x, y]`);
    if (it.cell) {
      const [cc, rr] = it.cell;
      if (!Number.isInteger(cc) || !Number.isInteger(rr) || cc < 0 || rr < 0 || cc >= cols || rr >= rows) throw new Error(`${what}: cell [${cc}, ${rr}] is outside the ${cols} x ${rows} grid (columns 0..${cols - 1}, rows 0..${rows - 1}, from the top-left)`);
    }
    if (it.at) {
      const ok = Array.isArray(it.at) && it.at.length === 2 && it.at.every(v => typeof v === 'number' && v >= 0 && v <= 1);
      if (!ok) throw new Error(`${what}: at must be [x, y] with both from 0 to 1 (got ${JSON.stringify(it.at)}); 1 is the high end of the axis`);
    }
    if (it.size !== undefined && !(typeof it.size === 'number' && it.size > 0 && Number.isFinite(it.size))) throw new Error(`${what}: size must be a number > 0 (got ${it.size})`);
    if (it.tone !== undefined && !ITEM_TONES.includes(it.tone)) throw new Error(`${what}: tone must be ${ITEM_TONES.join(' / ')} (got ${JSON.stringify(it.tone)})`);
    if (it.group !== undefined && (typeof it.group !== 'string' || !it.group)) throw new Error(`${what}: group must be a non-empty string (got ${JSON.stringify(it.group)})`);
    if (it.id !== undefined) {
      if (ids.has(it.id)) throw new Error(`${what}: the id "${it.id}" is used twice`);
      ids.add(it.id);
    }
  });
  const arrows = (opts.arrows ?? []).map((a): QuadrantArrow => ({...a}));
  arrows.forEach((a, i) => {
    for (const k of ['from', 'to'] as const) {
      const e = a[k];
      if (typeof e === 'string') { if (!ids.has(e)) throw new Error(`quadrant() arrow ${i + 1}: ${k} "${e}" is not the id of an item (items: ${[...ids].join(', ') || 'none have an id'})`); }
      else if (!(Array.isArray(e) && e.length === 2 && e.every(v => typeof v === 'number' && v >= 0 && v <= 1))) throw new Error(`quadrant() arrow ${i + 1}: ${k} must be an item id or [x, y] from 0 to 1`);
    }
  });
  const sizes = items.filter(i => i.size !== undefined);
  if ((opts.sizeTitle !== undefined || opts.sizeUnit !== undefined) && !sizes.length) throw new Error('quadrant(): sizeTitle / sizeUnit describe the bubble sizes, but no item has a size');
  // a bubble without a size would read as a small value: either every item has a size or none has
  const unsized = items.findIndex(i => i.size === undefined);
  if (sizes.length && unsized >= 0) throw new Error(`quadrant() item ${unsized + 1} "${items[unsized].label}": has no size, but other items do — give every item a size (its bubble would read as a small value), or none`);
  const groups = [...(opts.groups ?? [])];
  if (new Set(groups).size !== groups.length) throw new Error(`quadrant(): groups lists a name twice (${groups.join(', ')})`);
  // an item without a group would look like the first group's marker
  const ungrouped = items.findIndex(i => i.group === undefined);
  if (items.some(i => i.group !== undefined) && ungrouped >= 0) throw new Error(`quadrant() item ${ungrouped + 1} "${items[ungrouped].label}": has no group, but other items do — give every item a group (it would look like the first group's marker), or none`);
  for (const it of items) if (it.group !== undefined && !groups.includes(it.group)) groups.push(it.group);
  if (groups.length > SHAPES.length * 2) throw new Error(`quadrant(): ${groups.length} groups — at most ${SHAPES.length * 2} can be told apart by shape and colour`);
  if (opts.allowEmpty !== undefined && opts.allowEmpty !== true && !Array.isArray(opts.allowEmpty)) throw new Error(`quadrant(): allowEmpty must be true or a list of [col, row] cells (got ${JSON.stringify(opts.allowEmpty)})`);
  if (opts.allowEmpty !== undefined && opts.allowEmpty !== true) for (const e of opts.allowEmpty) {
    if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Number.isInteger(e[1]) || e[0] < 0 || e[1] < 0 || e[0] >= cols || e[1] >= rows) throw new Error(`quadrant(): allowEmpty cell ${JSON.stringify(e)} is outside the ${cols} x ${rows} grid (columns 0..${cols - 1}, rows 0..${rows - 1}, from the top-left), or use true`);
  }
  for (const [k, v] of [['height', opts.height], ['width', opts.width]] as const) if (v !== undefined && !(typeof v === 'number' && v > 0 && Number.isFinite(v))) throw new Error(`quadrant(): ${k} must be a finite number > 0 (got ${v})`);
  return {
    type: 'quadrant', ...(opts.id ? {id: opts.id} : {}), ...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until}),
    x, y, cols, rows, cells, items, arrows, groups, crosshair: opts.crosshair ?? p?.crosshair ?? false,
    ...(opts.sizeTitle === undefined ? {} : {sizeTitle: opts.sizeTitle}), ...(opts.sizeUnit === undefined ? {} : {sizeUnit: opts.sizeUnit}),
    height: opts.height ?? p?.height, ...(opts.width === undefined ? {} : {width: opts.width}),
    ...(opts.allowEmpty === undefined ? {} : {allowEmpty: opts.allowEmpty === true ? true : opts.allowEmpty.map(([c, r]) => [c, r] as [number, number])}),
  };
}

/** The anchor ids of the band's items (read before layout, so reveal gives each the figure's stage). */
export const quadrantIds = (b: QuadrantBand): string[] => b.items.flatMap(i => i.id ? [i.id] : []);

// ---------------------------------------------------------------------------------------------------------------------------
// sizes
// ---------------------------------------------------------------------------------------------------------------------------

const fmtNum = (n: number): string => n.toLocaleString('en-US', {maximumFractionDigits: 6});
/** Reference values for the size legend: the largest 1 / 2 / 5 x 10^k not above the biggest size, and a tenth of it. */
export function sizeRefs(max: number): number[] {
  const mag = 10 ** Math.floor(Math.log10(max));
  const v = [5, 2, 1].map(m => m * mag).find(m => m <= max * (1 + 1e-9)) ?? mag;
  return [v, v / 10];
}
const sizeLegendTitle = (b: QuadrantBand): string => `円の面積 = ${b.sizeTitle ?? '大きさ'}`;
const sizeRefLabel = (b: QuadrantBand, v: number): string => `${fmtNum(v)}${b.sizeUnit ?? ''}`;
const maxSize = (b: QuadrantBand): number => Math.max(0, ...b.items.map(i => i.size ?? 0));

/** Every [text, size, weight, font] the figure draws, so the measurer knows them before layout. */
export function quadrantTexts(b: QuadrantBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  const add = (s: string | undefined, size: number, weight = 400) => { if (s) out.push([s, size, weight, 'sans']); };
  for (const a of [b.x, b.y]) { add(a.title, roles.title, 700); add(a.low, roles.note); add(a.high, roles.note); }
  for (const row of b.cells) for (const cell of row) { add(cell.title, roles.title, 700); add(cell.note, roles.note); }
  for (const it of b.items) add(it.label, roles.note);
  for (const a of b.arrows) add(a.label, roles.note);
  for (const g of b.groups) add(g, roles.note);
  const mx = maxSize(b);
  if (mx > 0) { add(sizeLegendTitle(b), roles.note); for (const v of sizeRefs(mx)) add(sizeRefLabel(b, v), roles.note); }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------------------------------------------------------

type Side = 'right' | 'left' | 'below' | 'above' | 'below-right' | 'below-left' | 'above-right' | 'above-left';
const SIDES: Side[] = ['right', 'left', 'below', 'above', 'below-right', 'below-left', 'above-right', 'above-left'];
const FLOW_SIDES: Side[] = ['below', 'right', 'left', 'above', 'below-right', 'below-left', 'above-right', 'above-left'];
const GAP = 4, PAD = 8, MARGIN = 3;
/** The least bubble radius: a smaller size is drawn this big (and reported in `floored`). */
const MIN_R = 6;
/** Bubble centres sit on the 4px grid every other shape of the SVG uses. */
const g4 = (v: number): number => Math.round(v / 4) * 4;

/** Search offsets, nearest first: a fine lattice near the ideal spot, a coarser one further out. */
const OFFSETS: [number, number, number][] = (() => {
  const seen = new Set<string>(), out: [number, number, number][] = [];
  const add = (dx: number, dy: number) => { const k = `${dx},${dy}`; if (!seen.has(k)) { seen.add(k); out.push([dx, dy, Math.hypot(dx, dy)]); } };
  for (let dy = -60; dy <= 60; dy += 4) for (let dx = -60; dx <= 60; dx += 4) add(dx, dy);
  for (let dy = -480; dy <= 480; dy += 8) for (let dx = -480; dx <= 480; dx += 8) add(dx, dy);
  return out.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
})();
/** How far a coordinate item may be moved before the rows grow instead. */
const MAX_MOVE = 56;

const circleRect = (cx: number, cy: number, r: number, b: Rect, m = 0): boolean => {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return Math.hypot(cx - nx, cy - ny) < r + m;
};
const rectsMeet = (a: Rect, b: Rect, m = 0): boolean => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const inside = (a: Rect, b: Rect): boolean => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
/** Does the segment pass within `m` of the rect (sampled every 3px)? */
const segmentMeets = (s: {x1: number; y1: number; x2: number; y2: number}, r: Rect, m = 1): boolean => {
  const n = Math.max(1, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 3));
  for (let i = 0; i <= n; i++) {
    const px = s.x1 + (s.x2 - s.x1) * i / n, py = s.y1 + (s.y2 - s.y1) * i / n;
    if (px >= r.x - m && px <= r.x + r.w + m && py >= r.y - m && py <= r.y + r.h + m) return true;
  }
  return false;
};

interface Unit {
  i: number; item: QuadrantItem; r: number; cr: number; shape: QuadrantShape; tone: QuadrantInk; hollow: boolean;
  lines: string[]; lw: number; lh: number;
  /** the cell it must stay in (as drawn), and where its coordinates put it. */
  col: number; row: number; ideal?: {x: number; y: number};
}
interface Spot {cx: number; cy: number; side: Side; box: Rect}
class Grow extends Error {why: string; constructor(why: string) { super(why); this.why = why; }}

export function layoutQuadrant(band: QuadrantBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutQuadrant {
  const size = roles.note, tSize = roles.title, lineN = size + 4, lineT = tSize + 5;
  const tw = (s: string, sz: number, weight = 400) => textWidth(widthOf, s, sz, weight);
  const wrap = (s: string, sz: number, weight: number, maxW: number): string[] => wrapText(s, {maxWidth: Math.max(20, maxW), atomWidth: a => widthOf(a, sz, weight, 'sans')});
  const widest = (lines: string[], sz: number, weight: number) => Math.max(0, ...lines.map(l => tw(l, sz, weight)));
  const width = Math.min(w, band.width ?? w), left = x + (w - width) / 2;
  const {cols, rows} = band;

  // ---- axes: the y names sit in a gutter left of the plot, the x names in a row under it
  const gutterMax = Math.max(80, Math.min(150, width * 0.2));
  const yTitle = wrap(band.y.title, tSize, 700, gutterMax);
  const gutterW = Math.ceil(Math.max(widest(yTitle, tSize, 700), tw(band.y.high ?? '', size), tw(band.y.low ?? '', size))) + 14;
  const plotL = left + PAD + gutterW, plotR = left + width - PAD, plotW = plotR - plotL;
  const xLeft = (band.x.reversed ? band.x.high : band.x.low) ?? '', xRight = (band.x.reversed ? band.x.low : band.x.high) ?? '';
  if (tw(xLeft, size) + tw(band.x.title, tSize, 700) + tw(xRight, size) + 36 > plotW) throw new Error(`quadrant(): the x axis names do not fit under the plot (${Math.round(plotW)}px): shorten the title / low / high, or widen the figure`);
  const gap = band.crosshair ? 0 : 6;
  const cw = (plotW - gap * (cols - 1)) / cols;
  if (cw < 90) throw new Error(`quadrant(): ${cols} columns leave ${Math.round(cw)}px per cell — fewer columns or a wider figure`);

  // ---- captions: a header strip per row
  const capW = cw - 20;
  const caps = band.cells.map(row => row.map(cell => ({t: cell.title ? wrap(cell.title, tSize, 700, capW) : [], n: cell.note ? wrap(cell.note, size, 400, capW) : []})));
  const hdr = caps.map(row => Math.max(0, ...row.map(k => k.t.length + k.n.length ? 8 + k.t.length * lineT + k.n.length * lineN + 6 : 0)));

  // ---- the items: radius, label lines
  const mx = maxSize(band);
  const groupIndex = (g: string | undefined) => g === undefined ? -1 : band.groups.indexOf(g);
  const baseRow = Math.max(band.height ?? (rows === 2 ? 340 : 120 * rows + 90), 0) / rows;
  const rMax = Math.max(14, Math.min(44, Math.min(cw, baseRow - Math.max(...hdr)) * 0.2));
  const labelW = Math.max(70, Math.min(150, cw * 0.55));
  const units: Unit[] = band.items.map((item, i) => {
    const gi = groupIndex(item.group);
    const shape = gi < 0 ? 'circle' : groupStyle(gi).shape, hollow = gi >= 0 && groupStyle(gi).hollow;
    const tone = item.tone ?? (gi < 0 ? 'accent' : groupStyle(gi).tone);
    const r = item.size === undefined || mx <= 0 ? 8 : Math.max(MIN_R, rMax * Math.sqrt(item.size / mx));
    const lines = wrap(item.label, size, 400, labelW);
    return {i, item, r, cr: r * HOLD[shape], shape, tone, hollow, lines, lw: widest(lines, size, 400), lh: lines.length * lineN, col: 0, row: 0};
  });
  const floored = mx > 0 ? units.filter(u => u.item.size !== undefined && rMax * Math.sqrt(u.item.size / mx) < MIN_R - 0.5).map(u => u.item.label) : [];

  // ---- cell-placed items: a row-wrapped flow per cell (each unit a bubble with its label below); its height sets the row's least height
  const flowW = cw - 16, uw = (u: Unit) => Math.max(2 * u.cr, u.lw), uh = (u: Unit) => 2 * u.cr + GAP + u.lh;
  const flows = new Map<string, {rows: Unit[][]; heights: number[]; total: number}>();
  for (let k = 0; k < cols; k++) for (let r = 0; r < rows; r++) {
    const mine = units.filter(u => u.item.cell && u.item.cell[0] === k && u.item.cell[1] === r);
    if (!mine.length) continue;
    for (const u of mine) if (uw(u) > flowW) throw new Error(`quadrant(): the label "${u.item.label}" is wider than its cell (${Math.round(flowW)}px) — shorten it or widen the figure`);
    const flowRows: Unit[][] = [[]];
    let used = 0;
    for (const u of mine) {
      const cur = flowRows[flowRows.length - 1];
      if (cur.length && used + 12 + uw(u) > flowW) { flowRows.push([u]); used = uw(u); } else { used += (cur.length ? 12 : 0) + uw(u); cur.push(u); }
    }
    const heights = flowRows.map(fr => Math.max(...fr.map(uh)));
    flows.set(`${k},${r}`, {rows: flowRows, heights, total: heights.reduce((a, b) => a + b, 0) + 10 * (flowRows.length - 1)});
  }
  const flowNeed = Array.from({length: rows}, (_r, r) => Math.max(0, ...[...flows.entries()].filter(([key]) => Number(key.split(',')[1]) === r).map(([, f]) => f.total + 12)));

  // ---- one attempt at a layout with the rows grown by `grow`
  const attempt = (grow: number, moveLimit: number) => {
    const plotH0 = Math.max(band.height ?? (rows === 2 ? 340 : 120 * rows + 90), rows * (Math.max(...hdr) + 90));
    const rowH = Array.from({length: rows}, (_r, r) => Math.max(plotH0 / rows * grow, hdr[r] + 90, hdr[r] + flowNeed[r]));
    const plotT = y + PAD, plotH = rowH.reduce((a, b) => a + b, 0) + gap * (rows - 1), plotB = plotT + plotH;
    const rowTop = rowH.map((_h, r) => plotT + rowH.slice(0, r).reduce((a, b) => a + b, 0) + gap * r);
    const cellX = (k: number) => plotL + k * (cw + gap);
    const cellRect = (k: number, r: number): Rect => ({x: cellX(k), y: rowTop[r], w: cw, h: rowH[r]});
    const bodyRect = (k: number, r: number): Rect => ({x: cellX(k), y: rowTop[r] + hdr[r], w: cw, h: rowH[r] - hdr[r]});
    const plot: Rect = {x: plotL, y: plotT, w: plotW, h: plotH};

    // value space -> pixels (a value is mapped into the body of the cell it falls in, so a caption never sits on an item)
    const toCell = (vx: number, vy: number) => {
      const ix = Math.min(cols - 1, Math.floor(vx * cols)), iy = Math.min(rows - 1, Math.floor(vy * rows));
      const fx = vx * cols - ix, fy = vy * rows - iy;
      const col = band.x.reversed ? cols - 1 - ix : ix, row = band.y.reversed ? iy : rows - 1 - iy;
      const b = bodyRect(col, row);
      return {col, row, x: b.x + (band.x.reversed ? 1 - fx : fx) * b.w, y: b.y + (band.y.reversed ? fy : 1 - fy) * b.h};
    };
    const texts: QuadrantText[] = [], labelBoxes: LaidOutQuadrant['labelBoxes'] = [];
    const headers: Rect[] = [];

    // ---- captions
    band.cells.forEach((rowCells, r) => rowCells.forEach((cell, k) => {
      const cap = caps[r][k], cr0 = cellRect(k, r);
      const ink: QuadrantInk = cell.tone === 'accent' ? 'accent' : cell.tone === 'danger' ? 'danger' : 'text';
      let top = cr0.y + 8;
      for (const line of cap.t) { texts.push({text: line, x: cr0.x + 10, y: top + tSize, anchor: 'start', size: tSize, bold: true, fill: ink}); top += lineT; }
      for (const line of cap.n) { texts.push({text: line, x: cr0.x + 10, y: top + size, anchor: 'start', size, bold: false, fill: 'muted'}); top += lineN; }
      if (cap.t.length + cap.n.length) {
        const wd = Math.max(widest(cap.t, tSize, 700), widest(cap.n, size, 400)), box = {x: cr0.x + 10, y: cr0.y + 8, w: wd, h: top - cr0.y - 8};
        headers.push(box);
        labelBoxes.push({...box, label: [...cap.t, ...cap.n].join(' '), kind: 'caption'});
      }
    }));

    // ---- placing items: the bubble and its label are one unit, checked against everything placed before
    const placed: {u: Unit; spot: Spot}[] = [];
    const labelAt = (u: Unit, side: Side, cx: number, cy: number): Rect & {anchor: 'start' | 'middle' | 'end'; tx: number} => {
      const d = u.cr * 0.71 + 2;
      switch (side) {
        case 'right': return {x: cx + u.cr + GAP, y: cy - u.lh / 2, w: u.lw, h: u.lh, anchor: 'start', tx: cx + u.cr + GAP};
        case 'left': return {x: cx - u.cr - GAP - u.lw, y: cy - u.lh / 2, w: u.lw, h: u.lh, anchor: 'end', tx: cx - u.cr - GAP};
        case 'below': return {x: cx - u.lw / 2, y: cy + u.cr + GAP, w: u.lw, h: u.lh, anchor: 'middle', tx: cx};
        case 'above': return {x: cx - u.lw / 2, y: cy - u.cr - GAP - u.lh, w: u.lw, h: u.lh, anchor: 'middle', tx: cx};
        case 'below-right': return {x: cx + d, y: cy + d, w: u.lw, h: u.lh, anchor: 'start', tx: cx + d};
        case 'below-left': return {x: cx - d - u.lw, y: cy + d, w: u.lw, h: u.lh, anchor: 'end', tx: cx - d};
        case 'above-right': return {x: cx + d, y: cy - d - u.lh, w: u.lw, h: u.lh, anchor: 'start', tx: cx + d};
        default: return {x: cx - d - u.lw, y: cy - d - u.lh, w: u.lw, h: u.lh, anchor: 'end', tx: cx - d};
      }
    };
    const inPlot = {x: plotL + MARGIN, y: plotT + MARGIN, w: plotW - 2 * MARGIN, h: plotH - 2 * MARGIN};
    // the bubble and its label stay inside the item's own cell (a mark on a border would read as the other cell's)
    const free = (u: Unit, cx: number, cy: number, box: Rect, extra: {s: {x1: number; y1: number; x2: number; y2: number}}[] = []): boolean => {
      const c0 = cellRect(u.col, u.row), cell = {x: c0.x + MARGIN, y: c0.y + MARGIN, w: c0.w - 2 * MARGIN, h: c0.h - 2 * MARGIN};
      if (cx - u.cr < cell.x || cx + u.cr > cell.x + cell.w || cy - u.cr < cell.y || cy + u.cr > cell.y + cell.h || !inside(box, cell)) return false;
      if (headers.some(hd => rectsMeet(box, hd, 2) || circleRect(cx, cy, u.cr, hd, 2))) return false;
      for (const p of placed) {
        const o = p.u;
        if (Math.hypot(cx - p.spot.cx, cy - p.spot.cy) < u.cr + o.cr + 4) return false;
        if (circleRect(cx, cy, u.cr, p.spot.box, 2) || circleRect(p.spot.cx, p.spot.cy, o.cr, box, 2) || rectsMeet(box, p.spot.box, 2)) return false;
      }
      return !extra.some(e => segmentMeets(e.s, box));
    };
    const tryAt = (u: Unit, cx: number, cy: number, sides: Side[]): Spot | undefined => {
      for (const side of sides) {
        const box = labelAt(u, side, cx, cy);
        if (free(u, cx, cy, box)) return {cx, cy, side, box};
      }
      return undefined;
    };
    const moved: LaidOutQuadrant['moved'] = [];
    const settle = (u: Unit, ax: number, ay: number, sides: Side[], home: Rect, limit: number): Spot | undefined => {
      for (const [dx, dy, dist] of OFFSETS) {
        if (dist > limit) break;
        const cx = ax + dx, cy = ay + dy;
        if (cx < home.x || cx > home.x + home.w || cy < home.y || cy > home.y + home.h) continue; // the centre stays in the body of its own cell
        const s = tryAt(u, cx, cy, sides);
        if (s) return s;
      }
      return undefined;
    };

    for (const u of units) {
      if (u.item.at) { const t = toCell(u.item.at[0], u.item.at[1]); u.col = t.col; u.row = t.row; u.ideal = {x: t.x, y: t.y}; }
      else { [u.col, u.row] = u.item.cell as [number, number]; u.ideal = undefined; }
    }
    // coordinates first: they are where the author put them; the cell-placed items route around them
    for (const u of units.filter(u => u.ideal)) {
      const ideal = u.ideal as {x: number; y: number};
      const s = settle(u, g4(ideal.x), g4(ideal.y), SIDES, bodyRect(u.col, u.row), moveLimit);
      if (!s) throw new Grow(`"${u.item.label}" has no free spot ${moveLimit < 1e6 ? `within ${moveLimit}px of its coordinates` : 'in its cell'}`);
      placed.push({u, spot: s});
      const px = Math.hypot(s.cx - ideal.x, s.cy - ideal.y);
      if (Math.hypot(s.cx - ideal.x, s.cy - ideal.y) > 3) moved.push({id: u.item.id, label: u.item.label, px});
    }
    for (const [key, flow] of flows) {
      const [k, r] = key.split(',').map(Number), body = bodyRect(k, r);
      const {rows: flowRows, heights: rowHs, total} = flow;
      const n = flowRows.reduce((a, fr) => a + fr.length, 0);
      if (total > body.h - 10) throw new Grow(`the cell [${k}, ${r}] cannot hold ${n} item${n > 1 ? 's' : ''}`);
      let top = body.y + (body.h - total) / 2;
      flowRows.forEach((fr, fi) => {
        const rw = fr.reduce((a, u) => a + uw(u), 0) + 12 * (fr.length - 1);
        let cx0 = body.x + (body.w - rw) / 2;
        for (const u of fr) {
          const cx = g4(cx0 + uw(u) / 2), cy = g4(top + u.cr);
          cx0 += uw(u) + 12;
          const s = tryAt(u, cx, cy, ['below']) ?? settle(u, g4(body.x + body.w / 2), g4(body.y + body.h / 2), FLOW_SIDES, body, 1e9);
          if (!s) throw new Grow(`"${u.item.label}" has no free spot in its cell`);
          placed.push({u, spot: s});
        }
        top += rowHs[fi] + 10;
      });
    }
    return {rowH, plotT, plotB, plot, placed, moved, texts, labelBoxes, headers, cellRect, toCell, inPlot, free, labelAt};
  };

  let result: ReturnType<typeof attempt> | undefined, lastWhy = '';
  // first keep every item near its coordinates and grow the rows; as a last resort let a crowded item move anywhere in its cell (the rule quadrant-item-moved says so)
  for (const [limit, tries] of [[MAX_MOVE, 9], [1e9, 4]] as const) {
    for (let k = 0; k < tries && !result; k++) {
      try { result = attempt(1 + k * 0.25, limit); } catch (e) { if (!(e instanceof Grow)) throw e; lastWhy = e.why; }
    }
  }
  if (!result) throw new Error(`quadrant(): ${lastWhy}, even with the rows grown — fewer items, smaller sizes, a wider figure or a coarser grid`);
  const {rowH, plotT, plotB, plot, placed, moved, texts, labelBoxes, cellRect, toCell} = result;
  placed.sort((a, b) => a.u.i - b.u.i);

  // ---- bubbles, anchors
  const bubbles: QuadrantBubble[] = placed.map(({u, spot}) => ({x: spot.cx, y: spot.cy, r: u.r, cr: u.cr, shape: u.shape, tone: u.tone, hollow: u.hollow, cell: u.row * cols + u.col, ...(u.item.id ? {id: u.item.id} : {}), label: u.item.label}));
  const anchors: Anchor[] = placed.flatMap(({u, spot}) => u.item.id ? [{id: u.item.id, x: spot.cx - u.cr, y: spot.cy - u.cr, w: 2 * u.cr, h: 2 * u.cr}] : []);

  // ---- arrows, then every item label that an arrow crosses looks for another side
  const endOf = (e: QuadrantEnd): {x: number; y: number; cr: number} => {
    if (typeof e !== 'string') { const t = toCell(e[0], e[1]); return {x: t.x, y: t.y, cr: 0}; }
    const i = band.items.findIndex(it => it.id === e);
    return {x: bubbles[i].x, y: bubbles[i].y, cr: bubbles[i].cr};
  };
  const arrows: LaidOutQuadrant['arrows'] = [], chips: Rect[] = [];
  const arrowLabels: {text: string; seg: number}[] = [];
  for (const a of band.arrows) {
    const p = endOf(a.from), q = endOf(a.to);
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < p.cr + q.cr + 14) throw new Error(`quadrant(): the arrow ${typeof a.from === 'string' ? a.from : 'from'} → ${typeof a.to === 'string' ? a.to : 'to'} is too short to draw (the two ends are almost the same spot)`);
    const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
    const s = {x1: p.x + ux * (p.cr + 3), y1: p.y + uy * (p.cr + 3), x2: q.x - ux * (q.cr + 3), y2: q.y - uy * (q.cr + 3)};
    arrows.push({...s, dashed: a.dashed ?? false, tip: {dx: ux, dy: uy}});
    if (a.label) arrowLabels.push({text: a.label, seg: arrows.length - 1});
  }
  if (arrows.length) {
    placed.forEach(({u, spot}, pi) => {
      if (!arrows.some(a => segmentMeets(a, spot.box, 2))) return;
      const others = placed.filter((_p, j) => j !== pi);
      const save = placed.splice(0, placed.length, ...others); // test against the others only
      const cands = SIDES.filter(s => s !== spot.side).map(side => ({side, box: result!.labelAt(u, side, spot.cx, spot.cy)}));
      const ok = cands.find(cd => result!.free(u, spot.cx, spot.cy, cd.box, arrows.map(s => ({s}))));
      placed.splice(0, placed.length, ...save);
      if (ok) placed[pi].spot = {...spot, side: ok.side, box: ok.box};
    });
  }

  // ---- item labels (after any move) and the arrow labels
  placed.forEach(({u, spot}, pi) => {
    const lb = result!.labelAt(u, spot.side, spot.cx, spot.cy);
    u.lines.forEach((line, k) => texts.push({text: line, x: lb.tx, y: lb.y + k * lineN + size, anchor: lb.anchor, size, bold: false, fill: 'text', item: pi}));
    labelBoxes.push({x: spot.box.x, y: spot.box.y, w: spot.box.w, h: spot.box.h, label: u.item.label, kind: 'item', item: pi});
  });
  const chipsBusy = (r: Rect): boolean => placed.some(({u, spot}) => circleRect(spot.cx, spot.cy, u.cr, r, 2) || rectsMeet(r, spot.box, 2)) || chips.some(o => rectsMeet(r, o, 2)) || result!.headers.some(hd => rectsMeet(r, hd, 2)) || !inside(r, result!.inPlot);
  for (const al of arrowLabels) {
    const s = arrows[al.seg], lw = tw(al.text, size, 400), cw2 = lw + 10, ch = size + 6;
    let chip: Rect | undefined;
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
      const r: Rect = {x: s.x1 + (s.x2 - s.x1) * t - cw2 / 2, y: s.y1 + (s.y2 - s.y1) * t - ch / 2, w: cw2, h: ch};
      const x0 = Math.floor(r.x / 4) * 4, y0 = Math.floor(r.y / 4) * 4, snapped = {x: x0, y: y0, w: Math.ceil((r.x + r.w) / 4) * 4 - x0, h: Math.ceil((r.y + r.h) / 4) * 4 - y0};
      if (!chipsBusy(snapped)) { chip = snapped; break; }
    }
    if (!chip) throw new Error(`quadrant(): no room for the arrow label "${al.text}" (shorten it, or move the items further apart)`);
    chips.push(chip);
    texts.push({text: al.text, x: chip.x + chip.w / 2, y: chip.y + 3 + size - 1, anchor: 'middle', size, bold: false, fill: 'text'});
    labelBoxes.push({...chip, label: al.text, kind: 'arrow'});
  }

  // ---- cells, axis names
  const cells = band.cells.flatMap((rowCells, r) => rowCells.map((cell, k) => ({...cellRect(k, r), tone: cell.tone ?? 'plain'})));
  const lines: LaidOutQuadrant['lines'] = [];
  if (band.crosshair) {
    for (let k = 1; k < cols; k++) lines.push({x1: plotL + k * cw, y1: plotT, x2: plotL + k * cw, y2: plotB});
    let acc = plotT;
    for (let r = 0; r < rows - 1; r++) { acc += rowH[r]; lines.push({x1: plotL, y1: acc, x2: plotR, y2: acc}); }
  }
  const axisBox = (text: string, sz: number, weight: number, anchor: 'start' | 'middle' | 'end', ax: number, base: number) => {
    const wd = tw(text, sz, weight);
    labelBoxes.push({x: anchor === 'middle' ? ax - wd / 2 : anchor === 'end' ? ax - wd : ax, y: base - sz, w: wd, h: sz + 4, label: text, kind: 'axis'});
  };
  const yx = plotL - 10;
  const topEnd = band.y.reversed ? band.y.low : band.y.high, bottomEnd = band.y.reversed ? band.y.high : band.y.low;
  if (topEnd) { texts.push({text: topEnd, x: yx, y: plotT + size + 4, anchor: 'end', size, bold: false, fill: 'muted'}); axisBox(topEnd, size, 400, 'end', yx, plotT + size + 4); }
  if (bottomEnd) { texts.push({text: bottomEnd, x: yx, y: plotB - 6, anchor: 'end', size, bold: false, fill: 'muted'}); axisBox(bottomEnd, size, 400, 'end', yx, plotB - 6); }
  const ty = (plotT + plotB) / 2 - (yTitle.length * lineT) / 2;
  yTitle.forEach((line, k) => { const base = ty + k * lineT + tSize; texts.push({text: line, x: yx, y: base, anchor: 'end', size: tSize, bold: true, fill: 'text'}); axisBox(line, tSize, 700, 'end', yx, base); });
  const xBase = plotB + 10 + size;
  if (xLeft) { texts.push({text: xLeft, x: plotL, y: xBase, anchor: 'start', size, bold: false, fill: 'muted'}); axisBox(xLeft, size, 400, 'start', plotL, xBase); }
  if (xRight) { texts.push({text: xRight, x: plotR, y: xBase, anchor: 'end', size, bold: false, fill: 'muted'}); axisBox(xRight, size, 400, 'end', plotR, xBase); }
  texts.push({text: band.x.title, x: (plotL + plotR) / 2, y: xBase, anchor: 'middle', size: tSize, bold: true, fill: 'text'});
  axisBox(band.x.title, tSize, 700, 'middle', (plotL + plotR) / 2, xBase);

  // ---- legends: the groups (shape + colour + name), then what the bubble area means
  const marks: LaidOutQuadrant['marks'] = [];
  let cursorY = g4(xBase + 14);
  const legendText = (text: string, lx: number, ly: number, anchor: 'start' | 'middle' | 'end' = 'start') => {
    texts.push({text, x: lx, y: ly + size - 2, anchor, size, bold: false, fill: 'text'});
    const wd = tw(text, size, 400);
    labelBoxes.push({x: anchor === 'end' ? lx - wd : lx, y: ly - 1, w: wd, h: size + 3, label: text, kind: 'legend'});
  };
  if (band.groups.length) {
    let lx = plotL, ly = cursorY;
    for (const [gi, g] of band.groups.entries()) {
      const need = 24 + tw(g, size, 400) + 20;
      if (lx > plotL && lx + need > plotR) { lx = plotL; ly += 26; }
      marks.push({x: g4(lx + 9), y: ly + 8, r: 7, ...groupStyle(gi), ring: false});
      legendText(g, lx + 22, ly);
      lx += need;
    }
    cursorY = ly + 28;
  }
  if (mx > 0) {
    const rowTopY = cursorY, refs = sizeRefs(mx).map(v => ({v, r: Math.max(0, rMax * Math.sqrt(v / mx))})).filter(rf => rf.r >= 5);
    const title = sizeLegendTitle(band);
    let lx = plotL;
    const rowMid = g4(rowTopY + Math.max(rMax, size) + 2);
    legendText(title, lx, rowMid - size / 2 - 1);
    lx += tw(title, size, 400) + 22;
    for (const rf of refs) {
      const label = sizeRefLabel(band, rf.v), need = 2 * rf.r + 8 + tw(label, size, 400) + 22;
      if (lx + need - 22 > plotR) break;
      marks.push({x: g4(lx + rf.r), y: g4(rowMid), r: rf.r, shape: 'circle', tone: 'muted', ring: true});
      legendText(label, lx + 2 * rf.r + 8, rowMid - size / 2 - 1);
      lx += need;
    }
    cursorY = rowMid + Math.max(rMax, size) + 8;
  }
  const h = cursorY - y + PAD - (mx > 0 || band.groups.length ? 6 : 14);

  const taken = new Set(bubbles.map(b => b.cell));
  const allowed = band.allowEmpty;
  const emptyCells = allowed === true ? [] : band.cells.flatMap((rowCells, r) => rowCells.flatMap((cell, k) =>
    taken.has(r * cols + k) || allowed?.some(([c, rr]) => c === k && rr === r) ? [] : [`${cell.title ? `${cell.title} ` : ''}[${k}, ${r}]`]));

  return {
    type: 'quadrant', ...(band.id ? {id: band.id} : {}), x, y, w, h, ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until}),
    plot, crosshair: band.crosshair, cells, lines, texts, bubbles, arrows, chips, marks, anchors, labelBoxes, moved, floored, emptyCells,
  };
}
