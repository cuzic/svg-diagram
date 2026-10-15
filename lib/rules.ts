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

import {qualify, scopeOf} from './anchor-scope.ts';
import {nestedBandsOf} from './band-children.ts';
import {minTextSize} from './fit.ts';
import {IMAGE_WARN_BYTES} from './image.ts';
import {PALETTE, MIN_FONT_SIZE, STRONG_STROKE, wcagRatio as lightWcag, runColorOf, toneStyle, colorOf, paintOf, relativeLuminance, withTones} from './tokens.ts';

// contrast is judged on the colours as drawn: in a dark diagram the light tokens are looked up in the dark set first
const wcagIn = (d: LintTarget) => { const p = paintOf(d.appearance); return (a: string, b: string): number => lightWcag(p(a), p(b)); };
import {resolveTextColor, resolveBoxStyle} from './emit.ts';
import {budgetWarnings} from './budget.ts';
import {termFindings, tableFindings} from './consistency.ts';
import {barsValuesHidden} from './bars.ts';
import {fmt} from './plane.ts';
import {layoutMetrics} from './layout-metrics.ts';
import {dimmedBands} from './spotlight.ts';
import {visibleAt} from './reveal.ts';
import type {BarsBand} from './types/bars.ts';
import type {LaidOutConnect, LegendBand, LegendItem} from './types/containers.ts';
import type {ArrowWeight, EmphasisTone, DiagramData, LineStyle, Point, Rect, RuleId} from './types/core.ts';
import {bendsOf, crossingsOf} from './polyline-metrics.ts';
import type {Band, LaidOutBand} from './types/index.ts';
import type {SwimlaneBand} from './types/sequence-table-swimlane.ts';
import type {BoxBand, LaidOutBox} from './types/text-bands.ts';
import type {Finding} from './types/verdicts.ts';
import type {WfCallout} from './types/wireframe-nodes.ts';
import type {LintTarget} from './types/verdicts.ts';
import type {CauseRole} from './types/diagrams.ts';
import {describeApplied} from './fit-width.ts';
import {tocFindings} from './toc-rules.ts';
import {ftaFindings} from './fta-rules.ts';

