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

import {PALETTE, wcagRatio} from './tokens.mjs';
import {resolveTextColor, resolveBoxStyle} from './emit.mjs';
import {budgetWarnings} from './budget.mjs';

export const RULE_DOCS = {
  'a11y-text-contrast': 'テキストと背景のコントラスト比が WCAG の 4.5:1 未満',
  'a11y-nontext-contrast': '意味を持つ枠線・線のコントラスト比が 3:1 未満（色以外の手がかりも併用する）',
  'a11y-no-title': 'SVG の <title> に使える題名が見つからない（diagram({title}) を指定）',
  'legend-missing': '使った記法（線種・トーン）の凡例がない',
  'legend-incomplete': '凡例に載っていない記法がある（diagram({legend: "auto"}) で補える）',
  'swimlane-lane-order': 'レーンの並べ替えで、レーンをまたぐ距離を減らせる',
  'swimlane-lanes': 'レーンが多い（6 本まで）',
  'swimlane-hand-offs': 'レーンをまたぐ引き継ぎの数（情報）',
  'edge-crossings': '線どうしの交差・重なりがある',
  'arrow-labels': 'ラベルのない矢印が多い',
  'one-story': '1 つの図に、スイムレーンが複数ある（1 図 1 話）',
  'doc-width': '図の幅が本文の表示幅（約 930px）を超え、文字が縮む',
  'density': '文字量・箱の数が多い',
};

export const DEFAULT_LEGEND_LABELS = {
  'line:solid': '実線', 'line:dashed': '破線', 'line:dotted': '点線', 'line:double': '二重線', 'arrow:both': '双方向',
  'tone:new': '新規', 'tone:changed': '変更・改修', 'tone:removed': '対象外', 'tone:danger': '異常・注意',
  'tone:muted': '補助・任意', 'tone:accent': '強調',
};

// every band, including those nested in groups, rows, grids and swimlanes
export function walkBands(bands, out = []) {
  for (const b of bands) {
    out.push(b);
    if (b.type === 'group') walkBands(b.children, out);
    else if (b.type === 'row' || b.type === 'grid') out.push(...b.children);
    else if (b.type === 'swimlane') out.push(...b.steps);
  }
  return out;
}

// notation keys a diagram uses: 'line:dashed', 'arrow:both', 'tone:new', ...
export function usedNotation(bands) {
  const all = walkBands(bands);
  const used = new Set(), lines = new Set();
  for (const b of all) {
    if (b.type === 'connect') {
      lines.add(b.line ?? 'solid');
      if (b.arrow === 'both') used.add('arrow:both');
    } else if (b.type === 'box' && b.tone && b.tone !== 'plain') used.add(`tone:${b.tone}`);
  }
  const nonSolid = [...lines].filter(l => l !== 'solid');
  for (const l of nonSolid) used.add(`line:${l}`);
  if (nonSolid.length || used.has('arrow:both')) used.add('line:solid'); // the plain line needs a legend entry once others exist
  return used;
}

export function legendKeys(bands) {
  const keys = new Set();
  for (const b of walkBands(bands)) {
    if (b.type !== 'legend') continue;
    for (const it of b.items) {
      if (it.tone) keys.add(`tone:${it.tone}`);
      else if (it.arrow === 'both') keys.add('arrow:both');
      else keys.add(`line:${it.line ?? 'solid'}`);
    }
  }
  return keys;
}

// diagram({legend: 'auto'}): add a legend entry for every notation used but not listed.
export function applyAutoLegend(d) {
  if (d.legend !== 'auto') return;
  const used = usedNotation(d.bands), have = legendKeys(d.bands);
  const missing = [...used].filter(k => !have.has(k));
  if (!missing.length) return;
  const labels = {...DEFAULT_LEGEND_LABELS, ...(d.legendLabels ?? {})};
  // a tone whose boxes are ALL dashed gets a dashed swatch
  const boxes = walkBands(d.bands).filter(b => b.type === 'box');
  const allDashed = (tone) => { const bs = boxes.filter(b => b.tone === tone); return bs.length > 0 && bs.every(b => b.dashed); };
  const items = missing.map(k => {
    const [kind, v] = k.split(':');
    if (kind === 'tone') return allDashed(v) ? {tone: v, dashed: true, label: labels[k]} : {tone: v, label: labels[k]};
    if (kind === 'arrow') return {line: 'solid', arrow: 'both', label: labels[k]};
    return {line: v, label: labels[k]};
  });
  const existing = d.bands.find(b => b.type === 'legend');
  if (existing) existing.items.push(...items);
  else d.bands.push({type: 'legend', items, align: 'center'});
}

function ratioText(r) { return r.toFixed(1); }

