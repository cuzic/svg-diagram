---
name: svg-diagram
description: 宣言的な DSL で文書向けの SVG 図（構成図・フロー・スイムレーン・シーケンス図・表・画面のワイヤーフレーム・画面遷移図）を作り、検査して仕上げる。図やワイヤーフレームを作る・直すとき、仕様書や設計書に図を入れるときに使う。
argument-hint: "[作りたい図 / 直したい図のソース]"
keywords:
  - svg
  - diagram
  - wireframe
  - 図
  - ワイヤーフレーム
  - 画面遷移図
  - スイムレーン
  - シーケンス図
triggers:
  - 図を作って
  - ワイヤーフレーム
  - 画面遷移図
  - svg-diagram
  - 図を直して
---

# svg-diagram で図を作る

図は SVG を直接書かず、`*.ts`（DSL）で宣言して生成する。レイアウト・重なり・コントラストの検査は DSL 側が行う。
SVG は生成物としてコミットし、Markdown からはそれを参照する。**SVG を手で編集しない**（ソースを直して再生成する）。

## 手順

1. **ソースを書く**: `import {diagram, ...} from 'svg-diagram'` / `export default () => diagram({theme: 'blue', title: '図の題名'})...`
   - 文書向けは `theme: 'blue' | 'teal' | 'amber'`。`title` は必須（`check` が見る）。幅は 940px 以下（文書に埋めると縮むため）。
   - **ソースは `.ts` で書き、ビルドの前に `npx tsc -p .`（またはエディタの型エラー）を通す**。型が保証すること: `connect()` の参照先 id と `:side[@t]` の書式、swimlane の `lane` / flow の `from`・`to` / step の id の重複 / レーン 6 本まで、`stateMatrix()` の `required` と「1 行のセルの数 = 列の数」（未設計にするなら `undefined` を明示）、`box({step})` に `title`、`connect()` の `dip`・`bend`・`chip` の組み合わせ、14px 未満の `size`、`grid` の `cols`、`pyramid` / `curve` の個数。
   - **`connect()` の id の検査を効かせるには、関係する box と `connect()` を 1 回の `d.add(...)` にまとめるか、`d.add(a).add(b)` とつなぐ**（別々の文では、前の id を型が知らず検査されない。つないだ `add()` をまたぐ前方参照は型エラーになる）。
   - **接続点は、`const list = box({id: 'list'})` のハンドルで書く**: `connect(list.right, detail.at('top', 0.25))`（screens / swimlane は `flow.anchors.a.right`）。id を文字列で打ち直さないので、別の文にまたがっても未宣言の id や辺の綴り違いが作れない。`accept` のキー（ルール ID）や `legendLabels` のキー、`tone` / `line` / `route` なども閉じた文字列の型で、綴り違いは型エラーになる。
   - 型エラーは `check` の警告より前に直す。型を通っても、重なり・コントラスト・見た目は下のビルド・検査・目視で確かめる。
2. **ビルド**: `svg-diagram build src.ts --out out.svg`（重なり検査と lint --strict まで走る。失敗するとエラー文が出る）
3. **ルール検査**: `svg-diagram check --strict src.ts`（コントラスト、凡例、線の交差、幅、密度、題名）
4. **目で見る**: `svg-diagram preview out.svg out.png 2` で PNG にし、画像として読んで確認する（`svg-diagram show x.ts --png out.png` なら SVG を書かずにソースから直接 PNG にできる。`show` を `--png` なしで使うのは人が sixel 対応の端末で見るとき用で、エージェントの実行環境では端末がないためエラーになる）。**検査を通っても、レイアウトの良し悪しは目で見ないと分からない**。
5. **ズレ検査**: `svg-diagram check --drift --svg-dir <SVG の置き場> src.ts`（SVG が最新のソースから生成されたものか）
   - `--rebuild` を付けると、違いを言葉で説明する（「見た目は変わらない」ならそのまま再生成してよい）。
6. **文書との整合**: `svg-diagram check --docs <docs> --svg-dir <SVG の置き場> --src-dir <ソースの置き場>`（参照先、代替テキスト、孤立した図、図の注釈と文書のリストの一致）
7. **まとめて目視**: `svg-diagram contact a.svg b.svg ... --out sheet.png`（余白や釣り合いは検査では分からない）

## 部品

README の「部品」表を参照。基盤・ネットワーク図は、`group` の入れ子（ホスト > コンテナ > プロセス）と、`row([group, group])` の横並びで描く（接続線は、枠をまたぐ箇所で他の箱や題名を通らないよう、`@t` や `elbow` で調整）（box / row / grid / group / connect / swimlane / sequence / table / wireframe / screens ほか）。
新しい部品は「同じパターンが 3 回出たら」が原則。既存の図の出力が変わらないこと（回帰）を確認してから足す。

## くり返しは、まとめて書く

- 12 列の行: `row([a, b], {cols: [6, 6]})`（`col:` を手で数えない）。別の行の N 列目への矢印は、`row({id: 'top'})` の `top.col(5).top`。
- 接続線: `diagram({connectDefaults: {chip: true, route: 'elbow'}})` と `d.connect(from, to, {label})`。
- ワイヤーフレームの外枠: `diagram({wireframeDefaults: {appbar: {title, nav}}})` と、画面ごとの `shell: {active: '在庫'}`。
- 状態の一覧: `stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '理由'}})`。
- 表の記号セル: `cell('通る', {mark: 'ok' | 'mid' | 'ng' | 'best'})`。座標平面（軸・点・寸法線）は `plane()`。`raw()` で SVG を手書きする前に、これらを探す。

## ワイヤーフレーム・画面遷移図で、見て直すこと（実際に効いた点）

