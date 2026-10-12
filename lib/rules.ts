// Diagram rules ("svg-diagram check"): semantic checks that need the diagram model, not
// the rendered pixels — accessibility contrast, legend completeness, lane order, edge
// crossings, density. Each finding is {rule, severity: 'warn' | 'info', message}.
//
// Why these rules (web research, 2026-10): every diagram needs a legend for its notation
// and should be understandable on its own (C4 notation guide); lane order is the cheapest
// way to cut crossings and hand-offs across lanes are worth counting (swimlane guides);
// edge crossings are the most harmful layout flaw (Purchase 2002); text 4.5:1 and graphic
// objects 3:1, and never colour alone (WCAG 1.4.1 / 1.4.3 / 1.4.11); a short alt text plus
// a longer description (Google developer style guide).

import {PALETTE, STRONG_STROKE, wcagRatio, runColorOf, toneStyle} from './tokens.ts';
import {resolveTextColor, resolveBoxStyle} from './emit.ts';
import {budgetWarnings} from './budget.ts';
import {barsValuesHidden} from './bars.ts';
import {fmt} from './plane.ts';
import {dimmedBands} from './spotlight.ts';
import type {
  ArrowWeight, Band, BarsBand, BoxBand, EmphasisTone, DiagramData, Finding, LaidOutBand, LaidOutBox, LaidOutConnect, LegendBand, LegendItem,
  LineStyle, Point, RuleId, SwimlaneBand, WfCallout,
} from './types.ts';
import type {LintTarget} from './types.ts';

export const RULE_DOCS = {
  'a11y-text-contrast': 'テキストと背景のコントラスト比が WCAG の 4.5:1 未満',
  'a11y-color-only-emphasis': '色だけで強調した語がある（太字も併用する。色が見えない読者にも伝わるように）',
  'a11y-nontext-contrast': '意味を持つ枠線・線のコントラスト比が 3:1 未満（色以外の手がかりも併用する）',
  'a11y-no-title': 'SVG の <title> に使える題名が見つからない（diagram({title}) を指定）',
  'bars-values-hidden': '値ラベルも目盛りも出さない bars があるのに、図の題名（SVG の <title>）がなく、値を読み上げる <desc> が届かない（doc 媒体）',
  'bars-thin-bar': '棒が 1px 以下（値は 0 でない）。図の高さ・幅を上げるか max を見直す',
  'source-wraps': '出典行（diagram({sourceLine})）が 1 行に収まらず折り返している（短くする）',
  'legend-missing': '使った記法（線種・トーン）の凡例がない',
  'legend-incomplete': '凡例に載っていない記法がある（diagram({legend: "auto"}) で補える）',
  'swimlane-lane-order': 'レーンの並べ替えで、レーンをまたぐ距離を減らせる',
  'rowheader-tone-collides': '表の行ラベル（rowHeader）と同じ塗り（soft）の行トーンがある',
  'swimlane-lanes': 'レーンが多い（6 本まで）',
  'swimlane-hand-offs': 'レーンをまたぐ引き継ぎの数（情報）',
  'edge-crossings': '線どうしの交差・重なりがある',
  'arrow-labels': '一部にだけラベルがあり、ラベルのない矢印が多い',
  'one-story': '1 つの図に、スイムレーンが複数ある（1 図 1 話）',
  'doc-width': '図の幅が本文の表示幅（約 930px）を超え、文字が縮む',
  'density': '文字量・箱の数が多い',
  'wf-callout-no-note': '図の番号に対応する注釈がない',
  'wf-note-no-callout': '注釈に対応する番号が図にない',
  'wf-callout-gap': '図の番号が 1 からの連番になっていない',
  'wf-callout-duplicate': '同じ番号が複数の場所に付いている（情報）',
  'wf-states-todo': '状態の一覧に「未設計」の欄がある（設計するか、対象外と明示する）',
  'wf-states-required': '状態の一覧に、必須の状態の列がない',
  'wf-states-ragged': '状態の一覧の行に、列より多い欄がある',
  'wf-callout-order': '図の番号が、読む順（上から下、左から右）に並んでいない（情報）',
  'doc-image-missing': '文書が参照している SVG がない',
  'doc-alt-empty': '文書の画像に代替テキストがない',
  'doc-alt-long': '代替テキストが長い（155 文字以内にして、詳しい説明は本文に）',
  'doc-notes-missing': '図に注釈があるのに、文書に番号つきの注釈のリストがない',
  'doc-notes-mismatch': '文書の注釈のリストが、図の注釈と違う（片方を直し忘れている）',
  'doc-orphan-svg': 'どの文書からも参照されていない SVG',
};

