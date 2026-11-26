# PR #477 レビュー（Opus, round 1）

対象: `feat/chevron-rows-spec` @ 5b53edb3（ADR 0082 U3、D7）

## 結論

schema（`steps` 2〜12、`rows` の `oneOf`、`perRow` 1〜8、`current` 〜12）、`check` の 4 行、`build` の素通しは D7 どおりに動く。生成した `schema/spec.schema.json` も `pnpm schema` の出力と一致する。
ただし、D7 の表の 3 行目（縦で 9 つ以上）は、**分岐を消してもテストが落ちない**。消すと、round 2 の m9 で直した食い違い（縦の 9 つに「`rows` で折り返せ」と言う）が黙って戻る。テストが path しか見ないためである。
converged: no（Major 1）。

## 確かめたこと

- **spec の検査（作業用の場所のスクリプトで `validateSpec` を呼んだ）:**

  | `rows` の値 | 結果 |
  |---|---|
  | `'auto'`・`4` | issue なし |
  | `'foo'`・`'2'` | `parts[0].rows`: `must be one of "auto"` |
  | `9`・`5`・`0`・`-1` | `parts[0].rows`: `must be between 1 and 4` |
  | `1.5` | `parts[0].rows`: `must be an integer` |
  | `true`・`null` | `parts[0].rows`: `must be a integer or a string`（文は既存の `validateOneOf` のもの。n1） |

  - `perRow` の `9`・`0`・`1.5`・`true`・`'auto'` も、それぞれ `parts[0].perRow` の issue 1 つになる。
  - schema の issue があると `check` は呼ばれない（`lib/spec.ts:90`）。そのため、範囲外の値と `check` の issue は重ならない。13 steps も、`current: 13` も、issue は 1 つだけ。
- **`check` の表:** 各行が正しい path に 1 つずつ出る。両方の指定は、縦や 9 つ以上と重なっても `perRow` の issue 1 つだけ（n9 どおり）。`rows: 1` と `perRow` の組み合わせも 1 つだけ。
- **schema の形:** `rows` は pareto の `guide`（`schema/spec.schema.json:7314`）と同じ `oneOf` の形で出る。`parts.items` が既に `oneOf` なので、MCP の client にとって新しい構文はない。2 つの枝は型が別なので、標準の JSON Schema の検査器でも、どの値も 1 つの枝にしか当たらない。`spec-selective.ts:29` の `SCHEMA_KEYS` にない語も使っていない。
- **`build`:** 12 steps で `rows: 3`・`perRow: 4`・`'auto'`・`rows: 2` + `current: 5` が DSL と同じ SVG になる（PR のテスト）。spec の検査を通って DSL が throw する組み合わせは見つからない（縦・両方の指定は `check` が先に止める。`loopBack` は chevron の spec に無い）。
- **確認:** `pnpm typecheck` 通過。`pnpm lint` はエラーなし。`test/spec.test.ts`・`test/schema-files.test.ts`・`test/spec-selective*.test.ts` は 174 件すべて通過。`pnpm schema` を回しても差分なし。
- **変異（`lib/spec-parts/chevron.ts` に当て、chevron のテストだけを回した）:**

  | 変異 | 結果 |
  |---|---|
  | 26 行の `else if` を `if` に | 落ちる |
  | 22 行（縦の `rows`）を消す | 落ちる |
  | 24 行の `n <= 8` を `n <= 7` に | 落ちる |
  | 26 行の `rows === 1` を消す（PR に記載） | 落ちる |
  | **25 行（縦の 9 つ以上）を消す** | **通る**（M1） |
  | **25 行の文を横の文に差し替える** | **通る**（M1） |
  | **21 行の `return` を消す** | **通る**（m1） |

## 指摘

### M1（Major）縦で 9 つ以上の行を、テストが守っていない

- 場所: `test/spec.test.ts:170`（対象のコードは `lib/spec-parts/chevron.ts:25`）
- 問題:
  - テストは `.map(i => i.path)` で path だけを比べる。縦の issue も横の issue も、path は同じ `parts[0].steps` である。
  - そのため 25 行を消すと、縦の 9 つは 26 行に落ち、「`rows`（`'auto'` も可）か `perRow` で折り返す」と言う。それでもテストは通る。
  - これは round 2 の m9 で直した食い違いそのもの。言われたとおり `rows` を足すと、今度は「縦に `rows` は付かない」と言われる。
  - AGENTS.md の「新しいコードには、それを壊す変異を当て、テストが落ちること」を満たさない。