function textContrast(d, out) {
  const seen = new Set();
  const check = (fg, bg, what, size) => {
    if (!fg || !bg) return;
    const need = 4.5, r = wcagRatio(fg, bg), key = `${fg}|${bg}`;
    if (r < need && !seen.has(key)) {
      seen.add(key);
      out.push({rule: 'a11y-text-contrast', severity: 'warn', message: `${what} の文字 ${fg} と背景 ${bg} のコントラスト比が ${ratioText(r)}:1（4.5:1 以上が目安）`});
    }
  };
  const boxes = [];
  for (const b of d.laidOut) { if (b.type === 'row' || b.type === 'grid') boxes.push(...b.children); else boxes.push(b); }
  for (const b of boxes) {
    if (b.type === 'box' || b.type === 'banner') {
      const bg = resolveBoxStyle(b.tone ?? (b.type === 'banner' ? 'accent' : 'plain'), d.day).fill;
      for (const run of b.wrappedRuns ?? []) check(resolveTextColor(run.tone, d.day), bg, `「${String(run.text).slice(0, 14)}」`);
      if (b.tag) check(PALETTE.bg, b.tagTone === 'danger' ? PALETTE.danger : b.tagTone === 'muted' ? PALETTE.muted : PALETTE[d.day].accent, `タグ「${b.tag}」`);
    } else if (b.type === 'caption') {
      for (const run of b.wrappedRuns ?? []) check(resolveTextColor(run.tone, d.day), PALETTE.bg, `「${String(run.text).slice(0, 14)}」`);
    } else if (b.type === 'table') {
      if (b.titleBar) check(PALETTE.bg, PALETTE[d.day].accent, 'テーブルの題名帯');
      for (const row of b.rows) for (const c of row.cells) {
        const bg = row.header ? PALETTE[d.day].soft : row.tone ? resolveBoxStyle(row.tone, d.day).fill : PALETTE.bg;
        if (c.lines.length) check(resolveTextColor(c.tone, d.day), bg, `表のセル「${c.lines[0].slice(0, 12)}」`);
      }
    }
  }
}

function nonTextContrast(d, out) {
  const tones = new Set();
  for (const b of walkBands(d.bands)) if (b.type === 'box') tones.add(b.tone ?? 'plain');
  for (const t of tones) {
    const st = resolveBoxStyle(t, d.day);
    const r = Math.min(wcagRatio(st.stroke, st.fill), wcagRatio(st.stroke, PALETTE.bg));
    if (r < 3) out.push({rule: 'a11y-nontext-contrast', severity: 'warn', message: `トーン「${t}」の枠線 ${st.stroke} が、背景に対して ${ratioText(r)}:1（3:1 以上が目安）。タグや文言など、色以外の手がかりを必ず併用する`});
  }
  for (const c of d.connects ?? []) {
    // connector colours are resolved the same way emit does
    const col = c.tone === 'muted' ? PALETTE.muted : c.tone === 'danger' ? PALETTE.danger : c.tone === 'accent' ? PALETTE[d.day].accent : PALETTE.text;
    const r = wcagRatio(col, PALETTE.bg);
    if (r < 3) { out.push({rule: 'a11y-nontext-contrast', severity: 'warn', message: `矢印の色 ${col} のコントラスト比が ${ratioText(r)}:1`}); break; }
  }
}

function legendRules(d, out) {
  const used = usedNotation(d.bands), have = legendKeys(d.bands);
  if (!used.size) return;
  const hasLegend = walkBands(d.bands).some(b => b.type === 'legend');
  const missing = [...used].filter(k => !have.has(k));
  if (!missing.length) return;
  const names = missing.map(k => `${k}（例: ${DEFAULT_LEGEND_LABELS[k] ?? k}）`).join('、');
  out.push({rule: hasLegend ? 'legend-incomplete' : 'legend-missing', severity: 'warn', message: `凡例にない記法: ${names}`});
}

// segments of every connector, for crossing / overlap counting
function segsOf(connects) {
  const out = [];
  connects.forEach((c, i) => { for (let k = 0; k < c.points.length - 1; k++) out.push({i, c, a: c.points[k], b: c.points[k + 1]}); });
  return out;
}
const horiz = (s) => Math.abs(s.a.y - s.b.y) < 0.5;
const vert = (s) => Math.abs(s.a.x - s.b.x) < 0.5;
const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);

export function edgeStats(connects) {
  const segs = segsOf(connects);
  let crossings = 0, overlaps = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    if (s.i === t.i) continue;
    const share = s.c.fromId === t.c.fromId || s.c.toId === t.c.toId || s.c.fromId === t.c.toId || s.c.toId === t.c.fromId;
    if (horiz(s) && vert(t) || vert(s) && horiz(t)) {
      const h = horiz(s) ? s : t, v = horiz(s) ? t : s;
      if (v.a.x > lo(h.a.x, h.b.x) + 2 && v.a.x < hi(h.a.x, h.b.x) - 2 && h.a.y > lo(v.a.y, v.b.y) + 2 && h.a.y < hi(v.a.y, v.b.y) - 2) crossings++;
    } else if (!share && horiz(s) && horiz(t) && Math.abs(s.a.y - t.a.y) < 3) {
      if (Math.min(hi(s.a.x, s.b.x), hi(t.a.x, t.b.x)) - Math.max(lo(s.a.x, s.b.x), lo(t.a.x, t.b.x)) > 12) overlaps++;
    } else if (!share && vert(s) && vert(t) && Math.abs(s.a.x - t.a.x) < 3) {
      if (Math.min(hi(s.a.y, s.b.y), hi(t.a.y, t.b.y)) - Math.max(lo(s.a.y, s.b.y), lo(t.a.y, t.b.y)) > 12) overlaps++;
    }
  }
  return {crossings, overlaps};
}

