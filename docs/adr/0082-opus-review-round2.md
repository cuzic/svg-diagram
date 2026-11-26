# ADR 0082 Opus レビュー 第 2 回

- 対象: `docs/adr/0082-chevron-rows.md`（PR #468、ブランチ `docs/adr-chevron-wrap`、コミット 6cca3b41）
- 見方: round 1 の各指摘が直ったかを、`ファイル:行` と試し（spike）で確かめた。試しは round 1 のコピー（リポジトリの外）を、改訂後の D2・D4 に合わせて直して使った。
  - `rowGap = 40`、続きの線の 4 点を `Math.round`、`tone: 'text'`、`svgDefs` の hook。
  - 試しには `perRow` だけを入れた。`'auto'` は、`perRow` を 7・4・3・2 と変えて各 step の行数を数え、D3 の規則を手で当てた。

## round 1 の指摘の解決状況

| ID | 状況 | 確かめたこと |
|---|---|---|
| B1 | 解決 | D4 に `svgDefs` を決定として書いた。試しで、つなぎ線の無い 7 つ・`perRow: 4` の図に `<marker id="dsl-arrow">` が出て、`check --strict` が通る。spotlight で暗くなると `dsl-arrow-dim` が出る（`lib/emit-svg-core.ts:39` の `d.arrow && laidOut[i].dim`）。U1 のテストに暗い場合が無い（n4）。 |
| M1 | 解決 | 制限をやめた（案 a）。D5 の引用 `lib/layout-tree.ts:105`（`y0`）と `:108`（線を足す行）は正しい。 |
| M2 | 解決 | `chevronBand` で throw する（D1）。`expandLoopBacks` は配置の前に動く（`lib/core.ts:159-169`）。`chevronBand` に入る道は DSL の `chevron()`（`lib/dsl/chevron.ts:7`）だけで、spec は `loopBack` を出していない（`lib/spec-parts/chevron.ts:8-13`）。抜け道は無い。 |
| M3 | 一部 | 基準に sub を入れた。下の「`'auto'` の試し」のとおり、依頼の例では 2 段に決まり、困りごとは解ける。ただし round 1 で求めた「明示の `\n` の扱い」は書かれていない。fallback の「行数」の定義も無い（m8）。 |
| m1 | 解決 | 最後の縦線は 20px。矢じりは終点から 9 単位 × 0.7 × 1.5 ≈ 9.45px 手前まで伸びるので、見える線は約 10.5px。「9px 以上」と合う。 |
| m2 | 解決 | `colorOf('text', day)` は `PALETTE.text`（`lib/tokens.ts:224-227`）で、marker の塗り（`lib/emit-svg-core.ts:50`）と同じ値。試しで確かめた: 明るい図では線も矢じりも `#22201b`。`appearance: 'dark'` では、`recolor` が両方を `#ece6da` に変える。暗くなる帯では、線が `ink()` で `#6f6659`、矢じりが `dsl-arrow-dim` で `#6f6659`。PPTX は、線と矢じりが同じ `srgbClr`（`22201B`、dark では `ECE6DA`）で、`tailEnd type="triangle"`、名前は `line`。暗い帯は PPTX では絵になる（`lib/pptx/flow.ts:4-5`）ので、ずれは出ない。D6 の言い方は直っていない（n5）。 |
| m3 | 解決 | `Math.round` と、すべての矢羽根の後に積むことを書いた。 |
| m4 | 解決 | 文が `lib/layout-fit-width.ts:39` と合う。 |
| m5 | 一部 | D4 に既知の限界と書いた。D5 の `connect()` の行は、今も「重なりは既存の検査が見る」と言うだけ（n6）。 |
| m6 | 一部 | 1 段になる指定の文は直った。throw の一覧の文は、新たに誤読できる形になった（m10）。 |
| m7 | 一部 | `check` の条件は書いた。ただし、選んだ schema の形 `anyOf` / `const` は、このリポジトリの道具では通らない（M4）。条件には縦の chevron との矛盾もある（m9）。 |
| n1 | 解決 | — |
| n2 | 解決 | — |
| n3 | 解決 | — |