export const RULE_DOCS = {
  'a11y-text-contrast': 'テキストと背景のコントラスト比が WCAG の 4.5:1 未満',
  'a11y-color-only-emphasis': '色だけで強調した語がある（太字も併用する。色が見えない読者にも伝わるように）',
  'a11y-nontext-contrast': '意味を持つ枠線・線のコントラスト比が 3:1 未満（色以外の手がかりも併用する）',
  'a11y-no-title': 'SVG の <title> に使える題名が見つからない（diagram({title}) を指定）',
  'bars-values-hidden': '値ラベルも目盛りも出さない bars があるのに、図の題名（SVG の <title>）がなく、値を読み上げる <desc> が届かない（doc 媒体）',
  'bars-thin-bar': '棒が 1px 以下（値は 0 でない）。図の高さ・幅を上げるか max を見直す',
  'image-large': '埋め込んだ画像が大きい（300 KB 超）。ファイルがそのまま SVG に入り、段階表示の各ファイルにも入る。縮小・圧縮してから使う',
  'cjk-line-long': '見出し（caption の title / display / stat と banner の headline）の 1 行が、全角で数えて長すぎる（本文幅 600px に収まる字数の目安を超える、または図の幅に収まらず自動で折り返した。短くするか改行する）',
  'source-wraps': '出典行（diagram({sourceLine})）が 1 行に収まらず折り返している（短くする）',
  'legend-missing': '使った記法（線種・トーン）の凡例がない',
  'legend-incomplete': '凡例に載っていない記法がある（diagram({legend: "auto"}) で補える。凡例が要らない図は diagram({legend: false})）',
  'swimlane-lane-order': 'レーンの並べ替えで、レーンをまたぐ距離を減らせる',
  'shrink-narrow-text': "fit: 'shrink' で bpmn / swimlane を詰めた結果、task / step の幅が狭すぎて本文が 2〜3 字ずつ折れる。縦向き・図の分割・文言の短縮を検討する",
  'gray-tone-collision': '使っている 2 つのトーンの塗りが、白黒（グレースケール）にすると見分けにくい（明度差 L* が 10 未満。破線などの形の手がかりがあれば除く）',
  'rowheader-tone-collides': '表の行ラベル（rowHeader）と同じ塗り（soft）の行トーンがある',
  'semantic-table-warning': '意味付き表の入力に注意点がある（例: RACI の空の役割列）',
  'swimlane-lanes': 'レーンが多い（6 本まで）',
  'swimlane-hand-offs': 'レーンをまたぐ引き継ぎの数（情報）',
  'edge-crossings': '線どうしの交差・重なりがある',
  'edge-bends': '自動配置の図（cause / states / bpmn / classes / semnet）で、1 本の矢印が 5 回以上折れる、または折れの合計 ÷ 矢印の数が 3 を超える。既定は情報、diagram({layoutCheck: "strict"}) で warn',
  'quadrant-item-moved': 'quadrant() の項目が、重なりを避けるため指定した座標から 16px 以上動いた（座標は目安として読まれる）',
  'quadrant-size-floor': 'quadrant() の項目の size が小さすぎ、最小の円で描いた（面積が値より大きく見える）',
  'quadrant-empty-cell': 'quadrant() のマスに項目が 1 つもない（「該当なし」の空の枠が残っている。意図した空きは allowEmpty で示す）',
  'quadrant-tone-only': 'quadrant() の項目の色（tone）だけで種類を分けている（group を使うと形と凡例でも伝わる）',
  'funnel-values-rise': 'funnel({scale: "value"}) の値が下の段で増えている（漏斗として読むなら、値と段の順を確認する）',
  'toc-ude-count': '現状ツリー(causeTree({tree: "crt"}))の UDE が 5〜10 個の範囲の外。部分図なら accept で許容する。diagram({tocCheck: "strict"}) で warn',
  'toc-parts': 'TOC のツリーの部品が足りない・違う(crt に根本原因 root が無い、frt に施策 injection か望む結果 de が無い、frt に root がある)。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-parts': 'ネガティブブランチ(causeTree({tree: "nbr"}))に、トリミングの施策(role: trim)か、悪い結果(role: ude)が無い。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-no-tipping': 'ネガティブブランチで、転換点(role: tipping)を通らずに、原因を持たない実体から ude へ至る因果の道が残っている(転換点の無い枝)。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-tipping-not-and': 'ネガティブブランチの転換点(role: tipping)が、AND(複数の原因が揃って越える)の結果になっていない。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-trim-too-late': 'トリミングの施策(role: trim)が断つ(kind: blocks)先が、転換点より結果側(下流)にある。転換点そのもの、またはその手前を断つ。diagram({tocCheck: "strict"}) で warn',
  'toc-tt-unit': '移行ツリー(causeTree({tree: "tt"}))の AND の結果が、ニーズ(role: need または precondition)と行動(role: action)の両方を原因に持たない(現状 + ニーズ + 行動 → 新しい現実の単位の形でない)。diagram({tocCheck: "strict"}) で warn',
  'toc-prt-bottom-not-action': '前提条件ツリー(causeTree({tree: "prt"}))の最下部の中間目標(中間目標の鎖の底)に、行動(role: action)がつながっていない(最下部は、実行できる行動)。diagram({tocCheck: "strict"}) で warn',
  'toc-prt-one-to-one': '前提条件ツリーの障害と中間目標が、全部 1 対 1 だけ(1 つの中間目標に複数の障害、または 1 つの障害が複数の中間目標を妨げる形が PRT らしい)。diagram({tocCheck: "strict"}) で warn',
  'toc-obstacle-phrase': '前提条件ツリーの障害のラベルが「ない」「無い」「不足」で終わる(障害は、無いことではなく、そこにある事実で書く指針。日本語の文末の判定なので偽陽性がある。常に info)',
  'toc-mirror': '未来現実ツリー(causeTree({tree: "frt", mirrors: crt}))の望む結果(de / goal)の mirrors が、現状ツリーの ude の id でない、ude に対応する望む結果が無い、同じ ude を複数が mirrors している(1 対 1 でない)。diagram({tocCheck: "strict"}) で warn',
  'fta-gate-one-input': '故障の木(faultTree)の AND / OR / vote ゲートの入力が 1 つだけ。ゲートが意味を持たない。diagram({rcaCheck: "strict"}) で warn',
  'fta-vote-degenerate': '故障の木の vote ゲートの k が 1(OR と同じ)または入力の数(AND と同じ)。diagram({rcaCheck: "strict"}) で warn',
  'fta-top-is-leaf': '故障の木の頂上事象にゲートが無い(1 つの事象だけの木)。diagram({rcaCheck: "strict"}) で warn',
  'fta-undeveloped-left': '故障の木に、展開していない事象(ひし形)が残っている(常に info。意図した省略なら無視してよい)',
  'toc-source-has-cause': '原因を持たない役割(crt の root、frt・nbr の injection、nbr の trim、precondition)の実体に、入る矢印がある。diagram({tocCheck: "strict"}) で warn',
  'toc-chain-only': 'crt / frt が分岐も合流も AND も無い 1 本鎖(途中の原因を飛ばしている可能性)。diagram({tocCheck: "strict"}) で warn',
  'toc-orphan': 'causeTree({tree}) の実体のうち、どのリンクにも出てこないものがある(graph-orphan-node は connect() の線しか見ない)。diagram({tocCheck: "strict"}) で warn',
  'toc-cycle-undeclared': 'causeTree({tree}) に循環があるのに、戻りの矢印に back: true が付いていない(配置が戻りとして扱った矢印を示す)。diagram({tocCheck: "strict"}) で warn',
  'graph-orphan-node': '矢印でつないだ図の中に、どの矢印にもつながっていない箱がある（つなぎ忘れか、図に要らない箱。意図した注記なら id を付けない）',
  'graph-disconnected': '矢印でつないだ図が、互いにつながらない 2 つ以上のかたまりに分かれている（1 図 1 話なら、つなぎ忘れか、図を分ける）',
  'term-variant': '同じ語の表記が 1 つの図の中で揺れている（ユーザ / ユーザー、API / Api など）。1 つに揃える',
  'term-avoid': '用語集（.svg-diagram.json の "terms"）で、別の語に統一すると決めた語が使われている',
  'table-sum-mismatch': '表の「合計」行・列の値が、並ぶ値の和と合わない（丸めで説明できる差は除く）',
  'table-share-not-100': '表の「構成比」「割合」の列が、合計 100% にならない',
  'arrow-labels': '一部にだけラベルがあり、ラベルのない矢印が多い',
  'canvas-region-empty': 'canvas() の領域に内容がない（requireAll: 全領域を埋める指定）',
  'one-story': '1 つの図に、スイムレーンが複数ある（1 図 1 話）',
  'slide-min-text': 'スライド用キャンバスの最小文字サイズ(既定 24px)より小さい文字がある',
  'font-floor-lowered': 'canvas の図が文字の下限を 14px から下げている(canvas.minText < 14。1:1 で読む前提で、投影には向かない)',
  'slide-canvas-overflow': 'スライド用キャンバス(16:9)の高さに収まらない',
  'doc-width': '図の幅が本文の表示幅（約 930px）を超え、文字が縮む（diagram({maxWidth}) で図ごとに閾値を変える。幅そのものは diagram({width})）',
  'auto-fit-applied': '幅に収まらないので、dir / maxNodeW を省略した図(causeTree・stateDiagram・classDiagram・tree)をレイアウトが自動で変えた（dir を省略: warn、dir: \'auto\': info）。明示した dir / maxNodeW は変えず、収まらなければ試した案つきで throw する',
  'density': '文字量・箱の数が多い',
  'wf-callout-no-note': '図の番号に対応する注釈がない',
  'wf-note-no-callout': '注釈に対応する番号が図にない',
  'wf-callout-gap': '図の番号が 1 からの連番になっていない',
  'wf-callout-duplicate': '同じ番号が複数の場所に付いている（情報）',
  'wf-states-todo': '状態の一覧に「未設計」の欄がある（設計するか、対象外と明示する）',
  'wf-states-required': '状態の一覧に、必須の状態の列がない',
  'wf-states-ragged': '状態の一覧の行に、列より多い欄がある',
  'wf-callout-order': '図の番号が、読む順（上から下、左から右）に並んでいない（情報）',
  'layout-sibling-size': '横に並ぶ枠の幅が 1〜4px だけ違う（等分の行で 4px の格子に丸めた結果。cols / flex で揃える）。diagram({layoutCheck: "strict"}) で warn',
  'layout-edge-misalign': '隣り合う枠の縁（左端・右端・上端）が 1〜4px ずれている（0 は一致、5px 以上は別物として扱う）。diagram({layoutCheck: "strict"}) で warn',
  'layout-gutter-uneven': '横に並ぶ 3 枠以上の間隔が 2px 以上不均一。diagram({layoutCheck: "strict"}) で warn',
  'layout-unused-space': '枠の中身の下に 48px 以上かつ枠の高さの 40% 以上の空きがある（行の高さ揃え・canvas の床の結果）。diagram({layoutCheck: "strict"}) で warn',
  'layout-figure-offset': '内容（ラベル込み、題・凡例・出典行を除く）の左右の余白が 48px 以上違う（図が片側に寄っている）。diagram({layoutCheck: "strict"}) で warn',
  'layout-figure-narrow': '内容の幅が図の幅の 50% 未満（diagram({width}) で内容に合わせて狭められる）。diagram({layoutCheck: "strict"}) で warn',
  'layout-align-mixed': '横に並ぶ箱で文字の揃え（左・中央）が混在している（意図なら accept で許容する）。diagram({layoutCheck: "strict"}) で warn',
  'doc-image-missing': '文書が参照している SVG がない',
  'doc-alt-empty': '文書の画像に代替テキストがない',
  'doc-alt-long': '代替テキストが長い（155 文字以内にして、詳しい説明は本文に）',
  'doc-notes-missing': '図に注釈があるのに、文書に番号つきの注釈のリストがない',
  'doc-notes-mismatch': '文書の注釈のリストが、図の注釈と違う（片方を直し忘れている）',
  'doc-png-no-source': '文書が参照している PNG に、同じ名前の図のソース（--src-dir）も SVG（--svg-dir）もない（手作りの絵か、図を消したあとの残り）',
  'doc-orphan-png': '文書が参照している PNG と同じフォルダにある、どの文書からも参照されていない PNG',
  'doc-orphan-svg': 'どの文書からも参照されていない SVG',
};