export const DEFAULT_LEGEND_LABELS = {
  'line:solid': '実線', 'line:dashed': '破線', 'line:dotted': '点線', 'line:double': '二重線', 'arrow:both': '双方向', 'weight:strong': '強い流れ',
  'tone:new': '新規', 'tone:changed': '変更・改修', 'tone:removed': '対象外', 'tone:danger': '異常・注意',
  'tone:muted': '補助・任意', 'tone:accent': '強調', 'tone:solid': '主役', 'tone:solid-danger': '異常(強)',
} satisfies Record<`line:${LineStyle}` | 'arrow:both' | `weight:${ArrowWeight}` | `tone:${Exclude<EmphasisTone, 'plain'>}`, string>; // `satisfies`: a new line style / tone without a label (or a stale key) fails tsc; NotationKey derives from this table

// every band, including those nested in groups, rows, grids and swimlanes
export function walkBands(bands: Band[], out: Band[] = []): Band[] {
  for (const b of bands) {
    out.push(b);
    if (b.type === 'group') walkBands(b.children, out);
    else if (b.type === 'grouprow') walkBands(b.children, out);
    else if (b.type === 'row' || b.type === 'grid') out.push(...b.children);
    else if (b.type === 'swimlane') out.push(...b.steps);
  }
  return out;
}

// notation keys a diagram uses: 'line:dashed', 'arrow:both', 'weight:strong', 'tone:new', ...
export function usedNotation(bands: Band[], dimmed = new Set<Band>()): Set<string> {
  const all = walkBands(bands);
  const used = new Set<string>(), lines = new Set<string>();
  for (const b of all) {
    if (dimmed.has(b)) continue;
    if (b.type === 'connect') {
      lines.add(b.line ?? 'solid');
      if (b.arrow === 'both') used.add('arrow:both');
      if (b.weight) used.add(`weight:${b.weight}`);
    } else if (b.type === 'box' && b.tone && b.tone !== 'plain') used.add(`tone:${b.tone}`);
  }
  const nonSolid = [...lines].filter(l => l !== 'solid');
  for (const l of nonSolid) used.add(`line:${l}`);
  if (nonSolid.length || used.has('arrow:both') || used.has('weight:strong')) used.add('line:solid'); // the plain line needs a legend entry once others exist
  return used;
}

export function legendKeys(bands: Band[]): Set<string> {
  const keys = new Set<string>();
  for (const b of walkBands(bands)) {
    if (b.type !== 'legend') continue;
    for (const it of b.items) {
      if (it.tone) keys.add(`tone:${it.tone}`);
      else if (it.weight) keys.add(`weight:${it.weight}`);
      else if (it.arrow === 'both') keys.add('arrow:both');
      else keys.add(`line:${it.line ?? 'solid'}`);
    }
  }
  return keys;
}

// The legend labels of a diagram: the defaults, with 'accent' read as the runner-up ('次点') once the diagram has a solid ('主役') box:
// "主役 / 強調" would not say which is the upper step. An explicit legendLabels['tone:accent'] always wins.
export function legendLabelsFor(used: ReadonlySet<string>, custom?: Partial<Record<string, string>>): Record<string, string> {
  return {...DEFAULT_LEGEND_LABELS, ...(used.has('tone:solid') ? {'tone:accent': '次点'} : {}), ...(custom ?? {})} as Record<string, string>;
}

