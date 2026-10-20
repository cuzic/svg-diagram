// canvas(): a fixed-region canvas (Business Model Canvas, SWOT, 7S, five forces ...) from a named template. A canvas is a grid() whose
// boxes sit in the cells of the template (columns / rows they span), so every region is an ordinary box: it can be an anchor,
// be revealed, spotlighted, linted and checked like one. This file holds the templates, the validation and the pure geometry;
// layout.ts only places the boxes.
import type {CanvasLayout, GridBand} from './types/containers.ts';
import type {EmphasisTone} from './types/core.ts';
import type {BoxBand} from './types/text-bands.ts';

import {must} from './must.ts';
interface Region {
  id: string;
  title: string;
  col: number;
  row: number;
  cs?: number;
  rs?: number;
  /** Not counted by requireAll (a header cell that may stay a bare label, a free-form extra). */
  optional?: boolean;
  /** A pill on the box's top edge: says in words what a tone only hints (内部環境 / ハード). */
  tag?: string;
  tone?: EmphasisTone;
}
interface Template {
  cols: readonly number[];
  rows: readonly number[];
  /** Height / width the canvas keeps with `fit: 'aspect'` (the old look: a canvas looks like a form, not a stack of notes). */
  aspect: number;
  gap?: number;
  regions: readonly Region[];
  /** Regions that are only labels (no content key). */
  labels?: readonly Region[];
}

const R = <const I extends string>(id: I, title: string, col: number, row: number, cs = 1, rs = 1, extra: Partial<Region> = {}): Region & {id: I} => ({id, title, col, row, cs, rs, ...extra} as Region & {id: I});

// the nine-block shape shared by the Business Model Canvas and the Lean Canvas (10 columns, so a box spans 2 and the bottom two span 5)
const NINE = <const I extends readonly string[]>(ids: I, t: readonly string[]): (Region & {id: I[number]})[] => ([
  R(ids[0] as I[number], must(t[0]), 0, 0, 2, 2), R(ids[1] as I[number], must(t[1]), 2, 0, 2), R(ids[2] as I[number], must(t[2]), 2, 1, 2), R(ids[3] as I[number], must(t[3]), 4, 0, 2, 2), R(ids[4] as I[number], must(t[4]), 6, 0, 2), R(ids[5] as I[number], must(t[5]), 6, 1, 2), R(ids[6] as I[number], must(t[6]), 8, 0, 2, 2), R(ids[7] as I[number], must(t[7]), 0, 2, 5), R(ids[8] as I[number], must(t[8]), 5, 2, 5),
]);