export const DEFAULT_LEGEND_LABELS = {
  'line:solid': '実線', 'line:dashed': '破線', 'line:dotted': '点線', 'line:double': '二重線', 'arrow:both': '双方向', 'weight:strong': '強い流れ',
  'tone:new': '新規', 'tone:changed': '変更・改修', 'tone:removed': '対象外', 'tone:danger': '異常・注意',
  'tone:muted': '補助・任意', 'tone:accent': '強調', 'tone:solid': '主役', 'tone:solid-danger': '異常(強)',
  // a causeTree() figure (ADR 0015 D6): an entity role, an arrow joined by an arc, the core driver mark
  'role:ude': '好ましくない現象(UDE)', 'role:root': '根本原因', 'role:de': '望む結果(DE)', 'role:injection': '施策', 'role:precondition': '現状の事実', 'role:tipping': '転換点', 'role:trim': 'トリミング(施策)', 'role:need': 'ニーズ',
  'role:goal': '目標', 'role:io': '中間目標', 'role:obstacle': '障害', 'role:action': '行動', 'role:start': '開始', 'role:risk': '懸念', 'role:measure': '対策',
  'edge:and': '合わせて原因(AND)', 'edge:back': '戻り(フィードバック)', 'edge:blocks': '断つ', 'mark:core': '中核ドライバー',
} satisfies Record<`line:${LineStyle}` | 'arrow:both' | `weight:${ArrowWeight}` | `tone:${Exclude<EmphasisTone, 'plain'>}` | `role:${Exclude<CauseRole, 'effect' | 'step'>}` | 'edge:and' | 'edge:back' | 'edge:blocks' | 'mark:core', string>; // `satisfies`: a new line style / tone without a label (or a stale key) fails tsc; NotationKey derives from this table

// every band, including those nested in groups, rows, grids and swimlanes
export function walkBands(bands: Band[], out: Band[] = []): Band[] {
  for (const b of bands) {
    out.push(b);
    walkBands(nestedBandsOf(b), out);
  }
  return out;
}

