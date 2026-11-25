import {grayToneFindings} from './verify-gray-tones.ts';
export {GRAY_MIN_DL} from './verify-gray-tones.ts';
import {aspectTallFindings, documentWidthFindings, missingTitleFindings, pictographFindings, textBudgetFindings, wrapFallbackFindings} from './document-findings.ts';
import {edgeBendFindings} from './verify-edge-bends.ts';
export {EDGE_BENDS_MAX, EDGE_BENDS_MEAN} from './verify-edge-bends.ts';
import {parallelEdgeFindings} from './verify-cause-spacing.ts';
import {densityRestorationFindings} from './verify-density.ts';
import {narrowTextFindings} from './verify-shrink.ts';
import {boxSizeFindings, statFitFindings} from './verify-box-like.ts';
import {duplicateTitleFindings, fullWidthUnits, sourceLineFindings} from './verify-caption.ts';
export {fullWidthUnits} from './verify-caption.ts';
import {canvasRegionFindings} from './verify-grid.ts';
import {concentricFindings} from './verify-concentric.ts';
import {flowchartFindings} from './verify-flowchart.ts';
import {stateMatrixFindings} from './state-matrix-rules.ts';
import {draftStatusFinding} from './bands/status.ts';
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

import {midWordFindings} from './mid-word-findings.ts';
import {labelCoverFindings} from './verify-connect-label.ts';
import {axisMismatches} from './axis-rules.ts';
import {axisMismatchFindings} from './axis-comparison.ts';
import {graphFindings} from './verify-connection-graph.ts';
import {DARK_NOTE, mergeSides} from './appearance-auto.ts';
import {applyFindingAcceptance, analysisFindings, at, findingAcceptanceHint, fromSources} from './finding-rules.ts';
import type {SourceRef} from './source-ref.ts';
import {legendFindings, missingLegendItems, walkBands, wordedCanvasBands} from './legend-notation.ts';
export {DEFAULT_LEGEND_LABELS, legendKeys, legendLabelsFor, usedNotation, walkBands} from './legend-notation.ts';
import {itemIdsOf} from './band-ids.ts';
import {sourceOf, withSource} from './source-ref.ts';
import {canvasFindings} from './canvas-findings.ts';
import {minTextSize} from './fit.ts';
import {bandTextSizes} from './fit-handlers.ts';
import {imageSizeFindings} from './verify-image.ts';
import {hiddenBarsTitleFindings, thinBarFindings} from './verify-bars.ts';
import {PALETTE, wcagRatio as lightWcag, runColorOf, toneStyle, colorOf, paintOf, toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';

// contrast is judged on the colours as drawn: in a dark diagram the light tokens are looked up in the dark set first
const wcagIn = (d: LintTarget, tones: ToneEnv) => { const p = paintOf(tones, d.appearance); return (a: string, b: string): number => lightWcag(p(a), p(b)); };
import {resolveTextColor, resolveBoxStyle} from './emit-common.ts';
import {termFindings, tableFindings} from './consistency.ts';
import {quadrantFindings, quadrantLayoutFindings} from './verify-quadrant.ts';
import {funnelFindings} from './verify-funnel.ts';
import {describeBands, oneLine} from './diagram-description.ts';
import {layoutMetrics} from './layout-metrics.ts';
import {dimmedBands} from './spotlight.ts';
import type {LegendBand} from './types/containers.ts';
import type {EmphasisTone, DiagramData, RuleId} from './types/core.ts';
import {connectorFindings, connectorRules} from './verify-connect-crossings.ts';
export {edgePairs, edgeStats} from './verify-connect-crossings.ts';
import type {Band, LaidOutBand} from './types/index.ts';
import type {SwimlaneBand} from './types/sequence-table-swimlane.ts';
import type {BoxBand, LaidOutBox} from './types/text-bands.ts';
import type {Finding} from './types/verdicts.ts';
import {calloutNoteFindings, calloutOrderFindings, wireframeCalloutRules} from './verify-wireframe-callouts.ts';
import type {LintTarget} from './types/verdicts.ts';
import {layoutFitFindings, layoutFitRules} from './verify-layout-fit.ts';
import {tocFindings, tocLegendFinding} from './toc-rules.ts';
import {ftaFindings} from './fta-rules.ts';
import {bowtieFindings} from './rca-rules.ts';
import {statusText} from './status.ts';

import {must} from './must.ts';
import {swimlaneFindings} from './swimlane-rules.ts';
import {rowHeaderFindings, semanticTableFindings, tableRules} from './table-rules.ts';
export const RULE_DOCS = {
  'a11y-text-contrast': 'テキストと背景のコントラスト比が WCAG の 4.5:1 未満',
  'a11y-color-only-emphasis': '色だけで強調した語がある（太字も併用する。色が見えない読者にも伝わるように）',
  'a11y-nontext-contrast': '意味を持つ枠線・線のコントラスト比が 3:1 未満（色以外の手がかりも併用する）',
  'title-duplicated': '題名（diagram({title})）と、先頭の caption が同じ文字列。diagram({title, showTitle: true}) に寄せて、caption を消せる',
  'a11y-no-title': 'SVG の <title> に使える題名が見つからない（diagram({title}) を指定）',
  'bars-values-hidden': '値ラベルも目盛りも出さない bars があるのに、図の題名（SVG の <title>）がなく、値を読み上げる <desc> が届かない（doc 媒体）',
  'bars-thin-bar': '棒が 1px 以下（値は 0 でない）。図の高さ・幅を上げるか max を見直す',
  'image-large': '埋め込んだ画像が大きい（300 KB 超）。ファイルがそのまま SVG に入り、段階表示の各ファイルにも入る。縮小・圧縮してから使う',
  'cjk-line-long': '見出し（caption の title / display / stat と banner の headline）の 1 行が、全角で数えて長すぎる（本文幅 600px に収まる字数の目安を超える、または図の幅に収まらず自動で折り返した。短くするか改行する）',
  'draft-status': '図が下書き（diagram({status: "draft"})）のまま。公開前に外す（check --forbid-draft で warn にできる）',
  'source-wraps': '出典行（diagram({sourceLine})）が 1 行に収まらず折り返している（短くする）',
  'legend-missing': '使った記法（線種・トーン）の凡例がない',
  'legend-incomplete': '凡例に載っていない記法がある（diagram({legend: "auto"}) で補える。凡例が要らない図は diagram({legend: false})）',
  'swimlane-lane-order': 'レーンの並べ替えで、レーンをまたぐ距離を減らせる（swimlane の opts に laneOrder: \'auto\' を渡すと、この順に自動で並べる）',
  'text-mid-word-break': "レイアウトが、カタカナの語(「コンテキス/ト」)や英数字の語の途中で行を割っている。箱や列が最長の語より狭いときに起きる。diagram({keepWords: true}) で、箱を最長のカタカナの語より狭くしない(causeTree / tree / mindmap / faultTree / states / bpmn の task。cloud・chevron・cycle・swimlane には効かない)。ほかに、箱の幅を広げる・向き(dir)や maxNodeW を変える・文言を短くする・語の前後で改行を書く。漢字どうしの途中の改行は対象外。スペースの無い複合語の境目(「キャプチャ/ステージ」)は辞書なしでは見分けられず、誤検出になりうる(accept で許容する)",
  'glyph-missing': "図の文字に、絵文字として扱われない絵記号(✅ ❌ など。EMOJI_RE の外)がある。通常の文字のフォントで描かれ、字形が無いと空白になる(resvg のプレビューで確認できる)。icon.emoji() か SVG アイコン(box({icon}))を使うか、✓ ✗ などの字に置き換える",
  'connect-label-covers-arrow': connectorRules['connect-label-covers-arrow'].doc,
  'chart-axis-mismatch': "同じ単位で、横に並べる(同じ grouprow の別の group)か縦に続ける(間に別のチャートを挟まない)2 つのチャートの値の軸が違う。それぞれが自分のデータに合わせて軸を決めるので、同じ長さが別の値に見える(5.76 と 9.5 がほぼ同じ長さ)。両方に同じ domain: [0, 10] を書く(bars は max)。横向きのチャートは、ラベルの列の幅が違うと同じ値が別の長さに見えるので plotInset もそろえる。意図して別の量を別の軸で描くなら、axisGroup: false か accept",
  'wrap-fell-back': "wrap: 'bunsetsu-soft' で、文節で折ると図が幅に収まらなかったので、従来の折り方(phrase)で配置した(情報。漢字・ひらがなの途中で折れる行が残る)。図を 2 枚に分ける・文言を短くする・図の幅を広げると、文節で折れる。",
  'shrink-narrow-text': "fit: 'shrink' で bpmn / swimlane を詰めた結果、task / step の幅が狭すぎて本文が 2〜3 字ずつ折れる。縦向き・図の分割・文言の短縮を検討する",
  'gray-tone-collision': '使っている 2 つのトーンの塗りが、白黒（グレースケール）にすると見分けにくい（明度差 L* が 10 未満。破線などの形の手がかりがあれば除く）',
  'rowheader-tone-collides': tableRules['rowheader-tone-collides'].doc,
  'semantic-table-warning': tableRules['semantic-table-warning'].doc,
  'swimlane-lanes': 'レーンが多い（6 本まで）',
  'swimlane-hand-offs': 'レーンをまたぐ引き継ぎの数（情報）',
  'edge-crossings': connectorRules['edge-crossings'].doc,
  'edge-bends': '自動配置の図（cause / states / bpmn / classes / semnet）で、1 本の矢印が 5 回以上折れる、または折れの合計 ÷ 矢印の数が 3 を超える。既定は情報、diagram({layoutCheck: "strict"}) で warn',
  'edge-parallel': 'causeTree() の図で、別の矢印どうしの同じ向きの線が、レーンの間隔（14px、density: "compact" で 11px。canvas の図は文字の倍率 `max(1, minText の倍率)` を掛けた値、minText: 18 で 18px）より近くで 4px を超えて並び、その長さの合計がレーンの間隔の 2 倍を超える（端を共有する矢印どうしも数える。たどれない平行線の束になる）。pdpc・relationDiagram・whyWhyTree は対象外。既定は情報、diagram({layoutCheck: "strict"}) で warn',
  'quadrant-item-moved': 'quadrant() の項目が、重なりを避けるため指定した座標から 16px 以上動いた（座標は目安として読まれる）',
  'quadrant-size-floor': 'quadrant() の項目の size が小さすぎ、最小の円で描いた（面積が値より大きく見える）',
  'quadrant-empty-cell': 'quadrant() のマスに項目が 1 つもない（「該当なし」の空の枠が残っている。意図した空きは allowEmpty で示す）',
  'quadrant-tone-only': 'quadrant() の項目の色（tone）だけで種類を分けている（group を使うと形と凡例でも伝わる）',
  'funnel-values-rise': 'funnel({scale: "value"}) の値が下の段で増えている（漏斗として読むなら、値と段の順を確認する）',
  'toc-ude-count': '現状ツリー(causeTree({tree: "crt"}))の UDE が 5〜10 個の範囲の外。部分図なら accept で許容する。diagram({tocCheck: "strict"}) で warn',
  'toc-no-desired-result': '未来現実ツリー(causeTree({tree: "frt"}))に望む結果(role: de、最終のゴールなら goal)が無い。strict が求めるからと本文に無い文を作らず、本文に結果の文が無い枝(副作用の枝など)は accept で理由を書いて許容する(ADR 0037)。diagram({tocCheck: "strict"}) で warn',
  'toc-parts': 'TOC のツリーの部品が足りない・違う(crt に根本原因 root が無い、frt に施策 injection が無い、frt に root がある)。frt に望む結果 de / goal が無いのは toc-no-desired-result(ここに accept を書いた図は、そちらも許容される)。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-parts': 'ネガティブブランチ(causeTree({tree: "nbr"}))に、トリミングの施策(role: trim)か、悪い結果(role: ude)が無い。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-no-tipping': 'ネガティブブランチで、転換点(role: tipping)を通らずに、原因を持たない実体から ude へ至る因果の道が残っている(転換点の無い枝)。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-tipping-not-and': 'ネガティブブランチの転換点(role: tipping)が、AND(複数の原因が揃って越える)の結果になっていない。diagram({tocCheck: "strict"}) で warn',
  'toc-nbr-trim-too-late': 'トリミングの施策(role: trim)が断つ(kind: blocks)先が、転換点より結果側(下流)にある。転換点そのもの、またはその手前を断つ。diagram({tocCheck: "strict"}) で warn',
  'toc-tt-unit': '移行ツリー(causeTree({tree: "tt"}))の AND の結果が、ニーズ(role: need または precondition)と行動(role: action)の両方を原因に持たない(現状 + ニーズ + 行動 → 新しい現実の単位の形でない)。diagram({tocCheck: "strict"}) で warn',
  'toc-prt-bottom-not-action': '前提条件ツリー(causeTree({tree: "prt"}))の最下部の中間目標(中間目標の鎖の底)に、行動(role: action)がつながっていない(最下部は、実行できる行動)。diagram({tocCheck: "strict"}) で warn',
  'toc-prt-one-to-one': '前提条件ツリーの障害と中間目標が、全部 1 対 1 だけ(1 つの中間目標に複数の障害、または 1 つの障害が複数の中間目標を妨げる形が PRT らしい)。diagram({tocCheck: "strict"}) で warn',
  'toc-obstacle-phrase': '前提条件ツリーの障害のラベルが「ない」「無い」「不足」で終わる(障害は、無いことではなく、そこにある事実で書く指針。日本語の文末の判定なので偽陽性がある。常に info)',
  'toc-injection-to-obstacle': '未来現実ツリー(causeTree({tree: "frt"}) など)で、施策(role: injection)から障害(role: obstacle)へ通常の矢印(kind が blocks でない)が引かれている。矢印は「原因が結果を生む」と読まれるので、施策が障害を生むと逆の因果に読まれる。施策が障害を断つ・防ぐ意味なら、そのリンクに kind: "blocks" を付ける(破線と横棒の止め方になる)。diagram({tocCheck: "strict"}) で warn。',
  'toc-role-indistinct': 'tree を書いた causeTree に root / goal / start（どれも同じアクセント色の二重枠）があるのに、roleTags が無い。別々の図で同じ見た目が別の意味を持つ（現状ツリーの根本原因と、未来現実ツリーのゴール・施策）と、白黒や凡例なしでは取り違える。causeTree({roleTags: true}) で役割を文字にする。情報（check --strict は落ちない）。文書をまたぐ版は check --docs 側の後続',
  'toc-legend-suggested': "tree を書いた causeTree を含む図に、legend の指定がない。役割は色と枠でしか区別されない。diagram({legend: 'auto'}) を付けるか、causeTree({roleTags: true}) で役割を文字にする。情報。legend: false と書けば出ない",
  'toc-mirror': '未来現実ツリー(causeTree({tree: "frt", mirrors: crt}))の望む結果(de / goal)の mirrors が、現状ツリーの ude の id でない、ude に対応する望む結果が無い、同じ ude を複数が mirrors している(1 対 1 でない)。diagram({tocCheck: "strict"}) で warn',
  'fta-gate-one-input': '故障の木(faultTree)の AND / OR / vote ゲートの入力が 1 つだけ。ゲートが意味を持たない。diagram({rcaCheck: "strict"}) で warn',
  'fta-vote-degenerate': '故障の木の vote ゲートの k が 1(OR と同じ)または入力の数(AND と同じ)。diagram({rcaCheck: "strict"}) で warn',
  'fta-top-is-leaf': '故障の木の頂上事象にゲートが無い(1 つの事象だけの木)。diagram({rcaCheck: "strict"}) で warn',
  'fta-undeveloped-left': '故障の木に、展開していない事象(ひし形)が残っている(常に info。意図した省略なら無視してよい)',
  'isisnot-no-isnot': 'IS/IS NOT 表(isIsNot)に、IS NOT が空の行がある(比較対象が無い)。diagram({rcaCheck: "strict"}) で warn',
  'isisnot-no-distinct-at-all': 'IS/IS NOT 表に「違い」が 1 つも無い(IS と IS NOT で鋭く違う点を挙げる)。diagram({rcaCheck: "strict"}) で warn',
  'isisnot-no-hypothesis-stands': '仮説の検定表(isIsNotTests)に、説明できない行が 0 の仮説が無い(原因はまだ分かっていない。常に info)',
  'whywhy-no-root': 'なぜなぜ分析(whyWhyTable / whyWhyTree)に、真因(trueCause)の無い鎖(葉)がある。どこまで掘ったか分からない。diagram({rcaCheck: "strict"}) で warn',
  'whywhy-measure-without-root': 'なぜなぜ分析で、真因でない所に対策(measure)がある(症状への対策になる)。diagram({rcaCheck: "strict"}) で warn',
  'whywhy-single-chain': 'なぜなぜ分析が 1 本の鎖だけ(分岐が無い。原因が 1 つに決まっているか確かめる。常に info)',
  'whywhy-dig-below-root': 'なぜなぜの木で、真因(trueCause)の節の下にまだ「なぜ」がある(真因より下を掘っている。常に info)',
  'bowtie-barrier-missing': 'ボウタイ図(bowtie)で、脅威または結果にバリアが 1 つも無い(防ぐ・和らげる手が無い道)。diagram({rcaCheck: "strict"}) で warn',
  'comic-bubble-wide': 'マンガ(comic)のふきだしの文が、全角 11 字(内側 198px)より広い(穴の長さ + 後ろのひらがな、または語が長い)。穴を短くするか、ひらがなを減らす',
  'comic-orphan-line': 'マンガ(comic)のふきだしの最後の行が 2 字以下(「…」「ね。」)。広げても直らなかった。台詞を言い換えて、最後の行を長くするか前の行に収める',
  'comic-follower-split': 'マンガ(comic)のふきだしで、穴の後ろのひらがなの連なり(3 字以下)が穴から切り離されている(助詞が次の行に回る、連なりの途中で割れる)。穴と一緒の行に収まるように言い換える',
  'comic-value-invalid': 'マンガの穴の値が空白だけ、複数行、制御文字を含む、最大字数を超える、または指定された候補にない。穴の規則に合う値を入力する',
  'comic-values-unknown': 'マンガの穴の定義にない id が values にある。定義済みの穴の id を使う',
  'slot-overflow': 'マンガの穴の文字が 14px でも収まらず、穴の矩形で切れる。穴の値や飛ばしの文言を短くする',
  'fta-single-point': '故障の木に、単独で頂上事象を起こす事象(大きさ 1 のカットセット)がある。カットセットが多すぎて調べられないときもこの規則の info(常に info)',
  'toc-source-has-cause': '原因を持たない役割(crt の root、frt・nbr の injection、nbr の trim、precondition)の実体に、入る矢印がある。diagram({tocCheck: "strict"}) で warn',
  'toc-chain-only': 'crt / frt が分岐も合流も AND も無い 1 本鎖(途中の原因を飛ばしている可能性)。diagram({tocCheck: "strict"}) で warn',
  'toc-orphan': 'causeTree({tree}) の実体のうち、どのリンクにも出てこないものがある(graph-orphan-node は connect() の線しか見ない)。diagram({tocCheck: "strict"}) で warn',
  'toc-cycle-undeclared': 'causeTree({tree}) に循環があるのに、戻りの矢印に back: true が付いていない(配置が戻りとして扱った矢印を示す)。diagram({tocCheck: "strict"}) で warn',
  'graph-orphan-node': connectorRules['graph-orphan-node'].doc,
  'graph-disconnected': connectorRules['graph-disconnected'].doc,
  'term-variant': '同じ語の表記が 1 つの図の中で揺れている（ユーザ / ユーザー、API / Api など）。1 つに揃える',
  'term-avoid': '用語集（.svg-diagram.json の "terms"）で、別の語に統一すると決めた語が使われている',
  'table-sum-mismatch': tableRules['table-sum-mismatch'].doc,
  'table-share-not-100': tableRules['table-share-not-100'].doc,
  'arrow-labels': connectorRules['arrow-labels'].doc,
  'canvas-region-empty': 'canvas() の領域に内容がない（requireAll: 全領域を埋める指定）',
  'one-story': '1 つの図に、スイムレーンが複数ある（1 図 1 話）',
  'slide-min-text': 'スライド用キャンバスの最小文字サイズ(既定 24px)より小さい文字がある',
  'font-floor-lowered': 'canvas の図が文字の下限を 14px から下げている(canvas.minText < 14。1:1 で読む前提で、投影には向かない)',
  'box-size-ignored': 'box({size}) は効果がない(レイアウトも描画も読まない)。大きい文字は役割で書く: stat() / stat({size: "display"})・caption({role: "display"})・banner({headlineRole})・bars / plane({labelRole})。次の版で throw する',
  'stat-no-source': 'stat() の数字に出典(source)が無い。diagram({evidenceCheck: "info" | "strict"}) を書いた図だけで検査する(strict で warn)。stat({source, confidence}) で足す',
  'stat-fit-shrunk': 'stat() の値が箱の幅に収まらないので、自動で小さい文字にした(隣の stat と大きさがそろわない。箱を広げるか、値を短くするとそろう)',
  'slide-canvas-overflow': 'スライド用キャンバス(16:9)の高さに収まらない',
  'aspect-tall': '文書の図が縦に長い（高さが幅の 1.5 倍超。本の版面は縦横比が 1.5〜1.6 ほど）。部品に応じて、段組み（causeTree の fold、row の cols）か分割を検討する',
  'doc-width': '図の幅が本文の表示幅（約 930px）を超え、文字が縮む（diagram({maxWidth}) で図ごとに閾値を変える。幅そのものは diagram({width})）',
  'flowchart-decision-edges': '判断（flowchart のひし形）から出る矢印が 2 本未満、または 3 本以上、またはラベル（Yes / No など）がない',
  'auto-fit-applied': layoutFitRules['auto-fit-applied'].doc,
  'cause-line-scale-dropped': "canvas の causeTree で、線の間隔を文字の倍率で広げた図が canvas の高さ・幅に収まらず、広げない間隔で描いた（情報）。canvas を高くする・minText を下げる・図を分けると広げられる",
  'density-compact-restored': "diagram({density: 'compact'}) の因果ツリー・状態遷移で、詰めた図のほうが検査の問題(箱を通る矢印・ラベルの重なり)が多いので、通常の間隔で描いた（情報）",
  'density': '文字量・箱の数が多い',
  'concentric-label-crossing': 'concentric の扇形（sectors）の印の見出しが、輪の線か区切り線（layout: stack では段や列の線）をまたぐ、または stack の外枠の外に出る（重ならない場所が見つからなかった。ADR 0065）',
  'wf-callout-no-note': wireframeCalloutRules['wf-callout-no-note'].doc,
  'wf-note-no-callout': wireframeCalloutRules['wf-note-no-callout'].doc,
  'wf-callout-gap': wireframeCalloutRules['wf-callout-gap'].doc,
  'wf-callout-duplicate': wireframeCalloutRules['wf-callout-duplicate'].doc,
  'wf-states-todo': '状態の一覧に「未設計」の欄がある（設計するか、対象外と明示する）',
  'wf-states-required': '状態の一覧に、必須の状態の列がない',
  'wf-states-ragged': '状態の一覧の行に、列より多い欄がある',
  'wf-callout-order': wireframeCalloutRules['wf-callout-order'].doc,
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
  'doc-png-has-svg': '文書が PNG を参照しているが、同名の SVG もある（SVG への差し替え忘れ。PNG を残す意図なら許容する）',
  'doc-png-no-source': '文書が参照している PNG に、同じ名前の図のソース（--src-dir）も SVG（--svg-dir）もない（手作りの絵か、図を消したあとの残り）',
  'doc-orphan-png': '文書が参照している PNG と同じフォルダにある、どの文書からも参照されていない PNG',
  'doc-svg-no-source': '文書が参照している SVG に、対応する図のソースがない（ソースを消したあと SVG だけ残り、再生成されない古い絵になる。--src-dir か ./diagrams と、SVG に記録された生成元を探す）',
  'doc-orphan-svg': 'どの文書からも参照されていない SVG',
};

/** Per-part findings keep their location in auto appearance; grouped findings use their original wording to match across sides.
 * Document rules use the document as their scope and provide lines in --docs.
 */
export const RULE_LOCATION = {
  'a11y-text-contrast': 'band-grouped',
  'a11y-color-only-emphasis': 'band-grouped',
  'a11y-nontext-contrast': 'band-grouped',
  'title-duplicated': 'band',
  'a11y-no-title': 'diagram',
  'bars-values-hidden': 'diagram',
  'bars-thin-bar': 'band',
  'image-large': 'band',
  'cjk-line-long': 'band',
  'draft-status': 'diagram',
  'source-wraps': 'diagram',
  'legend-missing': 'diagram',
  'legend-incomplete': 'band-grouped',
  'swimlane-lane-order': 'band',
  'text-mid-word-break': 'band-grouped',
  'glyph-missing': 'band-grouped',
  'connect-label-covers-arrow': connectorRules['connect-label-covers-arrow'].scope,
  'chart-axis-mismatch': 'band-grouped',
  'wrap-fell-back': 'diagram',
  'shrink-narrow-text': 'band',
  'gray-tone-collision': 'band-grouped',
  'rowheader-tone-collides': tableRules['rowheader-tone-collides'].scope,
  'semantic-table-warning': tableRules['semantic-table-warning'].scope,
  'swimlane-lanes': 'band',
  'swimlane-hand-offs': 'band',
  'edge-crossings': connectorRules['edge-crossings'].scope,
  'edge-bends': 'band',
  'edge-parallel': 'band',
  'quadrant-item-moved': 'band',
  'quadrant-size-floor': 'band',
  'quadrant-empty-cell': 'band',
  'quadrant-tone-only': 'band',
  'funnel-values-rise': 'band',
  'toc-ude-count': 'band',
  'toc-no-desired-result': 'band',
  'toc-parts': 'band',
  'toc-nbr-parts': 'band',
  'toc-nbr-no-tipping': 'band',
  'toc-nbr-tipping-not-and': 'band',
  'toc-nbr-trim-too-late': 'band',
  'toc-tt-unit': 'band',
  'toc-prt-bottom-not-action': 'band',
  'toc-prt-one-to-one': 'band',
  'toc-obstacle-phrase': 'band',
  'toc-injection-to-obstacle': 'band',
  'toc-role-indistinct': 'band',
  'toc-legend-suggested': 'diagram',
  'toc-mirror': 'band',
  'fta-gate-one-input': 'band',
  'fta-vote-degenerate': 'band',
  'fta-top-is-leaf': 'band',
  'fta-undeveloped-left': 'band',
  'isisnot-no-isnot': 'band',
  'isisnot-no-distinct-at-all': 'band',
  'isisnot-no-hypothesis-stands': 'band',
  'whywhy-no-root': 'band',
  'whywhy-measure-without-root': 'band',
  'whywhy-single-chain': 'band',
  'whywhy-dig-below-root': 'band',
  'bowtie-barrier-missing': 'band',
  'comic-bubble-wide': 'band',
  'comic-orphan-line': 'band',
  'comic-follower-split': 'band',
  'comic-value-invalid': 'band',
  'comic-values-unknown': 'band',
  'slot-overflow': 'band',
  'fta-single-point': 'band',
  'toc-source-has-cause': 'band',
  'toc-chain-only': 'band',
  'toc-orphan': 'band',
  'toc-cycle-undeclared': 'band',
  'graph-orphan-node': connectorRules['graph-orphan-node'].scope,
  'graph-disconnected': connectorRules['graph-disconnected'].scope,
  'term-variant': 'band-grouped',
  'term-avoid': 'band-grouped',
  'table-sum-mismatch': tableRules['table-sum-mismatch'].scope,
  'table-share-not-100': tableRules['table-share-not-100'].scope,
  'arrow-labels': connectorRules['arrow-labels'].scope,
  'canvas-region-empty': 'band',
  'one-story': 'diagram',
  'slide-min-text': 'diagram',
  'font-floor-lowered': 'diagram',
  'box-size-ignored': 'band-grouped',
  'stat-no-source': 'band',
  'stat-fit-shrunk': 'band',
  'slide-canvas-overflow': 'diagram',
  'aspect-tall': 'diagram',
  'doc-width': 'diagram',
  'flowchart-decision-edges': 'band',
  'auto-fit-applied': layoutFitRules['auto-fit-applied'].scope,
  'cause-line-scale-dropped': 'band-grouped',
  'density-compact-restored': 'band-grouped',
  'density': 'diagram',
  'concentric-label-crossing': 'band',
  'wf-callout-no-note': wireframeCalloutRules['wf-callout-no-note'].scope,
  'wf-note-no-callout': wireframeCalloutRules['wf-note-no-callout'].scope,
  'wf-callout-gap': wireframeCalloutRules['wf-callout-gap'].scope,
  'wf-callout-duplicate': wireframeCalloutRules['wf-callout-duplicate'].scope,
  'wf-states-todo': 'band',
  'wf-states-required': 'band',
  'wf-states-ragged': 'band',
  'wf-callout-order': wireframeCalloutRules['wf-callout-order'].scope,
  'layout-sibling-size': 'band',
  'layout-edge-misalign': 'band',
  'layout-gutter-uneven': 'band',
  'layout-unused-space': 'band',
  'layout-figure-offset': 'diagram',
  'layout-figure-narrow': 'diagram',
  'layout-align-mixed': 'band',
  'doc-image-missing': 'diagram',
  'doc-alt-empty': 'diagram',
  'doc-alt-long': 'diagram',
  'doc-notes-missing': 'diagram',
  'doc-notes-mismatch': 'diagram',
  'doc-png-has-svg': 'diagram',
  'doc-png-no-source': 'diagram',
  'doc-orphan-png': 'diagram',
  'doc-svg-no-source': 'diagram',
  'doc-orphan-svg': 'diagram',
} satisfies Record<RuleId, 'band' | 'band-grouped' | 'diagram'>;

export function applyAutoLegend(d: DiagramData): void {
  if (d.legend !== 'auto') return;
  const items = missingLegendItems(d.bands, d.legendLabels, dimmedBands(d));
  if (!items.length) return;
  const existing = d.bands.find((b): b is LegendBand => b.type === 'legend');
  if (existing) existing.items.push(...items);
  else d.bands.push(withSource<LegendBand>({type: 'legend', items, align: 'center'}, sourceOf(d)));
}

function ratioText(r: number): string { return r.toFixed(1); }

/** Taller than this many widths: a book page is about 1.5 to 1.6 tall for its width, so a figure past it needs a page of its own. */

function textContrast(d: LintTarget, tones: ToneEnv, out: Finding[]): void {
  const paint = paintOf(tones, d.appearance);
  const pairs = new Map<string, {finding: Finding; refs: Set<SourceRef>}>();
  const check = (band: LaidOutBand, fg: string | undefined, bg: string | undefined, what: string): void => {
    if (!fg || !bg) return;
    fg = paint(fg); bg = paint(bg);
    const need = 4.5, r = lightWcag(fg, bg), key = `${fg}|${bg}`;
    if (r < need) {
      let pair = pairs.get(key);
      if (!pair) {
        pair = {refs: new Set(), finding: {rule: 'a11y-text-contrast', severity: 'warn', message: `${what} の文字 ${fg} と背景 ${bg} のコントラスト比が ${ratioText(r)}:1（4.5:1 以上が目安）`}};
        pairs.set(key, pair);
      }
      const ref = sourceOf(band);
      if (ref) pair.refs.add(ref);
    }
  };
  const boxes: (LaidOutBand | LaidOutBox)[] = [];
  for (const b of d.laidOut ?? []) { if (b.type === 'row' || b.type === 'grid') boxes.push(...b.children); else boxes.push(b); }
  for (const b of boxes) {
    if (b.type === 'box' || b.type === 'banner') {
      const bg = b.dim ? PALETTE.bg : resolveBoxStyle(tones, b.tone ?? ((b.type as string) === 'banner' ? 'accent' : 'plain'), d.day) /* banner() always sets tone; the fallback is defensive */.fill;
      const boxTone = b.tone ?? ((b.type as string) === 'banner' ? 'accent' : 'plain');
      for (const run of b.wrappedRuns ?? []) check(b, b.dim ? PALETTE.muted : runColorOf(tones, run.tone, boxTone, d.day), bg, `「${String(run.text).slice(0, 14)}」`);
      if (!b.dim) for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if (sp.tone) check(b, resolveTextColor(tones, sp.tone, d.day), bg, `「${sp.text.slice(0, 14)}」`);
      if (b.tag) check(b, PALETTE.bg, colorOf(toneStyle(tones, b.tagTone === 'danger' || b.tagTone === 'muted' ? b.tagTone : 'accent').ink, d.day), `タグ「${b.tag}」`);
    } else if (b.type === 'caption') {
      for (const run of b.wrappedRuns ?? []) check(b, resolveTextColor(tones, run.tone, d.day), PALETTE.bg, `「${String(run.text).slice(0, 14)}」`);
      for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if (sp.tone) check(b, resolveTextColor(tones, sp.tone, d.day), PALETTE.bg, `「${sp.text.slice(0, 14)}」`);
    } else if (b.type === 'table') {
      if (b.titleBar) check(b, PALETTE.bg, PALETTE[d.day].accent, 'テーブルの題名帯');
      for (const row of b.rows) for (const c of row.cells) {
        const bg = row.header || (b.rowHeader && c === row.cells[0]) ? PALETTE[d.day].soft : row.tone ? resolveBoxStyle(tones, row.tone, d.day).fill : PALETTE.bg;
        if (c.lines.length) check(b, resolveTextColor(tones, c.tone, d.day), bg, `表のセル「${must(c.lines[0]).slice(0, 12)}」`);
      }
    }
  }
  for (const {finding, refs} of pairs.values()) out.push({...finding, ...fromSources(refs)});
}

// em.danger() / em.accent() without em.b(): the emphasis is the colour alone (WCAG 1.4.1). em.muted() softens, so it is not one.
function colourOnlyEmphasis(d: LintTarget, out: Finding[]): void {
  if (d.medium !== 'doc') return;
  const words: string[] = [], parts = new Set<LaidOutBand>();
  const boxes: (LaidOutBand | LaidOutBox)[] = [];
  for (const b of d.laidOut ?? []) { if (b.type === 'row' || b.type === 'grid') boxes.push(...b.children); else boxes.push(b); }
  for (const b of boxes) {
    if (b.type !== 'box' && b.type !== 'banner' && b.type !== 'caption') continue;
    if (b.dim) continue;
    for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if ((sp.tone === 'danger' || sp.tone === 'accent') && !sp.bold) { words.push(`「${sp.text.slice(0, 14)}」`); parts.add(b); }
  }
  if (words.length) out.push({...fromSources([...parts].map(b => sourceOf(b))), rule: 'a11y-color-only-emphasis', severity: 'warn', message: `色だけで強調した語: ${words.slice(0, 6).join('')}${words.length > 6 ? ` ほか ${words.length - 6} 件` : ''}。em.b() も併用する`});
}

function nonTextContrast(d: LintTarget, tones: ToneEnv, out: Finding[]): void {
  const wcagRatio = wcagIn(d, tones);
  const used = new Map<EmphasisTone, BoxBand[]>();
  const dimmed = dimmedBands(d);
  for (const b of walkBands(d.bands)) if (b.type === 'box' && !dimmed.has(b)) {
    const tone = b.tone ?? 'plain', parts = used.get(tone) ?? [];
    parts.push(b);
    used.set(tone, parts);
  }
  for (const [t, parts] of used) {
    const st = resolveBoxStyle(tones, t, d.day);
    // a tone with no border of its own (solid) is drawn with its fill as the stroke: the fill against the page is what delimits it
    const ts = toneStyle(tones, t), own = typeof d.day === 'string' ? ts.stroke : ts.slideStroke ?? ts.stroke;
    const r = own == null ? wcagRatio(st.fill, PALETTE.bg) : Math.min(wcagRatio(st.stroke, st.fill), wcagRatio(st.stroke, PALETTE.bg));
    if (r < 3) out.push({...at(parts[0], ...parts.slice(1)), rule: 'a11y-nontext-contrast', severity: 'warn', message: `トーン「${t}」の枠線 ${st.stroke} が、背景に対して ${ratioText(r)}:1（3:1 以上が目安）。タグや文言など、色以外の手がかりを必ず併用する`});
  }
  let firstArrow: {col: string; r: number} | undefined;
  const arrowRefs: SourceRef[] = [];
  for (const c of d.connects ?? []) {
    // connector colours are resolved the same way emit does
    const col = c.dim ? PALETTE.muted : c.tone === 'muted' || c.tone === 'danger' || c.tone === 'accent' ? colorOf(toneStyle(tones, c.tone).ink, d.day) : PALETTE.text;
    const r = wcagRatio(col, PALETTE.bg);
    if (r < 3) {
      firstArrow ??= {col, r};
      if (col !== firstArrow.col) continue;
      const ref = sourceOf(c);
      if (ref) arrowRefs.push(ref);
    }
  }
  if (firstArrow) out.push({...fromSources(arrowRefs), rule: 'a11y-nontext-contrast', severity: 'warn', message: `矢印の色 ${firstArrow.col} のコントラスト比が ${ratioText(firstArrow.r)}:1`});
}

function legendRules(d: LintTarget, out: Finding[]): void {
  if (d.legend === false) return; // the author declared that this diagram needs no legend
  const all = walkBands(d.bands);
  const notation = all.filter(b => b.type === 'box' || b.type === 'connect' || b.type === 'legend');
  out.push(...legendFindings(notation, wordedCanvasBands(all), d.legendLabels, dimmedBands(d)));
}

function rowHeaderRules(d: LintTarget, tones: ToneEnv, out: Finding[]): void {
  for (const b of walkBands(d.bands)) if (b.type === 'table') out.push(...semanticTableFindings(b));
  for (const b of d.laidOut ?? []) if (b.type === 'table') out.push(...rowHeaderFindings(b, tones));
}

function grayToneRules(d: LintTarget, tones: ToneEnv, out: Finding[]): void {
  const all = walkBands(d.bands), worded = wordedCanvasBands(all);
  const samples: [object, string[]][] = [];
  for (const b of all) if (b.type === 'box' && !worded.has(b)) samples.push([b, [b.tone ?? 'plain']]);
  for (const b of all) if (b.type === 'emblem') samples.push([b, b.items.map(i => i.tone ?? 'plain')]);
  for (const b of d.laidOut ?? []) if (b.type === 'table') samples.push([b, b.rows.flatMap(r => !r.header && r.tone ? [r.tone] : [])]);
  out.push(...grayToneFindings(d, tones, samples));
}

function swimlaneRules(d: LintTarget, out: Finding[]): void {
  const lanesBands = d.bands.filter((b): b is SwimlaneBand => b.type === 'swimlane');
  if (lanesBands.length > 1) out.push({rule: 'one-story', severity: 'warn', message: `スイムレーンが ${lanesBands.length} つある。1 図 1 話にして、図を分けることを検討する`});
  for (const sl of lanesBands) out.push(...swimlaneFindings(sl, d.connects ?? []));
}

function wireframeRules(d: LintTarget, out: Finding[]): void {
  for (const band of d.laidOut ?? []) if (band.type === 'wireframe') out.push(...calloutOrderFindings(band));
  for (const band of walkBands(d.bands)) {
    if (band.type === 'wireframe') out.push(...calloutNoteFindings(band));
    if (band.type === 'screens') out.push(...stateMatrixFindings(band));
  }
}

/** The severity of the layout-quality findings (`layout-*`, and ADR 0016's `edge-bends`): info, or warn for a diagram that asked for diagram({layoutCheck: 'strict'}). */
export const layoutSeverity = (d: Pick<DiagramData, 'layoutCheck'>): 'warn' | 'info' => d.layoutCheck === 'strict' ? 'warn' : 'info';

/** The severity of the `toc-*` findings (ADR 0015 D3): info, or warn for a diagram that asked for diagram({tocCheck: 'strict'}). */
export const tocSeverity = (d: Pick<DiagramData, 'tocCheck'>): 'warn' | 'info' => d.tocCheck === 'strict' ? 'warn' : 'info';

/** The severity of the cause-analysis findings (ADR 0025 D5 / ADR 0026 D1): info, or warn for a diagram that asked for diagram({rcaCheck: 'strict'}). A finding that carries its own `severity` keeps it. */
export const rcaSeverity = (d: Pick<DiagramData, 'rcaCheck'>): 'warn' | 'info' => d.rcaCheck === 'strict' ? 'warn' : 'info';

/** The advice of the comic bands' line breaks (ADR 0074 D2): the layout found them, the lint reports them. A mistake of the data is a check problem (lib/verify-handlers.ts), not a finding. */
function comicRules(d: LintTarget, out: Finding[]): void {
  for (const b of d.laidOut ?? []) if (b.type === 'comic') for (const f of b.findings) if (f.severity === 'advice') out.push({...at(b), rule: f.rule, severity: 'warn', message: f.message});
}

/** The checks of the cause-analysis figures. Empty on purpose: each figure (faultTree, isIsNot, whyWhy*, bowtie) adds its own branch, reported at `f.severity ?? rcaSeverity(d)` like tocRules. */
function rcaRules(d: LintTarget, out: Finding[]): void {
  const severity = rcaSeverity(d);
  for (const b of walkBands(d.bands)) {
    if (b.type === 'fta') out.push(...analysisFindings(b, ftaFindings(b), severity));
    if (b.type === 'bowtie') out.push(...analysisFindings(b, bowtieFindings(b), severity));
    if ((b.type === 'table' || b.type === 'cause') && b.rca) out.push(...analysisFindings(b, b.rca.findings, severity));
  }
}

/** stat-no-source (ADR 0023 D10): a stat() number with no source. Runs only for a diagram that wrote diagram({evidenceCheck}). */
function evidenceRules(d: LintTarget, out: Finding[]): void {
  if (d.evidenceCheck === undefined) return;
  const severity = d.evidenceCheck === 'strict' ? 'warn' : 'info';
  for (const b of walkBands(d.bands)) if (b.type === 'box' && b.statValue !== undefined && !b.evidence) out.push({...at(b), rule: 'stat-no-source', severity, message: `数字 ${b.statValue} に出典がない(stat の source を足す)`});
}

function tocRules(d: LintTarget, out: Finding[]): void {
  const severity = tocSeverity(d);
  // a TOC tree on a diagram that says nothing about its legend: the roles are told apart only by a legend (ADR 0029 D1)
  if (d.legend === undefined && walkBands(d.bands).some(b => b.type === 'cause' && b.tree !== undefined)) out.push(tocLegendFinding());
  for (const b of walkBands(d.bands)) if (b.type === 'cause') out.push(...analysisFindings(b, tocFindings(b), severity));
}

// Alignment and whitespace (ADR 0014): measured on the laid-out bands (lib/layout-metrics.ts), reported at layoutSeverity(d).
function layoutQualityRules(d: LintTarget, out: Finding[]): void {
  if (!d.laidOut) return;
  const severity = layoutSeverity(d);
  for (const {rule, message, data, ...location} of layoutMetrics(d.laidOut, {width: d.width, slideCanvas: !!d.canvas})) {
    out.push({rule, severity, message, data, ...location});
  }
}

/** The exact snippet that accepts a finding of `rule` (for the warning output); '' for a rule that cannot be accepted. */
export function acceptHint(rule: string): string {
  return Object.hasOwn(RULE_DOCS, rule) ? findingAcceptanceHint(rule) : '';
}

/** Layout copies share SourceRefs across appearances, including refs from the same helper's different calls. */
export function mergeFindingSides(light: readonly Finding[], dark: readonly Finding[]): Finding[] {
  const refs = new Map<SourceRef, number>();
  const id = (ref: SourceRef): number => {
    const existing = refs.get(ref);
    if (existing !== undefined) return existing;
    const next = refs.size + 1;
    refs.set(ref, next);
    return next;
  };
  return mergeSides(light, dark, f => {
    const wording = `${f.rule}\0${f.message}`;
    if (RULE_LOCATION[f.rule as RuleId] === 'band-grouped') return wording;
    const locations = [f.loc, ...(f.related ?? [])].map(ref => ref ? id(ref) : 0);
    return `${wording}\0${locations.join(',')}`;
  }, f => ({...f, message: `${f.message} (${DARK_NOTE})`}));
}

export function lintDiagram(d: LintTarget): Finding[] {
  if (d.appearance === 'auto') { // ADR 0023 D4: both colour sides, the same finding once, a dark-only one marked
    const side = (appearance: 'light' | 'dark') => lintDiagram({...d, appearance});
    return mergeFindingSides(side('light'), side('dark'));
  }
  const out = lintAll(d, toneEnv(d.tones));
  const diagramLocation = at(d);
  return out.map(f => {
    const located = RULE_LOCATION[f.rule as RuleId] === 'diagram' || !f.loc ? {...f, ...diagramLocation} : f;
    return applyFindingAcceptance(located, d.accept);
  });
}

export const HEADLINE_BUDGET_PX = 600;
// the role sizes (tokens ROLES; test/diagram-api.test.ts keeps them equal), kept here because the rendering core must not import that global table
export const HEADLINE_PX: Readonly<Record<'title' | 'banner' | 'stat' | 'display', number>> = {title: 15, banner: 16, stat: 34, display: 56};
const isHeadlineRole = (r: string | undefined): r is keyof typeof HEADLINE_PX => r != null && r in HEADLINE_PX;
// a headline line over the budget (a guide in full-width characters: what fits a 600px text column), or one the layout had to wrap
function headlineLength(d: LintTarget, out: Finding[]): void {
  const seen = new Map<SourceRef | undefined, Set<string>>();
  const seenFor = (band: Band | LaidOutBand): Set<string> => {
    const loc = sourceOf(band);
    let lines = seen.get(loc);
    if (!lines) { lines = new Set(); seen.set(loc, lines); }
    return lines;
  };
  const flag = (band: Band | LaidOutBand, line: string, message: string): void => {
    const lines = seenFor(band);
    if (!lines.has(line)) { lines.add(line); out.push({...at(band), rule: 'cjk-line-long', severity: 'warn', message}); }
  };
  const quote = (line: string): string => { const t = line.trim(); return [...t].length > 16 ? `${[...t].slice(0, 16).join('')}…` : t; };
  const check = (band: Band, text: string, role: keyof typeof HEADLINE_PX): void => {
    const budget = Math.floor(HEADLINE_BUDGET_PX / HEADLINE_PX[role]);
    for (const line of text.split('\n')) {
      const u = fullWidthUnits(line.trim());
      if (u > budget) flag(band, line, `見出しの 1 行が全角 ${Math.ceil(u)} 字ぶんで、${budget} 字の目安（${role}。本文幅 ${HEADLINE_BUDGET_PX}px に収まる字数）を超える: 「${quote(line)}」。短くするか、改行して分ける`);
    }
  };
  for (const b of walkBands(d.bands)) {
    if (b.type === 'caption' && !b.sourceLine && isHeadlineRole(b.role)) check(b, b.text, b.role);
    else if (b.type === 'banner') check(b, b.headline, b.headlineRole ?? 'banner');
  }
  // under the budget but still wrapped by the layout (a narrow diagram, a banner in a row): the break falls anywhere, even inside a word
  const laid = (d.laidOut ?? []).flatMap(b => b.type === 'row' || b.type === 'grid' ? b.children : [b]);
  for (const b of laid) {
    const head = b.type === 'caption' && !b.sourceLine && isHeadlineRole(b.role) ? b.text : b.type === 'banner' ? b.headline : null;
    const run = head != null ? (b as {wrappedRuns: {text: string; lines: string[]}[]}).wrappedRuns[0] : undefined;
    if (head == null || !run) continue;
    const given = head.split('\n');
    if (run.lines.length > given.length && !given.some(l => seenFor(b).has(l))) flag(b, head, `見出しが幅に収まらず、${run.lines.length} 行に自動で折り返している: 「${quote(must(given[0]))}」。短くするか、区切りのよいところで改行する`);
  }
}

function lintAll(d: LintTarget, tones: ToneEnv): Finding[] {
  const out: Finding[] = [];
  out.push(...wrapFallbackFindings(d));
  out.push(...axisMismatchFindings(axisMismatches(d.bands)));
  out.push(...labelCoverFindings(d));
  out.push(...midWordFindings(d));
  out.push(...pictographFindings(d));
  layoutQualityRules(d, out);
  out.push(...edgeBendFindings(d));
  out.push(...parallelEdgeFindings(d));
  tocRules(d, out);
  rcaRules(d, out);
  comicRules(d, out);
  for (const band of d.laidOut ?? []) out.push(...layoutFitFindings(band));
  out.push(...densityRestorationFindings(d));
  for (const b of d.laidOut ?? []) if (b.type === 'concentric') out.push(...concentricFindings(b));
  for (const b of d.laidOut ?? []) if (b.type === 'states') out.push(...flowchartFindings(b));
  textContrast(d, tones, out);
  colourOnlyEmphasis(d, out);
  nonTextContrast(d, tones, out);
  legendRules(d, out);
  swimlaneRules(d, out);
  for (const b of d.laidOut ?? []) if (b.type === 'bpmn' || b.type === 'swimlane') out.push(...narrowTextFindings(b));
  wireframeRules(d, out);
  rowHeaderRules(d, tones, out);
  grayToneRules(d, tones, out);
  out.push(...graphFindings(d, walkBands, itemIdsOf));
  out.push(...termFindings(d.bands, d.terms), ...tableFindings(walkBands(d.bands)));

  out.push(...connectorFindings(d));
  out.push(...statFitFindings(d));
  evidenceRules(d, out);
  out.push(...boxSizeFindings(walkBands(d.bands)));
  if (d.canvas && d.laidOut) {
    const min = minTextSize(d, bandTextSizes);
    out.push(...canvasFindings(d.canvas, min, d.contentHeight));
  }
  out.push(...aspectTallFindings(d, () => walkBands(d.bands)));
  out.push(...documentWidthFindings(d));
  // doc diagrams are read at length on a page, so their budget is larger than the slide decks' (see budget.ts)
  out.push(...textBudgetFindings(d));
  out.push(...hiddenBarsTitleFindings(d, () => diagramTitle(d), walkBands));
  for (const b of walkBands(d.bands)) if (b.type === 'image') out.push(...imageSizeFindings(b));
  out.push(...thinBarFindings(d));
  headlineLength(d, out);
  if (d.status !== undefined) out.push(draftStatusFinding(d.status));
  for (const b of d.laidOut ?? []) if (b.type === 'caption') out.push(...sourceLineFindings(b));
  for (const b of d.laidOut ?? []) if (b.type === 'quadrant') out.push(...quadrantLayoutFindings(b));
  for (const b of walkBands(d.bands)) if (b.type === 'quadrant') out.push(...quadrantFindings(b));
  for (const b of walkBands(d.bands)) if (b.type === 'funnel') out.push(...funnelFindings(b));
  for (const b of walkBands(d.bands)) if (b.type === 'grid') out.push(...canvasRegionFindings(b));
  out.push(...duplicateTitleFindings(d, walkBands));
  if (d.medium === 'doc') out.push(...missingTitleFindings(d, diagramTitle(d)));
  return out;
}

// ---- SVG accessible name / description -------------------------------------------------

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
    if (b.type === 'emblem') return oneLine(b.items[0]?.label);
    if (b.type === 'valueChain') return oneLine(b.primary[0]?.label);
    if (b.type === 'wordart') return oneLine(b.text);
  }
  return '';
}

/** `stage`: a click stage of a revealing diagram; only what is on screen then is listed (nothing is left out without it). */
export function diagramDesc(d: DiagramData, stage?: number): string {
  const text = d.desc ? oneLine(d.desc) : describeBands(walkBands(d.bands), stage);
  // a figure with a status says so first, in the badge's own wording ("(下書き)"); one without is unchanged
  return d.status === undefined ? text : `(${statusText(d)})${text ? ` ${text}` : ''}`;
}