export const TEMPLATES = {
  bmc: {
    cols: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], rows: [1, 1, 0.8], aspect: 0.62,
    regions: NINE(['partners', 'activities', 'resources', 'value', 'relationships', 'channels', 'segments', 'cost', 'revenue'],
      ['主要パートナー', '主要活動', '主要リソース', '提供価値', '顧客との関係', 'チャネル', '顧客セグメント', 'コスト構造', '収益の流れ']),
  },
  lean: {
    cols: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], rows: [1, 1, 0.8], aspect: 0.62,
    regions: NINE(['problem', 'solution', 'metrics', 'uvp', 'unfair', 'channels', 'segments', 'cost', 'revenue'],
      ['課題', 'ソリューション', '主要指標', '独自の価値提案', '圧倒的な優位性', 'チャネル', '顧客セグメント', 'コスト構造', '収益の流れ']),
  },
  vpc: {
    cols: [1, 1], rows: [0.45, 1, 1, 1], aspect: 0.7, gap: 12,
    labels: [R('', '価値提案（バリューマップ）', 0, 0, 1, 1, {tone: 'muted', tag: '提供する側'}), R('', '顧客プロフィール', 1, 0, 1, 1, {tone: 'muted', tag: '求める側'})],
    regions: [
      R('gainCreators', 'ゲイン・クリエイター（嬉しさを作る）', 0, 1), R('gains', 'ゲイン（得たい成果）', 1, 1),
      R('products', '製品・サービス', 0, 2), R('jobs', 'ジョブ（片付けたい用事）', 1, 2),
      R('painRelievers', 'ペイン・リリーバー（悩みを取る）', 0, 3), R('pains', 'ペイン（困りごと）', 1, 3),
    ],
  },
  swot: {
    cols: [1, 1], rows: [1, 1], aspect: 0.5,
    regions: [
      R('strengths', '強み（Strengths）', 0, 0, 1, 1, {tag: '内部環境・プラス'}), R('weaknesses', '弱み（Weaknesses）', 1, 0, 1, 1, {tag: '内部環境・マイナス'}),
      R('opportunities', '機会（Opportunities）', 0, 1, 1, 1, {tag: '外部環境・プラス'}), R('threats', '脅威（Threats）', 1, 1, 1, 1, {tag: '外部環境・マイナス'}),
    ],
  },
  tows: {
    cols: [0.8, 1.6, 1.6], rows: [0.7, 1.2, 1.2], aspect: 0.62,
    regions: [
      R('strengths', '強み（S）', 1, 0, 1, 1, {optional: true, tag: '内部'}), R('weaknesses', '弱み（W）', 2, 0, 1, 1, {optional: true, tag: '内部'}),
      R('opportunities', '機会（O）', 0, 1, 1, 1, {optional: true, tag: '外部'}), R('threats', '脅威（T）', 0, 2, 1, 1, {optional: true, tag: '外部'}),
      R('so', 'SO 積極策（強みで機会をつかむ）', 1, 1), R('wo', 'WO 改善策（弱みを機会で補う）', 2, 1),
      R('st', 'ST 差別化策（強みで脅威をかわす）', 1, 2), R('wt', 'WT 防衛策（最悪を避ける）', 2, 2),
    ],
  },
  errc: {
    cols: [1, 1], rows: [1, 1], aspect: 0.5,
    regions: [
      R('eliminate', '－ 取り除く（Eliminate）', 0, 0), R('raise', '▲ 増やす（Raise）', 1, 0),
      R('reduce', '▼ 減らす（Reduce）', 0, 1), R('create', '＋ 付け加える（Create）', 1, 1),
    ],
  },
  pest: {
    cols: [1, 1], rows: [1, 1], aspect: 0.5,
    regions: [
      R('political', '政治（Politics）', 0, 0), R('economic', '経済（Economy）', 1, 0),
      R('social', '社会（Society）', 0, 1), R('technological', '技術（Technology）', 1, 1),
    ],
  },
  threeC: {
    cols: [1, 1, 1], rows: [1, 0.5], aspect: 0.5,
    regions: [
      R('customer', '顧客（Customer）', 0, 0), R('competitor', '競合（Competitor）', 1, 0), R('company', '自社（Company）', 2, 0),
      R('insight', '示唆（勝てるポイント）', 0, 1, 3, 1, {optional: true, tone: 'accent', tag: '結論'}),
    ],
  },
  sevenS: {
    // a hexagon of six around the shared values: hard S along the top and the right, soft S along the bottom and the left
    cols: [1, 1, 1, 1], rows: [1, 1.1, 1], aspect: 0.8, gap: 12,
    regions: [
      R('strategy', '戦略（Strategy）', 0, 0, 2, 1, {tag: 'ハード'}), R('structure', '組織構造（Structure）', 2, 0, 2, 1, {tag: 'ハード'}),
      R('style', '経営スタイル（Style）', 0, 1, 1, 1, {tag: 'ソフト', tone: 'muted'}), R('values', '共通の価値観（Shared Values）', 1, 1, 2, 1, {tone: 'accent', tag: '中心'}), R('systems', '制度・仕組み（Systems）', 3, 1, 1, 1, {tag: 'ハード'}),
      R('staff', '人材（Staff）', 0, 2, 2, 1, {tag: 'ソフト', tone: 'muted'}), R('skills', 'スキル（Skills）', 2, 2, 2, 1, {tag: 'ソフト', tone: 'muted'}),
    ],
  },
  fiveForces: {
    cols: [1, 1.2, 1], rows: [1, 1.1, 1], aspect: 0.7, gap: 16,
    regions: [
      R('newEntrants', '▼ 新規参入の脅威', 1, 0), R('suppliers', '▶ 売り手の交渉力（供給者）', 0, 1), R('rivalry', '業界内の競争（競合との敵対関係）', 1, 1, 1, 1, {tone: 'accent', tag: '中心'}),
      R('buyers', '◀ 買い手の交渉力（顧客）', 2, 1), R('substitutes', '▲ 代替品の脅威', 1, 2),
    ],
  },
  empathy: {
    cols: [1, 1, 1, 1, 1, 1], rows: [1, 1.3, 1, 1.1], aspect: 0.85,
    regions: [
      R('thinks', '考えていること（Thinks）', 0, 0, 6), R('says', '言っていること（Says）', 0, 1, 2), R('person', '対象のユーザー', 2, 1, 2, 1, {optional: true, tone: 'accent', tag: '中心'}),
      R('does', 'していること（Does）', 4, 1, 2), R('feels', '感じていること（Feels）', 0, 2, 6), R('pains', 'ペイン（痛み・不安）', 0, 3, 3), R('gains', 'ゲイン（望み・期待）', 3, 3, 3),
    ],
  },
  persona: {
    cols: [1, 1, 1, 1, 1, 1], rows: [1, 1.2, 1], aspect: 0.6,
    regions: [
      R('profile', 'プロフィール', 0, 0, 2, 2, {tone: 'accent', tag: '中心'}), R('quote', '口ぐせ・ひとこと', 2, 0, 4), R('goals', '目標（Goals）', 2, 1, 2), R('frustrations', '不満・障害（Frustrations）', 4, 1, 2),
      R('behaviors', '行動・習慣', 0, 2, 3), R('needs', 'ニーズ（求めていること）', 3, 2, 3),
    ],
  },
  a3: {
    cols: [1, 1], rows: [1, 1, 1, 1], aspect: 0.9,
    regions: [
      R('background', '1. 背景（なぜ取り上げるか）', 0, 0), R('current', '2. 現状（事実とデータ）', 0, 1), R('goal', '3. 目標（いつまでに何を）', 0, 2), R('cause', '4. 原因分析（なぜなぜ）', 0, 3),
      R('countermeasures', '5. 対策（何をするか）', 1, 0, 1, 2), R('plan', '6. 実施計画（誰が・いつ）', 1, 2), R('followup', '7. 効果の確認とフォロー', 1, 3),
    ],
  },
} as const satisfies Record<string, Template>;