画面ごとに `wireframe(root, {title, tag, h, notes})` を書き、`n:` で番号の丸を付けて右の注釈欄と対応させる。
作ったら PNG を 2 倍で撮り、次を見る。

- **空白**: 表や一覧の下、サイドバーの下に空きがないか。`flex`、行の追加、`wf.spacer(4, {flex: 1})` で埋める（row の中のカード・列は下まで伸びる）。
- **ラベルの衝突**: 地図のラベルが壁や枠線に重ならないか。`side: 'bottom'` や座標で逃がす。
- **番号の丸**: 隣の部品との境目にまたがっていないか。余白（既定 12px）が足りているか。
- **注釈文**: カタカナ語が途中で折れていないか（ツールは語単位で折る）。
- **状態の矛盾**: 例えば「通信断」の映像に `LIVE` を出していないか。
- **画面遷移図**: 矢印のラベルが画面にかかっていないか。ラベルが入る幅の `gap` / `rowGap` を取る。幅 940px に収めるには、タイトル行を短くし、画面名はサムネイルの `wf.appbar` に入れる。
- **モーダル**: `wireframe(root, {overlays: [wf.dialog(...), wf.toast(...)]})`。覆われた要素は描かれない。

## 画面仕様は「粗い全体 + 部品ごとの詳細」にする

1 画面に全部を描くと、状態（読み込み中・空・欠損・通信断・古い情報）が抜けやすい。次の 3 種類に分ける。

1. **全体（粗い図）**: `wf.region(名前, {n: true, emphasis: 'primary'})` だけで領域を並べ、見る順に番号を付ける（自動採番）。
2. **部品の構成**: `wireframe(部品, {frame: 'light', h: 'fit', notes})`。`parts: {level: true, ...}` で部品の**内側**に番号を付ける。
3. **部品の状態の一覧**: `stateMatrix(状態の列, 部品の行, {required: [...]})`。各欄は、図 / `'na'`（対象外。理由は `{na: '理由'}`）。**未指定は「未設計」と表示され、`check` が警告する**。

`state` は、映像・地図に限らず**どの部品にも**付けられる（`loading` は骨組み、`empty` は文言、`stale` は読めるまま点線の枠と札）。
`check` は、図の番号と注釈が一対一か、状態の一覧に「未設計」や必須の状態の抜けがないかも見る。

## 欲しい絵記号（アイコン）を入れる

`box({icon})` / `iconRow()` のアイコンは本体に入っていない。**プロジェクトごとに入れる**（`svg-diagram.icons.json`）。「鍵のアイコンが欲しい」と言われたら、次の順で進める。

1. **英語に直す**: Iconify の検索は英語。「鍵」→ `key`、「橋」→ `bridge`、「人」→ `person`、「承認」→ `approval`, `check-circle` など、似た語を 2〜3 個。
2. **候補を出す**: `svg-diagram icons find key bridge --png sheet.png`。ライセンスが許すセットだけが並び、**主セット**（最初に入れたセット）が先頭に出る。`--style fill|line` で塗り／線画を絞れる。
3. **目で選ぶ**: `sheet.png` を見る（枠が色つきのものが主セット）。図の中のアイコンは見た目を揃える（塗りと線画を混ぜない・太さが違うセットを混ぜない）。迷ったら主セットのものを選ぶ。主セットに無い時だけ他のセットから選び、揃わないことを伝える。
4. **入れる**: 候補の下に出る行をそのまま実行する（`svg-diagram icons add mdi:key-variant=key`）。1 回で複数入れられる。名前は図のソースで使う短い名前。
5. **使う**: `box({icon: 'key', title: '鍵の管理'})`。入っていない名前は、入れ方つきのエラーで教えてくれる。

注意:
- CC BY などのライセンスのセットは既定で除外される。使うかはユーザーに確認し、了承されたら `--allow-license CC-BY-4.0`。
- 多色（固定色）のアイコンは `--color` が要る。トーンにもダークテーマにも従わず検査の外になるので、色そのものに意味がある 1〜2 枚だけにする。
- 入れたアイコンの出典は `svg-diagram icons notice` で出せる（クレジットが要る文書に貼る）。
- 絵記号は図の核心の数枚だけ。全部の箱には付けない。

## クラウド・ネットワークの構成図

アイコン+名前の点を `node({id, icon, label, sub})` で置き、境界（VPC・サブネット・ゾーン）は `group({title})` の入れ子、線は `connect('a:right', 'b:left')`。例: `examples/cloud-architecture.ts`。

- **線は必ず辺を指す**（`:right` `:left` `:top` `:bottom`）。省略すると中心同士を結び、枠のない node ではアイコンを貫く。`:bottom` は名前の下に付く。
- 線が見出しや別の node にかかって `build` が止まったら、node の並び（同じ行・同じ列に寄せる）か、`route: 'elbow'` の `bend` で直す。ゾーンや層ごとに行を分け、線は隣の行へだけ引くと素直に収まる。
- アイコンは汎用なら `icons find`（carbon が構成図向き）。**AWS / Azure / GCP / Kubernetes の公式アイコンは Iconify に無い**ので、ユーザーに各社の配布ページから zip を DL してもらい、`icons add-pack <zip> --prefix aws --terms <規約の URL> --accept-terms --match "..."` で入れる。**規約を読んだかはユーザーに確認してから** `--accept-terms` を付ける（勝手に付けない）。
- PNG プレビューで曲がる線の矢じりが横向きに見えるのは resvg の癖。確かめるなら `--engine chromium`。

## 公開してよい内容か

図のソースは、案件の内容（社名・画面・数値）を含みやすい。ツール本体のリポジトリには**架空の例**だけを置き、案件の図は案件側のリポジトリに置く。
