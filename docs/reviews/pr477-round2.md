# PR #477 レビュー（Opus, round 2）

対象: `feat/chevron-rows-spec` @ 32c80ce5（round 1 @ c689f886 からの差分 1 commit）

## 結論

M1・m1・m2・n2 はすべて直っている。新しい不具合は見つからない。残りは nit 2 つだけ。
**converged: yes**（Blocker 0・Major 0）。

## round 1 の指摘の確認

| 指摘 | 判定 | 根拠 |
|---|---|---|
| M1 | 解決 | `test/spec.test.ts:170-180` で縦・横の 9 つの message を両方向から見る。縦の分岐を消す、縦の文を横の文に差し替える、のどちらでも落ちる。 |
| m1 | 解決 | `test/spec.test.ts:175` を足した。21 行の `return` を消すと落ちる。 |
| m2 | 解決 | `lib/spec-parts/chevron.ts:22` で、縦の 9 つ以上は `steps` の issue 1 つだけを出して return する。文に直し方（steps を減らす、または横にして `rows`/`perRow` で折り返す）がある。`test/spec.test.ts:174` で `rows`・`perRow` を足しても 1 つだけになることを見る。 |
| n2 | 解決 | description を「at most 4, about 3+ steps per row」に変えた。`autoPerRow`（`lib/flow-chevron.ts:31`、`maxR = min(4, floor(n/3))`）と合う。`pnpm schema` の出力とも一致する。 |

## 確かめたこと

- 作業用の場所に HEAD を展開し、`lib/spec-parts/chevron.ts` に変異を当てて chevron のテストだけを回した。

  | 変異 | 結果 |
  |---|---|
  | 22 行（縦の 9 つ以上）を消す | 落ちる |
  | 22 行の `return` を消す | 落ちる |
  | 22 行の文を横の文に差し替える | 落ちる |
  | 22 行の `n > 8` を `n > 9` に | 落ちる |
  | 21 行の `return` を消す | 落ちる |
  | 23 行（縦の `rows`）を消す | 落ちる |
  | 25 行の `\|\| vertical` を消す | 通る（等価変異。n2-1） |

- `test/spec.test.ts`・`test/schema-files.test.ts`・`test/spec-selective*.test.ts` は 174 件すべて通過。`pnpm typecheck` 通過。`pnpm lint` エラーなし。`pnpm schema` を回しても差分なし。
- 回帰: 縦で 9 つ以上と `rows`+`perRow` の両方を書くと、まず `perRow` の issue 1 つだけが出る（21 行が先）。`perRow` を外すと 22 行の issue が出る。2 回かかるが、どちらも直し方を言うので許容できる。横の `check` の結果は round 1 と同じ。

## 指摘

### n2-1（nit）25 行の `|| vertical` は届かない

- 場所: `lib/spec-parts/chevron.ts:25`
- 問題: 縦で `n > 8` は 22 行で return 済み。そのため 25 行に来る縦は必ず `n <= 8` で、`|| vertical` は結果を変えない（変異しても落ちない）。
- 直し方: `if (n <= 8) return;` にする。残すなら直さなくてよい。

### n2-2（nit）ADR D7 の description が実装とずれた

- 場所: `docs/adr/0082-chevron-rows.md:177`（実装は `lib/spec-parts/chevron.ts:12`）
- 問題: n2 の直しで description を変えたが、ADR D7 は旧い文「the fewest rows (up to 4) …」のまま。
- 直し方: U4 で ADR と README を直すときに、D7 の文を実装に合わせる。この PR では直さなくてよい。

## 判定

- Blocker 0、Major 0、Minor 0、nit 2（n2-1・n2-2）。
- **converged: yes。** マージしてよい。nit は任意、n2-2 は U4 で扱う。