// diagram({legend: 'auto'}): add a legend entry for every notation used but not listed.
export function applyAutoLegend(d: DiagramData): void {
  if (d.legend !== 'auto') return;
  const used = usedNotation(d.bands, dimmedBands(d)), have = legendKeys(d.bands);
  const missing = [...used].filter(k => !have.has(k));
  if (!missing.length) return;
  const labels = legendLabelsFor(used, d.legendLabels);
  // a tone whose boxes are ALL dashed gets a dashed swatch
  const boxes = walkBands(d.bands).filter((b): b is BoxBand => b.type === 'box');
  const allDashed = (tone: string) => { const bs = boxes.filter(b => b.tone === tone); return bs.length > 0 && bs.every(b => b.dashed); };
  const labelOf = (k: string): string => {
    const label = labels[k];
    if (label === undefined) throw new Error(`diagram({legend: 'auto'}): no legend label for "${k}" — add it to legendLabels`);
    return label;
  };
  const items = missing.map((k): LegendItem => {
    const [kind, v] = k.split(':');
    // v comes from our own `tone:<tone>` / `line:<style>` keys (usedNotation), so the casts hold
    if (kind === 'tone') return allDashed(v) ? {tone: v as EmphasisTone, dashed: true, label: labelOf(k)} : {tone: v as EmphasisTone, label: labelOf(k)};
    if (kind === 'arrow') return {line: 'solid', arrow: 'both', label: labelOf(k)};
    if (kind === 'weight') return {line: 'solid', weight: v as ArrowWeight, label: labelOf(k)};
    return {line: v as LineStyle, label: labelOf(k)};
  });
  const existing = d.bands.find((b): b is LegendBand => b.type === 'legend');
  if (existing) existing.items.push(...items);
  else d.bands.push({type: 'legend', items, align: 'center'});
}

function ratioText(r: number): string { return r.toFixed(1); }

function textContrast(d: LintTarget, out: Finding[]): void {
  const seen = new Set<string>();
  const check = (fg: string | undefined, bg: string | undefined, what: string): void => {
    if (!fg || !bg) return;
    const need = 4.5, r = wcagRatio(fg, bg), key = `${fg}|${bg}`;
    if (r < need && !seen.has(key)) {
      seen.add(key);
      out.push({rule: 'a11y-text-contrast', severity: 'warn', message: `${what} の文字 ${fg} と背景 ${bg} のコントラスト比が ${ratioText(r)}:1（4.5:1 以上が目安）`});
    }
  };
  const boxes: (LaidOutBand | LaidOutBox)[] = [];
  for (const b of d.laidOut ?? []) { if (b.type === 'row' || b.type === 'grid') boxes.push(...b.children); else boxes.push(b); }
  for (const b of boxes) {
    if (b.type === 'box' || b.type === 'banner') {
      const bg = b.dim ? PALETTE.bg : resolveBoxStyle(b.tone ?? ((b.type as string) === 'banner' ? 'accent' : 'plain'), d.day) /* banner() always sets tone; the fallback is defensive */.fill;
      const boxTone = b.tone ?? ((b.type as string) === 'banner' ? 'accent' : 'plain');
      for (const run of b.wrappedRuns ?? []) check(b.dim ? PALETTE.muted : runColorOf(run.tone, boxTone, d.day), bg, `「${String(run.text).slice(0, 14)}」`);
      if (!b.dim) for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if (sp.tone) check(resolveTextColor(sp.tone, d.day), bg, `「${sp.text.slice(0, 14)}」`);
      if (b.tag) check(PALETTE.bg, b.tagTone === 'danger' ? PALETTE.danger : b.tagTone === 'muted' ? PALETTE.muted : PALETTE[d.day].accent, `タグ「${b.tag}」`);
    } else if (b.type === 'caption') {
      for (const run of b.wrappedRuns ?? []) check(resolveTextColor(run.tone, d.day), PALETTE.bg, `「${String(run.text).slice(0, 14)}」`);
      for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if (sp.tone) check(resolveTextColor(sp.tone, d.day), PALETTE.bg, `「${sp.text.slice(0, 14)}」`);
    } else if (b.type === 'table') {
      if (b.titleBar) check(PALETTE.bg, PALETTE[d.day].accent, 'テーブルの題名帯');
      for (const row of b.rows) for (const c of row.cells) {
        const bg = row.header || (b.rowHeader && c === row.cells[0]) ? PALETTE[d.day].soft : row.tone ? resolveBoxStyle(row.tone, d.day).fill : PALETTE.bg;
        if (c.lines.length) check(resolveTextColor(c.tone, d.day), bg, `表のセル「${c.lines[0].slice(0, 12)}」`);
      }
    }
  }
}