export type CanvasTemplate = keyof typeof TEMPLATES;
type PestleKeys = 'legal' | 'environmental';
/** The region ids of a template (the keys of its content). */
export type CanvasKey<T extends CanvasTemplate> = (typeof TEMPLATES)[T]['regions'][number]['id'] | (T extends 'pest' ? PestleKeys : never);
export type CanvasContent<T extends CanvasTemplate> = {[K in CanvasKey<T>]?: string | readonly string[]};

export interface CanvasOpts<T extends CanvasTemplate = CanvasTemplate> {
  /** A caption above the canvas. */
  title?: string;
  /** Region titles, where the Japanese default does not fit your subject. */
  titles?: {[K in CanvasKey<T>]?: string};
  /** A tone per region. */
  tone?: {[K in CanvasKey<T>]?: EmphasisTone};
  /** Regions to stress: drawn as tone 'accent' with a 重点 pill (the word says it, not just the colour). */
  emphasis?: readonly CanvasKey<T>[];
  /** A chip at the bottom-right corner of the canvas (架空の例 / 仮説). */
  stamp?: string;
  /** The regions (not the title above them) are at least this tall (px). Content that needs more throws (shorten it or leave `h` out: without it the canvas grows). */
  h?: number;
  /** How tall the canvas is. 'content' (default): each row is as tall as its regions need (at least 96px for a region that is meant to be filled), so no region carries a blank
   *  band under its text. 'aspect': the canvas keeps the template's height / width as a floor (the old look: a roomy form to write into). `h` works with both. */
  fit?: 'content' | 'aspect';
  /** Gap between the regions (px, rounded to a multiple of 4; the rows under a tagged region keep at least 16px). */
  gap?: number;
  /** Every region needs content: a missing one is reported as canvas-region-empty. */
  requireAll?: boolean;
  /** pest only: add 法律 (Legal) and 環境 (Environment): PESTLE. Also on when `legal` or `environmental` has content. */
  pestle?: T extends 'pest' ? boolean : never;
  /** Click stage per region (see diagram({reveal})): {value: 1, segments: 2}. */
  reveal?: {[K in CanvasKey<T>]?: number};
  /** An anchor id: each region is then `${id}-${region}` for connect(), reveal and spotlight. */
  id?: string;
}

const PESTLE_EXTRA: readonly Region[] = [R('legal', '法律（Legal）', 0, 2), R('environmental', '環境（Environment）', 1, 2)];

