# ADR 0045: Web ページで動かす入口 `svg-diagram/browser` — 測定を外から渡す

- 状態: 実装中(1・2・3・4 のうち、入口・副作用の除去・canvas の Measurer・CI のスモークテストまで)。帯ごとの登録式(D6)は実測のあと別 PR
- 日付: 2026-10-27
- 基点: `main`(PR #338 まで)
- 関連: ADR 0007(Ports。Measurer の差し替え)、ADR 0031(中核に I/O を置かない)
- 範囲外: 凡例・用語の差し替え(`diagram({legendLabels})`。次の PR)、`swimlane({laneOrder: 'auto'})`、`math()` と `image()`、`slide` / `fill`、HTML 形式

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
`WebMeasurer = (req: {text, size, weight, font}) => {w, h} | Promise<{w, h}>`。`renderInBrowser` は `collectMeasures` が求めた全部をこの関数で測り、`layoutWith` に渡す。`renderDiagram()` と同じく、検証の失敗と XML の不整合は例外にせず結果(`verdict`、`xml`)で返す。canvas 版の参考実装 `canvasMeasurer()` は、`ctx.font = "<weight> <size>px <FONT_STACKS[font]>"` の `measureText` の幅と、`fontBoundingBoxAscent` / `Descent` を各々丸めた高さを返す(`lib/font-metrics.ts` の `textBox` と同じ規則)。

### D3: `icon-registry` は fs を import しない
`process.getBuiltinModule('node:fs')` で必要になったときだけ取る(Node 22.3 以降。`engines` は 22.18)。Web ページには `process` がないので、path アイコンは `icon.use(manifest)` で渡したものだけが使える(絵文字は fs を使わないのでそのまま使える)。

### D4: `emit-html` は SHA-1 を純 JS で持つ
`node:crypto` の代わりに `lib/sha1.ts`。出力の id(`sd-xxxxxxxx`)は変わらない(`test/sha1.test.ts` が `node:crypto` と突き合わせる)。

### D5: 入口に含めないものは、使われたら理由つきの例外にする
`math()` と `image()` は、呼ぶと「ブラウザ入口にない」と言って投げる。`diagram({slide})` / `{fill}` は `renderInBrowser` が投げる(実スライドの空き寸法が要る)。

### D6: 帯ごとの登録式にするかは、実測のあとに決める(この PR では入れない)
帯の種類ごとの処理表(layout / emit / verify / fit)は、網羅性を型で縛った 1 つの表なので、`swimlane` しか使わなくても全部の帯のコードが入る。実測(minify)は次のとおり。

| バンドル | サイズ |
|---|---|
| `lib/web.ts` 全部 | 872KB(gzip 302KB) |
| `diagram` `cloud` `renderInBrowser` `canvasMeasurer` の 4 つだけ import | 707KB |
| 上に `"sideEffects": false` | 676KB |

つまり名前ごとの tree shaking では約 19%(sideEffects を足しても約 22%)しか減らない。残りは帯の処理表が引き込む。減らすなら `createRenderer({bands: [...]})` のような登録式にして、Node 側の入口は全部入りのままにする案がある。得るものは数百 KB、払うものは「帯を足すときの登録先が 1 か所増える」ことと、網羅性の検査を全部入り側に移すこと。Artifact の用途では 1 回読み込めば足りるので、急がない。

## 検証
- `test/web-entry.test.ts`: `lib/web.ts` を `esbuild --platform=browser` で、alias・スタブ・external なしに束ねられること(`node:*` への import が 0)。Node で偽の測定関数を渡した描画。Chromium で swimlane / causeTree(CRT)/ causeTree(FRT)/ cloud を canvas で測って描き、verdict が ok で XML が整っていること(Chromium がなければ skip)。
- `test/sha1.test.ts`、`core-purity`(新しいファイルは SHELL に入れない)。