// em.danger() / em.accent() without em.b(): the emphasis is the colour alone (WCAG 1.4.1). em.muted() softens, so it is not one.
function colourOnlyEmphasis(d: LintTarget, out: Finding[]): void {
  if (d.medium !== 'doc') return;
  const words: string[] = [];
  const boxes: (LaidOutBand | LaidOutBox)[] = [];
  for (const b of d.laidOut ?? []) { if (b.type === 'row' || b.type === 'grid') boxes.push(...b.children); else boxes.push(b); }
  for (const b of boxes) {
    if (b.type !== 'box' && b.type !== 'banner' && b.type !== 'caption') continue;
    if (b.dim) continue;
    for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if ((sp.tone === 'danger' || sp.tone === 'accent') && !sp.bold) words.push(`「${sp.text.slice(0, 14)}」`);
  }
  if (words.length) out.push({rule: 'a11y-color-only-emphasis', severity: 'warn', message: `色だけで強調した語: ${words.slice(0, 6).join('')}${words.length > 6 ? ` ほか ${words.length - 6} 件` : ''}。em.b() も併用する`});
}

function nonTextContrast(d: LintTarget, out: Finding[]): void {
  const tones = new Set<EmphasisTone>();
  const dimmed = dimmedBands(d);
  for (const b of walkBands(d.bands)) if (b.type === 'box' && !dimmed.has(b)) tones.add(b.tone ?? 'plain');
  for (const t of tones) {
    const st = resolveBoxStyle(t, d.day);
    // a tone with no border of its own (solid) is drawn with its fill as the stroke: the fill against the page is what delimits it
    const ts = toneStyle(t), own = typeof d.day === 'string' ? ts.stroke : ts.slideStroke ?? ts.stroke;
    const r = own == null ? wcagRatio(st.fill, PALETTE.bg) : Math.min(wcagRatio(st.stroke, st.fill), wcagRatio(st.stroke, PALETTE.bg));
    if (r < 3) out.push({rule: 'a11y-nontext-contrast', severity: 'warn', message: `トーン「${t}」の枠線 ${st.stroke} が、背景に対して ${ratioText(r)}:1（3:1 以上が目安）。タグや文言など、色以外の手がかりを必ず併用する`});
  }
  for (const c of d.connects ?? []) {
    // connector colours are resolved the same way emit does
    const col = c.dim ? PALETTE.muted : c.tone === 'muted' ? PALETTE.muted : c.tone === 'danger' ? PALETTE.danger : c.tone === 'accent' ? PALETTE[d.day].accent : PALETTE.text;
    const r = wcagRatio(col, PALETTE.bg);
    if (r < 3) { out.push({rule: 'a11y-nontext-contrast', severity: 'warn', message: `矢印の色 ${col} のコントラスト比が ${ratioText(r)}:1`}); break; }
  }
}

function legendRules(d: LintTarget, out: Finding[]): void {
  const used = usedNotation(d.bands, dimmedBands(d)), have = legendKeys(d.bands);
  if (!used.size) return;
  const hasLegend = walkBands(d.bands).some(b => b.type === 'legend');
  const missing = [...used].filter(k => !have.has(k));
  if (!missing.length) return;
  const labels = legendLabelsFor(used, d.legendLabels), names = missing.map(k => `${k}（例: ${labels[k] ?? k}）`).join('、');
  out.push({rule: hasLegend ? 'legend-incomplete' : 'legend-missing', severity: 'warn', message: `凡例にない記法: ${names}`});
}