## 試しで確かめて問題がなかったこと（指摘にしない）

- **D8 のバイト同一:** `rowGap = 40`・`tone: 'text'`・`svgDefs` を入れた試しで、`chevron(` を使う今の例 9 本の SVG が今と 1 バイトも違わない。9 本は `arbinger-way-out`、`focus`、`spotlight-flow-shapes`、`chevron-release`、`width-fit`、`chevron-vertical`、`tree-band-funnel`、`steps-loop-back`、`tree-band-nodes`。
- **`'auto'` の試し**（7 つ、5 字のラベル「要件の確認」など、8 字の sub「説明の文を入れる」）: 各 step の行数を「ラベル / sub」で書く。

  | 幅 | perRow 7（r=1） | 4（r=2） | 3（r=3） | 2（r=4） | D3 が選ぶ r |
  |---|---|---|---|---|---|
  | 940（doc） | 1 / 2 | 1 / 1 | 1 / 1 | 1 / 1 | **2**（4 + 3） |
  | 1200（doc） | 1 / 2 | 1 / 1 | 1 / 1 | 1 / 1 | **2**（4 + 3） |
  | `canvas: 'slide'`（1280、文字 24px） | 2 / 2 | 1 / 1 | 1 / 1 | 1 / 1 | **2**（4 + 3） |

  依頼の例では、どの幅でも 4 + 3 に決まる。妥当。1200 でも 1 段にならないのは、`textW = (1160−24)/7 − 52 ≈ 110px` に 14px の 8 字（約 112px）が入らないため。
- **`fill` のフォント倍率の探索との相性:** `findFillScale` は高さが倍率に対して単調だと見なす二分探索（`lib/slide-fill.ts:14-28`）。`'auto'` では、倍率が上がると 1 行に入る字数が減って段が増える。段が増えれば図は高くなるので、単調さは崩れない。
- **`rowGap = 40` の幾何:** 次の段の先頭の矢羽根では、上辺が `xx` から `xx + cellW − tip` まで続く。`tip ≤ cellW/4` なので、終点の x（`xF + cellW/2`）は必ず上辺の上にある。始点（最後の矢羽根の下辺）も同じ。
- **`svgDefs` とラチェット:** hook の中の `p.k === 'path'` は primitive の種類で、`.type ===` ではない。`lib/bands/` の中でもある。
- **`chevron` の primitive を添字で読むコード:** 無い（`grep 'primitives\['`）。`polygonsOf`・`polygonsIn`（`lib/layout-tree.ts:77-79`）は `k === 'polygon'` で絞るので、path が増えても変わらない。

## Major

### M4. spec の `rows` を `anyOf` と `const` で書くと、型が通らず、検査もされない

- 節: D7「`rows`」
- 根拠:
  - `JsonSchema` の型に `anyOf` は無い（`lib/spec-kit.ts:32-48`）。`object({... rows: {anyOf: ...}})` は、余分なプロパティとして `pnpm typecheck` で落ちる。
  - 型を足して通したとしても、spec の検査器 `validate` は `oneOf`・`const`・`enum`・`type` しか見ない（`lib/spec-validation.ts:12-51`）。`anyOf` だけの節は `default:` に落ち、**どんな値も通る**。
  - `oneOf` の枝に `{const: 'auto'}` を `type` なしで置いても通らない。`validateOneOf` は枝を `type` で選ぶ（`lib/spec-validation.ts:58`）ので、`'auto'` が「must be a integer or a undefined」で断られる。
  - 試し（`validateAgainst`、パスは `rows`）:

    | 値 | ADR の `anyOf` | `oneOf` + `{const}` | `oneOf` + `{type: 'string', enum: ['auto']}` |
    |---|---|---|---|
    | `'auto'` | 通る | **断る（誤り）** | 通る |
    | `'foo'` | **通る（誤り）** | 断る | 断る（`must be one of "auto"`） |
    | `9` | **通る（誤り）** | 断る | 断る（`between 1 and 4`） |
    | `1.5` | **通る（誤り）** | 断る | 断る（`must be an integer`） |

  - 数と文字列の合併は、どの part でも `oneOf` + 型つきの `enum` で書いている。`lib/spec-parts/pareto.ts:16` の `guide` と `lib/spec-parts/value-chain.ts:12` の `margin` がその例。round 1 の m7 でも、この形を指した。
