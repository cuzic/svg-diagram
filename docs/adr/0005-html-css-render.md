# ADR 0005: HTML/CSS で描く出力(`--html`)

- 状態: 実装済み(第 1 段。箱・見出し・文字だけ HTML。残りは重ねた SVG)
- 日付: 2026-10-11

## 背景

Slidev や Web に埋め込むとき、図が 1 枚の SVG(`<img>`)だと文字を選択・検索できず、CSS から触れない。レイアウト(`layoutDiagram()`)は折り返し済みの行と座標を持つので、同じ結果から別の書き出しができる。

## 決定

1. `lib/emit-html.ts` の `emitHtml(laidOut, {reveal?, id?})` が、HTML 断片(`<style>` と `<div id class="sd">`)を返す。`renderDiagram(d, {html: true})` が `html` を返し、`build(d, out, {html: true})` / `svg-diagram build --html` が `<name>.html` を SVG の隣に書く。SVG は従来どおり作る(drift・lint・検査は SVG のまま)。
2. **ハイブリッド**: 箱・banner・caption・group の枠・arrow のない row・grid は、絶対配置の `div` と CSS。それ以外(コネクタ、矢印、表、曲線、plane、ワイヤーフレーム、step/icon/tag/stamp 付きの箱)は `emitSvg()` が作る SVG を、同じキャンバスに重ねた 1 枚の `<svg class="sd-ov">`(背景・`<style>`・`<metadata>` は除く)で出す。新しい図形を足すとき、HTML 版がなくても SVG にフォールバックするので壊れない。
3. **文字は 1 行 1 要素**: layout が行と baseline を決めているので、`white-space: pre`、固定幅、`line-height = ascent + descent`、`top = baseline − ascent` で置く(ブラウザは再折り返ししない)。ascent/descent は `font-metrics.ts` の `textBox`。
4. **枠線**: SVG は 2.5px の線が辺をまたぐ。CSS の `border` は整数 px に丸められるので、実線は `inset box-shadow`、破線・点線だけ `border`。座標は emit.ts と同じく 4px に丸める。
5. 検証は変えない。検査は layout の結果(と SVG)を見るので、HTML 版も同じ検査を通った図から出る。

## 実測

Chromium で SVG 版と HTML 版を描いて画素を比べた(差が 1 チャンネル合計 60 超の画素の割合): text-roles 0.5%、emphasis 2.7%(group 枠と文字の 1px のずれ)、inventory-flow 0%(全部 SVG フォールバック)。

## 既知の制約・次の段

- 表・swimlane・sequence・wireframe・step/tag/icon/stamp 付きの箱は、まだ SVG のまま(見た目は同じ、文字は選択できない)。表は `<table>` にすれば意味のある HTML になる。
- 矢印つきの row は SVG。矢印だけ重ねて子の箱を HTML にする分割は未対応。
- 同じページに複数枚置くと、`<marker id="dsl-arrow">` が重なる(SVG を `<img>` でなく直接埋めたときと同じ)。
- フォントは CSS の font stack で解決される。測った font と違うと 1〜2px ずれる。