// segments of every connector, for crossing / overlap counting
interface Seg {i: number; c: LaidOutConnect; a: Point; b: Point}
function segsOf(connects: LaidOutConnect[]): Seg[] {
  const out: Seg[] = [];
  connects.forEach((c, i) => { for (let k = 0; k < c.points.length - 1; k++) out.push({i, c, a: c.points[k], b: c.points[k + 1]}); });
  return out;
}
const horiz = (s: Seg) => Math.abs(s.a.y - s.b.y) < 0.5;
const vert = (s: Seg) => Math.abs(s.a.x - s.b.x) < 0.5;
const lo = (a: number, b: number) => Math.min(a, b), hi = (a: number, b: number) => Math.max(a, b);

const strokeOf = (c: LaidOutConnect) => c.weight === 'strong' ? STRONG_STROKE : 2;

export function edgeStats(connects: LaidOutConnect[]): {crossings: number; overlaps: number} {
  const segs = segsOf(connects);
  let crossings = 0, overlaps = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    if (s.i === t.i) continue;
    // two lines this close (centre to centre) look like one: the normal width gives the usual 3, a strong line widens it
    const near = (strokeOf(s.c) + strokeOf(t.c)) / 2 + 1;
    const share = s.c.fromId === t.c.fromId || s.c.toId === t.c.toId || s.c.fromId === t.c.toId || s.c.toId === t.c.fromId;
    if (horiz(s) && vert(t) || vert(s) && horiz(t)) {
      const h = horiz(s) ? s : t, v = horiz(s) ? t : s;
      if (v.a.x > lo(h.a.x, h.b.x) + 2 && v.a.x < hi(h.a.x, h.b.x) - 2 && h.a.y > lo(v.a.y, v.b.y) + 2 && h.a.y < hi(v.a.y, v.b.y) - 2) crossings++;
    } else if (!share && horiz(s) && horiz(t) && Math.abs(s.a.y - t.a.y) < near) {
      if (Math.min(hi(s.a.x, s.b.x), hi(t.a.x, t.b.x)) - Math.max(lo(s.a.x, s.b.x), lo(t.a.x, t.b.x)) > 12) overlaps++;
    } else if (!share && vert(s) && vert(t) && Math.abs(s.a.x - t.a.x) < near) {
      if (Math.min(hi(s.a.y, s.b.y), hi(t.a.y, t.b.y)) - Math.max(lo(s.a.y, s.b.y), lo(t.a.y, t.b.y)) > 12) overlaps++;
    }
  }
  return {crossings, overlaps};
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
}

// rowHeader: true paints the row-heading cell `soft`; a row whose own tone also fills `soft` (accent / new) loses the difference.
function rowHeaderRules(d: LintTarget, out: Finding[]): void {
  for (const b of d.laidOut ?? []) {
    if (b.type !== 'table' || !b.rowHeader) continue;
    const rows = b.rows.filter(r => !r.header && toneStyle(r.tone).fill === 'soft');
    if (!rows.length) continue;
    const names = rows.slice(0, 4).map(r => `「${(r.cells[0]?.lines[0] ?? '').slice(0, 12)}」`).join('');
    out.push({rule: 'rowheader-tone-collides', severity: 'warn', message: `表の行ラベルは soft で塗るが、${names}${rows.length > 4 ? ` ほか ${rows.length - 4} 行` : ''}は行のトーン（${[...new Set(rows.map(r => r.tone))].join('・')}）も soft なので、行ラベルと本文の塗りが同じになる。muted / changed / 太字の文字などに変えるか、行のトーンを外す`});
  }
}