- 問題:
  - ADR どおりに実装すると、型の検査で止まる。
  - 実装者が `JsonSchema` に `anyOf` を足して型だけ通すと、`rows: 9` や `rows: 'foo'` が spec の検査を素通りする。
    - `9` は DSL では有効な値なので、上限 4 は効かない。
    - `'foo'` は DSL の throw になり、spec の issue（パス付き）として返らない。MCP の利用者に、どこが悪いかが伝わらない。
- 直し方:
  - D7 を次のように書き直す。
    ```ts
    rows: {oneOf: [{type: 'integer', minimum: 1, maximum: 4}, {type: 'string', enum: ['auto']}], description: '…'}
    ```
    `spec-kit` にも `JsonSchema` にも手を入れない。
  - 「`spec-kit` の `oneOf` は文字列の列挙だけなので」の段落は、「`oneOf()`（関数）は文字列の列挙だけなので、`oneOf` の節を手で書く（pareto の `guide` と同じ形）」に直す。
  - U3 のテストに、`rows` が `'foo'`、`9`、`1.5` のとき、パス `parts[0].rows` の issue が出ることを足す。

## Minor

### m8. `'auto'` は sub が少し長いと最大の段数まで割る。fallback の「行数」が定義されておらず、`\n` の扱いも無い

- 節: D3
- 根拠（試し。7 つ、5 字のラベル。値は各 step の sub の行数。ラベルはどれも 1 行）:

  | sub の字数 | 幅 | r=1 | r=2 | r=3 | r=4 | D3 が選ぶ r |
  |---|---|---|---|---|---|---|
  | 12 | 940 | 3 | 1 | 1 | 1 | 2 |
  | 12 | slide | 3（ラベル 2） | 2 | 1 | 1 | **3**（3 + 3 + 1） |
  | 16 | 940 | 4 | 2 | 1 | 1 | **3** |
  | 16 | slide | 4（ラベル 2） | 2 | 2 | 1 | **4**（2 + 2 + 2 + 1） |

  - 「sub が 1 行」を満たすまで段を増やす。そのため、16 字の sub のスライドでは 1 段に 2 つ、4 段になる。
    - 手順の流れに見えにくい。続きの線が 3 本になる。最後の段は 1 つだけになる。
    - r=2 なら、sub が 2 行の 4 + 3 で済む。
  - どの `r` でも収まらないときの「最も行数の多い step の行数」は、ラベルと sub を合わせた行数か、別々の最大かが書かれていない。
  - 長い sub（どの幅でも折れる）では、段を増やすほど行数は減る。だから fallback は、ほぼいつも `maxR` を選ぶ。
  - round 1 の M3 で求めた「明示の `\n` を含むラベルは、何段にしても 1 行にならない（`lib/wrap.ts:80`）」の扱いも書かれていない。合わせた行数で比べ、同じなら小さい `r` を選ぶのであれば、結果として害は無い。ただし、それを ADR が言っていない。
- 直し方:
  - 次のどちらかを書く。
    - (a) 候補を `perRow >= 3` に限る（`maxR = max(1, min(4, floor(n/3)))` など）。7 つなら 4 + 3 か 3 + 3 + 1 までにする。
    - (b) 基準を 2 段階にする。まず「ラベル 1 行・sub 1 行」を探し、無ければ「ラベル 1 行・sub 2 行以下」の最初の `r` を選ぶ。
  - fallback の「行数」は、`\n` で区切った後の、ラベルと sub を合わせた行数と定義する。同じなら小さい `r` を選ぶ、と書く。
  - 上の表を、U2 のテストの期待値として ADR に載せる（今の ADR には、round 1 で求めた試しの表が無い）。

### m9. spec の `check` が、縦の 9〜12 個に矛盾した直し方を言う