export const canvasKeys = (template: CanvasTemplate, pestle = false): string[] => [...TEMPLATES[template].regions.map(r => r.id), ...(template === 'pest' && pestle ? PESTLE_EXTRA.map(r => r.id) : [])];
export const canvasTemplates = (): string[] => Object.keys(TEMPLATES);

const item = (s: unknown, where: string): string => {
  if (typeof s !== 'string' || !s.trim()) throw new Error(`canvas(): ${where} must be a non-empty string (got ${JSON.stringify(s)})`);
  return s.trim();
};
// a mark the author already put in front of a bullet: ・ / • stand alone, - and * only with a space after them (so "-5%" and "*注" keep
// their sign and star)
const BULLET = /^(?:[・･•]\s*|[-*]\s+)/;
const TONES: readonly string[] = ['plain', 'accent', 'danger', 'muted', 'new', 'changed', 'removed', 'solid', 'solid-danger'];
const OPT_KEYS: readonly string[] = ['title', 'titles', 'tone', 'emphasis', 'stamp', 'h', 'fit', 'gap', 'requireAll', 'pestle', 'reveal', 'id'];

/** CanvasOpts with the region ids as plain strings: what canvasBand() validates. */
export type LooseCanvasOpts = Omit<CanvasOpts, 'titles' | 'tone' | 'reveal' | 'emphasis' | 'pestle'> & {pestle?: boolean; titles?: Record<string, string | undefined>; tone?: Record<string, EmphasisTone | undefined>; reveal?: Record<string, number | undefined>; emphasis?: readonly string[]};
/** The grid() a canvas is: one box per region, in the template's order, with its cell. */
export function canvasBand(template: string, content: Record<string, string | readonly string[] | undefined>, opts: LooseCanvasOpts = {}): GridBand {
  if (!Object.hasOwn(TEMPLATES, template)) throw new Error(`canvas(template): unknown template ${JSON.stringify(template)} (use ${canvasTemplates().join(' | ')})`);
  const t = TEMPLATES[template as CanvasTemplate] as Template;
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error(`canvas("${template}", content): content is an object of region id -> text(s)`);
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) throw new Error(`canvas("${template}", content, opts): opts is an object`);
  for (const k of Object.keys(opts)) if (!OPT_KEYS.includes(k)) throw new Error(`canvas("${template}"): unknown option "${k}" (options: ${OPT_KEYS.join(', ')})`);
  for (const k of ['titles', 'tone', 'reveal'] as const) if (opts[k] !== undefined && (typeof opts[k] !== 'object' || opts[k] === null || Array.isArray(opts[k]))) throw new Error(`canvas({${k}}) is an object of region id -> value`);
  if (opts.emphasis !== undefined && !Array.isArray(opts.emphasis)) throw new Error(`canvas({emphasis}) is an array of region ids (got ${JSON.stringify(opts.emphasis)})`);
  if (opts.requireAll !== undefined && typeof opts.requireAll !== 'boolean') throw new Error('canvas({requireAll}) is true or false');
  const given = Object.keys(content).filter(k => content[k] !== undefined);
  const pestleKeys = given.filter(k => (['legal', 'environmental'] as string[]).includes(k));
  if (opts.pestle !== undefined && typeof opts.pestle !== 'boolean') throw new Error('canvas({pestle}) is true or false');
  if (opts.pestle && template !== 'pest') throw new Error(`canvas({pestle}) is for the 'pest' template only`);
  if (opts.pestle === false && pestleKeys.length) throw new Error(`canvas("pest"): pestle is false but ${pestleKeys.join(' / ')} has content (drop pestle: false to draw PESTLE)`);
  const pestle = template === 'pest' && (opts.pestle === true || pestleKeys.length > 0);
  const regions: Region[] = [...t.regions, ...(pestle ? PESTLE_EXTRA : [])];
  const valid = regions.map(r => r.id);
  const known = (k: string, what: string): void => { if (!valid.includes(k)) throw new Error(`canvas("${template}"): ${what} "${k}" is not a region of this template (regions: ${valid.join(', ')})`); };
  for (const k of Object.keys(content)) known(k, 'content key');
  for (const k of Object.keys(opts.titles ?? {})) known(k, 'titles key');
  for (const k of Object.keys(opts.tone ?? {})) known(k, 'tone key');
  for (const k of Object.keys(opts.reveal ?? {})) known(k, 'reveal key');
  for (const k of opts.emphasis ?? []) known(k, 'emphasis region');
  for (const [k, v] of Object.entries(opts.tone ?? {})) if (v !== undefined && !TONES.includes(v)) throw new Error(`canvas({tone}): ${k} is ${JSON.stringify(v)}, not one of ${TONES.join(', ')}`);
  if (opts.fit !== undefined && opts.fit !== 'content' && opts.fit !== 'aspect') throw new Error(`canvas({fit}) is 'content' or 'aspect' (got ${JSON.stringify(opts.fit)})`);
  if (opts.h !== undefined && !(Number.isFinite(opts.h) && opts.h > 0)) throw new Error(`canvas({h}) must be a number > 0 (got ${opts.h})`);
  if (opts.gap !== undefined && !(Number.isFinite(opts.gap) && opts.gap >= 0)) throw new Error(`canvas({gap}) must be a number >= 0 (got ${opts.gap})`);
  if (opts.id !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(opts.id)) throw new Error(`canvas({id}) is letters, digits, _ and - (got ${JSON.stringify(opts.id)})`);
  if (opts.title !== undefined && (typeof opts.title !== 'string' || !opts.title.trim())) throw new Error('canvas({title}) must be a non-empty string');

  const children: BoxBand[] = [], place: CanvasLayout['place'] = [], empty: string[] = [], worded: boolean[] = [], floor: boolean[] = [];
  const emphasis = new Set<string>(opts.emphasis ?? []);
  // 'tows': the SWOT headers hold facts too, so the 'person' / header cells are labels when they have no content
  regions.forEach(r => {
    const raw = content[r.id];
    if (raw !== undefined && !Array.isArray(raw) && typeof raw !== 'string') throw new Error(`canvas(): "${r.id}" is a string or an array of strings`);
    const items = raw === undefined ? [] : (typeof raw === 'string' ? [raw] : [...raw]).map((s, i) => item(s, `${r.id}[${i}]`));
    if (!items.length && !r.optional) empty.push(r.id);
    const title = opts.titles?.[r.id];
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) throw new Error(`canvas(): titles.${r.id} must be a non-empty string`);
    const tone = emphasis.has(r.id) ? 'accent' : opts.tone?.[r.id] ?? r.tone;
    const single = typeof raw === 'string';
    const box: BoxBand = {
      type: 'box', title: title?.trim() ?? r.title,
      ...(single ? {body: items[0]} : items.length ? {lines: items.map((s, i) => {
        const bare = s.replace(BULLET, '');
        if (!bare.trim() || /^[-*]$/.test(s)) throw new Error(`canvas(): ${r.id}[${i}] is only a bullet mark (${JSON.stringify(s)}): write the point after it`);
        return `・${bare}`;
      })} : {}),
      ...(tone ? {tone} : {}),
      ...(emphasis.has(r.id) ? {tag: r.tag ? `重点・${r.tag}` : '重点', tagTone: 'accent' as const} : r.tag ? {tag: r.tag, tagTone: 'muted' as const} : {}),
      ...(opts.id ? {id: `${opts.id}-${r.id}`} : {}),
      ...(opts.reveal?.[r.id] !== undefined ? {reveal: opts.reveal[r.id]} : {}),
    };
    if (opts.reveal?.[r.id] !== undefined && !(Number.isInteger(opts.reveal[r.id]) && (opts.reveal[r.id] as number) >= 1)) throw new Error(`canvas({reveal}): ${r.id} must be a whole stage >= 1`);
    children.push(box);
    floor.push(items.length > 0 || !r.optional);
    worded.push(!!box.tag && (emphasis.has(r.id) || opts.tone?.[r.id] === undefined));
    place.push({col: r.col, row: r.row, cs: r.cs ?? 1, rs: r.rs ?? 1});
  });
  // the label cells (a header that names a side, no content)
  for (const l of t.labels ?? []) {
    if (!l.title) continue;
    children.push({type: 'box', title: l.title, tone: l.tone ?? 'muted', ...(l.tag ? {tag: l.tag, tagTone: 'muted' as const} : {})});
    worded.push(!!l.tag);
    floor.push(false);
    place.push({col: l.col, row: l.row, cs: l.cs ?? 1, rs: l.rs ?? 1});
  }
  if (opts.stamp !== undefined) {
    if (typeof opts.stamp !== 'string' || !opts.stamp.trim()) throw new Error(`canvas({stamp}) must be a non-empty string (got ${JSON.stringify(opts.stamp)})`);
    // the stamp belongs to the canvas: it sits in the bottom row's right-most box (the corner box, or, when the corner cell is empty
    // as in fiveForces, the box nearest to it)
    const lastRow = Math.max(...place.map(p => p.row + p.rs));
    let i = -1;
    place.forEach((p, k) => { if (p.row + p.rs === lastRow && (i < 0 || p.col + p.cs > must(place[i]).col + must(place[i]).cs)) i = k; });
    children[i] = {...must(children[i]), stamp: opts.stamp.trim()};
  }
  const rows = Math.max(...place.map(p => p.row + p.rs));
  const colW = [...t.cols], rowW = Array.from({length: rows}, (_, i) => t.rows[i] ?? 1);
  return {
    // the gap is a multiple of 4: the regions' edges stay on the 4px grid (see canvasColumns)
    type: 'grid', children, cols: colW.length, gap: Math.round((opts.gap ?? t.gap ?? 12) / 4) * 4,
    canvas: {template, place, worded, floor, colW, rowW, aspect: t.aspect, fit: opts.fit ?? 'content', ...(opts.h === undefined ? {} : {h: opts.h}), ...(opts.title ? {title: opts.title.trim()} : {}), empty, requireAll: opts.requireAll === true},
  };
}

