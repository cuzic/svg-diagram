# ADR 0076: マンガのワークシートの拡張 — マンプと小道具、選択肢とヒント、時間の札と大ゴマ、自分のアバター、LLM の場面生成と検査

- 状態: 承認(Accepted。2026-11-22。レビュー 2 回で収束(Blocker・Major なし)。Q1〜Q16 はすべて決定済み。下の「決定済み」。**実装は U1 から始めてよい**。前提は各単位の表のとおり(ADR 0074 U4 まで)。設計と小さなスパイクで、`lib/` は変えていない)
- 日付: 2026-11-22
- 基点: `main`(23e43e16。ADR 0074 が入った時点)。名前と型は、ADR 0074 の文面、U1 の PR #436(`lib/comic/`、`lib/types/comic.ts`)、ADR 0077 の PR #435 に合わせた
- 関連: ADR 0074(コマ・ふきだし・人物・穴。この ADR はその型を広げる。**変える所は「ADR 0074 への変更」の表にすべて書く**)、ADR 0077(ふきだしの輪郭)、ADR 0072(source locations)、ADR 0071(JSON Schema)、ADR 0069(`partCatalog` と MCP の `list_diagram_parts`)、ADR 0057(spec の `canvas`)
- 範囲外: 縦書き(ADR 0074 の第 2 版)、絵師の素材そのもの、印刷用の文字の輪郭化
- 例のデータはすべてこの ADR のための作り話。ADR 0074 の例(「週に一度は早く帰る」、「最近、{change}ね」)と、オフィスや日常の一般的な場面だけを使う

## 背景