- 節: D7「`check` で issue にする条件」と「`check` で issue にする組み合わせ」
- 根拠:
  - `steps` の上限を 12 にすると、`direction: 'vertical'` の 9〜12 個も schema を通る。
  - そこへ「`rows` も `perRow` もない」の条件が当たり、「`rows` か `perRow` で折り返す」と言う。
  - 言われたとおりに `rows` を足すと、今度は「`rows` を `vertical` と一緒に指定した」の issue になる。
  - `perRow >= 9`（例: 12 個に `perRow: 9`）でも、メッセージは同じ「`rows` か `perRow` で折り返す」。既に `perRow` を書いた利用者には、何を直すかが伝わらない。
- 直し方:
  - 9 個以上の条件は「横（`direction` が無いか `'horizontal'`）のとき」に限る。
  - 縦の 9 個以上をどうするかを決めて書く。許すか、「縦は 8 つまで。横にして `rows` を使う」の issue にするか。
  - メッセージを場合で分ける。`perRow >= 9` なら「`perRow` を 8 以下にする」。
  - 今ある spec の issue の文は英語（`lib/spec-parts/chevron.ts:17` の `is ${c}, but there are ${n} steps`）。D7 の description（「横の矢羽根を何段に…」）とメッセージも、英語にするか、日本語にする理由を書く。spec の description は 242 か所すべてが英語で書かれている。

### m10. D1 の throw の条件「`'auto'` 以外の値」が、`rows: 2` も断るように読める

- 節: D1「throw する指定」
- 問題:
  - 「`rows` が 1 未満の整数、または `'auto'` 以外の値」は、字のとおりには `rows: 2`（`'auto'` 以外の値）も断る。
  - `1.5` や `NaN` を断るかどうかも、この文からは決まらない。
  - `perRow` の「1 未満の整数」も、`1.5` や `NaN` を断るかが読めない。
  - round 1 の m6 で求めた言い換えが入っていない。
- 直し方: 次のように書く。
  - 「`rows` が、1 以上の整数でも `'auto'` でもない」
  - 「`perRow` が、1 以上の整数でない」
  - U1 のテストに `rows: 1.5`、`rows: 0`、`rows: 'x'`、`perRow: 1.5` を足す。

## nit

- n4. U1 のテストに、round 1 の B1 で求めた 2 つめ（別の帯に spotlight を当てたとき、`dsl-arrow-dim` が `<defs>` に出ること）が無い。足す。
- n5. D6「これらの属性と値は、どれも今の `cycle` などの帯が既に出しているもの」は、属性ごとには正しい。ただし `thin` と `arrow` の組み合わせ（`stroke-width="1.5"` に `marker-end`）は、今の図には無い（round 1 m2 の後半）。そう書く。
- n6. D5 の `connect()` の行の「重なりは既存の検査が見る」に、「続きの線は除く（D4）」を足す（round 1 m5 の後半）。
- n7. D4 の「`PALETTE.text` で塗られる（`lib/emit-svg-core.ts:49`）」の行は `:50`。`:49` は `<marker>` の開きタグ。
- n8. `rows: 'auto'` と `loopBack` を一緒に指定すると、`n = 2`（`maxR = 1` で必ず 1 段）でも throw する。害は無いが、「`'auto'` は段数によらず断る」と書いておくと、実装とテストで迷わない。

## 結論

- **Blocker は無い。Major が 1 つ（M4）残る。**
- round 1 の B1・M1・M2 は直った。M3 は、依頼の例（5 字のラベル、8 字の sub、幅 940・1200・slide）では 4 + 3 を選び、困りごとは解ける。残りは m8 にした。
- M4 は D7 の `rows` の schema を `oneOf` + `{type: 'string', enum: ['auto']}` に書き直せば閉じる。小さな直しで、設計は変わらない。
- 規則（Blocker・Major が出たラウンドだけ再レビューする）に従うと、M4 を直したあとに第 3 回が要る。ただし、直しは 1 行の置き換えとテストの追加で済む。差分を見て閉じたと確かめられれば、第 3 回は簡単な確認で足りる。