/** The least height of a region that is meant to be filled (fit 'content'): a row never collapses to its title and one line. Label cells and optional regions left empty have no floor. */
export const CANVAS_MIN_ROW_H = 96;

// ---- geometry (pure) -----------------------------------------------------------------------------------------------------------

/**
 * The x and width of every column of a canvas `cw` wide whose left edge is `x0`. Column starts are on the 4px grid the emitter snaps
 * shapes to (gap is a multiple of 4), so the gutters are all `gap` wide and a region spanning columns lines up with the ones it spans.
 */
export function canvasColumns(c: CanvasLayout, x0: number, cw: number, gap: number): {x: number[]; w: number[]} {
  const total = c.colW.reduce((a, b) => a + b, 0), room = cw - gap * (c.colW.length - 1), n = c.colW.length;
  const x: number[] = [];
  let at = x0;
  c.colW.forEach((v, i) => { x.push(i === 0 ? x0 : Math.round(at / 4) * 4); at += room * v / total + gap; });
  const w = x.map((v, i) => (i + 1 < n ? must(x[i + 1]) - gap : x0 + cw) - v);
  return {x, w};
}
/** The left edge and width of the cell `p` covers. */
export function canvasSpan(cols: {x: number[]; w: number[]}, p: {col: number; cs: number}): {x: number; w: number} {
  const last = p.col + p.cs - 1;
  return {x: must(cols.x[p.col]), w: must(cols.x[last]) + must(cols.w[last]) - must(cols.x[p.col])};
}