function swimlaneRules(d: LintTarget, out: Finding[]): void {
  const lanesBands = d.bands.filter((b): b is SwimlaneBand => b.type === 'swimlane');
  if (lanesBands.length > 1) out.push({rule: 'one-story', severity: 'warn', message: `スイムレーンが ${lanesBands.length} つある。1 図 1 話にして、図を分けることを検討する`});
  for (const sl of lanesBands) {
    const n = sl.lanes.length;
    if (n > 6) out.push({rule: 'swimlane-lanes', severity: 'warn', message: `レーンが ${n} 本ある（6 本までが目安）`});
    const ids = new Map<string, number>(sl.steps.filter(s => s.id).map((s): [string, number] => [s.id as string, sl.lanes.findIndex(l => l.id === s.lane)]));
    const flows = (d.connects ?? []).filter(c => ids.has(c.fromId) && ids.has(c.toId));
    if (!flows.length) continue;
    const dist = (order: number[]) => { const pos = new Map(order.map((l, i) => [l, i])); return flows.reduce((s, c) => s + Math.abs((pos.get(ids.get(c.fromId) as number) as number) - (pos.get(ids.get(c.toId) as number) as number)), 0); };
    const cur = [...Array(n).keys()];
    const curD = dist(cur);
    const handOffs = flows.filter(c => ids.get(c.fromId) !== ids.get(c.toId)).length;
    out.push({rule: 'swimlane-hand-offs', severity: 'info', message: `引き継ぎ ${handOffs} 件 / 矢印 ${flows.length} 本。レーン間の距離の合計 ${curD}`});
    if (n >= 2 && n <= 8) {
      // lanes marked {fixed: true} keep their place (e.g. a collecting 'PM' lane at the bottom)
      const free = cur.filter(i => !sl.lanes[i].fixed);
      let best = cur, bestD = curD;
      for (const p of permutations(free)) {
        const order = cur.map(i => (sl.lanes[i].fixed ? i : p[free.indexOf(i)]));
        const x = dist(order);
        if (x < bestD) { best = order; bestD = x; }
      }
      if (bestD < curD) out.push({rule: 'swimlane-lane-order', severity: 'warn', message: `レーンを「${best.map(i => sl.lanes[i].label.replace(/\n/g, '')).join(' → ')}」の順にすると、レーン間の距離が ${curD} → ${bestD} に減る`});
    }
  }
}

// ---- wireframes: callout numbers vs notes, and the state matrix --------------------------------
function calloutsOf(...trees: unknown[]): number[] {
  const out: number[] = [];
  const walk = (x: unknown): void => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    // a wf node tree is walked generically (any node kind may carry n / parts / markers / children)
    const nd = x as {t?: unknown; n?: unknown; parts?: Record<string, unknown>; markers?: {n?: unknown}[]; children?: unknown};
    if (!nd.t) return;
    if (typeof nd.n === 'number') out.push(nd.n);
    for (const v of Object.values(nd.parts ?? {})) if (typeof v === 'number') out.push(v);
    for (const m of nd.markers ?? []) if (typeof m.n === 'number') out.push(m.n);
    walk(nd.children);
  };
  trees.forEach(walk);
  return out;
}

// the callout numbers should grow in reading order. Rows read top to bottom, columns (a sidebar, a main area) left to right,
// so the next number may sit lower, or clearly to the right — only a step back (up-and-left, or left on the same row) is flagged.
const ORDER_ROW = 48, ORDER_COL = 24;
function calloutOrder(d: LintTarget, out: Finding[]): void {
  for (const b of d.laidOut ?? []) {
    if (b.type !== 'wireframe' || !b.callouts?.length) continue;
    const first = new Map<number, WfCallout>();
    for (const c of b.callouts) if (!first.has(c.n)) first.set(c.n, c);
    const nums = [...first.keys()].sort((x, y) => x - y), bad = [];
    for (let i = 0; i + 1 < nums.length; i++) {
      const a = first.get(nums[i]) as WfCallout, c = first.get(nums[i + 1]) as WfCallout;
      const leftOfIt = c.x < a.x - ORDER_COL && c.y < a.y + ORDER_ROW;       // not on a later row, yet to the left
      const aboveIt = c.y < a.y - ORDER_ROW && c.x < a.x + ORDER_COL;        // higher up, and not in a column further right
      if (leftOfIt || aboveIt) bad.push(`${nums[i]}→${nums[i + 1]}`);
    }
    if (bad.length) out.push({rule: 'wf-callout-order', severity: 'info', message: `${b.title ? `「${b.title}」` : 'ワイヤーフレーム'}: 番号が読む順でない所: ${bad.join('、')}`});
  }
}

