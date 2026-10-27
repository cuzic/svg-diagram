# ADR 0045: Web ページで動かす入口 `svg-diagram/browser` — 測定を外から渡す

- 状態: 実装中(1・2・3・4 のうち、入口・副作用の除去・canvas の Measurer・CI のスモークテストまで)。帯ごとの登録式(D6)は実測のあと別 PR
- 日付: 2026-10-27
- 基点: `main`(PR #338 まで)
- 関連: ADR 0007(Ports。Measurer の差し替え)、ADR 0031(中核に I/O を置かない)
- 範囲外: `swimlane({laneOrder: 'auto'})`(別 PR #342)、`math()` と `image()`、`slide` / `fill`、HTML 形式
- コードの変更が要らなかったもの: 凡例の語の差し替え。`diagram({legendLabels})` がすでにあり、ブラウザ入口でも効く(テストあり)

## 背景

claude.ai の Artifact のように、サーバーも Node も使えない単一の HTML の中で図を描きたい、という要望があった(業務フロー図・現状ツリー・クラウド・未来ツリーの 4 種)。README の「ブラウザ不要」は Chromium が要らないという意味で、Web ブラウザで動くという意味ではない。要望者は node:* と native を空のスタブに差し替えて約 1.4MB のバンドルを作り、4 種の描画が通ることを確かめた。つまり**描画の中核はすでに純粋**で、足りないのは入口と、import 時の副作用である。

実測(`esbuild --platform=browser`、node 組み込みだけ external にして `lib/dsl.ts` を束ねた結果)。dsl.ts から推移的に node:* に届くのは次のとおり。

| ファイル | 何に使うか | 扱い |
|---|---|---|
| `dsl/io`(fs / path / child_process) | `build()`、`image()`、`math()` | 入口に含めない |
| `dsl/render`(slide-budget、image-file) | `renderDiagram()` / `checkDiagram()` | 入口に含めない。`diagram()` と純粋なパスは `dsl/diagram` に出す |
| `icon-registry`(fs / path) | `box({icon})` の path アイコン | `process.getBuiltinModule` で遅延(D3) |
| `emit-html`(node:crypto) | HTML 形式の id の SHA-1 | 純 JS の `sha1.ts`(D4) |
| `math-tex`(node:module) | `math()` | `io` の内側なので届かない |
| `font-metrics`(harfbuzzjs のトップレベル await)、`measure`、`raster`、`config`、`slide-index`(`isMain`)、`slide-budget`、`image-file`、`font-subset` | 測定・書き出し・CLI | 入口から届かない |

## 決定

### D1: 入口は `lib/web.ts`、`exports` は `"./browser"`
`lib/dsl-pure.ts`(`lib/dsl.ts` から、ファイルや process に触れない部分を分けたもの。公開される名前は変えない)を再公開し、`renderInBrowser(diagram, {measure})` と `canvasMeasurer()` を足す。`lib/dsl.ts` は `dsl-pure` + `io` + `render` + `closeMeasurer` で、これまでと同じ名前を同じ形で公開する。`lib/browser.ts`(Chromium を起動する殻)と名前が重なるので、ファイルは `web.ts`。

### D2: 測定は関数で渡す(ADR 0007 の Ports)
`WebMeasurer = (req: {text, size, weight, font}) => {w, h} | Promise<{w, h}>`。`renderInBrowser` は `collectMeasures` が求めた全部をこの関数で測り(同じ文字列は 1 回だけ。まとめて並べて待つ)、`layoutWith` に渡す。`renderDiagram()` と同じく、検証の失敗と XML の不整合は例外にせず結果(`verdict`、`xml`、`fit`)で返す。

参考実装は 2 つある。**`svgMeasurer()` を使う**: 隠した SVG の `<text>` の `getBBox()` を返す。`lib/measure.ts` が Chromium で測るのと同じやり方で、図の `<text>` をブラウザが描く箱と一致する(`test/web-entry.test.ts` が Chromium で、同じ文字列をマークアップから読み込んだ `<text>` の `getBBox()` と突き合わせる)。注意が 2 つある。(1) `xml:space="preserve"` は `setAttributeNS(XML 名前空間)` で付ける。`createElementNS` した要素への `setAttribute('xml:space')` は効かず、空白だけの run が幅 0 になって、空白 1 つにつき約 4px 狭く測られる(`lib/measure.ts` が以前に直したのと同じ不具合。Opus 再確認で見つかり、テストに入れた)。(2) 隠した SVG はページの文字の指定(`letter-spacing` など)を受け継ぐので、`style` で戻している。font の指定も属性ではなく `style` で付ける: ページに入れた図の `<style>` の `text {font-family}` は属性に勝ち、mono の文字が sans で測られる(Opus 2 度目の再確認 M5。`!important` の規則までは防げない)。表示されていない `host` は、全部 0 になる代わりに例外にする。`canvasMeasurer()` は DOM を使わず軽いが**近似**: canvas の `fontBoundingBoxAscent/Descent` は先頭のフォントの値だけで、SVG の箱はフォールバックしたフォント(等幅 + 日本語、絵文字)の分だけ高くなる。等幅の幅も 0.3px ほど狭く出ることがある(実測、Opus レビュー)。そのため文字が箱をわずかにはみ出し得るが、verdict は同じ測定値から作られるので気づけない。Worker など DOM のない場所で使うか、近似で足りるときだけ選ぶ。

同じ HarfBuzz の測定値を `renderDiagram` と `renderInBrowser` に渡すと、`examples/` 173 本のうち 169 本は SVG も verdict も一致した(残り 4 本は `image()` を含み、想定どおり投げる。Opus レビューでの確認)。

### D3: `icon-registry` は fs を import しない
`process.getBuiltinModule('node:fs')` で必要になったときだけ取る(Node 22.3 以降。`engines` は 22.18)。Web ページには `process` がないので、path アイコンは `icon.use(manifest)` で渡したものだけが使える(絵文字は fs を使わないのでそのまま使える)。

### D4: `emit-html` は SHA-1 を純 JS で持つ
`node:crypto` の代わりに `lib/sha1.ts`。出力の id(`sd-xxxxxxxx`)は変わらない(`test/sha1.test.ts` が `node:crypto` と突き合わせる)。

### D5: 入口に含めないものは、使われたら理由つきの例外にする
`gantt({today: 'auto'})` の日付は `renderInBrowser(d, {measure, today})` で渡す(ライブラリは時計を読まない)。`math()` と `image()` は、呼ぶと「ブラウザ入口にない」と言って投げる。`diagram({slide})` / `{fill}` は `renderInBrowser` が投げる(実スライドの空き寸法が要る)。

### D6: 帯ごとの登録式にするかは、実測のあとに決める(この PR では入れない)
帯の種類ごとの処理表(layout / emit / verify / fit)は、網羅性を型で縛った 1 つの表なので、`swimlane` しか使わなくても全部の帯のコードが入る。実測(minify)は次のとおり。

| バンドル | サイズ |
|---|---|
| `lib/web.ts` 全部 | 875KB(gzip 303KB) |
| `diagram` `cloud` `renderInBrowser` `canvasMeasurer` の 4 つだけ import | 707KB |
| 上に `"sideEffects": false` | 676KB |

つまり名前ごとの tree shaking では約 19%(sideEffects を足しても約 22%)しか減らない。残りは帯の処理表が引き込む。減らすなら `createRenderer({bands: [...]})` のような登録式にして、Node 側の入口は全部入りのままにする案がある。得るものは数百 KB、払うものは「帯を足すときの登録先が 1 か所増える」ことと、網羅性の検査を全部入り側に移すこと。Artifact の用途では 1 回読み込めば足りるので、急がない。

## 検証
- `test/web-entry.test.ts`: `lib/web.ts` を `esbuild --platform=browser` で、alias・スタブ・external なしに束ねられること(`node:*` への import が 0)。Node で偽の測定関数を渡した描画。Chromium で swimlane / causeTree(CRT)/ causeTree(FRT)/ gantt / cloud を `svgMeasurer()` で測って描き、verdict が ok で XML が整っていること(Chromium がなければ skip)。
- `test/sha1.test.ts`、`core-purity`(新しいファイルは SHELL に入れない。`web.ts` は `ROLES` を import せず、`tokens.rolesAt()` に選ばせる。`web-measure.ts` は `document` に触るが、core-purity の検査は DOM を見ないので core のまま。DOM を使うのは呼び出された `svgMeasurer()` / `canvasMeasurer()` の中だけで、import 時には何も評価しない)。

## Opus レビュー(1 巡目)で直したもの
`today` を渡す道がなかった(M1)、canvas の測定が SVG の箱とずれる(M2。`svgMeasurer` を足し、使うほうを変えた)、`web` を SHELL に入れて検査から外していた(M3。`rolesAt` で外した)、`prepared` ではなく外側の木で配置していた・同じ文字列を測り直していた・`fit` が結果から落ちていた・`fontBoundingBox*` が無いブラウザで NaN になった・アイコンのエラーが CLI を勧めた(低)。detach の順序の違い(`today: 'auto'` の日付なしと読めない `image()` が同じ図にあるときに、先に出るエラーが変わる)は、そのままにした。