- 直し方:
  - 170 行で message も確かめる。例: `assert.match(at({direction: 'vertical'}, 9)[0]!.message, /vertical/)` と、`assert.doesNotMatch(…, /rows/)`（m2 で文を変えるなら、その文に合わせる）。
  - 横の 9 つ（171〜172 行）でも message を 1 回確かめると、2 つの文の取り違えが両方向で落ちる。

### m1（Minor）両方の指定の `return` を守るテストが無い

- 場所: `lib/spec-parts/chevron.ts:21`、`test/spec.test.ts:164-167`
- 問題:
  - `return` が効くのは、両方の指定が縦か 9 つ以上と重なったときだけ。
  - 横の 9 つ以上では、26 行の `perRow === undefined` が既に issue を止める。そのため 167 行（`rows: 2, perRow: 3` で 10 個）は、`return` が無くても通る。
  - `return` を消すと、縦で両方を書いた spec に 3 つの issue（両方・縦の `rows`・縦の `perRow`）が出る。テストはこれを見ていない。
- 直し方: `at({direction: 'vertical', rows: 2, perRow: 2}, 4)` が `['parts[0].perRow']` だけになることを足す。167 行は、`return` の要る組み合わせ（縦で 9 つ以上と両方）に変えてもよい。

### m2（Minor）縦で 9 つ以上に `rows` / `perRow` を足すと、issue が 2 つになり、直し方の文も無い

- 場所: `lib/spec-parts/chevron.ts:22-25`
- 問題:
  - `{direction: 'vertical', rows: 2}` で 9 つにすると、`rows` の issue（「横にするか、`rows` を外す」）と `steps` の issue（「縦は 8 つまで」）の 2 つが出る。
  - `rows` を外す方を選ぶと、`steps` の issue が残る。一度で直らない。
  - `steps` の文「a vertical chevron holds up to 8」は、何が悪いかだけで、どう直すかを言わない（AGENTS.md「何が悪いかとどう直すかを 1 行で」）。round 2 の m9 も「縦は 8 つまで。横にして `rows` を使う」と、直し方まで書くよう求めていた。
- 直し方:
  - 25 行の文に直し方を足す。例: `has ${n} steps; a vertical chevron holds up to 8: remove direction 'vertical' (rows or 'auto' then wraps it) or use 8 steps or fewer`。
  - 縦で 9 つ以上なら、22〜23 行の issue は出さず、この 1 つだけにする。どちらの直し方を選んでも、それで全部直る。
  - D7 の表の 2 行目と 3 行目が重なるときのことは、ADR に書かれていない。実装で決めてよい範囲だが、PR の本文に 1 行書く。

### n1（nit）`rows: true` の文が `must be a integer or a string` になる

- 場所: `lib/spec-validation.ts:62`（この PR では変えていない）
- 問題: 冠詞が `a integer` になる。また、文字列は `'auto'` しか受けないのに、`a string` と言う。pareto の `guide` も同じ文になるので、既にある問題である。
- 直し方: この PR では直さない。別の PR で、`integer` に `an` を付け、`enum` が 1 つだけの枝ならその値を名前で示す。

### n2（nit）`rows` の description は `'auto'` を言いすぎている

- 場所: `lib/spec-parts/chevron.ts:12`
- 問題: 「the fewest rows (up to 4) where no step's text wraps」とあるが、D3 では 5 つ以下の `'auto'` は折り返さない（`maxR = floor(n/3)`）。また、9 つ以上は 2 段から数える。文は ADR D7 の指定どおりなので、この PR の誤りではない。
- 直し方: 直すなら ADR と一緒に直す（U4 の README と合わせる）。今は直さなくてよい。

## Open question への判断

**同時指定の path は `perRow` のままでよい。**

- 理由:
  - 既存の同じ種類の issue（`width` と `canvas`、`lib/spec.ts:92`）も、外す側のフィールドに出している。
  - ADR は `rows`（特に `'auto'`）を主の指定として書いており、`perRow` はその補いである。`perRow` を外すよう促す path の方が、ADR の向きと合う。
  - 文が両方の名前を言うので、どちらの path でも直し方は伝わる。
- PR の本文の Open questions から外し、D7 の表に「path は `perRow`」と書き足すとよい（U4 で ADR を直すときでよい）。

## 判定

- Blocker 0、Major 1（M1）、Minor 2（m1・m2）、nit 2。
- **converged: no。** M1 はテストに message の確認を足すだけで閉じる。m1・m2 も小さな直しで、設計は変わらない。
- M1 を直したら round 2 で確かめる。差分が M1・m1・m2 の直しだけなら、簡単な確認で足りる。