function wireframeRules(d: LintTarget, out: Finding[]): void {
  calloutOrder(d, out);
  for (const b of walkBands(d.bands)) {
    if (b.type === 'wireframe') {
      const calls = calloutsOf(b.root, b.overlays);
      const noteNums = (b.notes ?? []).map((nt, i) => (typeof nt === 'object' && nt.n != null ? nt.n : i + 1));
      const where = b.title ? `「${b.title}」` : 'ワイヤーフレーム';
      const uniq = [...new Set(calls)].sort((x, y) => x - y);
      const noNote = uniq.filter(c => !noteNums.includes(c));
      if (noNote.length) out.push({rule: 'wf-callout-no-note', severity: 'warn', message: `${where}: 番号 ${noNote.join('・')} に対応する注釈がない`});
      const noCall = noteNums.filter(nn => !calls.includes(nn));
      if (b.notes?.length && noCall.length) out.push({rule: 'wf-note-no-callout', severity: 'warn', message: `${where}: 注釈 ${noCall.join('・')} に対応する番号が図にない`});
      if (uniq.length && uniq.some((c, i) => c !== i + 1)) out.push({rule: 'wf-callout-gap', severity: 'warn', message: `${where}: 番号が 1 からの連番でない（${uniq.join('・')}）`});
      const dup = uniq.filter(c => calls.filter(x => x === c).length > 1);
      if (dup.length) out.push({rule: 'wf-callout-duplicate', severity: 'info', message: `${where}: 番号 ${dup.join('・')} が複数の場所に付いている（1 つの注釈を共有）`});
    }
    if (b.type === 'screens' && b.matrix) {
      const m = b.matrix;
      const miss = (m.required ?? []).filter(c => !m.cols.includes(c));
      if (miss.length) out.push({rule: 'wf-states-required', severity: 'warn', message: `状態の一覧に、必須の状態「${miss.join('」「')}」の列がない`});
      const todo: string[] = [];
      for (const row of m.rows) {
        if (row.cells.length > m.cols.length) out.push({rule: 'wf-states-ragged', severity: 'warn', message: `行「${row.label}」の欄が ${row.cells.length} 個で、列（${m.cols.length}）より多い`});
        m.cols.forEach((col, i) => { const c = row.cells[i]; if (c == null || c === 'todo') todo.push(`${row.label}×${col}`); }); // a row shorter than the columns leaves "未設計" cells
      }
      if (todo.length) out.push({rule: 'wf-states-todo', severity: 'warn', message: `「未設計」の欄: ${todo.join('、')}`});
    }
  }
}

export function lintDiagram(d: LintTarget): Finding[] {
  const out = lintAll(d);
  // diagram({accept: {'rule-id': 'reason'}}): a known, accepted finding is kept as info with its reason
  return out.map(f => (d.accept && d.accept[f.rule as RuleId] ? {...f, severity: 'info' as const, message: `${f.message}（許容: ${d.accept[f.rule as RuleId]}）`} : f));
}