/**
 * The height of every row, from what each cell needs: a row is as tall as its tallest single-row cell; a cell spanning rows that needs more
 * than they give widens them equally; and the whole is at least `minTotal`, shared by the rows' weights (a row that needs more keeps it).
 */
export function canvasRowHeights(c: CanvasLayout, needs: readonly number[], gap: number, minTotal: number): number[] {
  const n = c.rowW.length, rows = new Array<number>(n).fill(0);
  const cells = c.place.map((p, i) => ({...p, need: needs[i] ?? 0}));
  for (const k of [...new Set(cells.map(p => p.rs))].sort((a, b) => a - b)) {
    for (const p of cells.filter(q => q.rs === k)) {
      const have = rows.slice(p.row, p.row + k).reduce((a, b) => a + b, 0) + gap * (k - 1);
      if (p.need > have) for (let r = p.row; r < p.row + k; r++) rows[r] = must(rows[r]) + (p.need - have) / k;
    }
  }
  const room = minTotal - gap * (n - 1), fixed = new Set<number>();
  for (let guard = 0; guard < n + 1; guard++) {
    const free = [...rows.keys()].filter(r => !fixed.has(r)), left = room - [...fixed].reduce((a, r) => a + must(rows[r]), 0), fw = free.reduce((a, r) => a + must(c.rowW[r]), 0);
    if (!free.length || left <= 0) break;
    const over = free.find(r => must(rows[r]) > left * must(c.rowW[r]) / fw);
    if (over === undefined) { for (const r of free) rows[r] = Math.max(must(rows[r]), left * must(c.rowW[r]) / fw); break; }
    fixed.add(over);
  }
  return rows;
}
