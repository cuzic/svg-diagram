# ADR 0050: 部品を組み合わせる層(xmonad 風の合成)

- 状態: 実装済み(第 1・第 2 段。PR 待ち)。Opus 2 巡目まで反映
- 日付: 2026-10-31
- 基点: `main`(PR #351 まで)
- 関連: ADR 0031(FCIS)、ADR 0049(`tree()` のノードに band)、`lib/dsl/defaults.ts`(`connectDefaults`)、`lib/dsl/shared.ts`(`mapBands`)
- 範囲外: レイアウト(配置のパス)を値にして `|||` で切り替えること(D6)、DSL の外の言語(JSON/YAML)での合成

## 背景
ユーザーの依頼は、「全体に monad 合成のような感じで、部品を組み合わせて高度なことができるようにしたい。xmonad みたいな」。

いまの DSL には、合成の半分がある。
- `diagram().add(...)` は連結で、モノイドになっている(単位元は空の `add()`、結合的)。
- `row` / `group` / `grid` / `tree` は入れ子にできる(ADR 0049 で `tree` のノードにも任意の band が置ける)。
- `Declares` / `Refers` の型で、部品が宣言した id が `connect()` の端点として型検査される。
- 「帯 → 帯」の変換は `mapBands`(コンテナの中を辿る)と `applyConnectDefaults` / `applyWireframeDefaults` にあるが、**内部専用で、利用者が自分の変換を書いて重ねる道がない**。`connectDefaults` と `wireframeDefaults` はそれぞれ別の作りで、3 つ目の既定が要るたびに `diagram()` の中身を触ることになる。

xmonad との対応は次のとおり。

| xmonad | ここ | 状態 |
|---|---|---|
| `Layout` を `\|\|\|` で選ぶ | 配置のパス | **範囲外**(D6) |
| `LayoutModifier`(`smartBorders` など) | 部品の作り方を包む(オプションの既定) | なし → D1 |
| `ManageHook`(条件で振り分け) | 条件つきの書き換え | なし(内部の `mapBands` のみ) → D2・D3 |
| `X` モナド(状態・id を持ち回る) | 部品 = 帯と id を返す普通の関数 | 既にある(`box()` が帯・ハンドル・`Declares` を返す)。**新しい層は作らない** → D4 |
| 設定 = 値の合成(`<+>`) | `diagram({...})` の既定 | 別々 → D3 |

## Opus レビュー(1 巡目)で変えたこと
- 完成した帯に `withOpts` で値を足す案は、コンストラクタの検査(`assertBoxTone`、`assertSolidText`)と派生の値(`iconGlyph`、rich text)を飛ばす。「書かれたオプション」の記録(`GIVEN`)も connect/branch にしかなく、`connectDefaults` の後に走らせると既定を利用者の指定と誤認する。→ **オプションの合成は、帯が作られる前(コンストラクタの側)で行う**(D1)。
- `mapBands` は、関数が変えた帯の中へは降りず、パスも渡さない。`deep` の法則が成り立たない。→ 新しい走査 `rewrite` を作る(D2)。
- `Mod = <B>(b: B) => B` は、写して書き換えると `B` にならず(キャスト要)、`id` を変えると `Declares` とハンドルが嘘になる。→ 型を弱め、実行時に「種類と id が同じ」を検査する(D2)。
- `build` は既存の公開名(`lib/dsl/io.ts:82`)と衝突。`part` / `at` / `and` / `or` / `not` / `mirror` も紛らわしい。`part` / `build` の層は、普通の関数で足りるので **作らない**(D4)。
- (2 巡目)`{...b, tone}` の展開は非列挙のハンドル・`GIVEN`・`anchors` を落とし、`box()` の検査と派生(`iconGlyph`、rich text)も飛ばす → `rewrite` が返せるのは**見た目のキーだけ**(D2)。`styled` は引数の位置が帯ごとに違う → 第 1 段は options が先頭の帯だけ(D1)。`undefined` の値は既定を消さない(D1)。`inside` は wireframe の既存オプション名 → `within`。id の検査は部分木の全 id の多重集合で(D2)。
- 範囲外だった `RowOpts` に `dir` がなく、`mirror` は対象がない → 第 1 段から外す。

## 決定
### D1: `styled(ctor, defaults)` — 部品の作り方を包む
```ts
const card = styled(box, {tone: 'muted', size: 'sm'})         // box と同じ呼び方、既定だけ違う
const warn = styled(card, {tone: 'warn'})                     // 重ねられる(後のほうが勝つ)
d.add(card({id: 'a', label: '…'}), warn({id: 'b', label: '…'}))
```
- `styled<F>(c: F, defaults): F` と書き、戻り値は元の型 `F` そのもの(オーバーロード・`Declares` / `HandleOf` が保たれる)。中では `{...defaults, ...definedOnly(given)}` で元を呼ぶだけなので、検査・派生・`GIVEN` の記録は元のまま。**`given` の `undefined` の値は捨てる**(`defaults.ts` の `connect` の既定と同じ。`card({tone: props.tone})` が既定を消さない)。
- **第 1 段の対象は、options が先頭の引数の帯**(`box`、`banner`、`node`)。`group` / `row` / `grid` / `stat` は options が最後なので、`styled` の型(`Parameters` が最後のオーバーロードしか見ない、`Id` が `string` に潰れる)を試してから、第 2 段以降で足す。
- `defaults` の型は、第 1 引数のオプションの部分集合から `id` を除いたもの(全部の帯が同じ id になる)。
- 合成は関数の合成そのもの(`styled` を重ねる)。法則: `styled(c, {})` は `c` と同じ呼び出し結果、`styled(styled(c, a), b)` = `styled(c, {...a, ...b})`(テストで固定)。
- これで「`spacing(8)` や `withTone` を重ねる」ことが、帯が作られる前に済む。xmonad の `LayoutModifier` に近い。

### D2: `rewrite(bands, fn)` — 条件で帯を書き換える(ManageHook)
```ts
rewrite(bands, (b, path) => b.type === 'box' && path.some(p => p.type === 'group') ? {...b, tone: 'muted'} : undefined)
```
- `fn(band, path)` は、書き換えた帯か `undefined`(そのまま)を返す。`path` は祖先の帯の列(`tree` のノードの band は、その `tree` を path に足して辿る)。**書き換えた帯の中にも降りる**(`mapBands` との違い)。`fn` は 1 つの節に 1 回だけ。何も変えなければ同じ object を返す(コピーしない)。
- **返せるのは見た目のキーだけ**: `rewrite` は `fn` に「パッチ」(`{tone: …}` など)を返させ、`cloneBand` で写した帯にそのキーだけを `Object.assign` する(展開 `{...b}` は非列挙のハンドル・`GIVEN`・`anchors` を落とすので、`fn` が帯を丸ごと作って返すことは認めない)。許すキーは表で固定する(`tone`、`dashed`、`reveal` …。`title` / `icon` / `id` / `children` / `from` / `to` は派生の値と宣言に関わるので不可)。違えば throw。これで型・id・`Refers`・`GIVEN` が変わらないことが構造で守られ、実行時の id の検査は要らない。`wireframe` の `SHELLED`(同一性)は、写した帯にも印を引き継ぐ。
- 述語の小さな道具: `isType(t)`、`within(t)`。論理は普通の `&&` で書く(`and` / `or` / `not` は作らない)。
- 配列を返す帯(`swimlane()`、`branch()`)は、`add()` が平らにした後の個々の帯に効く。

### D3: `diagram({transform})` — 図全体の書き換え
`diagram({transform: [fn, …]})` の各 `fn` が `rewrite` の規則。`add()` の時点で、`connectDefaults` → `wireframeDefaults` → `transform` の順に適用する(`d.connect()` も `add()` を通る)。**`transform` は上書き**(利用者の指定と既定を区別しない。区別が要るのは D1 の側)。`connectDefaults` / `wireframeDefaults` は、中身を書き直さずそのまま残す(出力は変えない。重複の整理は、使われ方を見てから別に決める)。

### D4: 部品は普通の関数。`part` / `build` は作らない
`const stage = (n: string) => box({id: n, …})` が、帯・ハンドル・`Declares` を返す。複数の帯を返す部品は `const f = (…) => [a, b] as const` と書いて `d.add(...f)`(`IdsOf` は配列を平らにする。`lib/strict.ts:36-38`)。Writer/State の層を足しても、これ以上の型の利益がない。**開く条件**: 部品が複数の帯を返しつつ、その中の id を呼び出し側が文字列で `connect` する依頼が出たとき(型が `Band[]` に崩れる)。

### D5: 置き場所と規則
- `lib/dsl/styled.ts` と `lib/dsl/rewrite.ts`(純粋。FCIS の SHELL に入れない)。公開名は `styled` と `rewrite`(`test/fixtures/dsl-exports.json` に衝突がないことを確認する)。`lib/web.ts` からも出す。
- 新しい API を使わない図の出力は同一(golden で確かめる)。docs のコード例は `docs-check` を通す。

### D6: レイアウトを値にする案は採らない(今回)
配置のパスは帯ごとの closed な `switch` で、開くには全帯に手を入れる。**開く条件**: D1〜D3 を使っても、「同じ子の並びを、あとから行 ↔ 列に切り替えたい」類の依頼が 2 例以上出たとき。先に実測(帯の種類ごとの分岐の数)から始める。

## 実装で分かったこと
- `styled(styled(box, a), b)` と入れ子に書くと、TypeScript が `box` の `Id` を実体化して、id のハンドルの型が失われる。`const card = styled(box, a)` と束ねてから重ねれば保たれる(README に書いた)。
- `rewrite` に `when(pred | pred[], patch)` を足した(述語を `&&` で書く代わりの、パッチを返す定型)。

## 段取り
1. 第 1 段: D1(`styled`)。型を保つか(オーバーロード・`Declares`)を先に小さく試す。
2. 第 2 段: D2・D3(`rewrite` と `transform`)。テストは「入れ子の中まで届く」「書き換えた帯の中にも降りる」「何も変えなければ同じ object」「type / id を変えたら throw」「`SHELLED` を引き継ぐ」。
各段を別 PR にし、段ごとに Opus のレビューを受ける。

## 未決(レビューで聞くこと)
1. `styled` が、オーバーロードの多い `box()` / `group()` の型を保てるか(保てなければ、対象を絞る)。
2. (決定)名前は `transform` のまま。「既定の後に走り、勝つ」と書く。`override` は「足りない所だけ埋める」と誤読される。
3. (決定)`Refers`(connect の端点)が変わる書き換えは、第 1 版では許さない(コンパイル時の `ValidateBands` と食い違い、`GIVEN` とハンドルが古くなる)。許すなら別の ADR で。
