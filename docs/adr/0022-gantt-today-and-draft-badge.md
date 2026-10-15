# ADR 0022: gantt の `today` が軸の外のとき(E3)と、下書きバッジ `diagram({status: 'draft'})`(E4)

- 状態: 提案
- 日付: 2026-10-15
- 基点: `origin/main`(4f70b45、PR #226 まで)
- 関連: ADR 0006(HTML/CSS 出力。SVG の部品は HTML にも写る)、ADR 0008(`diagram({sourceLine})`・ダーク・`canvas`)、ADR 0017(文字の下限・`canvas` の `minText`)。バッジの部品は `lib/badge.ts`(ADR 0007 の functional core の流儀)
- 要望の原文: E3「gantt の `today` が軸の外だと throw。計画の開始日を `today` に合わせる必要があった。提案: `today: 'auto'`、または軸を `today` まで広げるオプション。優先度: 低」/ E4「下書き(仮説)の表示: 『仮説』『仮置き』の注記を `sourceLine` や caption に手書きした。提案: `diagram({status: 'draft'})` で、統一の『下書き』バッジを出す。優先度: 低」
- 範囲外: gantt 以外(`timeline` の `now`)、下書き以外の状態(`review` / `final` など)、透かし(図全体にかかる斜めの文字)

## 背景

どちらも優先度は低く、既存の書き方で回避できている。ただし回避が「計画のほうを動かす」(E3)、「注記を図ごとに手書きして、文言と位置がばらつく」(E4)になっていて、後者は ADR 0008 #8(出典行の固定位置)と同じ種類の不満である。まず既存機能で足りないかを、コードで確かめた。

## 現状(コードで確かめた事実)

### E3: gantt の `today`

- `today` は gantt の `GanttOpts`(`lib/types/timeline.ts:80-88`)の `today?: string` と `todayLabel?`。型のコメントは「Today, always written out (a build never reads the clock)」。README の gantt の節(`README.md:529`)も「`today` は必ず書く(ビルドは時計を読まない)。軸の外だと止まる」。つまり**決定性(同じソース → 同じ SVG)が明文の設計**である。`lib/` で時計を読むのは、アイコンの導入日(`lib/icon-pack.ts:91`)・スライド予算の測定時刻(`lib/slide-budget.ts:143`)・ロックの待ち(`lib/icon-install.ts`)だけで、描画には使っていない。
- DSL の `gantt()`(`lib/dsl/timeline-gantt.ts:21`)は `today` を文字列のままバンドへ渡すだけ。日付の検証は layout 側。
- **throw の出所は `lib/gantt.ts:101`**: `if (today !== undefined && (today < from || today >= to)) throw new Error(\`gantt(): today (${band.today}) is outside the axis\`)`。文面は軸の範囲を言わず、直し方も書かない。テストは `test/gantt.test.ts:67` が `/today .* is outside the axis/` で固定している(文面を足す変更は、この正規表現を保てば通る)。
- **軸の決め方は `axisOf`(`lib/gantt.ts:47-51`)**: `from` は指定がなければ全タスクの最初の開始、`to` は指定があれば `dayOf(to) + 1`(その日を含む)、なければ最後の終了。**`today` は軸の決定に関与しない**。タスクが軸の外なら別の throw(`:99`、`(from / to)` を直すよう書いてある)。
- **`axisOf` は 2 か所から呼ばれる**: layout(`:97`)と、文字幅の測定用 `ganttTexts`(`:65`)。軸を変える変更は**両方に同じ値を返す必要がある**(片方だけ変えると、目盛りのラベルの幅の測定が実際の軸とずれる)。`ganttTexts` は `band.today` を読まない(「今日」のラベルだけ測る)ので、`today` の解決は両方で同じ関数を通すのがよい。
- 今日の線の描画は `:177-182`(`px(today) + perDay / 2` に線、ラベルは軸の上、`danger` 色)。軸が広がれば自然に動く。
- 既存機能で足りるか: `from` / `to` を手で書けば軸は今日を含められる(README:526 の「`from` / `to` で広げられる」)。**足りないのは「`today` を変えるたびに `from` / `to` も直す手間」と、throw が直し方を言わないこと**。`today` を `Date` で自動にする回避(ソースの中で `new Date()` を書く)は、いまでも書けるが、同じソースが日によって違う SVG になり、`svg-diagram check`/`changed` の「古い SVG」の判定(`lib/freshness.ts` はソースと import のハッシュだけを見る)をすり抜ける。

### E4: 下書きの表示

- `diagram()` の `DiagramOpts`(`lib/types/core.ts:100-140` 付近)に `status` も `draft` も**ない**(`lib` 全体を `draft|下書き` で検索して 0 件)。`DiagramData` へ写すのは `lib/dsl/render.ts:44-77` の 1 か所で、検証も同じ関数の冒頭(`sourceLine` の検証は `:37`)。
- 出典行は `lib/layout-util.ts:187` の `withSourceLine` が、**最後の帯として caption(`align: 'left'`、`role: 'note'`、`tone: 'muted'`)を足す**。`layout.ts:43` と `layout-measure.ts:128` から呼ばれる。図の**題は SVG の中に描かれない**(`<title>` / `<desc>` だけ。`lib/emit.ts:84-88`。ADR 0020 の H10 の確認と同じ)ので、「題との衝突」は起きない。衝突の相手は、出典行(下端、左寄せ)と、図の上端の本文の部品だけ。
- 既存の「小さな札」の仕組み: (1) `lib/badge.ts` の `badgeSvg` は**数字・記号を円・四角・三角に入れる**部品で、`role="img" aria-label data-badge` の 1 グループ。(2) 同じ `lib/badge.ts` の `pillSvg`(`:60` 付近)は**語を入れる角丸の札**(ラベル・チップ用)。(3) `stamp`(`lib/emit-boxes.ts:79-83`、`lib/layout-handlers.ts:197-200`)は **box / banner / group の右下**に小さなチップを出し、内容の下に 1 段ぶんを確保し、箱より広いと throw。README:181 は「架空の例」「イメージ」「要確認」を例に挙げている。**図全体を対象にする札はない**(`stamp` は部品の中)。透かし(図全体にかかる文字)もない。
- 手書きで足りるか: 手書きの caption は `add()` の順に依存し、`sourceLine` に混ぜると出典と読み違える。`stamp` は部品ごとで、図全体の状態は表せない。つまり**図全体の状態の札は、既存では書けない**。
- アクセシビリティとメタデータ: doc 媒体の SVG は `<title>`・`<desc>`・`<metadata id="svg-diagram">` を持つ(`lib/emit.ts:81-89`)。題は `diagramTitle`(`lib/rules.ts:675`)が `d.title` → 最初の caption → … の順で決める。つまり**札を caption として入れると、題の候補を奪う**恐れがある(`withSourceLine` の caption は `sourceLine: true` で、題の候補から外れているかを実装時に確かめる)。
- ダーク・透明: 色は `PALETTE` のトークンで書けば、`recolor`(`lib/emit.ts:104`)が `appearance: 'dark'` で自動に置き換える(ADR 0008 #1)。`data-assumed-bg`(`:94`)により、透明背景のとき検査は `PALETTE.bg` を背景とみなす。`stamp` は塗り `PALETTE.bg`・枠 `PALETTE.border`・文字 `PALETTE.muted` で、同じ作法に乗っている。
- `canvas`(ADR 0017): `diagram({canvas: 'slide'})` は最小文字 24px の検査(`slide-min-text`)を持つ。札の文字がこの下限に追従するかは**未確認**(下の未決事項 Q4)。

## 論点

**E3**: (a) `'auto'` の「今日」をどこから取るか(時計を読むと決定性が崩れる)。(b) 軸を広げるオプションを足すか。(c) throw の文面。(d) 既存図の SVG を変えない。

**E4**: (a) 札の位置(上端か、右上か、出典行の隣か)と、他の部品・出典行との衝突。(b) 文言を固定にするか、差し替えを許すか。(c) 色・コントラスト・ダーク。(d) `<title>` / `<desc>` / `<metadata>` への反映。(e) `check` への出し方。(f) `status` を書かない図の SVG が 1 バイトも変わらないこと。

## 決定

### E3

**D1. ライブラリは時計を読まない。`today: 'auto'` は「呼び出し側が決めた日付」を指す。**
`today: 'auto'` と書いた gantt は、ビルドの文脈(`BuildContext` の `today`)から日付を受け取る。供給元は優先順に、CLI の `--today <YYYY-MM-DD>`、環境変数 `SVG_DIAGRAM_TODAY`、`.svg-diagram.json` の `today`。**どれも無ければ throw**(「`today: 'auto'` には日付が要る。`--today YYYY-MM-DD` か `SVG_DIAGRAM_TODAY` を渡す」)。`--today now` と書いたときだけ、CLI が**その 1 回の呼び出しの冒頭**で時計を 1 度読んで日付に直す(1 回のビルドの中で全図が同じ日を使う。`lib/` の描画は時計を知らない)。
  - 理由: 同じソースが日によって違う SVG になるのを、既定では起こさない(README:529 の約束を保つ)。CI やスライドの再ビルドで、日付を明示した人だけが日付で変わる図を得る。
  - 日付の渡し方が文脈なので、**解決した日付は SVG の `<metadata id="svg-diagram">` に `today` として残す**(後から「いつの日付で描いたか」が分かる。`lib/emit.ts:89` の `source` に 1 項目足す)。`freshness`(`lib/freshness.ts`)はソースのハッシュだけを見るので、`auto` の図は「日付が違っても fresh」と出る。これは**既知の限界として README に書く**(`changed` の判定は変えない。決定性を壊さない範囲で、判定に日付を混ぜるのは別の話)。
  - 検査の層(`check` / `lint`)は `--today` を受けなくてよい。`check` が図を組み立てるときに同じ文脈を渡すので、同じ日付で検査する。
  - `todayLabel` は従来どおり。

**D2. 軸を今日まで広げるオプションを足す: `gantt(rows, {today, extendToToday: true})`。**
`today` が軸の外(`today < from` または `today >= to`)のとき、**`from` / `to` を明示していない側だけ**を広げる(`from = today` / `to = today + 1`)。`from` / `to` を明示した側は、広げず従来どおり throw する(明示した軸は利用者の意図なので、勝手に動かさない)。`extendToToday` は `today: 'auto'` と独立に使え、併用もできる。
  - 軸の計算は `axisOf`(`lib/gantt.ts:47`)に 1 つにまとめる。**`layoutGantt` と `ganttTexts` は同じ `axisOf` を呼ぶ**(上の事実)。`axisOf` が `today` を知る必要があるので、引数を `(band, spans, today?)` にし、`today: 'auto'` の解決は `layoutGantt` / `ganttTexts` の手前(バンドを作る段)で日付の文字列に直す(layout は日付文字列しか見ない)。
  - 既定は `false`。`extendToToday` を書かない図は、軸も SVG も変わらない。

**D3. throw の文面を直し方つきにする(既存の図に影響しない)。**
`gantt(): today (2026-10-01) is outside the axis (2026-10-05 - 2026-12-04): move today into it, set from / to, or pass extendToToday: true`。先頭の `gantt(): today (…) is outside the axis` は変えない(`test/gantt.test.ts:67` の正規表現がそのまま通る)。軸の範囲の表示のため、日の通し番号を `YYYY-MM-DD` に戻す小さな関数を `lib/gantt.ts` に足す(`fmtDay` は `MM/DD` で年を持たない)。

**D4. 既存図は byte 同一。** `today` が `'auto'` でなく、`extendToToday` が無い図は、コードの経路が変わらない。軸が変わるのは新しいオプションを書いた図だけ。

### E4

**D5. `diagram({status: 'draft'})` を足す。値は `'draft'` だけで始める。**
将来の `'review'` などは同じ入口に足せるように、型は文字列のユニオン(`type DiagramStatus = 'draft'`)にする。`status` を書かない図は、描画も SVG も 1 バイトも変わらない(D10)。`statusLabel?: string` で文言を差し替えられる(「仮説」「仮置き」。単一行・非空。`sourceLine` と同じ検証)。**既定の文言は固定の「下書き」**。理由: 依頼元は「統一の『下書き』バッジ」を求めていて、手書きでばらついた文言を 1 つに揃えるのが目的。ただし要望の中に「仮説」「仮置き」が出ているので、差し替えは許す(許さないと同じ手書きに戻る)。

**D6. 見た目と位置: 図の最上段に 1 段(約 28px)を確保し、その右端に札を置く。**
- 札は `pillSvg`(`lib/badge.ts`)の角丸の札。**塗りは `PALETTE.bg`、枠は `PALETTE.muted` の破線 1.5px、文字は `PALETTE.text`・太字・`roles.note` の大きさ**。色だけに頼らず、**破線の枠(下書きらしさ)と文字**で伝える。ダークは `recolor` が置き換える(新しい色を作らない。`danger` は「してはいけない例」専用(`lib/tokens.ts:18` のコメント)なので使わない)。
- 位置は **最上段の右端**: 左寄せの本文・下端の出典行(`withSourceLine`)と別の段にあるので、**構造上、重ならない**。上端に 1 段を確保する方式は、`withSourceLine` と同じ作り(帯を 1 つ足す)にでき、`stamp` のように内容の下に帯を確保するのと同じ考え方になる(`layout-handlers.ts:197-200`)。**角に重ねる(overlay)案は、衝突の検査が新しく要るので採らない**(代替案 A2)。
- 実装は `withSourceLine`(`lib/layout-util.ts:187`)の隣に `withStatus(d)` を足し、**先頭**に内部の帯 `{type: 'status'}` を足す。新しい帯の型を作る(`caption` を流用しない)。理由: 流用すると `diagramTitle`(`lib/rules.ts:675-680`)の「最初の caption」が札の文言になり、題が「下書き」になる。`add()` した本文の帯の順(= 利用者が書いた順)は変えず、前に 1 段が増えるだけ。
- スライド(`canvas: 'slide'`、`slide`、`fill`)でも同じ。`fill` / `slide` は測った枠に収めるので、1 段ぶんの高さが予算に入る(`slide-budget` が超えれば既存の検査が言う)。`canvas` の最小文字(24px)に札の文字が追従するかを、実装で確かめる(未決事項 Q4)。文書(`theme`)・スライドで寸法は変えない(文字の大きさ以外)。

**D7. アクセシビリティとメタデータ。**
- 札は `<g role="img" aria-label="下書き" data-status="draft">`(`badgeSvg` の `data-badge` と同じ流儀)で、**読み上げに「下書き」が出る**。
- doc 媒体の `<title>` は題のまま。**`<desc>` の先頭に「(下書き)」を足す**(`diagramDesc` の最初に 1 文。利用者が `desc` を書いていても足す。書いていなければ自動の文の前に足す)。`status` が無い図の `<desc>` は変えない。
- `<metadata id="svg-diagram">` の `source` に `status: 'draft'` を足す(`lib/emit.ts:89`。DiagramSource に任意項目を 1 つ。`status` が無い図には出ない)。

**D8. `check` への出し方。**
- 新しい規則 `draft-status`(**info**)を足す。文言は「この図は下書き(status: 'draft')。公開前に外す」。`check` の一覧に出し、**`--strict` では失敗させない**(info は strict でも失敗しない)。公開前の確認用に、`check --no-draft`(新しいフラグ)で「下書きのまま」を**warn にする**。`--no-draft` は CI の公開ジョブだけが付ける。理由: 下書きの図を作る間は邪魔をしない、公開で止めたい。フラグを足さず `layoutCheck` のように図ごとの設定にする案(A5)も検討したが、「公開のとき」はソースでなく**実行の文脈**の話なので、CLI のフラグにした。
- 札の文字は既存のコントラストの検査(`a11y-text-contrast`)に通す(札の矩形を「自分の容器」にし、`badge` と同じく、文字が自分の矩形の中で読まれるようにする。`data-status` のグループを lint が `data-badge` と同じに扱う)。
- `accept: {'draft-status': '理由'}` は他の規則と同じに効く(`lib/rules.ts:540`)。

**D9. HTML 出力(ADR 0006)。** 札は SVG のグループなので、`--html` では「CSS に写せないもの」でなく、`svg-to-css` が rect / text を HTML に写す(`pillSvg` の rect・text は既に写る形)。破線の枠は `border`(ADR 0006 の第 4 項)。

**D10. 既存図は byte 同一。** `status` を書かない図は、`withStatus` が `d` をそのまま返す(`withSourceLine` と同じ)。`<desc>`・`<metadata>` にも項目を足さない。**回帰の確認**: 既存の全 `examples/` と `test/` の SVG が、実装の前後で同一であること。

## 代替案

- **A1. `today: 'auto'` が時計を読む**: 一番短い。**採らない**: 同じソースが日で変わる(README の約束に反する)。`freshness` の判定をすり抜ける。依頼の「決定性」の懸念そのもの。D1 で「呼び出し側が日付を決める」にした。
- **A2. 札を図の角に重ねる(overlay / 透かし)**: 高さが増えない。**採らない**: 本文・出典行との衝突を検査する仕組みを新しく作る必要がある。重なりが起きたとき、直す手段が利用者に無い。
- **A3. 札を `caption` で足す**: 実装が最小。**採らない**: 上の通り、題(`diagramTitle`)の候補を奪い、`slide` の spotlight の対象(`spotlight.ts:104` は `sourceLine` だけ除外)にもなる。
- **A4. 文言を固定のみにする**: 統一できる。**採らない**: 「仮説」「仮置き」の要望が現にあり、許さないと手書きに戻る。差し替えを許したうえで、既定を揃える。
- **A5. `draft` を `layoutCheck` のような図ごとの severity にする**: ソースで完結する。**採らない**: 公開で止めるかは実行の文脈の話(D8)。
- **A6. `extendToToday` を既定にする**: 手間が無い。**採らない**: 既存の `today` が軸の外の図が throw から描画に変わり、「うっかり `today` を間違えた」ことに気づけなくなる。opt-in にする。
- **A7. `gantt` の軸の自動拡張を `today` だけでなく `milestone` などにも**: 範囲外。

## 影響

- **既存図**: `today` が日付のままで `extendToToday` が無い gantt、`status` の無い図は、**SVG・HTML・メタデータとも byte 同一**(D4・D10)。throw の文面は、先頭を保ったまま後ろに足す(D3)。
- **公開 API**: `GanttOpts` に `extendToToday?: boolean`、`today` に `'auto'`。`DiagramOpts` に `status?: 'draft'`、`statusLabel?: string`。CLI に `--today` と `check --no-draft`。**`test/fixtures/dsl-exports.json` は変えない**(新しい関数を足さない。型と opts だけ)。
- **検査**: 新しい規則 `draft-status`(`lib/rules.ts` の規則の表 `:46` 付近に足す。規則 ID の型と README の規則一覧(`README.md:1173` 付近の表)に足す)。
- **README**: gantt の節(`:529`)に `today: 'auto'` / `extendToToday` / 既知の限界(`freshness` が日付を見ない)。`diagram` の opts の節に `status` / `statusLabel`、出典行の節(`:764`)の隣に「下書きバッジ」。
- **スライド**: 最上段に 1 段(約 28px)増える。測った枠に収まらなければ、既存の `slide-budget` の検査が言う。

## 実装計画

独立に進められる単位と、触るファイル。U1 と U2 は互いに独立(別の機能)。U3〜U5 は D5 の型が先に要るので、U3 を先に入れる。

| 単位 | 内容 | 触るファイル | 並列 |
|---|---|---|---|
| U1 | E3 の核: `axisOf` に today を渡す、`extendToToday`、throw の文面(D2・D3) | `lib/gantt.ts`(`axisOf`・`layoutGantt:97-101`・`ganttTexts:65`・日付の文字列化)、`lib/types/timeline.ts`(`GanttOpts`)、`lib/dsl/timeline-gantt.ts:21`(オプションの転送) | U2・U3 と並列 |
| U2 | E3 の `'auto'`: ビルド文脈の `today`、`--today` / `SVG_DIAGRAM_TODAY` / config、`<metadata>` の `today`、`'auto'` を日付に直す段 | `build-diagram.ts` / `check-diagram.ts`(CLI のフラグ)、`lib/config.ts`、`lib/dsl/timeline-gantt.ts`(`'auto'` の受け取り)、`lib/emit.ts:89` と `DiagramSource`(`lib/types/core.ts`) | U1 の後(`today` の型を共有) |
| U3 | E4 の入口: `status` / `statusLabel` の型と検証、`withStatus` の骨組み(帯なしで通す) | `lib/types/core.ts`(`DiagramOpts`・`DiagramData`)、`lib/dsl/render.ts:37・70` | 先頭 |
| U4 | E4 の描画: 内部帯 `status`、レイアウト、`pillSvg` の描画、HTML への写し | `lib/layout-util.ts`(`withStatus`)、`lib/layout.ts:43`・`lib/layout-measure.ts:128`(呼び出し)、`lib/emit*.ts`(帯の描画)、`lib/badge.ts`(必要なら `pillSvg` に破線の枠) | U3 の後 |
| U5 | E4 のメタデータ・検査: `<desc>` の先頭、`<metadata>`、`draft-status`、`check --no-draft`、lint が `data-status` を札として扱う | `lib/emit.ts`、`lib/rules.ts`(`diagramDesc:693`・規則の表)、`check-diagram.ts`、`lint-svg.ts` | U4 と並列にできる(帯の型が決まれば) |
| U6 | README とスキル(`skills/svg-diagram/`)の追記、`examples/` に 1 例ずつ | `README.md`、`examples/gantt-today-extend.ts`、`examples/status-draft.ts` | 最後 |

### テスト方針

- **フォント依存の絶対値は使わない**。座標・幅・文字の位置を数値で固定しない。`today` の日付は**固定の文字列**(`'2026-10-19'`)で、`Date` も時計も呼ばない。`--today now` だけは時計を読むので、テストは時計を差し替えられる形(関数を注入)にするか、`--today <固定日>` だけを試す。
- E3(U1): ①`today` が軸の外 → throw、文面に軸の範囲と `extendToToday` が出る、先頭は従来の正規表現(`/today .* is outside the axis/`)に通る。②`extendToToday: true` で throw せず、`today` が過去・未来の両方で、線が描かれ、**`ganttTexts` と `layoutGantt` が同じ軸**を使う(目盛りのラベルの日付に `today` の日が含まれる、で確かめる)。③`from` / `to` を明示した側は広がらず throw する。④`extendToToday` と `today` の無い図が、前後で**同じ SVG**(既存の gantt のテストと `examples/gantt.ts` を、実装前後で `diff` する)。
- E3(U2): `today: 'auto'` と日付の供給なし → throw。`--today 2026-10-19` と、同じ日付を直接書いた図が**同じ SVG**(`<metadata>` の `today` だけ違う)。日付を変えると線の位置だけが変わる。環境変数・config の優先順位(CLI > 環境変数 > config)。
- E4(U3〜U5): ①`status` なしの図が、実装前の出力と同一(`examples/` 全部の出力を比べる回帰)。②`status: 'draft'` で、SVG に「下書き」の文字、`role="img"` と `aria-label`、`<desc>` の先頭が出る。`statusLabel: '仮説'` で差し替わる。空・複数行は throw。③札と出典行(`sourceLine`)が**重ならない**(両方の矩形が交差しないことを、座標の絶対値でなく**交差の有無**で確かめる)。④題(`diagramTitle`)が札の文言にならない。⑤`appearance: 'dark'` で札の色が置き換わり、コントラストの検査が通る。透明背景でも通る。⑥`check` に `draft-status`(info)が出る、`--no-draft` で warn、`--strict` だけでは失敗しない、`accept` で許容できる。⑦`--html` でも札が出る。⑧`canvas: 'slide'` で `slide-min-text` に引っかからない(Q4 の確認)。
- 回帰: `pnpm test` 全体と `typecheck`。`test/fixtures/dsl-exports.json` が変わっていないこと。

## 未決事項

- **Q1**: `--today now` を CLI に入れるか(時計を読む入口を 1 つ作ることになる)。入れないなら、`SVG_DIAGRAM_TODAY=$(date +%F)` を利用者に書かせる(より素直で、時計を読む責任が呼び出し側に残る)。本 ADR は入れない側に傾いている。
- **Q2**: `freshness` に `auto` の日付を混ぜるか。混ぜると毎日 stale になり、混ぜないと日付違いの SVG が fresh と出る。本 ADR は混ぜない(README に限界を書く)。
- **Q3**: 札を最上段でなく、本文の最初の帯の右端に重ねない形で置けるか(高さを増やさないため)。現状は 1 段増やす案。
- **Q4**: `canvas: 'slide'` の最小文字 24px に、札の文字(`roles.note`)がどう効くか。`roles` が `canvas` の `minText` に追従するか、`lib/layout.ts` と `lib/canvas.ts` を実装時に読む。追従しない場合は、札の文字の大きさを `canvas` のときだけ上げる。
- **Q5**: `status` の将来の値(`'review'`、`'final'`)と、それぞれの文言・色。今は `'draft'` だけ。
- **Q6**: `draft-status` を、`status` の無い図にも「題に『仮説』『下書き』とある」ときに出す(手書きの検出)か。誤検知が多いので、本 ADR では入れない。