function lintAll(d: LintTarget): Finding[] {
  const out: Finding[] = [];
  textContrast(d, out);
  colourOnlyEmphasis(d, out);
  nonTextContrast(d, out);
  legendRules(d, out);
  swimlaneRules(d, out);
  wireframeRules(d, out);
  rowHeaderRules(d, out);

  const connects = d.connects ?? [];
  if (connects.length) {
    const {crossings, overlaps} = edgeStats(connects);
    if (crossings || overlaps) out.push({rule: 'edge-crossings', severity: 'warn', message: `線の交差 ${crossings} 箇所、重なり ${overlaps} 箇所。箱や線の配置・レーンの順を見直す`});
    const unlabeled = connects.filter(c => !c.label).length;
    // no label at all is a convention (the arrows only mean "depends on" / "next"); some labelled and most not is the inconsistency to flag
    if (connects.length >= 4 && unlabeled < connects.length && unlabeled / connects.length > 0.6) out.push({rule: 'arrow-labels', severity: 'info', message: `矢印 ${connects.length} 本のうち ${unlabeled} 本にラベルがない。何が流れるか（成果物・プロトコル）を短く添える`});
  }
  if (d.medium === 'doc' && d.width > (d.maxWidth ?? 940)) out.push({rule: 'doc-width', severity: 'warn', message: `幅 ${d.width}px。本文の表示幅（約 930px）に縮められ、文字が小さくなる（${d.maxWidth ?? 940}px 以下にする）`});
  // doc diagrams are read at length on a page, so their budget is larger than the slide decks' (see budget.ts)
  for (const w of budgetWarnings({laidOut: d.laidOut ?? []}, d.medium === 'doc' ? {boxBody: 100, total: 700, boxes: 30} : undefined)) out.push({rule: 'density', severity: 'warn', message: w});
  const allBars = walkBands(d.bands).filter((b): b is BarsBand => b.type === 'bars');
  if (d.medium === 'doc' && !diagramTitle(d) && allBars.some(barsValuesHidden)) out.push({rule: 'bars-values-hidden', severity: 'warn', message: '値を隠した bars があるが、図に題名がなく <desc> も出ない。diagram({title}) を指定する（値の列は自動で <desc> に入る）'});
  for (const b of d.laidOut ?? []) if (b.type === 'bars' && b.bars.some(r => (r.w > 0 && r.w <= 1 && r.h > 0) || (r.h > 0 && r.h <= 1 && r.w > 0))) { out.push({rule: 'bars-thin-bar', severity: 'warn', message: '棒が 1px 以下になっている。図の高さ・幅を上げるか max を見直す'}); break; }
  for (const b of d.laidOut ?? []) if (b.type === 'caption' && b.sourceLine && b.wrappedRuns.reduce((n, r) => n + r.lines.length, 0) > 1) out.push({rule: 'source-wraps', severity: 'warn', message: `出典行が ${b.wrappedRuns.reduce((n, r) => n + r.lines.length, 0)} 行に折り返している。1 行に収まる長さにする（出典の細部は本文へ）`});
  if (d.medium === 'doc' && !diagramTitle(d)) out.push({rule: 'a11y-no-title', severity: 'warn', message: 'SVG の題名にできるテキストがない。diagram({title}) を指定する'});
  return out;
}

// ---- SVG accessible name / description -------------------------------------------------
const oneLine = (t: unknown): string => String(t ?? '').replace(/\s*\n\s*/g, ' ').trim();

export function diagramTitle(d: DiagramData): string {
  if (d.title) return oneLine(d.title);
  for (const b of walkBands(d.bands)) {
    if (b.type === 'caption' && b.text) return oneLine(b.text);
    if (b.type === 'banner' && b.headline) return oneLine(b.headline);
  }
  for (const b of walkBands(d.bands)) if (b.type === 'group' && b.title) return oneLine(b.title);
  return '';
}

export function diagramDesc(d: DiagramData): string {
  if (d.desc) return oneLine(d.desc);
  const parts: string[] = [];
  for (const b of walkBands(d.bands)) {
    if (b.type === 'swimlane') {
      parts.push(`レーン: ${b.lanes.map(l => oneLine(l.label)).join('、')}`);
      parts.push(`手順: ${b.steps.map(s => oneLine(s.title)).join('、')}`);
    } else if (b.type === 'sequence') parts.push(`参加者: ${b.actors.map(a => oneLine(a.label)).join('、')}`);
    else if (b.type === 'table') parts.push(`表${b.title ? `「${oneLine(b.title)}」` : ''}: 列 ${b.columns.map(c => oneLine(c.label)).join('、')}`);
  }
  if (!parts.length) {
    const titles = walkBands(d.bands).filter((b): b is BoxBand => b.type === 'box' && !!b.title).map(b => oneLine(b.title));
    if (titles.length) parts.push(`要素: ${titles.slice(0, 16).join('、')}${titles.length > 16 ? ' ほか' : ''}`);
  }
  // outside the fallback above, so boxes and hidden-value bars can share one description
  for (const b of walkBands(d.bands)) if (b.type === 'bars' && barsValuesHidden(b)) parts.push(`値: ${b.data.map(x => `${oneLine(x.label)} ${fmt(x.value)}${b.unit ?? ''}`).join('、')}`);
  return parts.join('。');
}
