# ADR 0005: HTML/CSS で描く出力(`--html`)

- 状態: 実装済み(箱・見出し・表は HTML 要素。ほかの部品は図形が SVG、文字は HTML)
- 日付: 2026-10-11

## 背景

Slidev や Web に埋め込むとき、図が 1 枚の SVG(`<img>`)だと文字を選択・検索できず、CSS から触れない。レイアウト(`layoutDiagram()`)は折り返し済みの行と座標を持つので、同じ結果から別の書き出しができる。

## 決定

1. `lib/emit-html.ts` の `emitHtml(laidOut, {reveal?, id?})` が、HTML 断片(`<style>` と `<div id class="sd">`)を返す。`renderDiagram(d, {html: true})` が `html` を返し、`build(d, out, {html: true})` / `svg-diagram build --html` が `<name>.html` を SVG の隣に書く。SVG は従来どおり作る(drift・lint・検査は SVG のまま)。
2. **ハイブリッド**: 箱・banner・caption・group の枠・arrow のない row・grid は、絶対配置の `div` と CSS。それ以外(コネクタ、矢印、表、曲線、plane、ワイヤーフレーム、step/icon/tag/stamp 付きの箱)は `emitSvg()` が作る SVG を、同じキャンバスに重ねた 1 枚の `<svg class="sd-ov">`(背景・`<style>`・`<metadata>` は除く)で出す。新しい図形を足すとき、HTML 版がなくても SVG にフォールバックするので壊れない。
3. **文字は 1 行 1 要素**: layout が行と baseline を決めているので、`white-space: pre`、固定幅、`line-height = ascent + descent`、`top = baseline − ascent` で置く(ブラウザは再折り返ししない)。ascent/descent は `font-metrics.ts` の `textBox`。
4. **枠線**: SVG は 2.5px の線が辺をまたぐ。CSS の `border` は整数 px に丸められるので、実線は `inset box-shadow`、破線・点線だけ `border`。座標は emit.ts と同じく 4px に丸める。
5. 検証は変えない。検査は layout の結果(と SVG)を見るので、HTML 版も同じ検査を通った図から出る。

6. **どの部品の文字も HTML**: SVG 側が書く `<text>` は属性が決まっている(x、y=baseline、text-anchor、class、font-size、font-weight、fill と、絵文字・太字・色つきの `<tspan>`)ので、重ねる SVG から抜き出して同じ絶対配置の行(中央・右揃いは `translateX(-50%/-100%)`)にする。線・矢印・曲線・表以外の図形(swimlane の枠、sequence の線、wireframe の部品、plane、bars、pyramid、legend、コネクタ)は SVG のまま。`raw()` は作者の SVG(transform なども可)なので、文字ごとそのまま残す。

## 実測

Chromium で SVG 版と HTML 版を描いて画素を比べた(差が 1 チャンネル合計 60 超の画素の割合): text-roles 0.5%、emphasis 2.7%(group 枠と文字の 1px のずれ)、inventory-flow 0%(全部 SVG フォールバック)。

## 既知の制約

- 図形は SVG のままなので、文字(HTML)は常に図形の上に描かれる。重なる要素が前後する図(別の部品の上に半透明の幕を重ねる、など)では、幕が文字を覆わない。重なりは verify が禁じているので通常の図では起きない。
- `raw()` の文字は選択できない。
- 矢印つきの row は SVG の矢印を重ね、箱は SVG 図形 + HTML の文字。step・icon・tag・stamp 付きの箱も同じ。
- 同じページに複数枚置くと、`<marker id="dsl-arrow">` が重なる(SVG を `<img>` でなく直接埋めたときと同じ)。
- フォントは CSS の font stack で解決される。測った font と違うと 1〜2px ずれる。
- 実測(全 examples、SVG 版との画素差): 最大 1.6%。