function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
}

function swimlaneRules(d, out) {
  const lanesBands = d.bands.filter(b => b.type === 'swimlane');
  if (lanesBands.length > 1) out.push({rule: 'one-story', severity: 'warn', message: `スイムレーンが ${lanesBands.length} つある。1 図 1 話にして、図を分けることを検討する`});
  for (const sl of lanesBands) {
    const n = sl.lanes.length;
    if (n > 6) out.push({rule: 'swimlane-lanes', severity: 'warn', message: `レーンが ${n} 本ある（6 本までが目安）`});
    const ids = new Map(sl.steps.filter(s => s.id).map(s => [s.id, sl.lanes.findIndex(l => l.id === s.lane)]));
    const flows = (d.connects ?? []).filter(c => ids.has(c.fromId) && ids.has(c.toId));
    if (!flows.length) continue;
    const dist = (order) => { const pos = new Map(order.map((l, i) => [l, i])); return flows.reduce((s, c) => s + Math.abs(pos.get(ids.get(c.fromId)) - pos.get(ids.get(c.toId))), 0); };
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

export function lintDiagram(d) {
  const out = lintAll(d);
  // diagram({accept: {'rule-id': 'reason'}}): a known, accepted finding is kept as info with its reason
  return out.map(f => (d.accept && d.accept[f.rule] ? {...f, severity: 'info', message: `${f.message}（許容: ${d.accept[f.rule]}）`} : f));
}

function lintAll(d) {
  const out = [];
  textContrast(d, out);
  nonTextContrast(d, out);
  legendRules(d, out);
  swimlaneRules(d, out);

  const connects = d.connects ?? [];
  if (connects.length) {
    const {crossings, overlaps} = edgeStats(connects);
    if (crossings || overlaps) out.push({rule: 'edge-crossings', severity: 'warn', message: `線の交差 ${crossings} 箇所、重なり ${overlaps} 箇所。箱や線の配置・レーンの順を見直す`});
    const unlabeled = connects.filter(c => !c.label).length;
    if (connects.length >= 4 && unlabeled / connects.length > 0.6) out.push({rule: 'arrow-labels', severity: 'info', message: `矢印 ${connects.length} 本のうち ${unlabeled} 本にラベルがない。何が流れるか（成果物・プロトコル）を短く添える`});
  }
  if (d.medium === 'doc' && d.width > 940) out.push({rule: 'doc-width', severity: 'warn', message: `幅 ${d.width}px。本文の表示幅（約 930px）に縮められ、文字が小さくなる（940px 以下にする）`});
  // doc diagrams are read at length on a page, so their budget is larger than the slide decks' (see budget.mjs)
  for (const w of budgetWarnings(d, d.medium === 'doc' ? {boxBody: 100, total: 700, boxes: 30} : undefined)) out.push({rule: 'density', severity: 'warn', message: w});
  if (d.medium === 'doc' && !diagramTitle(d)) out.push({rule: 'a11y-no-title', severity: 'warn', message: 'SVG の題名にできるテキストがない。diagram({title}) を指定する'});
  return out;
}

// ---- SVG accessible name / description -------------------------------------------------
const oneLine = (t) => String(t ?? '').replace(/\s*\n\s*/g, ' ').trim();

export function diagramTitle(d) {
  if (d.title) return oneLine(d.title);
  for (const b of walkBands(d.bands)) {
    if (b.type === 'caption' && b.text) return oneLine(b.text);
    if (b.type === 'banner' && b.headline) return oneLine(b.headline);
  }
  for (const b of walkBands(d.bands)) if (b.type === 'group' && b.title) return oneLine(b.title);
  return '';
}

export function diagramDesc(d) {
  if (d.desc) return oneLine(d.desc);
  const parts = [];
  for (const b of walkBands(d.bands)) {
    if (b.type === 'swimlane') {
      parts.push(`レーン: ${b.lanes.map(l => oneLine(l.label)).join('、')}`);
      parts.push(`手順: ${b.steps.map(s => oneLine(s.title)).join('、')}`);
    } else if (b.type === 'sequence') parts.push(`参加者: ${b.actors.map(a => oneLine(a.label)).join('、')}`);
    else if (b.type === 'table') parts.push(`表${b.title ? `「${oneLine(b.title)}」` : ''}: 列 ${b.columns.map(c => oneLine(c.label)).join('、')}`);
  }
  if (!parts.length) {
    const titles = walkBands(d.bands).filter(b => b.type === 'box' && b.title).map(b => oneLine(b.title));
    if (titles.length) parts.push(`要素: ${titles.slice(0, 16).join('、')}${titles.length > 16 ? ' ほか' : ''}`);
  }
  return parts.join('。');
}