// notation keys a diagram uses: 'line:dashed', 'arrow:both', 'weight:strong', 'tone:new', ...
export function usedNotation(bands: Band[], dimmed = new Set<Band>(), withCause = false): Set<string> {
  const all = walkBands(bands);
  const used = new Set<string>(), lines = new Set<string>();
  // a canvas() region with a pill (重点 / 中心 / ソフト) says its tone in words: that tone needs no legend entry
  const worded = new Set<Band>(all.flatMap(b => b.type === 'grid' && b.canvas ? b.children.filter((_, i) => b.canvas!.worded[i]) : []));
  for (const b of all) {
    if (dimmed.has(b) || worded.has(b)) continue;
    if (b.type === 'connect') {
      lines.add(b.line ?? 'solid');
      if (b.arrow === 'both') used.add('arrow:both');
      if (b.weight) used.add(`weight:${b.weight}`);
    } else if (b.type === 'box' && b.tone && b.tone !== 'plain') used.add(`tone:${b.tone}`);
    else if (b.type === 'cause' && withCause) { // only legend: 'auto' reads these (the legend-* checks keep their old count)
      for (const n of b.nodes) if (n.role && n.role !== 'effect' && n.role !== 'step') used.add(`role:${n.role}`);
      if (b.links.some(l => typeof l.from !== 'string' && l.from.length > 1)) used.add('edge:and');
      if (b.links.some(l => l.back)) used.add('edge:back');
      if (b.links.some(l => l.kind === 'blocks')) used.add('edge:blocks');
      if (b.nodes.some(n => n.core)) used.add('mark:core');
    }
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
      if (it.role) keys.add(`role:${it.role}`);
      else if (it.edge) keys.add(`edge:${it.edge}`);
      else if (it.mark) keys.add(`mark:${it.mark}`);
      else if (it.tone) keys.add(`tone:${it.tone}`);
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
  const used = usedNotation(d.bands, dimmedBands(d), true), have = legendKeys(d.bands);
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
    if (kind === 'role') return {role: v as CauseRole, label: labelOf(k)};
    if (kind === 'edge') return {edge: v as 'and' | 'back' | 'blocks', label: labelOf(k)};
    if (kind === 'mark') return {mark: v as 'core', label: labelOf(k)};
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
  const wcagRatio = wcagIn(d), paint = paintOf(d.appearance);
  const seen = new Set<string>();
  const check = (fg: string | undefined, bg: string | undefined, what: string): void => {
    if (!fg || !bg) return;
    fg = paint(fg); bg = paint(bg);
    const need = 4.5, r = lightWcag(fg, bg), key = `${fg}|${bg}`;
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
      if (b.tag) check(PALETTE.bg, colorOf(toneStyle(b.tagTone === 'danger' || b.tagTone === 'muted' ? b.tagTone : 'accent').ink, d.day), `タグ「${b.tag}」`);
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
  const wcagRatio = wcagIn(d);
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
    const col = c.dim ? PALETTE.muted : c.tone === 'muted' || c.tone === 'danger' || c.tone === 'accent' ? colorOf(toneStyle(c.tone).ink, d.day) : PALETTE.text;
    const r = wcagRatio(col, PALETTE.bg);
    if (r < 3) { out.push({rule: 'a11y-nontext-contrast', severity: 'warn', message: `矢印の色 ${col} のコントラスト比が ${ratioText(r)}:1`}); break; }
  }
}

function legendRules(d: LintTarget, out: Finding[]): void {
  if (d.legend === false) return; // the author declared that this diagram needs no legend
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
  // crossings: right-angle crossings inside the other line's span by 2px (polyline-metrics, shared with the layered layout's score)
  const crossings = crossingsOf(connects.map(c => c.points), {margin: 2, tol: 0.5});
  const segs = segsOf(connects);
  let overlaps = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j];
    if (s.i === t.i) continue;
    // two lines this close (centre to centre) look like one: the normal width gives the usual 3, a strong line widens it
    const near = (strokeOf(s.c) + strokeOf(t.c)) / 2 + 1;
    const share = s.c.fromId === t.c.fromId || s.c.toId === t.c.toId || s.c.fromId === t.c.toId || s.c.toId === t.c.fromId;
    if (horiz(s) && vert(t) || vert(s) && horiz(t)) continue;
    if (!share && horiz(s) && horiz(t) && Math.abs(s.a.y - t.a.y) < near) {
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
  for (const b of walkBands(d.bands)) if (b.type === 'table') for (const message of b.semanticWarnings ?? []) out.push({rule: 'semantic-table-warning', severity: 'warn', message});
  for (const b of d.laidOut ?? []) {
    if (b.type !== 'table' || !b.rowHeader) continue;
    const rows = b.rows.filter(r => !r.header && toneStyle(r.tone).fill === 'soft');
    if (!rows.length) continue;
    const names = rows.slice(0, 4).map(r => `「${(r.cells[0]?.lines[0] ?? '').slice(0, 12)}」`).join('');
    out.push({rule: 'rowheader-tone-collides', severity: 'warn', message: `表の行ラベルは soft で塗るが、${names}${rows.length > 4 ? ` ほか ${rows.length - 4} 行` : ''}は行のトーン（${[...new Set(rows.map(r => r.tone))].join('・')}）も soft なので、行ラベルと本文の塗りが同じになる。muted / changed / 太字の文字などに変えるか、行のトーンを外す`});
  }
}

// In grayscale (a mono print, a colour-blind reader) only lightness is left. The fill of every tone a diagram uses (boxes, table rows),
// in the diagram's own theme and appearance, goes to CIE L* (0 black .. 100 white); two fills closer than GRAY_MIN_DL cannot be told apart.
// 10 is about where two flat greys stop reading as "different" on paper: it flags soft (L* ~93) next to plain white (100), and passes accent-soft against solid (~50). The de-emphasis tones (muted / removed: the pale code fill, grey text) are meant to sit back and are left out. Tones that differ in their dashed outline are told apart by shape; tones
// with the same fill (new / accent, changed / plain) are not told apart by their fill in colour either (the outline or nothing does it), so that is not this rule's matter.
export const GRAY_MIN_DL = 10;
const lightnessOf = (hex: string): number => { const y = relativeLuminance(hex); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };

function grayToneRules(d: LintTarget, out: Finding[]): void {
  const used = new Set<string>(), all = walkBands(d.bands);
  // a canvas() region with a pill (重点 / 中心 / 結論) says its tone in words, as for the legend (usedNotation): not a grayscale matter
  const worded = new Set<Band>(all.flatMap(b => b.type === 'grid' && b.canvas ? b.children.filter((_, i) => b.canvas!.worded[i]) : []));
  for (const b of all) if (b.type === 'box' && !worded.has(b)) used.add(b.tone ?? 'plain');
  for (const b of d.laidOut ?? []) if (b.type === 'table') for (const r of b.rows) if (!r.header && r.tone) used.add(r.tone);
  const p = paintOf(d.appearance);
  const tones = [...used].map(name => {
    const t = toneStyle(name), box = resolveBoxStyle(name as EmphasisTone, d.day);
    return {name, fill: p(box.fill).toLowerCase(), dashed: box.dashed, l: lightnessOf(p(box.fill)), quiet: t.fill === 'code'};
  });
  const seen = new Set<string>(), hits: string[] = [];
  for (let i = 0; i < tones.length; i++) for (let j = i + 1; j < tones.length; j++) {
    const a = tones[i], b = tones[j];
    if (a.fill === b.fill || a.quiet || b.quiet || a.dashed !== b.dashed || Math.abs(a.l - b.l) >= GRAY_MIN_DL) continue;
    const pair = `${a.name}・${b.name}`;
    if (!seen.has(pair)) { seen.add(pair); hits.push(`${pair}（L* ${Math.round(a.l)} と ${Math.round(b.l)}）`); }
  }
  if (hits.length) out.push({rule: 'gray-tone-collision', severity: 'warn', message: `白黒にすると塗りの明度が近く、見分けにくいトーンの組: ${hits.join('、')}。直し方は 2 つ: (1) トーンの塗りの明度差を L* 10 以上にする（diagram({tones: {accent: {fill: '#…'}}}) か .svg-diagram.json の \"tones\" で色を変える。または片方を solid / muted にする）、(2) 破線・太字・ラベルなど色以外の手がかりを足し、accept: {'gray-tone-collision': '理由'} で許容する（確認は preview --gray）`});
}

function shrinkRules(d: LintTarget, out: Finding[]): void {
  for (const b of d.laidOut ?? []) {
    if ((b.type !== 'bpmn' && b.type !== 'swimlane') || !b.narrow?.length) continue;
    const what = b.type === 'bpmn' ? 'task' : 'step';
    out.push({rule: 'shrink-narrow-text', severity: 'warn', message: `fit: 'shrink' で詰めた結果、${what} の本文が 2〜3 字ずつ折れている（${b.narrow.slice(0, 3).map(t => `「${t}」`).join('')}${b.narrow.length > 3 ? ` ほか ${b.narrow.length - 3} 件` : ''}）。直し方: 図を縦向きにする、列の多い図を 2 つに分ける、文言を短くする、図の幅（maxWidth）を広げる`});
  }
}

function swimlaneRules(d: LintTarget, out: Finding[]): void {
  const lanesBands = d.bands.filter((b): b is SwimlaneBand => b.type === 'swimlane');
  if (lanesBands.length > 1) out.push({rule: 'one-story', severity: 'warn', message: `スイムレーンが ${lanesBands.length} つある。1 図 1 話にして、図を分けることを検討する`});
  for (const sl of lanesBands) {
    const n = sl.lanes.length;
    if (n > 6) out.push({rule: 'swimlane-lanes', severity: 'warn', message: `レーンが ${n} 本ある（6 本までが目安）`});
    const ids = new Map<string, number>(sl.steps.filter(s => s.id).map((s): [string, number] => [qualify(scopeOf(sl), s.id as string), sl.lanes.findIndex(l => l.id === s.lane)]));
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

/** The severity of the layout-quality findings (`layout-*`, and ADR 0016's `edge-bends`): info, or warn for a diagram that asked for diagram({layoutCheck: 'strict'}). */
export const layoutSeverity = (d: Pick<DiagramData, 'layoutCheck'>): 'warn' | 'info' => d.layoutCheck === 'strict' ? 'warn' : 'info';

/** The severity of the `toc-*` findings (ADR 0015 D3): info, or warn for a diagram that asked for diagram({tocCheck: 'strict'}). */
export const tocSeverity = (d: Pick<DiagramData, 'tocCheck'>): 'warn' | 'info' => d.tocCheck === 'strict' ? 'warn' : 'info';

/** The severity of the cause-analysis findings (ADR 0025 D5 / ADR 0026 D1): info, or warn for a diagram that asked for diagram({rcaCheck: 'strict'}). A finding that carries its own `severity` keeps it. */
export const rcaSeverity = (d: Pick<DiagramData, 'rcaCheck'>): 'warn' | 'info' => d.rcaCheck === 'strict' ? 'warn' : 'info';

/** The checks of the cause-analysis figures. Empty on purpose: each figure (faultTree, isIsNot, whyWhy*, bowtie) adds its own branch, reported at `f.severity ?? rcaSeverity(d)` like tocRules. */
function rcaRules(d: LintTarget, out: Finding[]): void {
  const severity = rcaSeverity(d);
  for (const b of walkBands(d.bands)) if (b.type === 'fta') for (const f of ftaFindings(b)) out.push({rule: f.rule, severity: f.severity ?? severity, message: f.message});
}

function tocRules(d: LintTarget, out: Finding[]): void {
  const severity = tocSeverity(d);
  for (const b of walkBands(d.bands)) if (b.type === 'cause') for (const f of tocFindings(b)) out.push({rule: f.rule, severity: f.severity ?? severity, message: f.message});
}

// Alignment and whitespace (ADR 0014): measured on the laid-out bands (lib/layout-metrics.ts), reported at layoutSeverity(d).
function layoutQualityRules(d: LintTarget, out: Finding[]): void {
  if (!d.laidOut) return;
  const severity = layoutSeverity(d);
  for (const m of layoutMetrics(d.laidOut, {width: d.width, slideCanvas: !!d.canvas})) out.push({rule: m.rule, severity, message: m.message, data: m.data});
}

// ---- edge-bends (ADR 0016 D6) ------------------------------------------------------------------------------------------------
// A band whose edges the layout routed: cause / states / bpmn / classes, and the network charts (pert, dependency, a causal loop that is
// not a ring). The lines a person drew with connect() are not counted, nor are self-loops. The thresholds come from the principle, not from
// the examples: a layered edge should turn no more than twice (one elbow) and a figure about 2 times on average, so 5 bends on one edge
// (two layers skipped at a bend each) and an average over 3 are what a reader sees as tangled.
export const EDGE_BENDS_MAX = 5, EDGE_BENDS_MEAN = 3;

interface RoutedEdges {name: string; edges: {from: string; to: string; points: {x: number; y: number}[]}[]}
function routedBands(bands: LaidOutBand[], out: RoutedEdges[] = []): RoutedEdges[] {
  for (const b of bands) {
    if (b.type === 'cause' || b.type === 'states' || b.type === 'bpmn' || b.type === 'classes') out.push({name: `${b.type}${b.id ? ` ${b.id}` : ''}`, edges: b.edges});
    else if (b.type === 'chart' && b.edges) out.push({name: `${b.kind}${b.id ? ` ${b.id}` : ''}`, edges: b.edges});
    else if (b.type === 'row' || b.type === 'grid') routedBands(b.children, out);
  }
  return out;
}

function edgeBendsRules(d: LintTarget, out: Finding[]): void {
  if (!d.laidOut) return;
  const severity = layoutSeverity(d);
  for (const band of routedBands(d.laidOut)) {
    const counted = band.edges.filter(e => e.from !== e.to && e.points.length >= 2).map(e => ({e, bends: bendsOf(e.points)}));
    if (!counted.length) continue;
    const total = counted.reduce((n, c) => n + c.bends, 0), mean = total / counted.length;
    const worst = counted.filter(c => c.bends >= EDGE_BENDS_MAX).sort((p, q) => q.bends - p.bends);
    const parts: string[] = [];
    if (worst.length) parts.push(`${worst.length} 本が ${EDGE_BENDS_MAX} 回以上折れる（${worst.slice(0, 3).map(c => `${c.e.from} → ${c.e.to} が ${c.bends} 回`).join('、')}${worst.length > 3 ? ' ほか' : ''}）`);
    if (mean > EDGE_BENDS_MEAN) parts.push(`矢印 ${counted.length} 本の折れの合計 ${total}（平均 ${mean.toFixed(1)} 回、${EDGE_BENDS_MEAN} 回以下が目安）`);
    if (!parts.length) continue;
    out.push({rule: 'edge-bends', severity, message: `${band.name}: ${parts.join('。')}。層を飛ぶ矢印・戻る矢印を減らす（辺の向き・節の分け方を見直す）`, data: {band: band.name, measured: worst.length ? worst[0].bends : Math.round(mean * 10) / 10, threshold: worst.length ? EDGE_BENDS_MAX : EDGE_BENDS_MEAN, fix: '層を飛ぶ辺・戻る辺を減らす（節の分け方・辺の向きを見直す）。意図した形なら accept で許容する'}});
  }
}

export function lintDiagram(d: LintTarget): Finding[] {
  const out = withTones(d.tones, () => lintAll(d));
  // diagram({accept: {'rule-id': 'reason'}}): a known, accepted finding is kept as info with its reason
  return out.map(f => (d.accept && d.accept[f.rule as RuleId] ? {...f, severity: 'info' as const, message: `${f.message}（許容: ${d.accept[f.rule as RuleId]}）`} : f));
}

// the width of a line in full-width characters (CJK, kana, hangul, fullwidth forms and pictographs count 1, everything else
// - Latin, digits, halfwidth katakana - 0.5)
const WIDE: [number, number][] = [[0x1100, 0x115f], [0x2e80, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7af], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff01, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1faff], [0x20000, 0x3fffd]];
export function fullWidthUnits(line: string): number {
  let n = 0;
  for (const ch of line) { const c = ch.codePointAt(0)!; n += WIDE.some(([a, b]) => c >= a && c <= b) ? 1 : 0.5; }
  return n;
}
export const HEADLINE_BUDGET_PX = 600;
// the role sizes (tokens ROLES; test/diagram-api.test.ts keeps them equal), kept here because the rendering core must not import that global table
export const HEADLINE_PX: Readonly<Record<'title' | 'banner' | 'stat' | 'display', number>> = {title: 15, banner: 16, stat: 34, display: 56};
const isHeadlineRole = (r: string | undefined): r is keyof typeof HEADLINE_PX => r != null && r in HEADLINE_PX;
// a headline line over the budget (a guide in full-width characters: what fits a 600px text column), or one the layout had to wrap
function headlineLength(d: LintTarget, out: Finding[]): void {
  const seen = new Set<string>();
  const flag = (line: string, message: string): void => { if (!seen.has(line)) { seen.add(line); out.push({rule: 'cjk-line-long', severity: 'warn', message}); } };
  const quote = (line: string): string => { const t = line.trim(); return [...t].length > 16 ? `${[...t].slice(0, 16).join('')}…` : t; };
  const check = (text: string, role: keyof typeof HEADLINE_PX): void => {
    const budget = Math.floor(HEADLINE_BUDGET_PX / HEADLINE_PX[role]);
    for (const line of text.split('\n')) {
      const u = fullWidthUnits(line.trim());
      if (u > budget) flag(line, `見出しの 1 行が全角 ${Math.ceil(u)} 字ぶんで、${budget} 字の目安（${role}。本文幅 ${HEADLINE_BUDGET_PX}px に収まる字数）を超える: 「${quote(line)}」。短くするか、改行して分ける`);
    }
  };
  for (const b of walkBands(d.bands)) {
    if (b.type === 'caption' && !b.sourceLine && isHeadlineRole(b.role)) check(b.text, b.role);
    else if (b.type === 'banner') check(b.headline, b.headlineRole ?? 'banner');
  }
  // under the budget but still wrapped by the layout (a narrow diagram, a banner in a row): the break falls anywhere, even inside a word
  const laid = (d.laidOut ?? []).flatMap(b => b.type === 'row' || b.type === 'grid' ? b.children : [b]);
  for (const b of laid) {
    const head = b.type === 'caption' && !b.sourceLine && isHeadlineRole(b.role) ? b.text : b.type === 'banner' ? b.headline : null;
    const run = head != null ? (b as {wrappedRuns: {text: string; lines: string[]}[]}).wrappedRuns[0] : undefined;
    if (head == null || !run) continue;
    const given = head.split('\n');
    if (run.lines.length > given.length && !given.some(l => seen.has(l))) flag(head, `見出しが幅に収まらず、${run.lines.length} 行に自動で折り返している: 「${quote(given[0])}」。短くするか、区切りのよいところで改行する`);
  }
}

// a connected diagram (3+ arrows) should read as one graph: a box with an id that no arrow touches is a forgotten link,
// and arrows that split into separate clumps are probably two stories in one picture
function graphRules(d: LintTarget, out: Finding[]): void {
  const connects = d.connects ?? [];
  if (connects.length < 3) return;
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  const add = (x: string) => { if (!parent.has(x)) parent.set(x, x); };
  // a row / column end (sources.col(1)) stands for the boxes inside it
  const placed = (d.laidOut ?? []).flatMap(b => b.type === 'box' ? [b] : b.type === 'row' || b.type === 'grid' ? b.children : []).filter(b => !!b.id);
  const inside = (b: Rect, a: Rect) => Math.min(b.x + b.w, a.x + a.w) - Math.max(b.x, a.x) > 0.5 && Math.min(b.y + b.h, a.y + a.h) - Math.max(b.y, a.y) > 0.5; // even partly, as layout counts it
  const endIds = (id: string, area?: Rect): string[] => [id, ...(area ? placed.filter(b => inside(b, area)).map(b => b.id!) : [])];
  for (const c of connects) {
    if (!c.fromId || !c.toId) continue;
    const ids = [...endIds(c.fromId, c.fromArea), ...endIds(c.toId, c.toArea)];
    for (const id of ids) add(id);
    for (const id of ids) parent.set(find(id), find(ids[0]));
  }
  const boxes = walkBands(d.bands).filter((b): b is BoxBand => b.type === 'box' && !!b.id && !!b.title);
  const orphans = boxes.filter(b => !parent.has(b.id!));
  if (orphans.length) out.push({rule: 'graph-orphan-node', severity: 'warn', message: `どの矢印にもつながっていない箱: ${orphans.map(b => `「${oneLine(b.title)}」(${b.id})`).join('、')}。矢印を足すか、箱を消す（注記なら id を付けない）`});
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) { const r = find(id); groups.set(r, [...(groups.get(r) ?? []), id]); }
  if (groups.size > 1) out.push({rule: 'graph-disconnected', severity: 'warn', message: `矢印でつないだ図が ${groups.size} つのかたまりに分かれている（${[...groups.values()].map(g => g.slice(0, 3).join('・') + (g.length > 3 ? '…' : '')).join(' ／ ')}）。つなぎ忘れがないか、図を分けるか確かめる`});
}
const FIT_WHO = {cause: 'causeTree()', states: 'stateDiagram()', classes: 'classDiagram()', tree: 'tree() / mindmap()', fta: 'faultTree()'} as const;
// what the layout changed on its own to make a figure fit its width (ADR 0010 D3): left out is a warning, `dir: 'auto'` is the author's own choice
function fitRules(d: LintTarget, out: Finding[]): void {
  for (const b of d.laidOut ?? []) {
    if ((b.type !== 'cause' && b.type !== 'states' && b.type !== 'classes' && b.type !== 'tree' && b.type !== 'fta') || !b.fitApplied?.length) continue;
    const what = b.fitApplied.map(describeApplied).join('、'), auto = b.fitApplied.every(a => a.mode === 'auto');
    const knobs = b.type === 'fta' ? 'maxNodeW' : 'dir / maxNodeW', say = b.type === 'fta' ? "maxNodeW: 'auto'" : "dir: 'auto'"; // a fault tree has no `dir`
    out.push({rule: 'auto-fit-applied', severity: auto ? 'info' : 'warn', message: auto
      ? `${FIT_WHO[b.type]}: ${knobs} を 'auto' にしたため、幅に収まるようレイアウトが変えた: ${what}`
      : `${FIT_WHO[b.type]}: ${knobs} を省略したため、幅に収まるようレイアウトが自動で変えた: ${what}。意図した変更なら ${say} と書く（info になる）。固定したいなら ${knobs} を明示する（収まらなければ試した案つきで止まる）`});
  }
}
function lintAll(d: LintTarget): Finding[] {
  const out: Finding[] = [];
  layoutQualityRules(d, out);
  edgeBendsRules(d, out);
  tocRules(d, out);
  rcaRules(d, out);
  fitRules(d, out);
  textContrast(d, out);
  colourOnlyEmphasis(d, out);
  nonTextContrast(d, out);
  legendRules(d, out);
  swimlaneRules(d, out);
  shrinkRules(d, out);
  wireframeRules(d, out);
  rowHeaderRules(d, out);
  grayToneRules(d, out);
  graphRules(d, out);
  out.push(...termFindings(d.bands, d.terms), ...tableFindings(walkBands(d.bands)));

  const connects = d.connects ?? [];
  if (connects.length) {
    const {crossings, overlaps} = edgeStats(connects);
    if (crossings || overlaps) out.push({rule: 'edge-crossings', severity: 'warn', message: `線の交差 ${crossings} 箇所、重なり ${overlaps} 箇所。箱や線の配置・レーンの順を見直す`});
    const unlabeled = connects.filter(c => !c.label).length;
    // no label at all is a convention (the arrows only mean "depends on" / "next"); some labelled and most not is the inconsistency to flag
    if (connects.length >= 4 && unlabeled < connects.length && unlabeled / connects.length > 0.6) out.push({rule: 'arrow-labels', severity: 'info', message: `矢印 ${connects.length} 本のうち ${unlabeled} 本にラベルがない。何が流れるか（成果物・プロトコル）を短く添える`});
  }
  if (d.canvas && d.laidOut) {
    const min = minTextSize(d);
    if (d.canvas.minText < MIN_FONT_SIZE) out.push({rule: 'font-floor-lowered', severity: 'info', message: `文字の下限を ${MIN_FONT_SIZE}px から ${d.canvas.minText}px に下げている(最小の文字 ${min}px)。キャンバスは 1:1 で読まれる前提。投影には向かない`});
    if (min < d.canvas.minText) out.push({rule: 'slide-min-text', severity: 'warn', message: `最小の文字が ${min}px。スライド用キャンバスは ${d.canvas.minText}px 以上(その文字を大きくするか、減らす)`});
    if (d.contentHeight !== undefined && d.contentHeight > d.canvas.height) out.push({rule: 'slide-canvas-overflow', severity: 'warn', message: `内容の高さ ${d.contentHeight}px が、キャンバスの高さ ${d.canvas.height}px を超える。行・文字を減らすか、図を分ける`});
  }
  if (d.medium === 'doc' && !d.canvas && d.width > (d.maxWidth ?? 940)) out.push({rule: 'doc-width', severity: 'warn', message: `幅 ${d.width}px。本文の表示幅（約 930px）に縮められ、文字が小さくなる（${d.maxWidth ?? 940}px 以下にする）`});
  // doc diagrams are read at length on a page, so their budget is larger than the slide decks' (see budget.ts)
  for (const w of budgetWarnings({laidOut: d.laidOut ?? []}, d.medium === 'doc' ? {boxBody: 100, total: 700, boxes: 30} : undefined)) out.push({rule: 'density', severity: 'warn', message: w});
  const allBars = walkBands(d.bands).filter((b): b is BarsBand => b.type === 'bars');
  if (d.medium === 'doc' && !diagramTitle(d) && allBars.some(barsValuesHidden)) out.push({rule: 'bars-values-hidden', severity: 'warn', message: '値を隠した bars があるが、図に題名がなく <desc> も出ない。diagram({title}) を指定する（値の列は自動で <desc> に入る）'});
  for (const b of walkBands(d.bands)) if (b.type === 'image' && b.bytes > IMAGE_WARN_BYTES) out.push({rule: 'image-large', severity: 'warn', message: `画像（${Math.round(b.bytes / 1024)} KB）が大きい。SVG に埋め込まれ、段階表示の各ファイルにも入る。解像度を下げるか圧縮する（${IMAGE_WARN_BYTES / 1024} KB 以下が目安）`});
  for (const b of d.laidOut ?? []) if (b.type === 'bars' && b.bars.some(r => (r.w > 0 && r.w <= 1 && r.h > 0) || (r.h > 0 && r.h <= 1 && r.w > 0))) { out.push({rule: 'bars-thin-bar', severity: 'warn', message: '棒が 1px 以下になっている。図の高さ・幅を上げるか max を見直す'}); break; }
  headlineLength(d, out);
  for (const b of d.laidOut ?? []) if (b.type === 'caption' && b.sourceLine && b.wrappedRuns.reduce((n, r) => n + r.lines.length, 0) > 1) out.push({rule: 'source-wraps', severity: 'warn', message: `出典行が ${b.wrappedRuns.reduce((n, r) => n + r.lines.length, 0)} 行に折り返している。1 行に収まる長さにする（出典の細部は本文へ）`});
  for (const b of d.laidOut ?? []) if (b.type === 'quadrant') {
    const far = b.moved.filter(m => m.px >= 16);
    if (far.length) out.push({rule: 'quadrant-item-moved', severity: 'warn', message: `quadrant() の項目 ${far.map(m => `「${m.label}」(${Math.round(m.px)}px)`).join('、')} が、他の項目やラベルを避けて座標から離れた。座標を離すか、図を大きくする`});
    if (b.emptyCells.length) out.push({rule: 'quadrant-empty-cell', severity: 'warn', message: `quadrant() のマス ${b.emptyCells.map(l => `「${l}」`).join('、')} に項目がない（空の枠が残っている）。項目を入れるか、マスを減らす。意図した空きなら quadrant({allowEmpty: [[col, row]]}) （全部なら true）`});
    if (b.floored.length) out.push({rule: 'quadrant-size-floor', severity: 'warn', message: `quadrant() の項目 ${b.floored.map(l => `「${l}」`).join('、')} の size が最大の値に比べて小さすぎ、最小の円で描いた（面積が値より大きく見える）。値の差が大きすぎるなら、大きさではなく文字で示す`});
  }
  for (const b of walkBands(d.bands)) if (b.type === 'quadrant' && !b.groups.length && new Set(b.items.flatMap(i => i.tone ? [i.tone] : [])).size >= 2) out.push({rule: 'quadrant-tone-only', severity: 'warn', message: 'quadrant() の項目を tone（色）だけで分けている。色だけでは意味が伝わらない。group を指定する（形と凡例が付く）'});
  for (const b of walkBands(d.bands)) if (b.type === 'funnel' && b.scale === 'value' && b.stages.some((s, i) => i > 0 && (s.value ?? 0) > (b.stages[i - 1].value ?? 0))) out.push({rule: 'funnel-values-rise', severity: 'warn', message: 'funnel() の value が下の段で増えている。漏斗の減少として読ませるなら、値または段の順を見直す'});
  for (const b of walkBands(d.bands)) if (b.type === 'grid' && b.canvas?.requireAll && b.canvas.empty.length) out.push({rule: 'canvas-region-empty', severity: 'warn', message: `canvas("${b.canvas.template}") の領域 ${b.canvas.empty.join('、')} に内容がない。書くか、requireAll を外す`});
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
  for (const b of walkBands(d.bands)) {
    if (b.type === 'chevron' || b.type === 'cycle') return oneLine(b.steps[0]?.label);
    if (b.type === 'funnel') return oneLine(b.stages[0]?.label);
    if (b.type === 'venn') return oneLine(b.sets.map(s => s.label ?? s.name).join('・'));
    if (b.type === 'concentric') return oneLine(b.centre ?? b.rings[0]?.label);
    if (b.type === 'wordart') return oneLine(b.text);
  }
  return '';
}

/** `stage`: a click stage of a revealing diagram; only what is on screen then is listed (nothing is left out without it). */
export function diagramDesc(d: DiagramData, stage?: number): string {
  if (d.desc) return oneLine(d.desc);
  const parts: string[] = [];
  const bands = walkBands(d.bands).filter(b => visibleAt(b as {reveal?: number; until?: number}, stage));
  for (const b of bands) {
    if (b.type === 'swimlane') {
      parts.push(`レーン: ${b.lanes.map(l => oneLine(l.label)).join('、')}`);
      parts.push(`手順: ${b.steps.filter(s => visibleAt(s, stage)).map(s => oneLine(s.title)).join('、')}`);
    } else if (b.type === 'sequence') parts.push(`参加者: ${b.actors.map(a => oneLine(a.label)).join('、')}`);
    else if (b.type === 'table') parts.push(`表${b.title ? `「${oneLine(b.title)}」` : ''}: 列 ${b.columns.map(c => oneLine(c.label)).join('、')}`);
  }
  if (!parts.length) {
    const titles = bands.filter((b): b is BoxBand => b.type === 'box' && !!b.title).map(b => oneLine(b.title));
    if (titles.length) parts.push(`要素: ${titles.slice(0, 16).join('、')}${titles.length > 16 ? ' ほか' : ''}`);
  }
  for (const b of walkBands(d.bands)) if (b.type === 'image' && b.alt) parts.push(`画像: ${oneLine(b.alt)}`);
  for (const b of walkBands(d.bands)) if (b.type === 'math') parts.push(`数式: ${oneLine(b.alt)}`);
  // outside the fallback above, so boxes and hidden-value bars can share one description
  for (const b of bands) if (b.type === 'bars' && barsValuesHidden(b)) parts.push(`値: ${b.data.filter(x => visibleAt(x, stage)).map(x => `${oneLine(x.label)} ${fmt(x.value)}${b.unit ?? ''}`).join('、')}`);
  for (const b of bands) if (b.type === 'chart') parts.push(oneLine(b.alt));
  return parts.join('。');
}
