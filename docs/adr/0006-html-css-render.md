# ADR 0006: HTML/CSS で描く出力(`--html`)

- 状態: 実装済み(文字・箱・表・線・矢印・曲線・図形のすべてが HTML 要素。SVG に残るのは、CSS で書けないものと raw() だけ)
- 日付: 2026-10-11

## 背景

Slidev や Web に埋め込むとき、図が 1 枚の SVG(`<img>`)だと文字を選択・検索できず、CSS から触れない。レイアウト(`layoutDiagram()`)は折り返し済みの行と座標を持つので、同じ結果から別の書き出しができる。

## 決定

1. `lib/emit-html.ts` の `emitHtml(laidOut, {reveal?, id?})` が、HTML 断片(`<style>` と `<div id class="sd">`)を返す。`renderDiagram(d, {html: true})` が `html` を返し、`build(d, out, {html: true})` / `svg-diagram build --html` が `<name>.html` を SVG の隣に書く。SVG は従来どおり作る(drift・lint・検査は SVG のまま)。
2. **ハイブリッド**(第 1 段。第 3 項で図形も CSS にした): 箱・banner・caption・group の枠・arrow のない row・grid は、絶対配置の `div` と CSS。それ以外(コネクタ、矢印、表、曲線、plane、ワイヤーフレーム、step/icon/tag/stamp 付きの箱)は `emitSvg()` が作る SVG を、同じキャンバスに重ねた 1 枚の `<svg class="sd-ov">`(背景・`<style>`・`<metadata>` は除く)で出す。新しい図形を足すとき、HTML 版がなくても SVG にフォールバックするので壊れない。
3. **文字は 1 行 1 要素**: layout が行と baseline を決めているので、`white-space: pre`、固定幅、`line-height = ascent + descent`、`top = baseline − ascent` で置く(ブラウザは再折り返ししない)。ascent/descent は `font-metrics.ts` の `textBox`。
4. **枠線**: SVG は 2.5px の線が辺をまたぐ。CSS の `border` は整数 px に丸められるので、実線は `inset box-shadow`、破線・点線だけ `border`。座標は emit.ts と同じく 4px に丸める。
5. 検証は変えない。検査は layout の結果(と SVG)を見るので、HTML 版も同じ検査を通った図から出る。

6. **どの部品の文字も HTML**: SVG 側が書く `<text>` は属性が決まっている(x、y=baseline、text-anchor、class、font-size、font-weight、fill と、絵文字・太字・色つきの `<tspan>`)ので、重ねる SVG から抜き出して同じ絶対配置の行(中央・右揃いは `translateX(-50%/-100%)`)にする。線・矢印・曲線・表以外の図形(swimlane の枠、sequence の線、wireframe の部品、plane、bars、pyramid、legend、コネクタ)は SVG のまま。`raw()` は作者の SVG(transform なども可)なので、文字ごとそのまま残す。

7. **図形も CSS**(`lib/svg-to-css.ts`): 重ねる SVG の図形を、描かれた順のまま HTML の箱に変える。
   - `rect` / `circle` → 箱(背景、`inset box-shadow` の枠、`border-radius`。破線・点線の枠は `border`)。
   - `polygon`、塗りの `path` → `clip-path: polygon()` で切った箱。曲線(C/S/Q/T)と円弧(A)は、数 px ごとの折れ線に直してから切る。複数の閉じた輪(穴のあるアイコン)は、行って戻る橋で 1 つの polygon にして even-odd / nonzero で塗る。
   - 線の `path` → 線の太さをもつ帯の輪郭(miter の接合、butt / square / round の端、鋭すぎる角は bevel)を polygon にする。`stroke-dasharray` は弧長で区切って 1 本ずつ帯にする(1 本の図で 400 本を超えるなら SVG に戻す)。
   - `marker-start` / `marker-end` → 矢じりも polygon の箱(`<marker>` の寸法・ref・単位から、線の向きに合わせて計算)。
   - 曲線に `clip-path: shape()` は使わない。`shape()` は曲線を正確に描けるが、Baseline に入って間もない(2026 年 2 月)ので読めないブラウザが残る。`polygon()` はどこでも読める。線の太さのある輪郭は、どのみち `shape()` 1 つでは作れない(`clip-path` は塗り領域だけ)。
   - `<g role="img" aria-label>`(番号バッジ)は、同じ role と label をもつ原点の 0 サイズの箱に子の図形を入れる。
   - フィルタ、グラデーション、translate / scale 以外の transform、枠線つきの polygon は SVG のまま(順序は保つ)。

## 実測

Chromium で SVG 版と HTML 版を描いて画素を比べた(差が 1 チャンネル合計 60 超の画素の割合): text-roles 0.5%、emphasis 2.7%(group 枠と文字の 1px のずれ)、inventory-flow 0%(全部 SVG フォールバック)。

## 既知の制約

- 図形と文字は別の層(文字が上)なので、文字は常に図形の上に描かれる。重なる要素が前後する図(別の部品の上に半透明の幕を重ねる、など)では、幕が文字を覆わない。重なりは verify が禁じているので通常の図では起きない。
- `raw()` は作者の SVG のままで、文字も選択できない。
- 同じページに複数枚置くと、`<marker id="dsl-arrow">` が重なる(SVG を `<img>` でなく直接埋めたときと同じ)。
- フォントは CSS の font stack で解決される。測った font と違うと 1〜2px ずれる。
- 実測(全 examples、SVG 版との画素差): 最大 3.0%(icons: 文字の 1px 上下と、穴のあるアイコンの縁)。`<svg` が残る example は 0。
- 曲線は折れ線近似なので、拡大すると角が見える(3px ごとに点を置いている)。