ADR 0074 は、台詞に穴のあるマンガの土台(`comic()` の帯、`bubble()`、パラメトリックな顔、穴、`renderComic` / `update`、幾何の地図、検査)を決めた。実装は U1(PR #436)が出ている。

決める人は、次に効く拡張を 5 つ選んだ。優先の順に: (1) マンプ(漫符)と小道具、(2) 穴の選択肢とヒント、(3) 時間の札と大きなコマ・コマ数、(4) 自分のアバター、(5) LLM の場面生成と読む順などの検査。

**方針は 3 つ。**

- ADR 0074 の型の**任意の項目を足す**。`version: 1` のまま。足した項目が無いデータは、今までと同じ SVG になる(ADR 0074 の golden を変えない)。例外は 1 つで、体の境目の 3 層(D4。髪の輪郭だけではない)。これは ADR 0074 U2 が入る前に決める(下の「ADR 0074 への変更」)。
- 意味が先(ADR 0074 の方針)。データに座標や大きさを置かない。位置は幾何の地図と決まった規則から出す。
- 決定的で、SVG だけ(`<text>` と `<use>` とフィルタを使わない)。`update` で値が変わっても、足した要素の位置は動かない。座標は、**1/4px の倍数にそろえる**(エンジンで三角関数の最後の桁が違っても、結果が変わらないように)。

### ADR 0074 から前提にするもの

| 前提 | 出どころ | この ADR での使い道 |
|---|---|---|
| `geometry`: `panels` / `bubbles` / `slots` / `heads` / `points`(`mouth`、`head: [cx, cy, r]`) | 0074 D5 | D1、D2 の置き場所 |
| しっぽ `{base: [Pt, Pt], tip, from}`(`ComicLaidBubble.tail`。ADR 0077 も同じ名前) | PR #436 `lib/types/comic.ts`、PR #435 | D1 のぶつかりの検査 |
| 頭の円の半径 36px、頭の中心は下から 76px、人物の `at` は 3 か所。コマの幅は 1 列で 420px、2×2 で 360px | 0074 D1、`lib/comic/constants.ts` | 頭のアンカー |
| ふきだしの高さの予算。縦横比は **6:5**(0074 U1 の測定で確定。PR #436)。コマは 420×352px(`snap4`)、ふきだしの帯は 220px | 0074 D1、Q10 | D3 の札が帯を縮める |
| `Cast.face = {hue, hair}`、素材の `anchors`(`head` / `mouth` / `hand`) | 0074 D3、D6 | D4、手のアンカー |
| 穴の `max` / `choices` / `strict`、`update` の `seq` と `stale` | 0074 D4、D5 | D2 |
| 検査の `ComicFinding = {rule, severity: 'problem' \| 'advice', where, message}`(U1)と、共通の `Finding = {message, loc?, related?, rule, severity: 'warn' \| 'info', data?: FindingData}`、`FindingData = {band?, measured, threshold, fix?}`(`lib/types/verdicts.ts`)、`RULE_DOCS`(規則名 → 説明の文字列) | PR #436、`lib/schema-files.ts:127` | D5 |

### ADR 0074 への変更(この ADR が変える所。型・規則・幾何の地図・id・Schema の項目ごとに 1 行)

| # | 項目 | ADR 0074 の文面 | この ADR | 変える単位 |
|---|---|---|---|---|
| A1 | `Face.hue` と `Face` の項目 | D6: `face?: {hue: number; hair?}`(`face` があれば `hue` は必須) | `hue` は任意。`hairColor` / `skin` / `glasses` / `top` を足す(D4)。`hue` が無いとき、`hairColor` の既定は `brown`、`top` の既定は `gray`。`hair` は 2 種から 4 種 | U4 |
| A2 | 体の境目の描き方 | D3 / スパイク: 髪に輪郭が無い。顔・首・服の境目も塗りだけ。U2 は未マージ | **無条件で、2 つの塗りの境目(髪と顔、顔と首・服、髪と肩、眼鏡の枠)すべてに 3 層(紙色のキーライン・インク・キーライン)を付ける**(D4)。肌の `fair` は、U1 が使う肌色のトークン(`COLOR.skin` = `PALETTE.amber.soft`)とする。ADR 0074 U2 の PR が入る前なら U2 に取り込む。入ったあとなら U4 で golden を 1 回だけ更新する | U2(0074)または U4。**0074 U2 の PR に取り込んだ**(U4 では体の境目を変えない) |
| A3 | `comic-panel-count` | D6: `panels` の数が `layout` と違う(問題) | `comic-grid-fill`(升の置き方の検査)に置き換え。スパンが無ければ同じ意味 | U3 |
| A4 | `comic-slots-per-panel` | 1 コマ 2 個まで | `2 × cols` 個まで(幅 1 のコマは 2 個のまま) | U3 |
| A5 | `comic-reading-order` | D1 / D6: `anchor` の上書きが読む順に反する(助言) | 幾何の地図を読む検査に広げる(D5c)。重さは助言のまま | U6 |
| A6 | `choices` の個数 | 上限なし | 9 個以上は助言 `comic-slot-choices`(問題にしない。既存のデータを止めない) | U2 |
| A7 | `Dialogue.who` | D6: `who: string`(必須)。`comic-speaker-unknown` は `cast` に無い `who` を止める | `kind` が `narration` と `caption` のときは `who` を省ける(Schema は `if` / `then`)。話し手の検査は両方とも対象外 | U3 |
| A8 | `Dialogue.kind` | `say` / `think` / `shout` / `narration` | `caption` を足す | U3 |
| A9 | 割り(`layout`) | `1x4` / `2x2` / `1x3` / `1x2` | `2x3` を足す | U3 |
| A10 | 幾何の地図 | `{panels, bubbles, slots, heads, points}` | `tails`、`marks`、`props`、`captions`、`slotOrder`、`inputRects` を足す(既存の項目は変えない) | U1〜U3 |
| A11 | 層の順 | D2 の「しっぽ、ふきだし」を別々に描く | ふきだしの輪郭は**しっぽを含む 1 本の経路**(ADR 0077)。D1 の層の順はそれに合わせて書く | U1 |
| A12 | `renderComic` の引数 | `{measure, values, characters}` | `avatars` を足す。結果に `slotContext(id, values)` を足す | U2、U4 |
| A13 | 素材の `character.json` | `anchors` ほか | 任意の `recolor` を足す(D4) | U4 |
| A14 | `chat()`(D7) | 同じ `Dialogue` の列 | `marks` / `props` / `span` / 間奏は落とす。`caption` は中央の区切り | U7 |
| A15 | コマの縦横比 | Q10(6:5 を既定。U1 で確定) | **変えない**。この ADR は 6:5(0074 U1 の測定で確定。PR #436)を前提にして、札の分の帯の計算(D3a)を足すだけ | — |
| A16 | `ComicPanel` の項目 | `{id, bg?, thumb?, stage, dialogue}` | `marks` / `props`(U1)、`span`・`kind`(U3)を足す。**`kind: 'interlude'` のとき `stage` は空**(Schema の `if` / `then`) | U1、U3 |
| A17 | `SlotDef` の項目 | `{max?, prompt, fallback?, choices?, strict?}` | `hints` を足す | U2 |
| A18 | 札のあるコマの高さの予算 | D1: 頭の上の帯(6:5 で 220px) | 札があるコマは帯が 32px 下がり **188px**。`comic-bubble-zone` と `comic-text-budget` はこの帯で見る | U3 |
| A19 | `labels` と番号の札 | D1: `labels` は全コマに | 間奏には番号の札も `labels` も付かない。`labels` の数はふつうのコマの数 | U3 |
| A20 | id の文法と幾何の地図の鍵 | コマ `p1`、ふきだし `p1.d2`、頭 `p1.me` | マンプ `p1.me.m1`、小道具 `p1.me.o1`(`n` は同じ人物・同じ種類の通し番号)。地図の `marks` / `props` / `captions` / `tails` の鍵は、その id(帯に scope があれば前に `scope.`) | U1、U3 |
| A21 | `RULE_DOCS` の行と `FindingData` | 規則名 → 説明の文字列 | 形は変えず、**新しい規則ごとに行を足す**(各単位が自分の規則の行を持つ)。`FindingData` に任意の `where?: string` を足し、comic の検査は D5b のとおり `measured` / `threshold` を埋める | 各単位、U5 |

0074 の「状態」の行には、この ADR が採用されたとき、「ADR 0076 が拡張・一部変更」の 1 行を足す(U0 のドキュメントの PR)。

### スパイク(`spikes/comic-extensions/`。`lib/` は触っていない)

ADR 0074 のスパイク(`spikes/comic-worksheet/proto.ts`)を**そのまま取り込み**、その `Geometry` の上に層を足した(Node、HarfBuzz。ふきだしの id はスパイクが `p1.b0`(0 始まり)、U1 は `p1.d1`)。

| ファイル | 内容 |
|---|---|
| `manpu.ts` | マンプ 10 種と小道具 6 種、整数の表のアンカー、厳密なぶつかりの検査(線分・矩形・円の交差)、しっぽ `{base, tip, from}`、候補を順に試す置き方 |
| `run.ts` | 2 人のコマ 4 つ(0074 のサンプル)と、3 人(左・中央・右)のコマ 1 つで数える。`out/scene-resolved.svg`、`out/scene-first-choice.svg`、`out/three-people.svg` |
| `checks.ts` / `run-checks.ts` | 読む順・しっぽの交差・話し手の不明(幾何の地図だけを読む) |
| `palette.ts` | パレットのコントラストと、キーラインの測定。`out/avatar-keyline.svg`(平らな矩形)、`out/avatar-heads.svg`(最悪の 3 組の頭を原寸と縮小図の倍率で。キーラインは境目の線だけで、外側の輪郭は無い。縮小図では 0.57px のキーラインが細くなるが、インクの線は見える。縮小図は絵として扱う(0074 D5)ので、そのまま許す) |

測った数:

| 測ったこと | 結果 |
|---|---|
| 場面(要求したのは**マンプ 7 個と小道具 5 個の計 12 個**) | **11 個が置けた**。置けなかった 1 個は 2 コマ目の左の人物のマンプ。最初の候補でぶつかったのは 3 個。候補を試して 2 個が解決 |
| 希望の `at` を書いたもののうち、そこに置けなかったもの | 12 個中 2 個(壁の時計と壁のカレンダーが `hand` に落ちた) |
| マンプ 10 種 × 人物 11 人(2 人のコマ 8 人 + 3 人のコマ 3 人 = 110 通り。`center` は 1 人) | 最初の候補が衝突: 27 通り。左 17/50、右 7/50、中央 3/10。候補を試したあとに置けない: 10 通りで、**すべて 2 コマ目の左の人物**。このコマは 0074 のサンプルが 6:5 でなく 7:5 のまま `comic-bubble-zone` と `comic-text-budget` を出している(原因は積みきれないふきだしで、マンプが置けないのは結果) |
| 小道具 6 種 × 人物 11 人 × 要求のアンカー 4 種(264 通り) | **1 つも消えなかった**。要求のアンカーに置けた割合: `hand` 60/66、`floor` 48/66、`wall-out` 24/66、`wall-in` 18/66。落ちた先は `hand` か `wall-out`(壁は、ふきだしの帯と同じ高さで、ふきだしにぶつかりやすい)。壁のアンカーの y を札の下(コマの上から 72px)に置き、札(x 32、幅 140px、y 16〜44)を障害物に足した場合も、同じ数(24/66、18/66)で、札にはぶつからない |
| 1 場面(12 個)の置く時間(200 回の中央値を 5 回測った範囲) | 中央値 約 0.04 ms(0.036〜0.043)、90 パーセンタイル 0.06〜0.10 ms、最大 0.2〜0.3 ms。別の日の負荷の高いホストでは、中央値 0.07〜0.12 ms、ピークは数 ms。**桁の目安**(壁時計の基準にしない) |
| 足した SVG の大きさ | 11 個で約 2.9 KB(土台の 10.4 KB の 28%) |
| 新しい検査(読む順・しっぽの交差・話し手の不明) | 4 コマ・6 個のふきだしで約 1 ms。実際の幾何では 0 件。ふきだしを 2 つ入れ替え、1 つを話し手と反対側へ動かした複製では 6 件(読む順 1、しっぽの交差 2、話し手の不明 3) |
| パレット(肌 6・髪 6・服 9) | 髪と肌の 36 組のうち、色の差が 3:1 未満は 19 組、インクの輪郭だけでは 3:1 に届かないのは 26 組。服と肌の 54 組では色の差 3:1 未満が 44 組、輪郭だけで足りないのが 19 組。**色の差でも輪郭だけでも保証できない**。そこで、紙色のキーラインをインクの線の両側に付ける(15.6:1。D4) |

## 決定

### D1. マンプ(漫符)と小道具

**データ(ADR 0074 の `ComicPanel` に任意の項目を足す)**

```ts
interface ComicPanel {
  /* 0074 の項目 */
  marks?: Mark[];     // 頭につく記号(汗、怒りなど)
  props?: Prop[];     // 持つ・置く物(PC、コーヒーなど)
}
type MarkKind = 'sweat' | 'anger' | 'sparkle' | 'question' | 'exclaim' | 'heart' | 'sigh' | 'idea' | 'gloom' | 'zzz';
type HeadAnchor = 'top-out' | 'top-in' | 'top' | 'side-out' | 'side-in';
interface Mark { id?: string; kind: MarkKind; on: string; at?: HeadAnchor; size?: 's' | 'm' }   // size の既定は m
type PropKind = 'pc' | 'coffee' | 'calendar' | 'clock' | 'documents' | 'phone';
type PropAnchor = 'hand' | 'floor' | 'wall-out' | 'wall-in';
interface Prop { id?: string; kind: PropKind; on: string; at?: PropAnchor; alt?: string }
```

- `on` は、そのコマの `stage` にいる人物の id(いなければ `comic-extra-target`、問題)。
- `id` を省くと、`<コマ>.<on>.m<n>`(マンプ)、`<コマ>.<on>.o<n>`(小道具)。**`n` は、同じ人物の同じ種類(マンプか小道具か)の中の 1 始まりの通し番号**。ほかの人物にマンプを足しても、番号は変わらない(LLM が `where` の id で直すため)。
- データに座標はない。`at` は意味の名前で、**希望**であり強制ではない。種類は閉じた `enum`(Schema で止める)。

**アンカーの模型(規範)**

- **頭のアンカー**: 頭の中心(`points[…].head` の `cx`, `cy`)からの**整数のずれ**の表で決める(三角関数は使わない)。頭の円から 8px 離し、記号の半分の大きさを足した距離を、真上から 52°(`top-out` / `top-in`)・真上(`top`)・水平から 8° 上(`side-out` / `side-in`)の向きに取って、一度だけ丸めた値:

  | 大きさ | `top-out` | `top` | `side-out` |
  |---|---|---|---|
  | `s`(20px) | (33, −43) | (0, −54) | (53, −8) |
  | `m`(28px) | (36, −46) | (0, −58) | (57, −8) |

  `top-in` と `side-in` は x の符号を反転する。結果の座標は 1/4px の倍数に丸める。
- **`out` / `in` の向き(1 か所で決める)**: `out` は、コマの中央から離れる側。**`left` の人物は左、`right` の人物は右、`center` の人物は右**(`in` はその反対)。マンプにも小道具にも同じ規約を使う(スパイクで 3 人のコマを使って確かめた)。
- **小道具のアンカー**(頭の中心を基準に。y はコマの下から、または上から。幅や高さのあるコマ(D3)でも同じ式):

  | アンカー | x | y |
  |---|---|---|
  | `hand` | 内側へ 58px | コマの下から 30px(素材があれば `anchors.hand` を倍率をかけて使う) |
  | `floor` | 内側へ 108px | コマの下から 30px |
  | `wall-out` | 外側へ 76px | コマの上から **72px**(番号の札と、札のあるコマの札(D3a。y が 16〜44px、余白 4px)の下) |
  | `wall-in` | 内側へ 76px | コマの上から 72px |

  素材に `hand` が無いとき、`hand` を指定した小道具は `floor` から始める(助言 `comic-anchor-missing`)。頭のアンカーは `head` の円だけから出るので、素材に追加の印は要らない。

**置き方(規範。決定的)**

1. ふきだしを先に置く。**マンプと小道具はふきだしを動かさない**(文字が先)。
2. **小道具を先に、次にマンプを置く**。各種類の中では、データに書いた順。理由: 小道具は場面の情報で、候補が少ない(4 か所)ので先に取り、飾りのマンプが残りへ譲る。
3. **候補の並び**:
   - マンプ: (a) 書き手の `at`、(b) 種類ごとの好みの上位 3 つ(下の表)、(c) 残りを `top`、`top-out`、`top-in`、`side-out`、`side-in` の順に。重複は除く。
   - 小道具: `at`、`hand`、`floor`、`wall-out`、`wall-in`。重複は除く。

   | 種類 | 好みの順 |
   |---|---|
   | `sweat` | `top-out`、`side-out`、`top` |
   | `anger` / `question` / `exclaim` | `top-in`、`top`、`top-out` |
   | `sparkle` / `heart` / `zzz` | `top-out`、`top-in`、`side-out` |
   | `sigh` | `side-in`、`side-out`、`top-in` |
   | `idea` / `gloom` | `top`、`top-out`、`top-in` |

4. 先頭から、**ぶつからない最初の位置**を採る。置いた箱は障害物に足す。
5. **1 人あたりの上限**: マンプは 3 個、小道具は 2 個まで(超えた分は `comic-extra-count`、助言。置かない)。
6. 1 つも置けなければ: **マンプは描かず、助言**(`comic-mark-no-room`)。**小道具は描かず、問題**(`comic-prop-no-room`。場面の情報が消えるため)。ふきだしの帯が積みきれていて(`comic-bubble-zone`)置けないときは、その原因だけを報告し、これらは出さない(1 つの誤りは 1 回だけ。ADR 0074 と同じ)。
7. **`at` を書いたものが**、書いた位置と違う所に置かれたときだけ、助言 `comic-extra-moved`(`at` を書かないものは、既定の候補の並びのどこに置かれても出さない。LLM はふつう `at` を書かないので、助言が増えるだけになる)(書き手が「壁のカレンダー」と指定したのが「手に持つカレンダー」に変わると、意味が変わるため)。置いた位置は地図に残る(下)。

**ぶつかりの検査(ADR 0074 の検査を広げる)。** 置く箱(マンプは 20px か 28px、小道具は 40px の正方形)は、次のどれにも重ならない。判定は**厳密**(線分・矩形・円の交差。点を並べた近似にしない)。

| 障害物 | 余白 | 理由 |
|---|---|---|
| ふきだし | 4px | **ふきだしの外接の矩形**(形が楕円や雲でも、ADR 0077 の `shape` に関わらず矩形) |
| しっぽ | 2px | 付け根 2 点と先の三角形 `{base, tip}`。形が変わっても付け根と先が同じなら結果は同じ(ADR 0077。付け根の幅に結果が依存しないよう、余白を 2px 取る) |
| 頭の円(**自分も含む**) | 2px | 顔を覆わない |
| 先に置いたマンプ・小道具 | 2px | 重ねない |
| 札(D3a)の矩形 | 4px | あるとき |
| コマの縁 | 8px | 枠線に触れない |
| 番号の札(24px) | 4px | 左上 |

胴は障害物にしない。代わりに、床と手の小道具を**胴の上の層**に描く(下)。

**幾何の地図に足すもの(加えるだけ。A10)**: `tails: Record<id, {base, tip, from}>`(U1 の `ComicLaidBubble.tail` から。ADR 0077 が付け根と先を作り直しても、同じ名前と形)、`marks` と `props: Record<id, {rect, at, wanted}>`(`at` は置いた位置、`wanted` は希望。描かなかったものは載せない)。

**層の順(規範。DOM の順で決め、`z-index` は使わない)**: コマの紙と背景 → 壁の小道具 → 胴 → 顔 → **床と手の小道具** → マンプ → **ふきだしの輪郭(しっぽを含む 1 本の経路。ADR 0077)** → ふきだしの文字と穴。ふきだしはいつも一番上に出る。ぶつかりの検査があるので、マンプがふきだしに覆われることは起きない。

**SVG だけ・決定的。** 断片は固定の箱(24px / 40px)で描いた `<path>` / `<circle>` / `<rect>` で、`lib/comic/` が文字列で持つ。`<text>`・`<use>`・フィルタ・外部参照を使わない(ADR 0074 D3 の `sanitizeBody` を通る形)。色は `lib/tokens.ts` から取る。**どの線も、紙と色味の背景(`warm` / `cool`)に対して 3:1 以上**(インク 15.6:1、色つきの線は 5.3〜6.8:1。塗りの色はインクの線で縁取る)。`size: 's'` は 24px の断片を 0.83 倍するので、線の太さも同じ倍率で細くなる。

**アクセシビリティ。** マンプは気持ちを重ねるだけの飾りで、意味は `expression` と台詞が持つ。`aria-hidden="true"` にし、`<title>` を付けない。小道具は場面の情報なので `<title>` に日本語の名前を入れ、書き手が `alt` で上書きできる。

**`chat()` では、`marks` と `props` を静かに落とす**(U7)。

**代替案**

- **マンプを `expression` の一部にする**(`worry-sweat` など)。組み合わせが増え、`enum` が膨らむ。却下。
- **自由な `x` / `y`**。ADR 0074 の「データに座標を置かない」に反し、LLM の出力の位置が安定しない。却下。
- **絵文字の文字にする**。フォントと環境で見た目が変わる。却下。
- **置けないとき、置ける所までふきだしを動かす**。文字が先の原則に反し、値の長さで位置が動く心配が出る。却下。

### D2. 選択肢とヒント

**データ(ADR 0074 D4 の穴の定義に任意の項目を足す)**

```ts
interface SlotDef {  // 0074: {max?, prompt, fallback?, choices?, strict?}
  choices?: string[];  // 0074。ページがチップか選択欄で出す。自由入力も許す(strict でなければ)
  hints?: string[];    // 新規。最大 3 つ。例として見せる答え。選ばせるのでなく「たとえば」
}
```

**`choices` は「この中から選ぶ」候補、`hints` は「こう書けばよい」という例。** `choices` が無く `hints` だけなら、ページは入力欄の下に例を小さく出し、押すと入力欄へ入れる。`choices` があって `strict` でなければ、チップと自由入力を両方出す。`strict: true` なら選ぶだけ。新しい `mode` の項目は足さない。

| 規則 | 重さ | 内容 |
|---|---|---|
| `comic-slot-hints` | 問題 | `hints` が 4 個以上、重複、1 行でない、制御文字を含む |
| `comic-slot-hint-length` | 問題 | `hints` の 1 つが `max` 字を超える(押して入れても必ず穴に入るように) |
| `comic-slot-choices` | 助言 | `choices` が 9 個以上、重複(チップは 8 個まで。A6) |
| `comic-slot-hint-dup` | 助言 | `hints` が `choices` の候補と同じ |

**`max` との関係。** `max` が無いときの既定は、ADR 0074 のとおり `choices` のいちばん長い候補(`hints` は数えない。ヒントの長さでふきだしの箱を変えさせない)。ふきだしの箱は今までどおり `max` だけから決まる。`choices` と `hints` は幾何に影響しない。

**`update` との関係。** チップを押すことは普通の値の変更(`update({...values, [id]: choice})`)。特別な経路は作らない。`seq` と `stale` の規則はそのまま。

**幾何の地図に足すもの(A10)**: `slotOrder: string[]`(穴の id を読む順に。キーボードと読み上げの順)と、穴ごとの `inputRects[id]`。

- `inputRects[id]` は、穴の矩形を**幅・高さとも 44px まで外へ広げ**、コマの中に収めたあと、**ほかの穴の `inputRects` と重ならないよう**、重なる帯を 2 つの中央で割って縮めたもの。行の間隔が 26px なので、縦に並ぶ穴は 26px の高さになる。保証は「穴の矩形を含む、互いに重ならない、**24×24px 以上**」(WCAG 2.5.8 の下限)。44px(2.5.5)には届かないことがあり、その場合はページがチップの列をポップオーバーで出して標的を大きくする(見本が示す)。
- `geometry` は ADR 0074 のとおり値で変わらない(テストで `deepEqual`)。

**LLM に追加のヒントを聞く、ページ側の手がかり。** ライブラリは**どこにも送信しない**(利用者の入力を外に出さないため)。出すのは、データの形と 2 つの関数だけ。

```ts
// renderComic の結果(handle)の上の関数。seq は handle が持つ「最後に始まった update の seq」
r.slotContext(slotId, values): {
  slot: string; panel: string; speaker: string; prompt: string; max: number;
  sentence: string;                 // 他の穴を値で埋め、この穴を「＿＿」にした台詞
  choices: string[]; hints: string[];
  seq: number;
}
// ページが LLM から受け取った案を、値として入れてよいか見る(handle に依らない純粋な関数)
acceptValue(sheet, slotId, text): Finding[]   // 1 行・制御文字なし・max 字以内・strict の候補外 を ADR 0074 D4 の値の規則で見る
```

ページ側の型(ライブラリは持つだけで呼ばない): `type HintProvider = (ctx: ReturnType<RenderResult['slotContext']>, signal: AbortSignal) => Promise<string[]>`。古さの扱い: ページは要求を出すときの `ctx.seq` を覚え、答えが戻ったとき `update` の `seq` が進んでいたら捨てる(ADR 0074 D5 の `stale` と同じ考え方)。戻った案は `acceptValue` を通ったものだけを出す。ヒントはデータに書き戻さない。

**アクセシビリティ(見本が示す。規範は入力欄の側)。** 入力欄の `<label>` は台詞の文(`titles[ふきだしの id]`)、案内(`prompt`)は `aria-describedby`。チップは `role="listbox"` の中の `role="option"`(または普通のボタンの並び)、キーボードで矢印と Enter。選んだあと、`update` の戻りの `titles` を `aria-live="polite"` の領域で読み上げる。Tab の順は `slotOrder`。埋めた状態は強調色と**太字**の両方で伝える(色だけに頼らない)。

**代替案**: チップを SVG の中に描く(IME と選択は HTML が確か。ADR 0074 Q3)、ヒントの長さから既定の `max` を出す(ヒント 1 つで全員の箱が広がる)、ライブラリが LLM を呼ぶ(鍵・送信先・同意はページの仕事)。いずれも却下。

### D3. 時間の札と大きなコマ

#### 3a. 時間の札(キャプション)

「1 か月後」のような札は、`Dialogue.kind` に `'caption'` を足して表す(A8。新しい型を作らない)。

```ts
// 例: {id: 'c1', kind: 'caption', tpl: '{period}後', slots: {period: {max: 4, prompt: '期間'}}}   (who は要らない。A7)
```

- 札は 1 コマに**1 つまで**(2 つ以上は `comic-caption-count`、問題)。**`dialogue` の先頭に置く**(先頭でなければ `comic-caption-order`、助言)。
- 見た目: インク色の塗りに白い文字(14px 太字)の四角、高さ 28px、**x はコマの左から 32px、y はコマの上から 16px**(ふきだしの帯の上端と同じ高さ。番号の札(24px)の右)。しっぽなし。1 行、**穴を最大で数えて 10 字まで**(`comic-caption-wide`、問題)。穴は使える(札の穴も 1 コマの穴の数に数える)。札の矩形は `geometry.captions[id]` に載り(`bubbles` には入れない)、D1 の障害物になる。
- **ふきだしの帯を縮める。** 札のあるコマは、帯の上端が **32px 下がる**(札 28px + 隙間 4px。帯は y = 48 から)。6:5(0074 U1 の測定で確定。PR #436。1 コマ 420×352px)の帯は 220px から **188px**。ふきだしの高さは 1 行 48、2 行 72、3 行 100(隙間 6px)なので、**6:5 では 3+2 行(178px)が入り、3+3 行(206px)は入らない**。7:5(1 コマ 300px)に変えたときは帯が 168px から 136px になり、2+2 行(150px)が入らず 1+2 行(126px)まで(U3 で確かめる)。`comic-bubble-zone` と `comic-text-budget` は、札のあるコマではこの狭い帯で見る(A18)。
- **`labels`**(0074 D1)は、**ふつうのコマ(間奏でないもの)だけ**に付く(間奏は番号の札を持たない)。`labels` の数もふつうのコマの数に合わせる。

#### 3b. コマの割り(格子、スパン、コマ数)

ADR 0074 D1 は、名前つきの割り(B)を選び、自由な格子(C)を避けた。理由は「検査の幾何と LLM の出力の安定が先に崩れる」。ここでは**名前つきの割りを格子の枠にしたまま、スパンを 3 つの形に限る**。LLM が数え間違えやすいので、置き方を単純にし、書き方を制限し、失敗を 1 か所に局所化する(Q5)。

- **割りに `2x3`(2 列 3 行、6 コマ)を足す**(A9)。コマ数 2 / 4 / 6 は、`1x2` / `2x2` か `1x4` / `2x3`。
- **`span?: {cols?: 1 | 2; rows?: 1 | 2}`**(既定 1×1)。使える形は 3 つだけ: 普通(1×1)、**全幅**(`cols: 2`。2 列の割りのみ)、**倍の高さ**(`rows: 2`)。`cols: 2` と `rows: 2` を同時に付けるのは禁止。コマの大きさは、幅 = `cols × 升の幅 + (cols − 1) × 溝`、高さ = `rows × 升の高さ + (rows − 1) × 溝`(升の幅は 0074 のとおり。1 列の割りは 420px、2 列は 360px)。
- **`2x3` の大きさ**: 幅 360px、既定の縦横比は 1:1(`2x2` と同じ。2 列の割りの既定)。
- **置き方(規範。カーソル方式。決定的)。** 升を行ごと左から右に数える。カーソルは「**まだ空いている最初の升**」。`panels` を順に見て、各コマの左上をカーソルに置く。次のとき、そのコマを `comic-grid-fill`(問題。`where` はそのコマ)で止める。**最初の失敗で置くのをやめ、報告は 1 件だけ**(あとのコマの置き方は定めない。往復は 1 件ずつ直す)。穴埋め(後ろのコマを空いた升へ戻して入れること)はしない。
  1. コマの升(`cols × rows`)のどれかが、割りの外へ出る、または埋まっている。
  2. `cols: 2` のコマが、行の最初の升(左の列)以外にカーソルがあるとき(幅のコマは、行の頭に書く)。
  3. `rows: 2` のコマが、左の列以外にカーソルがあるとき。

  すべてのコマを置いたあと、空いた升が残れば `comic-grid-fill`(`where` はワークシート全体)。
- **読む順 = `panels` の順 = 見た目の順。** 禁止の 2 と 3 があるので、倍の高さのコマは左の列にだけ現れ、全幅のコマは行をまるごと使う。そのため、左上の升を行ごと左から右に並べた順が `panels` の順に一致する(例: 2×2 で `[倍の高さ, 普通, 普通]` なら、左に縦長、右の上、右の下の順)。`rtl`(第 2 版)では、列を鏡にする(スパンは列の番号で決まっているので、そのまま鏡にできる)。`comic-reading-order`(D5c)は、この性質を幾何の地図から確かめる。
- **例(2×2)**: `[全幅, 普通, 普通]` は成立。`[普通, 全幅, 普通]` は 2 つ目でカーソルが右の列なので `comic-grid-fill`(直し方: 全幅のコマを行の頭へ移す)。`[普通, 倍の高さ, 普通]` は 2 つ目でカーソルが右の列なので `comic-grid-fill`。
- **コマの中の規則は、コマの幅と高さに合わせる**。人物の位置(`left` / `right` は左右の縁から 104px)、頭の高さ(下から 76px)、D1 のアンカー(下から・上から・頭から)は式のまま。**穴の数の上限は 1 コマ `2 × cols` 個**(A4)。ふきだしの行数の予算は積みの単位なので変えない。
- **大きなコマで人物を大きくするか**(寄りの絵)は、第 1 版では**しない**(Q7)。広いコマは左右の人物の間が広がり、高いコマは上に余白が増える。余白はマンプ・壁の小道具・札で使える。

#### 3c. 場面の切り替えのコマ(間奏)

`ComicPanel.kind?: 'scene' | 'interlude'`(既定 `scene`)を足す。**間奏は、格子の升を使わない、全幅の帯**で、`panels` の順に、コマの行の間へ入る。`stage` は空、`dialogue` は `caption` が 1 つだけ。高さ 96px、淡い色味(`bg.tint`)、文字は 24px 太字を中央に。**間奏は、(a) カーソルが行の左の升にあり、その行の升がどれも埋まっていないとき、または (b) すべての升が埋まったあと(終わりの間奏。エピローグ)**に置ける(上から続く倍の高さのコマがあるとき、行の途中のときは `comic-grid-fill`)。最初のコマの前(カーソルが左上)も (a) で置ける。置かれた間奏は、あとの行の y を `96 + 溝` ずらす。`chat()` では中央の大きな区切りの文字になる。

「全幅で高さが半分のコマ」を格子に入れる案は、升の高さが半分になり置き方が崩れる。帯にして格子の外に出すほうが単純(Q6)。

#### 3d. 検査

| 規則 | 重さ | 内容 |
|---|---|---|
| `comic-grid-fill` | 問題 | 上の置き方に反する、升が余る・はみ出す、間奏が置けない(`comic-panel-count` の一般化。A3) |
| `comic-span-invalid` | 問題 | `cols` が割りの列数を超える、`rows` が 2 を超える、`cols: 2` と `rows: 2` の同時 |
| `comic-caption-count` | 問題 | 札が 1 コマに 2 つ以上 |
| `comic-caption-wide` | 問題 | 札が穴を最大で数えて 10 字を超える |
| `comic-caption-order` | 助言 | 札が `dialogue` の先頭でない |
| `comic-interlude-content` | 問題 | 間奏に人物やふきだしがある(`caption` 以外) |
| `comic-slots-per-panel` | 問題 | 上限が `2 × cols`(A4) |

### D4. 自分のアバター

**データ。** ADR 0074 の `Cast.face = {hue, hair?}` を**そのまま広げる**(新しい入れ物は作らない)。

```ts
interface Face {   // 0074: {hue: number; hair?: 'short' | 'long'}
  hue?: number;                                       // 0074。あれば髪と服の色の元(従来の見た目。A1: 任意にする)
  hair?: 'short' | 'long' | 'bob' | 'none';           // 髪型。0074 の 2 種に 2 種を足す
  hairColor?: 'black' | 'brown' | 'chestnut' | 'blond' | 'gray' | 'navy';
  skin?: 'fair' | 'light' | 'medium' | 'tan' | 'brown' | 'dark';
  glasses?: 'none' | 'round' | 'square';
  top?: 'navy' | 'blue' | 'teal' | 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'gray';   // 服の色
}
```

- 色は**名前のついたパレットの鍵だけ**(`#rrggbb` は受け取らない)。肌 6・髪の色 6・服 9。値は `lib/tokens.ts` に置く(候補はスパイクの `palette.ts`)。同じデータは同じ SVG。
- **既定(未指定の項目)**: `skin` は `fair`(0074 U1 が使う肌色のトークン `COLOR.skin` = `PALETTE.amber.soft`。ほかの肌色もトークンに置く)、`hair` は `short`、`glasses` は `none`。`hairColor` は、`hue` があれば従来どおり `hue` から(`hsl(hue 35% 28%)`)、無ければ `brown`。`top` は、`hue` があれば `hsl(hue 45% 62%)`、無ければ `gray`。**`face` の中のどの項目も必須でない**(A1)。
- **同じ人物 id なら全コマで同じ**(`stage` が `who` で `cast` を引く)。表情はコマごとに変わり、アバターは変わらない。
- **自分のアバターはページが決める。** `renderComic(sheet, {avatars: {me: {...}}})` で `cast[id].face` を**項目ごとに上書き**する(素材の `characters` と同じく、1 回の描画ごとに渡す。大域の状態にしない)。ライブラリは保存しない(`Face` は JSON なので、保存はページ)。アバターを変えても幾何は変わらない(頭の円は固定)。反映は `renderComic` をもう一度呼ぶ(測って遅ければ、差分の経路を足す)。

**読みやすさ(スパイクの結果から)。** パレットの色同士のコントラストは保証できない(髪と肌 36 組のうち 19 組が 3:1 未満、服と肌 54 組のうち 44 組)。インクの輪郭だけでも足りない(髪 `black` は輪郭の色との比が 1.03:1、肌 `dark` は 1.92:1。輪郭だけでは 3:1 に届かない組が、髪と肌で 26 組、服と肌で 19 組)。そこで、**2 つの塗りの境目は、いつも次の 3 層で描く**(A2。無条件。組み合わせごとの選び分けはしない)。

> 紙色のキーライン 1.5px | インクの線 2.5px | 紙色のキーライン 1.5px

インクの線の両側が必ず紙色なので、境目は塗りの色に関わらず 15.6:1(インクと紙の比)で見える。**3 層を描くのは内側の境目だけ**で、外側の輪郭(紙に接する縁)はインクの線だけ(外側にも付けると、縁が二重になる。`out/avatar-heads.svg`)。対象は、髪と顔、顔と首・服、服と髪(長い髪が肩にかかる所)、眼鏡の枠。

1. **眼鏡は枠だけ**(レンズの塗りは無い)。枠はインクの線 2px にキーラインを付ける。肌がどの色でも見える(`dark` でも 15.6:1)。
2. すべての部品に輪郭が付く(髪も。0074 のスパイクは髪に輪郭が無かった)。
3. 人物を見分ける助けを色だけにしない。髪型と眼鏡の違いでも見分けられるようにする。
4. 検査 `comic-cast-similar`(助言): 同じ `cast` の 2 人が、`hair`・`hairColor`(または `hue`)・`skin`・`glasses`・`top` のすべてで同じ。

**パレットのテスト(U4 の基準が満たせる形)**: (a) すべての境目が 3 層(キーライン・インク・キーライン)で描かれる(構造のテスト)。(b) インクの色と紙の色の比が 3:1 以上(15.6:1)。(c) 色の組み合わせの全部(肌 × 髪 × 服 × 髪型 × 眼鏡)で SVG が決定的。色の塗りどうしの比は、テストに入れない(上のとおり、保証しないため)。

**絵師の素材(ADR 0074 Q2)との両立。** パラメータは**パラメトリックな顔だけ**を動かす。素材の人物で効くのは、次のものだけ。

- 素材の `character.json` に、`recolor: {skin: '#f1c8a0', hair: '#3a2a1a', top: '#4a6fa5'}` を**任意**で書ける。意味は「この素材の SVG のこの色の文字列が、肌・髪・服を表す」。読み込みのとき、その文字列をパレットの色に**文字列として置き換える**(`fill` / `stroke` の属性値だけ。`<style>` は使えない。決定的で、サニタイズの規則は変わらない)。
- `hair`(髪型)と `glasses` は素材の絵そのものなので効かない。パラメータが指定されていて素材が受けられないとき、`comic-avatar-ignored`(助言)。
- アンカー(`head` / `mouth` / `hand`)はこの ADR の影響を受けない。マンプと小道具(D1)の位置も素材のアンカーから出る。

**代替案**: `#rrggbb` を受け取る(コントラストの検査が要り、見た目が不揃いになる)、`avatar` を別の入れ物にする(`face` と二重になる)、組み合わせごとにキーラインの有無を選ぶ(同じ意味の図で絵が変わり、テストが組み合わせごとに分かれる)、パレットを絞って全部の組を 3:1 にする(36 組中 19 組が落ちるので、色の数が数個になり、肌と髪の多様さを失う)。いずれも却下。

### D5. LLM が場面を出しやすくし、直す往復を決める

#### 5a. LLM が出しやすい形にする

`comic` は spec の部品なので、ADR 0069 の `partCatalog()` から MCP の `list_diagram_parts` に自動で出る(`{type, description, schema, example}`)。そこに次を載せる。

- **`description`**(英語)に、書き方の規則を数行で: 1 コマに人物は 3 人まで(`left` / `center` / `right`)、1 つのふきだしは 3 行まで、1 コマに積むのは 4 行まで(札があるコマは 6:5 で 3+2 行)、穴は 1 コマ 2 個まで(全幅のコマは 4 個)、`tpl` の 1 行は 9 字前後、`max` は 1〜9、人物の id は短い英字、台詞は意味で書く(座標を書かない)、**`span` と `kind: 'interlude'` は頼まれたときだけ使う**(LLM が数え間違えやすい)。
- **Schema の各項目に `description`**。`kind` の `enum` には意味を 1 行ずつ(`sweat`: 困っている・焦っている、など)。
- **`example`** は小さな 2 コマ。`partCatalog()` の例が問題なく描けるテスト(`lib/spec-kit.ts` のコメント)に載る。
- **作り話の例 3 つ**(テストの fixture): (1) 会議の前に資料を確認する 2 コマ(穴 `{what}`)、(2) 昼休みに同僚へ相談する 4 コマ(札「{period}後」あり)、(3) 日常の買い物で選ぶ 4 コマ(穴に `choices` と `hints`)。製品の手順の名前や特定の手法は使わない。

#### 5b. 出す → 検査 → 直す の往復の契約

使うツールは、**既存の `render_diagram` と `check_diagram`**(Q12。新しい `render_comic` は作らない)。理由: (1) `comic` は spec の部品として入るので、ツールは増えない。(2) MCP の経路には値が無い(ADR 0074 D5)ので、描かれるのは空のワークシートで、`render_diagram` の出力と同じ。(3) 値を持つ描画は `renderComic`(ブラウザ)だけで、MCP に出す理由が無い。

**検査の結果の形。** 共通の `Finding` は `{message, loc?, related?, rule, severity, data?}` で、`where` は無い。comic の検査(ADR 0074 U1 の `ComicFinding`)は `where` を持つ(ふきだし `p2.d1`、コマ `p2`、マンプ `p2.me.m1`)。そこで、**`where` を `Finding.data.where` に載せる**(`FindingData` に任意の `where?: string` を足す)。`loc`(ADR 0072 D7 の spec の path)は、comic の部品の id から引く(今の `locateMessage` は文言からの推測なので、comic の id は引けない。U5 で、部品の印から path を出す)。`check_diagram` の出力に `data.where` と path が出ることを、わざと壊した例でテストする。

**`FindingData` の必須項目(`measured`、`threshold`)の埋め方。** 共通の型は変えない(必須のまま)。数のある規則は、その数と限度を入れる(例: `comic-text-budget` は積んだ行数と 4、`comic-slot-max` は `max` と 9、`comic-caption-wide` は字数と 10)。数のない規則(置けない・id の衝突・順序など)は、**`measured` = 違反の件数(1 以上)、`threshold` = 0** を入れる。`severity` の対応は、ADR 0074 U4 が既存の `comic-*` に使うものに合わせる: 問題(`problem`)は検証の問題として、助言(`advice`)は `Finding` の `severity: 'warn'` として出す(`info` は使わない)。U5 の頭で 0074 U4 の実装を読んで、この対応を確かめる。

**往復の規則(LLM への指示。`list_diagram_parts` の description に書く)**

1. spec を出し、`check_diagram` を呼ぶ。
2. `verdict` が `ok` でなければ、**問題の各件**を、規則の `scope`(下の表)で直す。
   - `auto: 'advice'` の問題(素材のライセンスなど、人だけが直せるもの)は、直さずに人に伝える。
   - `dialogue` / `panel`: `where` が指すコマ(`panels[]` の 1 つ。id は変えない)だけを直す。ほかのコマは変えない。
   - `sheet`: `cast`・`span`・`panels` の並びを変えてよい。**直したあとは、すべての `where` を読み直す**(コマの数や並びが変わると、path が動く。`where` の id は動かさない)。
3. 直したら 1 に戻る。**3 回で止める**。止めたら、残った問題を人に伝える。
4. 助言は、問題がなくなってから 1 回だけ直してよい(`auto: 'advice'` は直さなくてよい)。

**`RULE_FIX` の表(新しい。`RULE_DOCS` は規則名 → 説明の文字列のまま変えない)**

`RULE_DOCS` の値は文字列で、`lib/schema-files.ts:127`(Schema の説明に差し込む)、`test/diagram-api.test.ts:112`(長さ > 0)、`RuleId` の型(キーから導く)が使っている。ここに入れ物を入れると壊れる。別の表を足す。

```ts
// lib/comic/rule-fix.ts(U5)。`Record<ComicRuleId, RuleFix>`
interface RuleFix {
  hint: string;                                   // 命令形の英語 1 文
  scope: 'dialogue' | 'panel' | 'sheet';          // どこまで直してよいか
  auto: 'edit' | 'regen' | 'advice';              // edit: その場の書き換え / regen: その範囲を作り直す(同じ id の置き換えを返す) / advice: 直さなくてよい
}
```

`FindingData` には、すでに件ごとの `fix?: string`(fit-width などが使う)がある。**件ごとの `fix` が先、規則ごとの `RULE_FIX.hint` はその代わり**(`check_diagram` の出力は `howToFix: {hint, scope, auto}` として足す。名前を分ける)。テスト: **`ComicRuleId` の全部に `RULE_FIX` の項目がある**(規則の一覧から作るので、あとの単位が足した規則も同じテストで見える)。

| 規則 | 重さ | `auto` | `scope` | `hint` |
|---|---|---|---|---|
| `comic-text-budget` | 問題 | edit | dialogue | Shorten the line or split it over two bubbles (3 lines per bubble, 4 stacked per panel). |
| `comic-bubble-zone` | 問題 | regen | panel | Remove a bubble or move a line to another panel. |
| `comic-slots-per-panel` | 問題 | regen | panel | Keep at most two blanks per panel (four in a full-width one); write the others as plain words. (The page's value table changes.) |
| `comic-slot-max` / `comic-slot-prompt` / `comic-slot-hints` / `comic-slot-hint-length` | 問題 | edit | dialogue | Bring the number or length into its range. |
| `comic-slot-duplicate` / `comic-slot-undefined` | 問題 | edit | dialogue | Give each blank one definition and one id; make the template and `slots` agree. |
| `comic-speaker-unknown` / `comic-extra-target` | 問題 | edit | panel | Use a character that is on the stage of that panel, or add it to `stage`. |
| `comic-at-collision` | 問題 | edit | panel | Move one character to another `at`. |
| `comic-id-collision` | 問題 | edit | sheet | Rename the id (letters, digits, `_`, `-`); ids are unique across the sheet. |
| `comic-asset-missing` | 問題 | edit | sheet | Drop the `asset` and use the built-in face (`face`), or name an asset that exists. |
| `comic-license-missing` | 問題 | advice | sheet | A human supplies the licence; the loop cannot fix it (it appears only when assets are passed in). |
| `comic-bubble-covers-face` / `comic-tail-off-speaker` | 問題 | regen | panel | Re-plan the bubbles of this panel (fewer or shorter lines, speakers on the stage). |
| `comic-grid-fill` / `comic-span-invalid` | 問題 | regen | sheet | Drop the `span`, or put a full-width panel first in its row and a double-height panel in the left column. |
| `comic-caption-count` | 問題 | edit | panel | Keep one caption per panel. |
| `comic-caption-wide` | 問題 | edit | dialogue | At most 10 characters (blanks counted at `max`). |
| `comic-interlude-content` | 問題 | edit | panel | An interlude holds one caption and no characters. |
| `comic-prop-no-room` | 問題 | regen | panel | Remove the prop, or free its anchor (fewer or shorter bubbles). |
| `comic-bubble-wide` / `comic-orphan-line` / `comic-follower-split` | 助言 | edit | dialogue | Reword so the line breaks fall elsewhere. |
| `comic-mark-no-room` / `comic-extra-moved` / `comic-extra-count` | 助言 | advice | panel | Optional; remove a mark or leave it as is. |
| `comic-anchor-missing` | 助言 | advice | panel | Optional; the prop was put on the floor. |
| `comic-slot-choices` / `comic-slot-hint-dup` | 助言 | advice | dialogue | Optional; keep at most 8 choices and no repeats. |
| `comic-caption-order` | 助言 | edit | dialogue | Move the caption to the first place of `dialogue`. |
| `comic-bubble-side` | 助言 | advice | panel | Optional; the bubble leans to the wrong side of the speaker. |
| `comic-avatar-ignored` / `comic-cast-unused` | 助言 | advice | sheet | Optional; remove the unused field or character. |
| `comic-reading-order` / `comic-tail-cross` / `comic-speaker-unclear` | 助言 | regen | panel | Order the lines left to right, or swap who stands where. |
| `comic-face-repeat` | 助言 | edit | sheet | Change the `expression` in one of the panels. |
| `comic-cast-similar` | 助言 | edit | sheet | Change hair style, glasses or clothing colour of one character. |

値の検査(`slot-overflow`、`comic-value-invalid`、`comic-values-unknown`)は `renderComic` / `update` の `findings` で、MCP の往復には出ない。表には入れない(`RULE_FIX` のキーは `check_diagram` の経路の規則だけ。テストは、その経路の一覧で取る)。

#### 5c. 新しい検査

ADR 0074 の `comic-reading-order` は、**幾何の地図を読む検査**に広げる(A5)。ふきだしの置き方が決まった規則のうちは出ない。出るのは、`anchor` の上書き、広いコマ(D3)、第 2 版の縦書きのとき。スパイクの実際の幾何では 0 件で、複製を壊すと 6 件出た。

| 規則 | 重さ | 内容 |
|---|---|---|
| `comic-reading-order`(広げる) | 助言 | (1) コマの中のふきだしの**読む順**が `dialogue` の順と違う。読む順は、縦の範囲が重なるふきだしを 1 行として、行を上から下へ、行の中を水平なら左から右へ(`dir: 'rtl'` は右から左へ。縦書きは列を右から左へ、列の中を上から下へ)。(2) **コマの順**: コマの左上の升を行ごとに左から右へ並べた順が、`panels` の順と違う(D3b の置き方では起きない。`rtl` や将来の置き方の保険)。`dir` を引数にして、第 2 版で同じ関数を使う |
| `comic-tail-cross` | 助言 | しっぽが別のしっぽと交差する、または別のふきだしの箱を通る(`{base, tip}` の三角形と箱の矩形で、厳密に) |
| `comic-speaker-unclear` | 助言 | (a) しっぽが話し手でない人物の頭の円(+4px)の近くを通る、(b) ふきだしの中心が、話し手より別の人物に(8px 以上)近い |
| `comic-face-repeat` | 助言 | 同じ人物が、**登場する連続する 3 コマ**で同じ `expression`。3 コマ未満のワークシートでは出さない |
| `comic-cast-similar` | 助言 | D4 |

すべて助言。ふきだしの置き方が決まっているので、問題にすると LLM の往復が止まりやすく、見た目の好みに近いものを問題にしないほうがよい(Q14)。

## 代替案(全体)

- **5 つを別々の ADR にする**。型を広げる場所(`ComicPanel` / `SlotDef` / `Face` / `Dialogue.kind`)と検査の表が重なる。1 つにまとめ、実装の単位(U1〜U9)は別の PR にする。
- **ADR 0074 の `version` を 2 にする**。足したものはすべて任意。上げない。
- **マンプ・小道具・アバターを `lib/comic/` の外の別の帯にする**。しっぽ・頭の円・穴の矩形との関係(ぶつかりの検査)を持てなくなる。却下。

## 影響

- 型の追加(すべて任意): 「ADR 0074 への変更」の表(A1〜A15)のとおり。
- Schema(`schema/comic.schema.json` と `spec.schema.json`)、`spec-parts` の登録、`dsl-exports`、`skills/svg-diagram/references` の項目は、**各単位が自分の項目の分を持つ**(U1: マンプ・小道具、U2: ヒント、U3: 札・スパン・間奏・`2x3`、U4: アバター)。`layout` と `panels` の数の対応は、升の合計で決まるようになるので、Schema には `maxItems` だけ残し、`comic-grid-fill` に任せる(A3)。
- **golden は変えない**(足した項目が無いデータは同じ出力)。例外は A2(髪の輪郭)の 1 回だけ。足した要素を使う例は、新しい golden として足す。
- 検査の規則が約 25 増える(D5b の表)。`RULE_FIX`(新)と `FindingData.where`(新)を足す。`RULE_DOCS` の形(規則名 → 文字列)は変えず、新しい規則ごとに行を足す(A21)。
- `chat()`(U7)、Artifact の見本(U8)、MCP のプラグイン(別のリポジトリ。U9)は、別の単位が持つ。

## 実装計画

どの単位も `main` に入れる PR を 1 つとし、Opus のレビューで Blocker と Major がなくなってから入れる。優先の順(1〜5)に U1〜U6、あとに支える単位 U7〜U9。**全単位の前提は、ADR 0074 U4(Schema と検査の仕組み)。**

| 単位 | ADR 0074 の前提(面ごと) | 内容 |
|---|---|---|
| U0 | — | ADR 0074 の状態の行に「ADR 0076 が拡張・一部変更」を足す(この ADR の採用と同時) |
| U1 | 配置・幾何・しっぽ: U1(PR #436)。幾何の地図: U3。規則・Schema: U4 | マンプと小道具 |
| U2 | 穴・`update`・`renderComic`: U3。規則・Schema: U4 | 選択肢とヒント |
| U3 | 割り・コマの置き方: U1。規則・Schema: U4。`chat()` の最小の対応は U3 が持つ(0074 U5 の有無に関わらず) | 札、スパン、`2x3`、間奏 |
| U4 | 顔と素材: U2(髪の輪郭は A2)。規則・Schema: U4 | アバター |
| U5 | 規則の一覧: U4。`partCatalog` と `locateMessage`(ADR 0069、0072) | LLM 向けの記述と往復の契約 |
| U6 | 幾何: U1、U3。この ADR の U1(しっぽの地図)、U3(コマの置き方) | 読む順などの検査 |
| U7 | `chat()`: 0074 U5。この ADR の U1〜U4 の項目 | `chat()` が新しい項目を落とす・`caption` を区切りにする |
| U8 | 見本: 0074 U6。この ADR の U2、U4 | Artifact の見本: チップ、ヒント、a11y、アバターの選択 |
| U9 | プラグイン(別リポジトリ)。この ADR の U5 | MCP のプラグインへの取り込み: `howToFix` の出力、`list_diagram_parts` |

### U1: マンプと小道具

- 範囲: D1 のすべて。`lib/comic/` に `marks.ts`(断片の表)、`anchors.ts`(整数の表)、`place-extras.ts`(置き方とぶつかりの検査)。幾何の地図に `tails` / `marks` / `props`。規則 `comic-mark-no-room`、`comic-prop-no-room`、`comic-extra-moved`、`comic-anchor-missing`、`comic-extra-target`。Schema と登録(マンプ・小道具の分)。
- 完了の基準: (1) スパイクと同じ場面(マンプ 7、小道具 5)で、**おおよそ同じ結果**になる(目安は 11 個が置けて、1 個が `comic-mark-no-room`、`at` を書いた 2 個が `comic-extra-moved`)。スパイクのしっぽは 0074 のプロトタイプの式で、U1 の `tailOf`(`reach` を `edge + TAIL_MIN` で挟み、付け根は `balloonPath` から)とは違うので、**ビット単位の一致は求めない**。U1 の PR は、U1 のしっぽで場面を測り直して、数字をこの ADR に書き直す。(2) 置いたどの箱も、ふきだしの矩形・しっぽの三角形・頭・ほかの箱・コマの縁・番号の札と重ならない(性質のテスト。厳密な交差)。(3) 空・埋めた・飛ばし・長すぎるの 4 状態で、位置が同じ(`deepEqual`)。(4) 2 回置いて SVG が同じ。座標が 1/4px の倍数。(5) 帯が積みきれていないコマでは `comic-mark-no-room` / `comic-prop-no-room` を出さず、`comic-bubble-zone` だけ。(6) マンプと小道具のないデータの SVG が、U1 の前と**バイト単位で同じ**。(7) 素材の `anchors.hand` が小道具の位置になる。(8) 3 人のコマ(`center`)で、`out` が右になる。(9) 層の順が D1 のとおり(DOM の順)。
- テスト: 種類 16 × 人物(左・中央・右)の網羅、候補の順(表を固定)、`aria-hidden` と `<title>`、断片が `<text>` / `<use>` / フィルタを含まない、線の紙に対する比が 3:1 以上、`chat()` では U7 で落ちる。

### U2: 選択肢とヒント

- 範囲: D2 のすべて。`hints`、規則 4 つ、`slotOrder`、`inputRects`、`r.slotContext`、`acceptValue`。Schema と登録。
- 完了の基準: (1) `choices` と `hints` を足しても `geometry` が `deepEqual`。(2) `max` が無いときの既定は `choices` の最長で、`hints` を足しても変わらない。(3) `hints` の 4 個目、`max` 超え、重複が期待の規則で止まる。(4) `inputRects` が、穴の矩形を含み、互いに重ならず、24×24px 以上で、コマの外へ出ない(縦に並ぶ穴・同じ行の穴の両方で)。(5) `acceptValue` が ADR 0074 D4 の値の規則と同じ結果。(6) `slotContext` の `sentence` が `titles` と同じ文で、`seq` が handle の最新。(7) ライブラリのコードがネットワークや `fetch` を使わない(束ねたあとの確認)。(8) `comic-slot-choices` が助言で、9 個の `choices` を持つ 0074 のデータの `verdict` が変わらない。
- テスト: 規則ごとの単体、`slotOrder` が読む順、`update` の `seq` / `stale` が選択肢でも変わらない。

### U3: 時間の札、スパン、`2x3`、間奏

- 範囲: D3 のすべて(A3、A4、A7〜A9)。`caption`、帯の縮み、`span` とカーソルの置き方、`2x3`、`interlude`、検査 7 つ。Schema と登録。**`chat()` の最小の対応も、この PR が持つ**(0074 U5 が先に入っていても後でも): 札(`who` なし)で `cast[who]` を引かない、間奏のコマの `stage` を読まない、`marks` / `props` / `span` を無視する。実行時に落ちないことを、この単位のテストで確かめる。仕上げ(区切りの見た目)は U7。**縦横比は 0074 Q10 の 6:5 のまま**(確定済み)。
- 完了の基準: (1) 札のあるコマの帯が 32px 縮み、6:5 で 3+2 行が通り、3+3 行が `comic-bubble-zone`。7:5 を指定したとき 2+2 行が `comic-bubble-zone`。(2) **置き方の網羅**: 2×2 と 2×3 と 1 列の割り(1×3、1×4)で、すべての並び(コマは割りの升の数まで、2×3 なら 6 個まで。各コマは普通・全幅・倍の高さ。3⁶ = 729 通りで軽い)について、期待どおり「置けて `panels` の順 = 左上の升の行ごとの順」または `comic-grid-fill` になる(期待の表をテストに固定)。(3) 例: 2×2 で `[全幅, 普通, 普通]` は成立、`[普通, 全幅, 普通]` と `[普通, 倍の高さ, 普通]` は `comic-grid-fill`(`where` が 2 つ目のコマ)。(4) 間奏が、行の頭で置けて、行の途中と、上から続く倍の高さのコマがあるときは `comic-grid-fill`。置いたあとの行の y がずれる。(5) 全幅のコマで穴が 4 個まで通り、5 個で止まる。(6) **高いコマ・広いコマで、D1 の `hand` / `floor` / `wall-*` と頭のアンカーが、式のとおりに置かれる**(スパイクは固定の 420×300 でしか試していないので、ここで確かめる)。(7) スパンや札のないデータの出力が変わらない(golden)。(8) 4 状態で `geometry` が `deepEqual`(札の穴を含む)。(9) 札の矩形が番号の札と重ならない。(10) 札・間奏・スパンを含むデータで、`chat()` が例外なく描ける(最小の対応)。(11) 札のあるコマで、壁のアンカー(コマの上から 72px)が札の矩形と重ならない。(12) 最初の失敗で置くのをやめ、`comic-grid-fill` が 1 件だけ出る。終わりの間奏が置ける。
- テスト: 上のとおり、幾何(コマの大きさの式)、`labels` が間奏を数えない、`comic-caption-count` / `comic-caption-wide` / `comic-caption-order`、`who` を省いた札が Schema を通る。

### U4: 自分のアバター

- 範囲: D4 のすべて(A1、A2、A13)。`Face` の項目、パレット(`lib/tokens.ts`)、髪型 4 種・眼鏡 2 種、3 層の境目、`avatars`、素材の `recolor`。`comic-cast-similar`、`comic-avatar-ignored`。Schema と登録。
- 完了の基準: (1) `hue` だけのデータの出力は、**体の境目に 3 層を足し、肌色が U1 のトークンのままである以外は同じ**(A2。ADR 0074 U2 より前なら U2 の PR に取り込み、後なら U4 の PR で golden を 1 回だけ更新して、人が見て受け入れる)。(2) 同じ `cast` の人物が全コマで同じ見た目。(3) `avatars` で上書きしても `geometry` が `deepEqual`。(4) **すべての境目が 3 層**で、インクと紙の比が 3:1 以上(構造のテスト)。(5) 肌 × 髪 × 服 × 髪型 × 眼鏡の全部で、SVG が決定的で、境目の構造が崩れない。(6) 素材に `recolor` があればパレットの色に置き換わる。なければ `comic-avatar-ignored`。(7) `hue` なしの `face` で、既定の `hairColor` と `top` が使われる。
- テスト: パレットの網羅、`recolor` の置き換え、`#rrggbb` を Schema が拒む、`comic-cast-similar`。

### U5: LLM 向けの記述と往復の契約

- 範囲: 5a と 5b。部品の `description`・Schema の `description`・`example`・fixture 3 つ。`RULE_FIX` と `FindingData.where`、comic の部品の印から path を引く(ADR 0072 D7)。
- 完了の基準: (1) `partCatalog()` の `comic` が出て、`example` が問題なく描ける。(2) fixture 3 つが Schema と検査を通る。(3) **わざと壊した 8 例**(穴が 3 個、話し手が舞台にいない、`at` の衝突、`max` が範囲外、id に `.`、札が 2 つ、全幅のコマが行の途中、`hints` が 4 個)が、期待の規則と `data.where` と path で返る。(4) 固定の「直した版」(LLM を使わない)で、`scope` のとおりに直すと、次の検査で消える。`scope: sheet` を直したあと、`where` の id で読み直せる。(5) **`ComicRuleId` の全部に `RULE_FIX` の項目がある**(規則の一覧から作るテスト。あとの単位の規則も同じテストで見える)。(6) `RULE_DOCS` の形(文字列)が変わっていない。
- テスト: 上のとおり。LLM の品質は測らない(契約だけ)。

### U6: 読む順・しっぽの交差・話し手の不明・同じ顔

- 範囲: 5c。`comic-reading-order` の広げ(ふきだしの順とコマの順)、`comic-tail-cross`、`comic-speaker-unclear`、`comic-face-repeat`。`dir` を引数にした読む順の関数。各規則の `RULE_FIX` の項目。
- 完了の基準: (1) 実際の幾何(0074 のサンプル 4 コマ)で 0 件。(2) 壊した複製(ふきだしの入れ替え、反対側への移動)で、期待の件数(スパイクと同じ: 読む順 1、しっぽの交差 2、話し手の不明 3)。(3) 同じ表情が 3 コマ続くデータで `comic-face-repeat`、2 コマでは出ない。(4) 左から右の `dir` で正しく、`rtl` の引数で順が鏡になる(単体)。(5) **作業量のテスト**: ふきだし n 個の検査の交差判定の回数が n² 以下(壁時計の時間では見ない。ホストで数倍ぶれるため)。(6) コマの順の検査が、D3b の置き方の網羅(U3 の(2))と矛盾しない。
- テスト: 上のとおり。

### U7: `chat()` が新しい項目を落とす

- 範囲: U3 が持つ最小の対応(落ちない)の上に、`caption` を中央の区切り、間奏を大きな区切りの文字にする仕上げ(A14)。0074 U5 が入っていること。
- 完了の基準: 新しい項目を足しても、`chat()` の幾何と SVG が変わらない(区切りの文字を除く)。`caption` の穴の値がチャットにも出る。
- テスト: golden、同じ値での穴の一致。

### U8: Artifact の見本

- 範囲: 0074 U6 の見本に、チップ、ヒント(`slotContext` を使う `HintProvider` の見本。送信先はダミー)、a11y(D2)、アバターの選択(`avatars`、`localStorage` に保存)を足す。
- 完了の基準: headless の通し(0074 U6 と同じ方式)で、チップの選択 → `update` → 保存、アバターの変更 → 再描画まで通る。見本が公開 API だけを使う。
- テスト: 通しは CI では任意(ネットワークが要る)。

### U9: MCP のプラグイン

- 範囲: 別のリポジトリ。core の取り込み、`check_diagram` の出力に `howToFix`(`RULE_FIX`)と `data.where` を出す。ADR 0069 の手順(core を vendor して取り込む)。
- 完了の基準: `list_diagram_parts` に `comic` が出る。壊した例で `howToFix` と `where` が返る。
- テスト: プラグインの側で。

## テスト方針

- ADR 0074 と同じ: 配置は純粋な関数で、測定は関数で渡す。足した要素の位置は幾何だけから決まるので、フォントに依存しない。
- 「足した項目が無いデータの出力は変わらない」を、ADR 0074 の golden ですべて取る(A2 だけが例外)。
- 「値で位置が動かない」を、状態の組ごとの `deepEqual` で、マンプ・小道具・札・入力欄の矩形にも広げる。
- 時間の数字は、壁時計の基準にせず、作業量(判定の回数)で見る。

## 決定済み(2026-11-22。決める人。未決だった Q1・Q3〜Q7・Q9〜Q12・Q14・Q15 はすべて推奨どおりに決定)

Q2・Q8・Q13・Q16 はレビューの調整で先に決まっていた。下の表の「状態」は、すべて決定済み。「推奨 / 決定」の欄が、そのまま決定の中身。

| # | 質問 | 状態 | 決定 |
|---|---|---|---|
| Q1 | データの項目の名前。`marks` か `manpu` か | 決定済み(推奨どおり) | `marks`。`manpu` は英語を話す LLM に通じにくい。説明に「漫符(comic symbols)」と書く |
| Q2 | マンプや小道具が置けないとき | 決定済み | マンプは描かずに助言(`comic-mark-no-room`)、**小道具は問題**(`comic-prop-no-room`。場面の情報が消えるため)。`at` を書いたものが違う位置に置かれたときだけ助言 `comic-extra-moved` |
| Q3 | `hints` を `max` の既定に数えるか | 決定済み(推奨どおり) | 数えない(ヒントの長さでふきだしの箱が変わるのを避ける)。代わりに、ヒントは `max` 字以内(問題) |
| Q4 | LLM への追加のヒントの取得 | 決定済み(推奨どおり) | ライブラリは材料(`r.slotContext`)と受け入れの検査(`acceptValue`)だけを出し、送信はページの仕事 |
| Q5 | スパンを入れて、ADR 0074 D1 の「自由な格子はやらない」を一部見直すか | 決定済み(推奨どおり) | 見直す。形は 3 つ(普通・全幅・倍の高さ)、全幅は行の頭、倍の高さは左の列だけ。カーソル方式で後戻りしない。LLM の説明には「頼まれたときだけ使う」と書く |
| Q6 | 場面の切り替え(間奏)を、格子の外の全幅の帯にするか | 決定済み(推奨どおり) | する(升の高さが半分のコマを入れると置き方が崩れる)。終わりの間奏も許す |
| Q7 | 大きなコマで人物を大きくするか(寄り) | 決定済み(推奨どおり) | 第 1 版はしない。余白をマンプ・壁の小道具・札で使い、寄りは見た目を測ってから別の単位で |
| Q8 | 縦横比の既定 | 決定済み | **0074 Q10 に従う**(0074 U1 の測定で 6:5 に確定。PR #436)。この ADR は 6:5 を前提にする |
| Q9 | アバターのパレットの数 | 決定済み(推奨どおり) | 肌 6・髪の色 6・服 9・髪型 4・眼鏡 3。足すのは表を足すだけ |
| Q10 | 自分のアバターの保存 | 決定済み(推奨どおり) | ライブラリは保存せず、`renderComic({avatars})` で渡す。保存先はページの仕事 |
| Q11 | 素材の人物にアバターを効かせる範囲 | 決定済み(推奨どおり) | 素材が `recolor` を宣言した色(肌・髪・服)だけ。髪型・眼鏡は効かず、助言を出す |
| Q12 | MCP に `render_comic` を足すか | 決定済み(推奨どおり) | 足さない。`render_diagram` / `check_diagram` / `list_diagram_parts` をそのまま使う |
| Q13 | 直し方の形 | 決定済み | `RULE_DOCS` はそのまま(行だけ足す)、別に `RULE_FIX`(命令形の英語 1 文、規則ごとに 1 つの `scope`、`auto`)。`where` は `Finding.data.where`。`measured` / `threshold` の埋め方は D5b |
| Q14 | 新しい検査(読む順・交差・話し手の不明・同じ顔・似た人物・個数)の重さ | 決定済み(推奨どおり) | すべて助言。往復が止まりやすくなるので問題にしない。必要になったものだけ、あとで問題に上げる |
| Q15 | `comic-face-repeat` の閾値 | 決定済み(推奨どおり) | 3 コマ続けて |
| Q16 | 体の境目の 3 層(A2)の入れ方 | 決定済み | 無条件で全人物に付ける。ADR 0074 U2 が未マージなら U2 に取り込む。入ったあとなら U4 で golden を 1 回だけ更新して、人が見て受け入れる |

## スパイクの再現

```
node spikes/comic-extensions/run.ts [outdir]        # マンプと小道具: 衝突、アンカーごとの落ち先、center、決定性、大きさ、時間の中央値(out/*.svg)
node spikes/comic-extensions/run-checks.ts          # 読む順・しっぽの交差・話し手の不明(実際の幾何と壊した複製)
node spikes/comic-extensions/palette.ts [outdir]    # パレットのコントラストとキーライン(out/avatar-keyline.svg、out/avatar-heads.svg)
```

`spikes/comic-extensions/out/` に、解決後(`scene-resolved.svg`)、最初の候補だけ(`scene-first-choice.svg`)、3 人のコマ(`three-people.svg`)、キーラインの比較(`avatar-keyline.svg`)を置いた。これらは `lib/` の外で、ADR 0074 のスパイクと同じく、U1 の PR で `lib/comic/` に置き換えて消す。
