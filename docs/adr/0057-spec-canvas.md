# ADR 0057: JSON spec の図をスライドの大きさで描く（`canvas`）

- 状態: 実装済み
- 日付: 2026-11-15
- 基点: `main`(837df96)
- 関連: ADR 0017(`canvas` と `fontFloor`)、ADR 0052(`canvas.fit: 'content'`)、ADR 0055(デッキ)

## 背景

JSON spec(`svg-diagram/spec`、MCP の `render_diagram` の入力)は、図を必ず幅 940px で描く。文書の本文の列(約 930px)に等倍で貼ると、14px の文字が 14px で読めるようにするためで、幅を超えると `doc-width` が「縮められて文字が小さくなる」と知らせる。

スライドに置く図ではこの前提が合わない。LT のスライド(Slidev、16:9)に、21 ノードの現状ツリー(CRT)を左から右へ描こうとしたところ、横向きには 1681px 要り、940px には収まらなかった。`maxNodeW` の下限 120 も、14px で 1 行 8 文字ほどを保つための値で、これ以上は詰められない。作り手は spec の外で `specToDiagram()` の結果の `width` を書き換え、1760px で描いて回避した(spec の外なので MCP からは描けない)。

DSL にはスライド 1 枚を等倍で描く `diagram({canvas: {width, height, minText, fit}})` が既にある(ADR 0017、0052)。spec がそれを出していないだけだった。

## 決定

- D1. spec の最上位に `canvas` を足す。中身は DSL と同じ `width`(整数、640〜3840)、`height`(整数、360〜2160)、`minText`(数、14〜48)、`fit`(`'content'` のみ)。どれも省略でき、既定は DSL と同じ 1280×720・24px・高さ固定。値はそのまま `diagram({canvas})` に渡す(変換しない)ので、同じ図は DSL と同じ SVG になる。
- D2. 範囲は、小さい画面(640×360)から 4K(3840×2160)まで。`minText` の下限は既定の文字の下限(`fontFloor` 14)。DSL は 10 まで下げられるが、`renderSpec` は案件の設定を持たず `fontFloor` 14 のままなので、14 未満は Node の経路で例外になる(spec からは下げられない)。上限はスライドの見出しほどの 48。範囲は `CANVAS_LIMITS`(spec-kit)に置き、スキーマと説明文が同じ値を使う。
- D3. 自由な `width` だけを出す案は採らない。幅だけ広げると文字は 14px のままで、表示する側が縮めれば文字が小さくなる(`doc-width` が警告する状態そのもの)。`canvas` は「この大きさで等倍に見せる」と宣言し、文字の下限(`minText`)も一緒に決めるので、スライドで読める大きさが保証される。
- D4. デッキ(ADR 0055)の図には `canvas` を書けない。デッキはスライドの空きに合わせて図を縮めるので、図が自分の大きさを決める `canvas` とは両立しない。デッキのスキーマの `figure` から `canvas` を外し、`validateDeck()` は `slides[i].figure.canvas` で断る。

## 結果

- 21 ノードの CRT は、`canvas: {width: 1920, height: 1080, minText: 20, fit: 'content'}` で 1920×698 に収まる(左から右、spec の範囲内)。`minText: 24` では 1920×969。
- 範囲外の値・知らない項目・`'slide'` のような文字列は、`canvas.width` などの場所つきで返る。
- MCP のプラグインは `specSchema` をそのまま入力のスキーマにしているので、vendor の core を差し替えれば `render_diagram` から使える。プラグインのビューアーの PNG は、4K(約 830 万画素)までは等倍を下回らないようにする(以前は 200 万画素が上限で、1920×1080 が 0.98 倍になった)。

## レビュー(Opus)で直したこと

- `minText` 10〜13 は `renderSpec`(Node)で `fontFloor` の例外になり、結果ではなく throw で返っていた → spec の下限を 14 にした(D2)。
- デッキの図に範囲外の `canvas` を書くと、`canvas.width` と `canvas` の 2 つが返った → `canvas` を断るときは中身の誤りを返さない。
- `renderSpec`(Node)・単体の PPTX(`renderPptxEdge`)で `canvas` を描くテストを足した。
